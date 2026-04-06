/**
 * mlmApproval.ts
 *
 * Full MLM approval logic.
 * Supports two paths:
 *   1. Firestore path (applyFirestoreMLMApproval) — uses getDoc + updateDoc, (value || 0) safe
 *   2. localStorage fallback (applyFullMLMApproval) — for offline / demo mode
 *
 * Income config (per plan):
 *   ₹599  → direct ₹40,  level ₹5,  pair ₹30
 *   ₹999  → direct ₹70,  level ₹8,  pair ₹50
 *   ₹1999 → direct ₹140, level ₹16, pair ₹100
 *   ₹2999 → direct ₹210, level ₹24, pair ₹150
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
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
  plan?: string | number; // active plan (e.g. "599", "1999")
  planActive?: boolean; // true after admin approves payment
  paidUser?: boolean; // true after first successful payment
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

// ─────────────────────────────────────────────────────────────────────────────
// FIRESTORE PATH — getDoc + updateDoc, (value || 0) safe
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Approve a payment in Firestore.
 *
 * Steps:
 *  1. getDoc the joining user — abort if already approved
 *  2. updateDoc the user: isActive=true, planActive=true, planStatus=active
 *     + directIncome += DIRECT, levelIncome += LEVEL*10, pairIncome += PAIR
 *     + wallet += (DIRECT + LEVEL*10 + PAIR)
 *  3. Find sponsor via referredBy — updateDoc sponsor's directIncome/wallet
 *  4. Walk 10 upline levels — updateDoc each level's levelIncome/wallet
 *  5. Pair income — updateDoc sponsor if pair threshold crossed
 *  6. Update order/paymentRequest status in Firestore
 */
export async function applyFirestoreMLMApproval(
  payment: MLMPayment,
): Promise<{ success: boolean; error?: string }> {
  const phone = String(payment.phone ?? payment.userPhone ?? "");
  const planStr = String(payment.plan ?? payment.planId ?? "");
  const amountNum = Number(payment.amount ?? payment.planId ?? 0);
  const utr = String(payment.utr ?? payment.upiRef ?? "");
  const paymentId = payment.id ?? "";

  // Resolve income amounts from PLANS config
  const matchedPlan = PLANS.find(
    (p) => p.price === amountNum || String(p.price) === planStr,
  );
  const DIRECT = matchedPlan?.directIncome ?? DEFAULT_DIRECT;
  const LEVEL = matchedPlan?.levelIncome ?? DEFAULT_LEVEL;
  const PAIR = matchedPlan?.pairIncome ?? DEFAULT_PAIR;
  const totalUserIncome = DIRECT + LEVEL * MAX_LEVELS + PAIR;

  try {
    // ── 1. Find the joining user by phone ────────────────────────────────────
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
      // No Firestore record — fall back to localStorage path
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

    // ── 3. Activate the joining user ──────────────────────────────────────────
    // Use (value || 0) for every income field to avoid null errors
    const joiningRef = doc(db, "users", joiningUserId);
    batch.update(joiningRef, {
      isActive: true,
      planActive: true,
      planStatus: "active",
      paidUser: true,
      approvalApplied: true,
      selectedPlan: amountNum,
      // Income fields: always add to existing value (or 0 if null)
      directIncome: increment(DIRECT),
      levelIncome: increment(LEVEL * MAX_LEVELS),
      pairIncome: increment(PAIR),
      wallet: increment(totalUserIncome),
    });

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
        sponsorData = sponsorSnap.docs[0].data() as Record<string, unknown>;

        // Fetch fresh sponsor data to get current directCount
        const freshSponsorSnap = await getDoc(doc(db, "users", sponsorUserId));
        if (freshSponsorSnap.exists()) {
          sponsorData = freshSponsorSnap.data() as Record<string, unknown>;
        }

        const sponsorRef = doc(db, "users", sponsorUserId);
        const newDirectCount = ((sponsorData.directCount as number) || 0) + 1;

        // Calculate pair income
        const pairs = Math.floor(newDirectCount / 2);
        const alreadyPaidPairs = (sponsorData.pairPaid as number) || 0;
        const newPairs = Math.max(0, pairs - alreadyPaidPairs);
        const pairCredit = newPairs * PAIR;

        const sponsorUpdate: Record<string, unknown> = {
          directIncome: increment(DIRECT),
          wallet: increment(DIRECT + pairCredit),
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
      // For level 1 the sponsor was already handled above — still credit levelIncome
      let levelUserId: string | null = null;
      let levelUserData: Record<string, unknown> | null = null;

      if (level === 1 && sponsorUserId) {
        levelUserId = sponsorUserId;
        levelUserData = sponsorData;
      } else {
        const lq = query(
          collection(db, "users"),
          where("referralCode", "==", currentRefCode),
        );
        const lSnap = await getDocs(lq);
        if (lSnap.empty) break;
        levelUserId = lSnap.docs[0].id;
        levelUserData = lSnap.docs[0].data() as Record<string, unknown>;
      }

      if (!levelUserId) break;

      // Don't double-update the sponsor ref if already in batch (batch handles it)
      if (level > 1) {
        const levelRef = doc(db, "users", levelUserId);
        batch.update(levelRef, {
          levelIncome: increment(LEVEL),
          wallet: increment(LEVEL),
        });
      }

      // Move up to next level
      currentRefCode = String(
        levelUserData?.referredBy ?? levelUserData?.sponsorId ?? "",
      );
      level++;
    }

    // ── 6. Update order/paymentRequest status ─────────────────────────────────
    if (paymentId) {
      const orderRef = doc(db, "paymentRequests", paymentId);
      batch.update(orderRef, {
        status: "approved",
        isAmountAdded: true,
        approvedAt: Date.now(),
        utr,
      });
    }

    // ── 7. Commit all writes atomically ───────────────────────────────────────
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
 * Steps:
 * 1. Mark payment approved
 * 2. Push to orders
 * 3. Activate user + set plan + planActive = true
 * 4. Direct income
 * 5. Level income (10 levels)
 * 6. Pair income (every 2 directs = 1 pair @ PAIR_INCOME)
 * 7. Admin wallet
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
  const joiningUser = findByPhone(phone);

  // Resolve income amounts from plan
  const matchedPlan = PLANS.find(
    (p) => p.price === amountNum || String(p.price) === planStr,
  );
  const DIRECT = matchedPlan?.directIncome ?? DEFAULT_DIRECT;
  const LEVEL = matchedPlan?.levelIncome ?? DEFAULT_LEVEL;
  const PAIR = matchedPlan?.pairIncome ?? DEFAULT_PAIR;
  const totalUserIncome = DIRECT + LEVEL * MAX_LEVELS + PAIR;

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
        // Credit income to the joining user as well
        directIncome: (u.directIncome || 0) + DIRECT,
        levelIncome: (u.levelIncome || 0) + LEVEL * MAX_LEVELS,
        pairIncome: (u.pairIncome || 0) + PAIR,
        wallet: (u.wallet || 0) + totalUserIncome,
      };
    }
    return u;
  });

  // 4. DIRECT INCOME — credit sponsor (found via referredBy code)
  if (joiningUser?.referredBy) {
    const directUser = findByCode(joiningUser.referredBy);
    if (directUser) {
      users = users.map((u) => {
        if (u.phone === directUser.phone) {
          const newDirectCount = (u.directCount || 0) + 1;
          const pairs = Math.floor(newDirectCount / 2);
          const alreadyPaidPairs = u.pairPaid || 0;
          const newPairs = Math.max(0, pairs - alreadyPaidPairs);
          const pairCredit = newPairs * PAIR;

          return {
            ...u,
            wallet: (u.wallet || 0) + DIRECT + pairCredit,
            directCount: newDirectCount,
            directIncome: (u.directIncome || 0) + DIRECT,
            pairIncome: (u.pairIncome || 0) + pairCredit,
            ...(newPairs > 0 ? { pairPaid: pairs } : {}),
          };
        }
        return u;
      });
    }
  }

  // 5. LEVEL INCOME — walk up 10 levels via referredBy chain
  let currentRef = joiningUser?.referredBy;
  let level = 1;
  while (currentRef && level <= MAX_LEVELS) {
    const levelUser = findByCode(currentRef);
    if (!levelUser) break;
    users = users.map((u) => {
      if (u.phone === levelUser.phone) {
        return {
          ...u,
          wallet: (u.wallet || 0) + LEVEL,
          levelIncome: (u.levelIncome || 0) + LEVEL,
        };
      }
      return u;
    });
    // Use the original (pre-update) chain to avoid infinite loops
    const nextRef = findByCode(currentRef)?.referredBy;
    currentRef = nextRef;
    level++;
  }

  // Save users
  saveUsers(users);

  // 6. Admin wallet (simple number stored as JSON number)
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
}
