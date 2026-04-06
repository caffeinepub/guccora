import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle,
  Clock,
  Copy,
  Info,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PLANS, useGuccora } from "../context/GuccoraContext";
import type { Transaction } from "../context/GuccoraContext";
import { db } from "../firebase";

type MLMTransaction = {
  id: string;
  userId: string;
  type: "direct" | "level" | "pair";
  amount: number;
  fromUserId: string;
  orderId: string;
  level: number | null;
  createdAt: { seconds: number; nanoseconds: number } | null;
};

type ReferredUser = {
  id: string;
  name: string;
  phone: string;
  paidUser?: boolean;
  referralCode: string;
  createdAt?: number;
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatFirestoreDate(
  createdAt: { seconds: number; nanoseconds: number } | null | undefined,
): string {
  if (!createdAt) return "—";
  return new Date(createdAt.seconds * 1000).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const INCOME_TYPE_CONFIG: Record<
  "direct" | "level" | "pair",
  { label: string; className: string }
> = {
  direct: {
    label: "Direct Income",
    className: "bg-gold/15 text-gold border border-gold/30",
  },
  level: {
    label: "Level Income",
    className: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  },
  pair: {
    label: "Pair Income",
    className: "bg-violet-500/15 text-violet-400 border border-violet-500/30",
  },
};

function TxnIcon({ type }: { type: Transaction["type"] }) {
  if (type === "debit")
    return <ArrowUpRight size={14} className="text-red-400" />;
  return <ArrowDownLeft size={14} className="text-green-400" />;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    pending: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20",
    approved: "bg-green-400/10 text-green-400 border-green-400/20",
    rejected: "bg-red-400/10 text-red-400 border-red-400/20",
  };
  return (
    <span
      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
        variants[status] ?? variants.pending
      }`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export function WalletPage() {
  const { userData, submitWithdrawal, currentUser } = useGuccora();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [upiId, setUpiId] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mlmTransactions, setMlmTransactions] = useState<MLMTransaction[]>([]);
  const [referredUsers, setReferredUsers] = useState<ReferredUser[]>([]);
  const [referralsLoading, setReferralsLoading] = useState(true);

  // Listen to Firestore MLM income transactions for this user
  useEffect(() => {
    const userId = currentUser?.id;
    if (!userId) return;

    let unsubscribe: (() => void) | undefined;
    try {
      const q = query(
        collection(db, "transactions"),
        where("userId", "==", userId),
        where("type", "in", ["direct", "level", "pair"]),
        orderBy("createdAt", "desc"),
      );
      unsubscribe = onSnapshot(
        q,
        (snap) => {
          const docs = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as MLMTransaction[];
          setMlmTransactions(docs);
        },
        () => {
          // Firestore unavailable — show empty silently
          setMlmTransactions([]);
        },
      );
    } catch {
      // ignore
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser?.id]);

  // Listen to Firestore referred users (where referredBy == myReferralCode)
  useEffect(() => {
    const myCode = userData.referralCode;
    if (!myCode) {
      setReferralsLoading(false);
      return;
    }

    setReferralsLoading(true);
    let unsubscribe: (() => void) | undefined;
    try {
      const q = query(
        collection(db, "users"),
        where("referredBy", "==", myCode),
      );
      unsubscribe = onSnapshot(
        q,
        (snap) => {
          const docs = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ReferredUser, "id">),
          }));
          setReferredUsers(docs);
          setReferralsLoading(false);
        },
        () => {
          // Firestore unavailable — try localStorage fallback
          try {
            const raw = localStorage.getItem("users");
            const all = raw ? JSON.parse(raw) : [];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const filtered = all.filter((u: any) => u.referredBy === myCode);
            setReferredUsers(filtered);
          } catch {
            setReferredUsers([]);
          }
          setReferralsLoading(false);
        },
      );
    } catch {
      setReferralsLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [userData.referralCode]);

  function handleCopyReferralLink() {
    const link = `${window.location.origin}?ref=${userData.referralCode}`;
    navigator.clipboard
      .writeText(link)
      .then(() => toast.success("Referral link copied!"))
      .catch(() => toast.error("Failed to copy"));
  }

  async function handleWithdraw() {
    const amt = Number.parseFloat(amount);
    if (Number.isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!upiId.trim()) {
      toast.error("UPI ID is required");
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 500));
    const result = submitWithdrawal(amt, upiId.trim(), {
      bankName: bankName.trim() || undefined,
      accountNumber: accountNumber.trim() || undefined,
      ifsc: ifsc.trim() || undefined,
    });
    setSubmitting(false);
    if (result.success) {
      toast.success("Withdrawal request submitted!");
      setSheetOpen(false);
      setAmount("");
      setUpiId("");
    } else {
      toast.error(result.error ?? "Withdrawal failed");
    }
  }

  return (
    <div className="px-4 py-5 max-w-lg mx-auto animate-fade-in">
      {/* Balance Card */}
      <div
        className="rounded-2xl p-6 mb-5 border border-gold/20 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #141414 0%, #1a1500 100%)",
        }}
        data-ocid="wallet.balance.card"
      >
        <div className="absolute right-4 top-4">
          <Wallet size={32} className="text-gold/20" />
        </div>
        <div className="text-[#808080] text-xs mb-1">Wallet Balance</div>
        <div className="text-gold font-black text-4xl font-display gold-text-glow mb-1">
          ₹{userData.walletBalance.toLocaleString("en-IN")}
        </div>
        <div className="text-[#606060] text-xs mb-4">
          Total Earned: ₹
          {(
            userData.directIncome +
            userData.levelIncome +
            userData.pairIncome
          ).toLocaleString("en-IN")}
        </div>
        {/* Income breakdown */}
        <div className="flex items-center gap-4 mb-4">
          <div className="text-center">
            <p className="text-gold font-bold text-sm">
              ₹{userData.directIncome.toLocaleString("en-IN")}
            </p>
            <p className="text-[#505050] text-[10px]">Direct</p>
          </div>
          <div className="w-px h-6 bg-gold/15" />
          <div className="text-center">
            <p className="text-amber-400 font-bold text-sm">
              ₹{userData.levelIncome.toLocaleString("en-IN")}
            </p>
            <p className="text-[#505050] text-[10px]">Level</p>
          </div>
          <div className="w-px h-6 bg-gold/15" />
          <div className="text-center">
            <p className="text-violet-400 font-bold text-sm">
              ₹{userData.pairIncome.toLocaleString("en-IN")}
            </p>
            <p className="text-[#505050] text-[10px]">Pair</p>
          </div>
        </div>
        <Button
          onClick={() => setSheetOpen(true)}
          className="bg-gold hover:bg-gold-light text-black font-black px-6 h-9 rounded-xl text-sm"
          data-ocid="wallet.withdraw.primary_button"
        >
          Withdraw
        </Button>
      </div>

      {/* ====== MY PLAN CARD ====== */}
      {userData.paidUser && (
        <div
          className="rounded-2xl border border-gold/15 p-4 mb-5 flex items-center gap-3"
          style={{ background: "#141414" }}
          data-ocid="wallet.my_plan.card"
        >
          <div className="w-10 h-10 rounded-full bg-gold/15 flex items-center justify-center flex-shrink-0">
            <CheckCircle size={18} className="text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[#808080] text-xs">My Plan</p>
            {(userData as { selectedPlan?: 599 | 999 | 1999 | 2999 | null })
              .selectedPlan ? (
              <p className="text-white font-black text-base">
                ₹
                {(
                  userData as { selectedPlan?: 599 | 999 | 1999 | 2999 | null }
                ).selectedPlan?.toLocaleString("en-IN")}{" "}
                Plan
              </p>
            ) : (
              <p className="text-white font-bold text-base">Active Member</p>
            )}
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
            ✓ ACTIVE
          </span>
        </div>
      )}

      {/* ====== INCOME PLAN BREAKDOWN ====== */}
      {userData.paidUser &&
        (() => {
          const userPlan = PLANS.find(
            (p) =>
              p.price ===
              (userData as { selectedPlan?: 599 | 999 | 1999 | 2999 | null })
                .selectedPlan,
          );
          if (!userPlan) return null;
          return (
            <div
              className="rounded-2xl border border-gold/15 p-4 mb-5"
              style={{ background: "#141414" }}
              data-ocid="wallet.income_breakdown.card"
            >
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={14} className="text-gold" />
                <h2 className="text-white font-semibold text-sm">
                  Income Breakdown — ₹{userPlan.price} Plan
                </h2>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div
                  className="rounded-xl border border-gold/20 p-3 text-center"
                  style={{ background: "#0A0A0A" }}
                >
                  <p className="text-gold font-black text-lg">
                    ₹{userPlan.directIncome}
                  </p>
                  <p className="text-[#606060] text-[10px] mt-0.5">
                    Direct Income
                  </p>
                  <p className="text-[#404040] text-[10px]">per referral</p>
                </div>
                <div
                  className="rounded-xl border border-amber-500/20 p-3 text-center"
                  style={{ background: "#0A0A0A" }}
                >
                  <p className="text-amber-400 font-black text-lg">
                    ₹{userPlan.levelIncome}
                  </p>
                  <p className="text-[#606060] text-[10px] mt-0.5">
                    Level Income
                  </p>
                  <p className="text-[#404040] text-[10px]">× 10 levels</p>
                </div>
                <div
                  className="rounded-xl border border-violet-500/20 p-3 text-center"
                  style={{ background: "#0A0A0A" }}
                >
                  <p className="text-violet-400 font-black text-lg">
                    ₹{userPlan.pairIncome}
                  </p>
                  <p className="text-[#606060] text-[10px] mt-0.5">
                    Pair Income
                  </p>
                  <p className="text-[#404040] text-[10px]">per pair match</p>
                </div>
              </div>
              <div
                className="mt-3 rounded-xl border border-white/5 px-3 py-2"
                style={{ background: "#0A0A0A" }}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[#606060] text-xs">
                    Max Level Income (10 levels)
                  </span>
                  <span className="text-amber-400 font-bold text-xs">
                    ₹{userPlan.levelIncome * 10}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[#606060] text-xs">
                    Binary Pair Matching
                  </span>
                  <span className="text-[#808080] text-xs">
                    Left + Right = 1 Pair
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

      {/* ====== REFERRAL INFO PANEL ====== */}
      <div
        className="rounded-2xl border border-gold/15 mb-5 overflow-hidden"
        style={{ background: "#141414" }}
        data-ocid="wallet.referral.panel"
      >
        {/* Section A — My Referral Code */}
        <div className="px-4 pt-4 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <Users size={14} className="text-gold" />
            <h2 className="text-white font-semibold text-sm">
              My Referral Code
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex-1 rounded-xl border border-gold/25 px-3 py-2"
              style={{ background: "#0A0A0A" }}
            >
              <span
                className="text-gold font-black text-base tracking-widest font-mono"
                data-ocid="wallet.referral_code.input"
              >
                {userData.referralCode || "—"}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyReferralLink}
              className="flex items-center gap-1.5 text-xs text-[#808080] hover:text-gold transition-colors border border-gold/15 hover:border-gold/40 rounded-xl px-3 py-2 h-full"
              data-ocid="wallet.referral.copy_button"
            >
              <Copy size={13} />
              Copy Link
            </button>
          </div>
          <p className="text-[#505050] text-[10px] mt-1.5">
            Share your link — earn ₹40–₹210 direct income when your referral
            joins
          </p>
        </div>

        {/* Section C — Referred Users List */}
        <div className="px-4 pt-3 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-white font-semibold text-sm">Referred Users</h3>
            {referredUsers.length > 0 && (
              <Badge
                className="ml-auto bg-gold/10 text-gold border-gold/20 text-[9px] px-1.5"
                data-ocid="wallet.referred_users.badge"
              >
                {referredUsers.length}
              </Badge>
            )}
          </div>

          {referralsLoading ? (
            <div
              className="flex items-center justify-center py-6"
              data-ocid="wallet.referred_users.loading_state"
            >
              <div className="w-5 h-5 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
            </div>
          ) : referredUsers.length === 0 ? (
            <div
              className="text-center py-6"
              data-ocid="wallet.referred_users.empty_state"
            >
              <Users size={24} className="mx-auto mb-2 text-gold/15" />
              <p className="text-[#505050] text-xs">No referrals yet</p>
              <p className="text-[#404040] text-[10px] mt-0.5">
                Share your code to start earning ₹100–₹500 per referral
              </p>
            </div>
          ) : (
            <div className="space-y-2" data-ocid="wallet.referred_users.list">
              {referredUsers.map((user, i) => {
                const initial = (user.name || "?").charAt(0).toUpperCase();
                const maskedPhone = user.phone
                  ? user.phone.replace(/.(?=.{4})/g, "*")
                  : "—";
                return (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 border border-white/5"
                    style={{ background: "#0A0A0A" }}
                    data-ocid={`wallet.referred_user.item.${i + 1}`}
                  >
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-gold/15 flex items-center justify-center flex-shrink-0">
                      <span className="text-gold font-black text-sm">
                        {initial}
                      </span>
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">
                        {user.name || "Unknown"}
                      </p>
                      <p className="text-[#505050] text-[10px]">
                        {maskedPhone}
                      </p>
                    </div>
                    {/* Paid / Pending badge */}
                    {user.paidUser ? (
                      <div
                        className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20"
                        data-ocid={`wallet.referred_user.paid_badge.${i + 1}`}
                      >
                        <CheckCircle size={10} />
                        Paid
                      </div>
                    ) : (
                      <div
                        className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#303030] text-[#808080] border border-white/10"
                        data-ocid={`wallet.referred_user.pending_badge.${i + 1}`}
                      >
                        <Clock size={10} />
                        Pending
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* KYC Warning */}
      {userData.kycStatus !== "approved" && (
        <div
          className="flex items-start gap-3 rounded-xl p-3 border border-yellow-500/20 mb-5"
          style={{ background: "#1a1500" }}
          data-ocid="wallet.kyc_warning.error_state"
        >
          <Info size={16} className="text-yellow-400 mt-0.5 flex-shrink-0" />
          <p className="text-yellow-400/90 text-xs">
            KYC verification required to withdraw. Please complete your KYC.
          </p>
        </div>
      )}

      {/* Transactions */}
      <div
        className="rounded-2xl border border-gold/10 mb-5"
        style={{ background: "#141414" }}
      >
        <div className="px-4 py-3 border-b border-gold/10">
          <h2 className="text-white font-semibold text-sm">
            Transaction History
          </h2>
        </div>
        {userData.transactions.length === 0 ? (
          <div
            className="text-center py-8 text-[#606060] text-sm"
            data-ocid="wallet.transactions.empty_state"
          >
            No transactions yet
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {userData.transactions.map((txn, i) => (
              <div
                key={txn.id}
                className="flex items-center gap-3 px-4 py-3"
                data-ocid={`wallet.transaction.item.${i + 1}`}
              >
                <div className="w-7 h-7 rounded-full bg-surface-3 flex items-center justify-center flex-shrink-0">
                  <TxnIcon type={txn.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {txn.description}
                  </p>
                  <p className="text-[#606060] text-xs">
                    {formatDate(txn.timestamp)}
                  </p>
                </div>
                <span
                  className={`text-sm font-bold ${
                    txn.type === "debit" ? "text-red-400" : "text-green-400"
                  }`}
                >
                  {txn.type === "debit" ? "-" : "+"}₹
                  {txn.amount.toLocaleString("en-IN")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MLM Income History (Firestore) */}
      {currentUser?.id && (
        <div
          className="rounded-2xl border border-gold/10 mb-5"
          style={{ background: "#141414" }}
          data-ocid="wallet.mlm_income.panel"
        >
          <div className="px-4 py-3 border-b border-gold/10 flex items-center gap-2">
            <TrendingUp size={14} className="text-gold" />
            <h2 className="text-white font-semibold text-sm">
              MLM Income History
            </h2>
            {mlmTransactions.length > 0 && (
              <Badge className="ml-auto bg-gold/10 text-gold border-gold/20 text-[9px]">
                {mlmTransactions.length}
              </Badge>
            )}
          </div>

          {mlmTransactions.length === 0 ? (
            <div
              className="text-center py-10"
              data-ocid="wallet.mlm_income.empty_state"
            >
              <TrendingUp size={28} className="mx-auto mb-2 text-gold/20" />
              <p className="text-[#606060] text-sm">No income yet</p>
              <p className="text-[#404040] text-xs mt-1">
                Income from referrals will appear here after admin approval
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {mlmTransactions.map((txn, i) => {
                const cfg =
                  INCOME_TYPE_CONFIG[txn.type] ?? INCOME_TYPE_CONFIG.direct;
                return (
                  <div
                    key={txn.id}
                    className="flex items-center gap-3 px-4 py-3"
                    data-ocid={`wallet.mlm_income.item.${i + 1}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            cfg.className
                          }`}
                        >
                          {cfg.label}
                        </span>
                        {txn.level !== null && txn.level > 0 && (
                          <span className="text-[10px] text-[#606060]">
                            Level {txn.level}
                          </span>
                        )}
                      </div>
                      <p className="text-[#606060] text-xs">
                        {formatFirestoreDate(
                          txn.createdAt as {
                            seconds: number;
                            nanoseconds: number;
                          } | null,
                        )}
                      </p>
                    </div>
                    <span className="text-green-400 font-bold text-sm">
                      +₹{txn.amount.toLocaleString("en-IN")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Withdrawal History */}
      {userData.withdrawals.length > 0 && (
        <div
          className="rounded-2xl border border-gold/10"
          style={{ background: "#141414" }}
        >
          <div className="px-4 py-3 border-b border-gold/10">
            <h2 className="text-white font-semibold text-sm">
              Withdrawal Requests
            </h2>
          </div>
          <div className="divide-y divide-white/5">
            {userData.withdrawals.map((w, i) => (
              <div
                key={w.id}
                className="flex items-center gap-3 px-4 py-3"
                data-ocid={`wallet.withdrawal.item.${i + 1}`}
              >
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">
                    ₹{w.amount.toLocaleString("en-IN")}
                  </p>
                  <p className="text-[#606060] text-xs">{w.upiId}</p>
                  <p className="text-[#505050] text-xs">
                    {formatDate(w.timestamp)}
                  </p>
                </div>
                <StatusBadge status={w.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Withdrawal Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="border-t border-gold/20 rounded-t-2xl"
          style={{ background: "#141414" }}
          data-ocid="wallet.withdraw.sheet"
        >
          <SheetHeader className="mb-4">
            <SheetTitle className="text-gold font-black font-display">
              Withdraw Funds
            </SheetTitle>
            <SheetDescription className="text-[#606060]">
              Minimum withdrawal: ₹200. KYC required.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-3 pb-6">
            <div className="space-y-1.5">
              <Label className="text-[#A0A0A0] text-sm">Amount (₹)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Min ₹200"
                className="bg-surface-3 border-gold/20 text-white"
                data-ocid="wallet.amount.input"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[#A0A0A0] text-sm">UPI ID *</Label>
              <Input
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="yourname@upi"
                className="bg-surface-3 border-gold/20 text-white"
                data-ocid="wallet.upi_id.input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[#A0A0A0] text-xs">Bank Name</Label>
                <Input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Optional"
                  className="bg-surface-3 border-gold/20 text-white text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#A0A0A0] text-xs">IFSC Code</Label>
                <Input
                  value={ifsc}
                  onChange={(e) => setIfsc(e.target.value)}
                  placeholder="Optional"
                  className="bg-surface-3 border-gold/20 text-white text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[#A0A0A0] text-xs">Account Number</Label>
              <Input
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Optional"
                className="bg-surface-3 border-gold/20 text-white text-sm"
              />
            </div>
            <Button
              onClick={handleWithdraw}
              disabled={submitting}
              className="w-full bg-gold hover:bg-gold-light text-black font-black h-11 rounded-xl"
              data-ocid="wallet.withdraw.submit_button"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                  Processing...
                </span>
              ) : (
                "Request Withdrawal"
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
