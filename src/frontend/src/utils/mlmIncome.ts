/**
 * MLM Income Utility (client-side helpers only)
 *
 * distributeMLMIncome has been moved to the Firebase Cloud Function `approveOrder`.
 * Only income reversal and user deletion remain here, as they still run client-side
 * (triggered by admin delete actions, not order approval).
 */
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * Reverse all MLM income associated with a given orderId.
 * - Subtracts wallet amounts from users who received income from this order.
 * - Marks each transaction as reversed: true to prevent double subtraction.
 * - Also reverses admin wallet credit for admin_credit type transactions.
 *
 * @param orderId - Firestore order document ID
 */
export async function reverseMLMIncome(orderId: string): Promise<void> {
  if (!orderId) return;

  try {
    // ── 1: Query all transactions for this order ────────────────────────────
    const txnQuery = query(
      collection(db, "transactions"),
      where("orderId", "==", orderId),
    );
    const txnSnap = await getDocs(txnQuery);

    if (txnSnap.empty) return;

    // ── 2: Group non-reversed transactions by userId → sum amounts per type ─
    // Map: userId → { total: number, byType: { direct: number, level: number, pair: number } }
    type IncomeGroup = {
      total: number;
      byType: { direct: number; level: number; pair: number };
    };
    const userGroups = new Map<string, IncomeGroup>();
    let adminCreditTotal = 0;
    const txnDocsToMark: string[] = []; // doc IDs to mark as reversed

    for (const txnDoc of txnSnap.docs) {
      const data = txnDoc.data();

      // Skip already-reversed transactions
      if (data.reversed === true) continue;

      const txnType = data.type as string;
      const amount = (data.amount as number) ?? 0;
      const userId = data.userId as string;

      // Track admin credit separately
      if (txnType === "admin_credit") {
        adminCreditTotal += amount;
        txnDocsToMark.push(txnDoc.id);
        continue;
      }

      if (!userId) continue;

      txnDocsToMark.push(txnDoc.id);

      if (!userGroups.has(userId)) {
        userGroups.set(userId, {
          total: 0,
          byType: { direct: 0, level: 0, pair: 0 },
        });
      }

      const group = userGroups.get(userId)!;
      group.total += amount;

      if (txnType === "direct") {
        group.byType.direct += amount;
      } else if (txnType === "level") {
        group.byType.level += amount;
      } else if (txnType === "pair") {
        group.byType.pair += amount;
      }
    }

    // ── 3: Subtract income from each affected user's wallet ─────────────────
    const userUpdatePromises = Array.from(userGroups.entries()).map(
      async ([userId, group]) => {
        try {
          const updates: Record<string, unknown> = {
            wallet: increment(-group.total),
          };
          if (group.byType.direct > 0) {
            updates.directIncome = increment(-group.byType.direct);
          }
          if (group.byType.level > 0) {
            updates.levelIncome = increment(-group.byType.level);
          }
          if (group.byType.pair > 0) {
            updates.pairIncome = increment(-group.byType.pair);
          }
          await updateDoc(doc(db, "users", userId), updates);
        } catch {
          // ignore individual failures
        }
      },
    );

    // ── 4: Subtract admin credit from adminWallet/main ──────────────────────
    let adminUpdatePromise: Promise<void> = Promise.resolve();
    if (adminCreditTotal > 0) {
      adminUpdatePromise = (async () => {
        try {
          await updateDoc(doc(db, "adminWallet", "main"), {
            balance: increment(-adminCreditTotal),
          });
        } catch {
          // ignore if admin wallet doc doesn't exist
        }
      })();
    }

    // Run all wallet updates in parallel
    await Promise.all([...userUpdatePromises, adminUpdatePromise]);

    // ── 5: Mark all processed transactions as reversed ─────────────────────
    const markPromises = txnDocsToMark.map(async (txnDocId) => {
      try {
        await updateDoc(doc(db, "transactions", txnDocId), {
          reversed: true,
        });
      } catch {
        // ignore
      }
    });
    await Promise.all(markPromises);
  } catch {
    // Top-level catch — fail silently to avoid crashing caller
  }
}

/**
 * Safely delete a user and clean up all related data.
 * - Reverses all income from approved orders before deleting.
 * - Deletes all related orders, transactions, and the user document.
 *
 * @param userId - Firestore user document ID
 */
export async function deleteUser(userId: string): Promise<void> {
  if (!userId) return;

  // ── 1: Query all orders for this user ─────────────────────────────────────
  let orderIds: string[] = [];
  try {
    const ordersQuery = query(
      collection(db, "orders"),
      where("userId", "==", userId),
    );
    const ordersSnap = await getDocs(ordersQuery);

    // ── 2: Reverse income for each approved order ────────────────────────────
    const reversePromises: Promise<void>[] = [];
    for (const orderDoc of ordersSnap.docs) {
      const orderData = orderDoc.data();
      if (orderData.status === "approved") {
        reversePromises.push(reverseMLMIncome(orderDoc.id));
      }
    }
    // Wait for all reversals before deleting
    await Promise.all(reversePromises);

    orderIds = ordersSnap.docs.map((d) => d.id);
  } catch {
    // Continue even if orders query fails
  }

  // ── 3: Delete all order documents for this user ────────────────────────────
  const deleteOrderPromises = orderIds.map(async (orderId) => {
    try {
      await deleteDoc(doc(db, "orders", orderId));
    } catch {
      // ignore
    }
  });
  await Promise.all(deleteOrderPromises);

  // ── 4a: Delete transactions where userId == userId ─────────────────────────
  try {
    const txnByUserQuery = query(
      collection(db, "transactions"),
      where("userId", "==", userId),
    );
    const txnByUserSnap = await getDocs(txnByUserQuery);
    const deleteTxnByUserPromises = txnByUserSnap.docs.map(async (txnDoc) => {
      try {
        await deleteDoc(doc(db, "transactions", txnDoc.id));
      } catch {
        // ignore
      }
    });
    await Promise.all(deleteTxnByUserPromises);
  } catch {
    // ignore
  }

  // ── 4b: Delete transactions where fromUserId == userId ────────────────────
  try {
    const txnFromUserQuery = query(
      collection(db, "transactions"),
      where("fromUserId", "==", userId),
    );
    const txnFromUserSnap = await getDocs(txnFromUserQuery);
    const deleteTxnFromUserPromises = txnFromUserSnap.docs.map(
      async (txnDoc) => {
        try {
          await deleteDoc(doc(db, "transactions", txnDoc.id));
        } catch {
          // ignore
        }
      },
    );
    await Promise.all(deleteTxnFromUserPromises);
  } catch {
    // ignore
  }

  // ── 5: Delete the user document ───────────────────────────────────────────
  try {
    await deleteDoc(doc(db, "users", userId));
  } catch {
    // ignore
  }
}
