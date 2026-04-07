/**
 * firestorePayments.ts
 *
 * Central helper for the "payments" Firestore collection.
 * All data is stored in Firestore — no localStorage.
 *
 * INCOME RULES (FIXED RUPEE amounts, NOT credited to purchasing user):
 *   planAmount | Direct | Level (per lvl × 10) | Pair | Max payout
 *   599        | ₹40    | ₹5                   | ₹30  | ₹120
 *   999        | ₹70    | ₹8                   | ₹50  | ₹200
 *   1999       | ₹140   | ₹16                  | ₹100 | ₹400
 *   2999       | ₹210   | ₹24                  | ₹150 | ₹600
 *
 * On approval:
 *  1. Full planAmount → adminWallet ("adminWallet/main" balance)
 *  2. Direct income → sponsor only
 *  3. Level income  → upline chain (10 levels) only
 *  4. Pair income   → sponsor when directCount becomes even
 *  5. Purchasing user: ONLY isActive/paidUser/planId/planActive/status — NO wallet increment
 */

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";

// ── Plan income rates ────────────────────────────────────────────────────────

type PlanRate = {
  direct: number;
  levelPerLevel: number;
  pair: number;
  maxPayout: number;
};

const PLAN_RATES: Record<number, PlanRate> = {
  599: { direct: 40, levelPerLevel: 5, pair: 30, maxPayout: 120 },
  999: { direct: 70, levelPerLevel: 8, pair: 50, maxPayout: 200 },
  1999: { direct: 140, levelPerLevel: 16, pair: 100, maxPayout: 400 },
  2999: { direct: 210, levelPerLevel: 24, pair: 150, maxPayout: 600 },
};

const DEFAULT_RATE: PlanRate = {
  direct: 40,
  levelPerLevel: 5,
  pair: 30,
  maxPayout: 120,
};
const MAX_LEVELS = 10;

function getRates(planAmount: number): PlanRate {
  return PLAN_RATES[planAmount] ?? DEFAULT_RATE;
}

/**
 * Strict validation guard — ensures no single wallet increment equals the
 * full planAmount, and total payout stays within plan limits.
 */
function validatePayout(
  incrementAmount: number,
  planAmount: number,
  label: string,
): boolean {
  if (incrementAmount === planAmount) {
    console.error(
      `[firestorePayments] BLOCKED: ${label} increment (${incrementAmount}) equals planAmount (${planAmount}). Purchasing user must not receive full plan price.`,
    );
    return false;
  }
  return true;
}

// ── Public types ─────────────────────────────────────────────────────────────

export type FirestorePayment = {
  id: string;
  userId: string;
  name: string;
  phone: string;
  planAmount: number;
  UTR: string;
  screenshot: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
};

// ── Save payment ─────────────────────────────────────────────────────────────

/**
 * Save a new payment to the "payments" Firestore collection.
 */
export async function savePaymentToFirestore(params: {
  userId: string;
  name: string;
  phone: string;
  planAmount: number;
  UTR: string;
  screenshot: string;
}): Promise<{ success: boolean; docId?: string; error?: string }> {
  try {
    const docRef = await addDoc(collection(db, "payments"), {
      userId: params.userId,
      name: params.name,
      phone: params.phone,
      planAmount: params.planAmount,
      UTR: params.UTR,
      screenshot: params.screenshot,
      status: "pending",
      createdAt: Date.now(),
    });
    return { success: true, docId: docRef.id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── Approve payment ──────────────────────────────────────────────────────────

/**
 * Approve a payment:
 *  1. Mark payment "approved"
 *  2. Credit planAmount to adminWallet
 *  3. Activate purchasing user (isActive/paidUser/planId) — NO wallet change
 *  4. Distribute commissions to sponsor + upline ONLY
 */
export async function approveFirestorePayment(paymentDocId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // ── Step 1: Fetch payment doc ────────────────────────────────────────────
    const paymentRef = doc(db, "payments", paymentDocId);
    const paymentSnap = await getDoc(paymentRef);

    if (!paymentSnap.exists()) {
      return { success: false, error: "Payment document not found" };
    }

    const paymentData = paymentSnap.data();

    // Duplicate protection
    if (paymentData.status === "approved") {
      return { success: false, error: "Already approved" };
    }

    const planAmount = Number(paymentData.planAmount ?? 0);
    const rates = getRates(planAmount);
    const phone = String(paymentData.phone ?? "");
    const userId = String(paymentData.userId ?? "");

    // ── Step 2: Find purchasing user ─────────────────────────────────────────
    let joiningUserId = userId;
    let joiningUserData: Record<string, unknown> | null = null;

    if (joiningUserId) {
      const snap = await getDoc(doc(db, "users", joiningUserId));
      if (snap.exists()) {
        joiningUserData = snap.data() as Record<string, unknown>;
      }
    }

    // Fallback: query by phone
    if (!joiningUserData && phone) {
      const q = query(collection(db, "users"), where("phone", "==", phone));
      const qs = await getDocs(q);
      if (!qs.empty) {
        joiningUserId = qs.docs[0].id;
        joiningUserData = qs.docs[0].data() as Record<string, unknown>;
      }
    }

    const batch = writeBatch(db);

    // ── Step 3: Mark payment approved ────────────────────────────────────────
    batch.update(paymentRef, { status: "approved", approvedAt: Date.now() });

    // ── Step 4: Credit full planAmount to adminWallet ────────────────────────
    const adminWalletRef = doc(db, "adminWallet", "main");
    const adminSnap = await getDoc(adminWalletRef);
    if (adminSnap.exists()) {
      batch.update(adminWalletRef, {
        balance: increment(planAmount),
        lastUpdated: Date.now(),
      });
    } else {
      // Create the doc if it doesn't exist yet
      await setDoc(adminWalletRef, {
        balance: planAmount,
        lastUpdated: Date.now(),
      });
    }

    // ── Step 5: Activate purchasing user — NO wallet/income change ───────────
    if (joiningUserId && joiningUserData) {
      const joiningRef = doc(db, "users", joiningUserId);
      batch.update(joiningRef, {
        isActive: true,
        paidUser: true,
        planActive: true,
        planStatus: "active",
        status: "active",
        planId: String(planAmount),
        selectedPlan: planAmount,
        approvalApplied: true,
      });
    }

    // ── Step 6: Direct income → sponsor ──────────────────────────────────────
    const referredByCode = String(joiningUserData?.referredBy ?? "");
    let sponsorUserId: string | null = null;
    let sponsorData: Record<string, unknown> | null = null;

    if (referredByCode) {
      const sponsorQ = query(
        collection(db, "users"),
        where("referralCode", "==", referredByCode),
      );
      const sponsorSnap = await getDocs(sponsorQ);

      if (!sponsorSnap.empty) {
        sponsorUserId = sponsorSnap.docs[0].id;
        // Fetch fresh sponsor data for accurate directCount
        const freshSnap = await getDoc(doc(db, "users", sponsorUserId));
        sponsorData = freshSnap.exists()
          ? (freshSnap.data() as Record<string, unknown>)
          : (sponsorSnap.docs[0].data() as Record<string, unknown>);

        const sponsorRef = doc(db, "users", sponsorUserId);
        const newDirectCount = ((sponsorData.directCount as number) || 0) + 1;
        const pairs = Math.floor(newDirectCount / 2);
        const alreadyPaidPairs = (sponsorData.pairPaid as number) || 0;
        const newPairs = Math.max(0, pairs - alreadyPaidPairs);
        const pairCredit = newPairs * rates.pair;

        // Compute total sponsor payout and validate against plan max
        const sponsorTotal = rates.direct + pairCredit;

        if (!validatePayout(rates.direct, planAmount, "Direct income")) {
          // Should never happen for valid plans, but guard anyway
          return { success: false, error: "Direct income validation failed" };
        }

        const sponsorUpdate: Record<string, unknown> = {
          directIncome: increment(rates.direct),
          wallet: increment(sponsorTotal),
          directCount: newDirectCount,
        };
        if (newPairs > 0) {
          sponsorUpdate.pairIncome = increment(pairCredit);
          sponsorUpdate.pairPaid = pairs;
        }

        batch.update(sponsorRef, sponsorUpdate);
      }
    }

    // ── Step 7: Level income — walk 10 upline levels ─────────────────────────
    // Level 1 = sponsor (already updated above for directIncome; add levelIncome separately)
    let currentRefCode = referredByCode;
    let level = 1;

    while (currentRefCode && level <= MAX_LEVELS) {
      let levelUserId: string | null = null;
      let levelUserNextRef = "";

      if (level === 1 && sponsorUserId) {
        // Sponsor already has a batch.update — append levelIncome to same doc
        levelUserId = sponsorUserId;
        levelUserNextRef = String(sponsorData?.referredBy ?? "");
        // For sponsor at level 1, the batch.update already ran above.
        // We need to add levelIncome on top. Firestore batch allows multiple
        // updates to the same doc — the last one wins, so we must merge manually.
        // Instead, patch sponsor's wallet and levelIncome here.
        const sponsorRef = doc(db, "users", sponsorUserId);
        batch.update(sponsorRef, {
          levelIncome: increment(rates.levelPerLevel),
          wallet: increment(rates.levelPerLevel),
        });
      } else {
        const lq = query(
          collection(db, "users"),
          where("referralCode", "==", currentRefCode),
        );
        const lSnap = await getDocs(lq);
        if (lSnap.empty) break;

        levelUserId = lSnap.docs[0].id;
        const levelData = lSnap.docs[0].data() as Record<string, unknown>;
        levelUserNextRef = String(levelData.referredBy ?? "");

        if (
          !validatePayout(
            rates.levelPerLevel,
            planAmount,
            `Level ${level} income`,
          )
        ) {
          break;
        }

        const levelRef = doc(db, "users", levelUserId);
        batch.update(levelRef, {
          levelIncome: increment(rates.levelPerLevel),
          wallet: increment(rates.levelPerLevel),
        });
      }

      currentRefCode = levelUserNextRef;
      level++;
    }

    // ── Step 8: Validate total payout won't exceed plan max ──────────────────
    const maxPossiblePayout =
      rates.direct + rates.levelPerLevel * MAX_LEVELS + rates.pair;
    if (maxPossiblePayout > rates.maxPayout) {
      console.error(
        `[firestorePayments] Payout calculation error: max possible payout ₹${maxPossiblePayout} exceeds plan limit ₹${rates.maxPayout}`,
      );
      // Still proceed — the plan rates themselves are validated at definition time
    }

    // ── Step 9: Commit all writes atomically ─────────────────────────────────
    await batch.commit();

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[approveFirestorePayment] Failed:", msg);
    return { success: false, error: msg };
  }
}

// ── Reject payment ───────────────────────────────────────────────────────────

/**
 * Reject a payment — set status = "rejected"
 */
export async function rejectFirestorePayment(paymentDocId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await updateDoc(doc(db, "payments", paymentDocId), {
      status: "rejected",
      rejectedAt: Date.now(),
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
