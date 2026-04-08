/**
 * mlmIncome.ts — client-side income reversal helpers.
 * distributeMLMIncome has been moved to the Firebase Cloud Function `approveOrder`.
 * Only income reversal and user deletion remain here (for admin delete actions).
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
 */
export async function reverseMLMIncome(orderId: string): Promise<void> {
  if (!orderId) return;
  try {
    const txnQuery = query(
      collection(db, "transactions"),
      where("orderId", "==", orderId),
    );
    const txnSnap = await getDocs(txnQuery);
    if (txnSnap.empty) return;

    type IncomeGroup = {
      total: number;
      byType: { direct: number; level: number; pair: number };
    };
    const userGroups = new Map<string, IncomeGroup>();
    let adminCreditTotal = 0;
    const txnDocsToMark: string[] = [];

    for (const txnDoc of txnSnap.docs) {
      const data = txnDoc.data();
      if (data.reversed === true) continue;

      const txnType = data.type as string;
      const amount = (data.amount as number) ?? 0;
      const userId = data.userId as string;

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
      if (txnType === "direct") group.byType.direct += amount;
      else if (txnType === "level") group.byType.level += amount;
      else if (txnType === "pair") group.byType.pair += amount;
    }

    const userUpdatePromises = Array.from(userGroups.entries()).map(
      async ([userId, group]) => {
        try {
          const updates: Record<string, unknown> = {
            wallet: increment(-group.total),
          };
          if (group.byType.direct > 0)
            updates.directIncome = increment(-group.byType.direct);
          if (group.byType.level > 0)
            updates.levelIncome = increment(-group.byType.level);
          if (group.byType.pair > 0)
            updates.pairIncome = increment(-group.byType.pair);
          await updateDoc(doc(db, "users", userId), updates);
        } catch {
          // ignore
        }
      },
    );

    let adminUpdatePromise: Promise<void> = Promise.resolve();
    if (adminCreditTotal > 0) {
      adminUpdatePromise = (async () => {
        try {
          await updateDoc(doc(db, "adminWallet", "main"), {
            balance: increment(-adminCreditTotal),
          });
        } catch {
          // ignore
        }
      })();
    }

    await Promise.all([...userUpdatePromises, adminUpdatePromise]);

    const markPromises = txnDocsToMark.map(async (txnDocId) => {
      try {
        await updateDoc(doc(db, "transactions", txnDocId), { reversed: true });
      } catch {
        // ignore
      }
    });
    await Promise.all(markPromises);
  } catch {
    // fail silently
  }
}

/**
 * deleteUser — safely delete a user and all related data.
 */
export async function deleteUser(userId: string): Promise<void> {
  if (!userId) return;

  let orderIds: string[] = [];
  try {
    const ordersQuery = query(
      collection(db, "orders"),
      where("userId", "==", userId),
    );
    const ordersSnap = await getDocs(ordersQuery);
    const reversePromises: Promise<void>[] = [];
    for (const orderDoc of ordersSnap.docs) {
      if ((orderDoc.data() as Record<string, unknown>).status === "approved") {
        reversePromises.push(reverseMLMIncome(orderDoc.id));
      }
    }
    await Promise.all(reversePromises);
    orderIds = ordersSnap.docs.map((d) => d.id);
  } catch {
    // continue
  }

  const deleteOrderPromises = orderIds.map(async (orderId) => {
    try {
      await deleteDoc(doc(db, "orders", orderId));
    } catch {
      // ignore
    }
  });
  await Promise.all(deleteOrderPromises);

  try {
    const txnByUserQuery = query(
      collection(db, "transactions"),
      where("userId", "==", userId),
    );
    const txnByUserSnap = await getDocs(txnByUserQuery);
    await Promise.all(
      txnByUserSnap.docs.map(async (txnDoc) => {
        try {
          await deleteDoc(doc(db, "transactions", txnDoc.id));
        } catch {
          // ignore
        }
      }),
    );
  } catch {
    // ignore
  }

  try {
    const txnFromUserQuery = query(
      collection(db, "transactions"),
      where("fromUserId", "==", userId),
    );
    const txnFromUserSnap = await getDocs(txnFromUserQuery);
    await Promise.all(
      txnFromUserSnap.docs.map(async (txnDoc) => {
        try {
          await deleteDoc(doc(db, "transactions", txnDoc.id));
        } catch {
          // ignore
        }
      }),
    );
  } catch {
    // ignore
  }

  try {
    await deleteDoc(doc(db, "users", userId));
  } catch {
    // ignore
  }
}
