/**
 * mlmApproval.ts
 *
 * Full MLM approval logic using localStorage.
 * Uses referredBy / directCount / pairPaid fields on user objects.
 *
 * Income config:
 *   DIRECT_INCOME = 40 (per plan — override via PLANS lookup)
 *   LEVEL_INCOME  = 5  per level (10 levels)
 *   PAIR_INCOME   = 30 per pair
 */

import { PLANS } from "../context/GuccoraContext";

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
 * Full MLM approval:
 * 1. Mark payment approved
 * 2. Push to orders
 * 3. Activate user
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

  // 3. Activate joining user
  const joiningUser = findByPhone(phone);
  users = users.map((u) => {
    if (u.phone === phone) {
      return {
        ...u,
        status: "Active",
        isActive: true,
        userStatus: "active",
        planStatus: "active",
      };
    }
    return u;
  });

  // Resolve income amounts from plan
  const matchedPlan = PLANS.find(
    (p) => p.price === amountNum || String(p.price) === planStr,
  );
  const DIRECT = matchedPlan?.directIncome ?? DEFAULT_DIRECT;
  const LEVEL = matchedPlan?.levelIncome ?? DEFAULT_LEVEL;
  const PAIR = matchedPlan?.pairIncome ?? DEFAULT_PAIR;

  // 4. DIRECT INCOME — credit sponsor (found via referredBy code)
  if (joiningUser?.referredBy) {
    const directUser = findByCode(joiningUser.referredBy);
    if (directUser) {
      users = users.map((u) => {
        if (u.phone === directUser.phone) {
          return {
            ...u,
            wallet: (u.wallet || 0) + DIRECT,
            directCount: (u.directCount || 0) + 1,
            directIncome: (u.directIncome || 0) + DIRECT,
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
    // Re-read updated users for next iteration (referredBy chain may have changed)
    currentRef = findByCode(currentRef)?.referredBy;
    level++;
  }

  // 6. PAIR INCOME — every 2 directs = 1 pair = PAIR income
  if (joiningUser?.referredBy) {
    const parent = findByCode(joiningUser.referredBy);
    if (parent) {
      // directCount was already incremented above — read fresh from users array
      const freshParent = users.find((u) => u.phone === parent.phone);
      const directs = freshParent?.directCount ?? (parent.directCount || 0);
      const pairs = Math.floor(directs / 2);
      const alreadyPaidPairs = freshParent?.pairPaid ?? (parent.pairPaid || 0);

      if (pairs > alreadyPaidPairs) {
        const newPairs = pairs - alreadyPaidPairs;
        users = users.map((u) => {
          if (u.phone === parent.phone) {
            return {
              ...u,
              wallet: (u.wallet || 0) + newPairs * PAIR,
              pairPaid: pairs,
              pairIncome: (u.pairIncome || 0) + newPairs * PAIR,
            };
          }
          return u;
        });
      }
    }
  }

  // Save users
  saveUsers(users);

  // 7. Admin wallet (simple number stored as JSON number)
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
