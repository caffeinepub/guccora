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
  Info,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useGuccora } from "../context/GuccoraContext";
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
        <Button
          onClick={() => setSheetOpen(true)}
          className="bg-gold hover:bg-gold-light text-black font-black px-6 h-9 rounded-xl text-sm"
          data-ocid="wallet.withdraw.primary_button"
        >
          Withdraw
        </Button>
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
