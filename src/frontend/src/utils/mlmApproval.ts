/**
 * mlmApproval.ts
 *
 * Full MLM approval logic.
 * Supports two paths:
 *   1. Firestore path (applyFirestoreMLMApproval) — uses getDoc + updateDoc, (value || 0) safe
 *   2. localStorage fallback (applyFullMLMApproval) — for offline / demo mode
 *
 * INCOME RULES — FIXED RUPEE amounts. Commissions go to sponsor/upline ONLY.
 * The purchasing user NEVER receives a wallet credit. Full planAmount goes to adminWallet.
 *
 *   planAmount | Direct | Level (per lvl × 10) | Pair | Max payout
 *   599        | ₹40    | ₹5                   | ₹30  | ₹120
 *   999        | ₹70    | ₹8                   | ₹50  | ₹200
 *   1999       | ₹140   | ₹16                  | ₹100 | ₹400
 *   2999       | ₹210   | ₹24                  | ₹150 | ₹600
 */

import {
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
import { PLANS } from "../context/GuccoraContext";
import { db } from "../firebase";

const DEFAULT_DIRECT = 40;
const DEFAULT_LEVEL = 5;
const DEFAULT_PAIR = 30;
const MAX_LEVELS = 10;

// ── Plan rates map ────────────────────────────────────────────────────────────

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

// ── Types ─────────────────────────────────────────────────────────────────────

export type MLMUser = {
  id?: string;
  name?: string;
  phone?: string;
  referralCode?: string;
  referredBy?: string; // referral CODE of sponsor (NOT phone)
  wallet?: number;
  status?: string;
  directCount?: number;
  pairPaid?: number;
  isActive?: boolean;
  userStatus?: string;
  planStatus?: string;
  plan?: string | number;
  planActive?: boolean;
  paidUser?: boolean;
  selectedPlan?: number;
  // legacy compat
  sponsorId?: string;
  directIncome?: number;
  levelIncome?: number;
  pairIncome?: number;
};

export type MLMPayment = {
  index?: number;
  id?: string;
  name?: string;
  phone?: string;
  plan?: string | number;
  amount?: string | number;
  utr?: string;
  upiRef?: string;
  screenshot?: string;
  screenshotUrl?: string;
  status?: string;
  userName?: string;
  userPhone?: string;
  planId?: string | number;
  userId?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPlanRates(amountNum: number, planStr: string): PlanRate {
  // Try exact planAmount first
  if (PLAN_RATES[amountNum]) return PLAN_RATES[amountNum];
  // Try parsing planStr
  const parsed = Number(planStr);
  if (!Number.isNaN(parsed) && PLAN_RATES[parsed]) return PLAN_RATES[parsed];
  // Try PLANS config as a final fallback
  const matchedPlan = PLANS.find(
    (p) => p.price === amountNum || String(p.price) === planStr,
  );
  if (matchedPlan) {
    return {
      direct: matchedPlan.directIncome ?? DEFAULT_DIRECT,
      levelPerLevel: matchedPlan.levelIncome ?? DEFAULT_LEVEL,
      pair: matchedPlan.pairIncome ?? DEFAULT_PAIR,
      maxPayout:
        (matchedPlan.directIncome ?? DEFAULT_DIRECT) +
        (matchedPlan.levelIncome ?? DEFAULT_LEVEL) * MAX_LEVELS +
        (matchedPlan.pairIncome ?? DEFAULT_PAIR),
    };
  }
  return {
    direct: DEFAULT_DIRECT,
    levelPerLevel: DEFAULT_LEVEL,
    pair: DEFAULT_PAIR,
    maxPayout: 120,
  };
}

/**
 * Guard: block any increment that equals the full plan price.
 * Returns true if the increment is safe to apply.
 */
function guardWalletIncrement(
  incrementAmount: number,
  planAmount: number,
  label: string,
): boolean {
  if (incrementAmount === planAmount && planAmount > 0) {
    console.error(
      `[mlmApproval] BLOCKED: ${label} increment (₹${incrementAmount}) equals planAmount (₹${planAmount}). Full product price must never be credited to a user wallet.`,
    );
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// FIRESTORE PATH — getDoc + updateDoc, (value || 0) safe
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Approve a payment in Firestore.
 *
 * Steps:
 *  1. Find the joining user — abort if already approved
 *  2. Activate joining user: isActive, paidUser, planActive, planId, status
 *     → NO wallet/income increment on joining user
 *  3. Credit planAmount to adminWallet ("adminWallet/main" balance)
 *  4. Direct income → sponsor
 *  5. Level income → walk 10 upline levels
 *  6. Pair income → sponsor when directCount hits even number
 *  7. Mark paymentRequest as approved
 */
export async function applyFirestoreMLMApproval(
  payment: MLMPayment,
): Promise<{ success: boolean; error?: string }> {
  const phone = String(payment.phone ?? payment.userPhone ?? "");
  const planStr = String(payment.plan ?? payment.planId ?? "");
  const amountNum = Number(payment.amount ?? payment.planId ?? 0);
  const utr = String(payment.utr ?? payment.upiRef ?? "");
  const paymentId = payment.id ?? "";

  const rates = getPlanRates(amountNum, planStr);

  // Validate total payout against plan max
  const totalMaxPayout =
    rates.direct + rates.levelPerLevel * MAX_LEVELS + rates.pair;
  if (totalMaxPayout > rates.maxPayout) {
    console.error(
      `[mlmApproval] Payout (₹${totalMaxPayout}) exceeds plan max (₹${rates.maxPayout}) for plan ₹${amountNum}`,
    );
  }

  try {
    // ── 1. Find the joining user ──────────────────────────────────────────────
    let joiningUserId = payment.userId ?? "";
    let joiningUserData: Record<string, unknown> | null = null;

    if (joiningUserId) {
      const snap = await getDoc(doc(db, "users", joiningUserId));
      if (snap.exists()) {
        joiningUserData = snap.data() as Record<string, unknown>;
      }
    }

    // Fallback: query by phone
    if (!joiningUserData) {
      const q = query(collection(db, "users"), where("phone", "==", phone));
      const qs = await getDocs(q);
      if (!qs.empty) {
        joiningUserId = qs.docs[0].id;
        joiningUserData = qs.docs[0].data() as Record<string, unknown>;
      }
    }

    if (!joiningUserData) {
      return { success: false, error: "User not found in Firestore" };
    }

    // ── 2. Duplicate protection ───────────────────────────────────────────────
    if (
      joiningUserData.isAmountAdded === true ||
      joiningUserData.approvalApplied === true
    ) {
      return { success: false, error: "Already approved" };
    }

    const batch = writeBatch(db);

    // ── 3. Activate joining user — NO wallet or income change ─────────────────
    const joiningRef = doc(db, "users", joiningUserId);
    batch.update(joiningRef, {
      isActive: true,
      planActive: true,
      planStatus: "active",
      status: "active",
      paidUser: true,
      approvalApplied: true,
      isAmountAdded: true,
      selectedPlan: amountNum,
      planId: String(amountNum),
    });

    // ── 4. Credit planAmount to adminWallet ───────────────────────────────────
    const adminWalletRef = doc(db, "adminWallet", "main");
    const adminSnap = await getDoc(adminWalletRef);
    if (adminSnap.exists()) {
      batch.update(adminWalletRef, {
        balance: increment(amountNum),
        lastUpdated: Date.now(),
      });
    } else {
      // Must use setDoc outside batch for doc creation
      await setDoc(adminWalletRef, {
        balance: amountNum,
        lastUpdated: Date.now(),
      });
    }

    // ── 5. Direct income → sponsor ────────────────────────────────────────────
    const referredByCode = String(
      joiningUserData.referredBy ?? joiningUserData.sponsorId ?? "",
    );

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

        // Fetch fresh sponsor data to get current directCount
        const freshSponsorSnap = await getDoc(doc(db, "users", sponsorUserId));
        sponsorData = freshSponsorSnap.exists()
          ? (freshSponsorSnap.data() as Record<string, unknown>)
          : (sponsorSnap.docs[0].data() as Record<string, unknown>);

        const sponsorRef = doc(db, "users", sponsorUserId);
        const newDirectCount = ((sponsorData.directCount as number) || 0) + 1;

        // Pair income calculation
        const pairs = Math.floor(newDirectCount / 2);
        const alreadyPaidPairs = (sponsorData.pairPaid as number) || 0;
        const newPairs = Math.max(0, pairs - alreadyPaidPairs);
        const pairCredit = newPairs * rates.pair;

        // Guard: block if any single credit equals full plan price
        if (!guardWalletIncrement(rates.direct, amountNum, "Direct income")) {
          return { success: false, error: "Direct income validation failed" };
        }

        const sponsorWalletIncrement = rates.direct + pairCredit;
        const sponsorUpdate: Record<string, unknown> = {
          directIncome: increment(rates.direct),
          wallet: increment(sponsorWalletIncrement),
          directCount: newDirectCount,
        };
        if (newPairs > 0) {
          sponsorUpdate.pairIncome = increment(pairCredit);
          sponsorUpdate.pairPaid = pairs;
        }

        batch.update(sponsorRef, sponsorUpdate);
      }
    }

    // ── 6. Level income — walk 10 upline levels ───────────────────────────────
    // Level 1 is the sponsor (already handled above); we still credit levelIncome
    // to the sponsor and continue up the chain for levels 2–10.
    let currentRefCode = referredByCode;
    let level = 1;

    while (currentRefCode && level <= MAX_LEVELS) {
      let levelUserId: string | null = null;
      let nextRefCode = "";

      if (level === 1 && sponsorUserId) {
        levelUserId = sponsorUserId;
        nextRefCode = String(
          sponsorData?.referredBy ?? sponsorData?.sponsorId ?? "",
        );
      } else {
        const lq = query(
          collection(db, "users"),
          where("referralCode", "==", currentRefCode),
        );
        const lSnap = await getDocs(lq);
        if (lSnap.empty) break;

        levelUserId = lSnap.docs[0].id;
        const levelData = lSnap.docs[0].data() as Record<string, unknown>;
        nextRefCode = String(levelData.referredBy ?? levelData.sponsorId ?? "");
      }

      if (!levelUserId) break;

      if (
        !guardWalletIncrement(
          rates.levelPerLevel,
          amountNum,
          `Level ${level} income`,
        )
      ) {
        // Skip this level but continue chain
        currentRefCode = nextRefCode;
        level++;
        continue;
      }

      const levelRef = doc(db, "users", levelUserId);
      batch.update(levelRef, {
        levelIncome: increment(rates.levelPerLevel),
        wallet: increment(rates.levelPerLevel),
      });

      currentRefCode = nextRefCode;
      level++;
    }

    // ── 7. Update paymentRequest status ──────────────────────────────────────
    if (paymentId) {
      const orderRef = doc(db, "paymentRequests", paymentId);
      batch.update(orderRef, {
        status: "approved",
        isAmountAdded: true,
        approvedAt: Date.now(),
        utr,
      });
    }

    // ── 8. Commit all writes atomically ──────────────────────────────────────
    await batch.commit();

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[applyFirestoreMLMApproval] Failed:", msg);
    return { success: false, error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCALSTORAGE PATH — offline / demo fallback
// ─────────────────────────────────────────────────────────────────────────────

function loadUsers(): MLMUser[] {
  try {
    return JSON.parse(localStorage.getItem("users") || "[]") as MLMUser[];
  } catch {
    return [];
  }
}

function saveUsers(users: MLMUser[]): void {
  localStorage.setItem("users", JSON.stringify(users));
}

/**
 * Full MLM approval using localStorage.
 * Used as fallback when Firestore is unavailable.
 *
 * The purchasing user is NEVER credited to wallet here either.
 *
 * Steps:
 * 1. Mark payment approved
 * 2. Push to orders
 * 3. Activate user: isActive, planActive, paidUser — NO wallet increment
 * 4. Admin wallet += planAmount
 * 5. Direct income → sponsor
 * 6. Level income → 10 upline levels
 * 7. Pair income → sponsor on even directCount
 */
export function applyFullMLMApproval(payment: MLMPayment): void {
  const payments: MLMPayment[] = (() => {
    try {
      return JSON.parse(localStorage.getItem("payments") || "[]");
    } catch {
      return [];
    }
  })();
  const orders: Record<string, unknown>[] = (() => {
    try {
      return JSON.parse(localStorage.getItem("orders") || "[]");
    } catch {
      return [];
    }
  })();
  let adminWallet: number = (() => {
    try {
      return JSON.parse(localStorage.getItem("adminWallet") || "0") as number;
    } catch {
      return 0;
    }
  })();

  let users = loadUsers();

  // Normalise payment fields
  const phone = String(payment.phone ?? payment.userPhone ?? "");
  const name = String(payment.name ?? payment.userName ?? "User");
  const planStr = String(payment.plan ?? payment.planId ?? "");
  const amountNum = Number(payment.amount ?? payment.planId ?? 0);
  const utr = String(payment.utr ?? payment.upiRef ?? "");
  const screenshot = String(payment.screenshot ?? payment.screenshotUrl ?? "");

  const rates = getPlanRates(amountNum, planStr);

  // 1. Mark payment approved in payments array (match by utr or index)
  const pmtIdx =
    typeof payment.index === "number"
      ? payment.index
      : payments.findIndex((p) => p.utr === utr || p.upiRef === utr);
  if (pmtIdx >= 0 && payments[pmtIdx]) {
    (payments[pmtIdx] as Record<string, unknown>).status = "approved";
    localStorage.setItem("payments", JSON.stringify(payments));
  }

  // 2. Add to orders
  orders.push({
    id: payment.id ?? String(Date.now()),
    name,
    phone,
    plan: planStr,
    amount: amountNum,
    utr,
    screenshot,
    status: "approved",
    isAmountAdded: true,
    userName: name,
    productName: planStr ? `₹${planStr} Plan` : "Plan",
    date: new Date().toLocaleString(),
  });
  localStorage.setItem("orders", JSON.stringify(orders));

  // Helper — find by referral code
  const findByCode = (code: string) =>
    users.find((u) => u.referralCode === code);
  // Helper — find by phone
  const findByPhone = (ph: string) => users.find((u) => u.phone === ph);

  // 3. Activate joining user — set plan + planActive = true
  //    DO NOT touch wallet or income fields for the purchasing user
  users = users.map((u) => {
    if (u.phone === phone) {
      return {
        ...u,
        status: "Active",
        isActive: true,
        userStatus: "active",
        planStatus: "active",
        plan: planStr,
        planActive: true,
        paidUser: true,
        selectedPlan: amountNum,
        planId: String(amountNum),
        // wallet, directIncome, levelIncome, pairIncome are intentionally NOT updated here
      };
    }
    return u;
  });

  const joiningUser = findByPhone(phone);

  // 4. Admin wallet — full planAmount goes to admin
  adminWallet = (adminWallet || 0) + amountNum;
  localStorage.setItem("adminWallet", JSON.stringify(adminWallet));

  // Also update the object-style wallet key for backward compat
  try {
    const adminWalletObjRaw = localStorage.getItem("guccora_admin_wallet");
    const adminWalletObj = adminWalletObjRaw
      ? (JSON.parse(adminWalletObjRaw) as {
          balance: number;
          history: unknown[];
        })
      : { balance: 0, history: [] };
    adminWalletObj.balance = adminWallet;
    adminWalletObj.history = [
      { amount: amountNum, date: new Date().toISOString(), utr },
      ...(adminWalletObj.history || []),
    ];
    localStorage.setItem(
      "guccora_admin_wallet",
      JSON.stringify(adminWalletObj),
    );
  } catch {
    // non-critical
  }

  // 5. DIRECT INCOME — credit sponsor (found via referredBy code)
  if (joiningUser?.referredBy) {
    const directUser = findByCode(joiningUser.referredBy);
    if (directUser) {
      users = users.map((u) => {
        if (u.phone === directUser.phone) {
          const newDirectCount = (u.directCount || 0) + 1;
          const pairs = Math.floor(newDirectCount / 2);
          const alreadyPaidPairs = u.pairPaid || 0;
          const newPairs = Math.max(0, pairs - alreadyPaidPairs);
          const pairCredit = newPairs * rates.pair;

          // Guard: sponsor wallet increment must not equal full plan price
          const sponsorIncrement = rates.direct + pairCredit;
          if (
            !guardWalletIncrement(
              sponsorIncrement,
              amountNum,
              "Sponsor direct+pair",
            )
          ) {
            return u;
          }

          return {
            ...u,
            wallet: (u.wallet || 0) + sponsorIncrement,
            directCount: newDirectCount,
            directIncome: (u.directIncome || 0) + rates.direct,
            pairIncome: (u.pairIncome || 0) + pairCredit,
            ...(newPairs > 0 ? { pairPaid: pairs } : {}),
          };
        }
        return u;
      });
    }
  }

  // 6. LEVEL INCOME — walk up 10 levels via referredBy chain
  let currentRef = joiningUser?.referredBy;
  let level = 1;
  while (currentRef && level <= MAX_LEVELS) {
    const levelUser = findByCode(currentRef);
    if (!levelUser) break;

    // Guard: level income must not equal full plan price
    if (
      guardWalletIncrement(
        rates.levelPerLevel,
        amountNum,
        `Level ${level} income`,
      )
    ) {
      users = users.map((u) => {
        if (u.phone === levelUser.phone) {
          return {
            ...u,
            wallet: (u.wallet || 0) + rates.levelPerLevel,
            levelIncome: (u.levelIncome || 0) + rates.levelPerLevel,
          };
        }
        return u;
      });
    }

    // Use the original (pre-update) chain to avoid infinite loops
    const nextRef = findByCode(currentRef)?.referredBy;
    currentRef = nextRef;
    level++;
  }

  // Save users
  saveUsers(users);
}
