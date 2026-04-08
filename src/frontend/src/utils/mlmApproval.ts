/**
 * mlmApproval.ts — v2 FORCED REBUILD
 *
 * Full MLM approval logic.
 * Supports two paths:
 *   1. Firestore path (applyFirestoreMLMApproval) — uses writeBatch, (value || 0) guards
 *   2. localStorage fallback (applyFullMLMApproval) — offline/demo mode
 *
 * INCOME RULES — FIXED RUPEE amounts. Only sponsor/upline receive commissions.
 * The purchasing user NEVER receives a wallet credit.
 * Full planAmount goes to adminWallet ONLY.
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

const MAX_LEVELS = 10;

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

export type MLMUser = {
  id?: string;
  name?: string;
  phone?: string;
  referralCode?: string;
  referredBy?: string;
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

function getPlanRates(amountNum: number, planStr: string): PlanRate {
  if (PLAN_RATES[amountNum]) return PLAN_RATES[amountNum];
  const parsed = Number(planStr);
  if (!Number.isNaN(parsed) && PLAN_RATES[parsed]) return PLAN_RATES[parsed];
  const matchedPlan = PLANS.find(
    (p) => p.price === amountNum || String(p.price) === planStr,
  );
  if (matchedPlan) {
    return {
      direct: matchedPlan.directIncome,
      levelPerLevel: matchedPlan.levelIncome,
      pair: matchedPlan.pairIncome,
      maxPayout:
        matchedPlan.directIncome +
        matchedPlan.levelIncome * MAX_LEVELS +
        matchedPlan.pairIncome,
    };
  }
  return DEFAULT_RATE;
}

/**
 * guardWalletIncrement: block any increment equal to full plan price.
 * Returns true if the increment is safe.
 */
function guardWalletIncrement(
  incrementAmount: number,
  planAmount: number,
  label: string,
): boolean {
  if (incrementAmount === planAmount && planAmount > 0) {
    console.error(
      `[mlmApproval] BLOCKED: ${label} increment (₹${incrementAmount}) equals planAmount (₹${planAmount}). Full product price must NEVER be credited to a user wallet.`,
    );
    return false;
  }
  return true;
}

/**
 * validatePayout: total commissions must not exceed plan max.
 */
function validatePayout(rates: PlanRate): boolean {
  const total = rates.direct + rates.levelPerLevel * MAX_LEVELS + rates.pair;
  if (total > rates.maxPayout) {
    console.error(
      `[mlmApproval] Payout ₹${total} exceeds plan max ₹${rates.maxPayout}`,
    );
    return false;
  }
  return true;
}

// ── FIRESTORE PATH ────────────────────────────────────────────────────────────

/**
 * Approve a payment via Firestore:
 * 1. Activate purchasing user (isActive, paidUser, planActive) — NO wallet change
 * 2. Credit planAmount to adminWallet/main
 * 3. Direct income → sponsor (referredBy chain)
 * 4. Level income → 10 upline levels
 * 5. Pair income → sponsor on even directCount
 * 6. Mark payment as approved
 * All writes in a single writeBatch.
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
  validatePayout(rates);

  try {
    // ── 1. Find the joining user ──────────────────────────────────────────────
    let joiningUserId = payment.userId ?? "";
    let joiningUserData: Record<string, unknown> | null = null;

    if (joiningUserId) {
      const snap = await getDoc(doc(db, "users", joiningUserId));
      if (snap.exists())
        joiningUserData = snap.data() as Record<string, unknown>;
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

    if (!joiningUserData) {
      return { success: false, error: "User not found in Firestore" };
    }

    // Duplicate protection
    if (
      joiningUserData.isAmountAdded === true ||
      joiningUserData.approvalApplied === true
    ) {
      return { success: false, error: "Already approved" };
    }

    const batch = writeBatch(db);

    // ── 2. Activate joining user — NO wallet/income increment on purchasing user ──
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

    // ── 3. Credit full planAmount to adminWallet/main ─────────────────────────
    const adminWalletRef = doc(db, "adminWallet", "main");
    const adminSnap = await getDoc(adminWalletRef);
    if (adminSnap.exists()) {
      batch.update(adminWalletRef, {
        balance: increment(amountNum),
        lastUpdated: Date.now(),
      });
    } else {
      // Create if not exists (cannot use batch.set after batch.update, so setDoc separately)
      await setDoc(adminWalletRef, {
        balance: amountNum,
        lastUpdated: Date.now(),
      });
    }

    // ── 4. Direct income → sponsor ────────────────────────────────────────────
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

        // Fetch fresh sponsor data to get accurate directCount
        const freshSponsorSnap = await getDoc(doc(db, "users", sponsorUserId));
        sponsorData = freshSponsorSnap.exists()
          ? (freshSponsorSnap.data() as Record<string, unknown>)
          : (sponsorSnap.docs[0].data() as Record<string, unknown>);

        const sponsorRef = doc(db, "users", sponsorUserId);
        const newDirectCount = ((sponsorData.directCount as number) || 0) + 1;
        const pairs = Math.floor(newDirectCount / 2);
        const alreadyPaidPairs = (sponsorData.pairPaid as number) || 0;
        const newPairs = Math.max(0, pairs - alreadyPaidPairs);
        const pairCredit = newPairs * rates.pair;

        // Guard: direct income must not equal full plan price
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

    // ── 5. Level income — walk 10 upline levels ───────────────────────────────
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
        // Add levelIncome to sponsor on top of the direct+pair batch already queued
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
        nextRefCode = String(levelData.referredBy ?? levelData.sponsorId ?? "");

        if (
          !guardWalletIncrement(
            rates.levelPerLevel,
            amountNum,
            `Level ${level} income`,
          )
        ) {
          currentRefCode = nextRefCode;
          level++;
          continue;
        }

        const levelRef = doc(db, "users", levelUserId);
        batch.update(levelRef, {
          levelIncome: increment(rates.levelPerLevel),
          wallet: increment(rates.levelPerLevel),
        });
      }

      currentRefCode = nextRefCode;
      level++;
    }

    // ── 6. Update payment status ──────────────────────────────────────────────
    if (paymentId) {
      const orderRef = doc(db, "paymentRequests", paymentId);
      batch.update(orderRef, {
        status: "approved",
        isAmountAdded: true,
        approvedAt: Date.now(),
        utr,
      });
    }

    // ── 7. Commit atomically ──────────────────────────────────────────────────
    await batch.commit();

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[applyFirestoreMLMApproval] Failed:", msg);
    return { success: false, error: msg };
  }
}

// ── LOCALSTORAGE FALLBACK ─────────────────────────────────────────────────────

function loadUsers(): MLMUser[] {
  try {
    return JSON.parse(localStorage.getItem("users") || "[]") as MLMUser[];
  } catch {
    return [];
  }
}

function saveUsers(users: MLMUser[]): void {
  try {
    localStorage.setItem("users", JSON.stringify(users));
  } catch {
    // ignore
  }
}

/**
 * applyFullMLMApproval — localStorage fallback when Firestore is unavailable.
 * The purchasing user NEVER receives a wallet credit here either.
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
      const raw = localStorage.getItem("adminWallet");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed === "number") return parsed;
      }
      return 0;
    } catch {
      return 0;
    }
  })();

  let users = loadUsers();

  const phone = String(payment.phone ?? payment.userPhone ?? "");
  const name = String(payment.name ?? payment.userName ?? "User");
  const planStr = String(payment.plan ?? payment.planId ?? "");
  const amountNum = Number(payment.amount ?? payment.planId ?? 0);
  const utr = String(payment.utr ?? payment.upiRef ?? "");
  const screenshot = String(payment.screenshot ?? payment.screenshotUrl ?? "");
  const rates = getPlanRates(amountNum, planStr);

  // 1. Mark payment approved
  const pmtIdx =
    typeof payment.index === "number"
      ? payment.index
      : payments.findIndex((p) => p.utr === utr || p.upiRef === utr);
  if (pmtIdx >= 0 && payments[pmtIdx]) {
    (payments[pmtIdx] as Record<string, unknown>).status = "approved";
    try {
      localStorage.setItem("payments", JSON.stringify(payments));
    } catch {
      // ignore
    }
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
  try {
    localStorage.setItem("orders", JSON.stringify(orders));
  } catch {
    // ignore
  }

  const findByCode = (code: string) =>
    users.find((u) => u.referralCode === code);
  const findByPhone = (ph: string) => users.find((u) => u.phone === ph);

  // 3. Activate joining user — NO wallet/income change on purchasing user
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
        // wallet, directIncome, levelIncome, pairIncome intentionally NOT updated
      };
    }
    return u;
  });

  const joiningUser = findByPhone(phone);

  // 4. Admin wallet — full planAmount
  adminWallet = (adminWallet || 0) + amountNum;
  try {
    localStorage.setItem("adminWallet", JSON.stringify(adminWallet));
  } catch {
    // ignore
  }

  // Also sync to object-style key
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

  // 5. DIRECT INCOME → sponsor
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

  // 6. LEVEL INCOME — walk 10 upline levels
  let currentRef = joiningUser?.referredBy;
  let level = 1;
  while (currentRef && level <= MAX_LEVELS) {
    const levelUser = findByCode(currentRef);
    if (!levelUser) break;

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

    const originalUser = findByCode(currentRef);
    currentRef = originalUser?.referredBy;
    level++;
  }

  saveUsers(users);
}
