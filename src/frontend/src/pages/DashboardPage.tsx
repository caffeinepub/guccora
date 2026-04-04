import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  Clock,
  Copy,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { PLANS, useGuccora } from "../context/GuccoraContext";
import type { AppPage } from "../types/pages";

type DashboardPageProps = {
  onNavigate: (page: AppPage) => void;
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { userData } = useGuccora();
  const plan = PLANS.find((p) => p.id === userData.planId);
  const totalEarnings =
    userData.directIncome + userData.levelIncome + userData.pairIncome;
  const recentTxns = userData.transactions.slice(0, 3);

  const totalUsers = userData.team.length + 1;
  const activeUsers =
    userData.team.filter((m) => m.isActive).length +
    (userData.isActive ? 1 : 0);

  function copyReferral() {
    const link = `${window.location.origin}?ref=${userData.referralCode}`;
    navigator.clipboard
      .writeText(link)
      .then(() => toast.success("Referral link copied!"));
  }

  const daysLeft = userData.planExpiry
    ? Math.max(0, Math.ceil((userData.planExpiry - Date.now()) / 86400000))
    : 0;

  return (
    <div className="px-4 py-5 space-y-5 max-w-lg mx-auto animate-fade-in">
      {/* Welcome Banner */}
      <div
        className="rounded-2xl p-5 border border-gold/20 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #141414 0%, #1a1500 100%)",
        }}
      >
        <div className="absolute right-0 top-0 w-32 h-32 rounded-full bg-gold/5 -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center">
              <span className="text-gold font-bold text-sm">
                {userData.name ? userData.name[0].toUpperCase() : "G"}
              </span>
            </div>
            <div>
              <p className="text-[#808080] text-xs">Welcome back,</p>
              <p className="text-white font-bold text-base">
                {userData.name || "User"}
              </p>
            </div>
            {userData.isActive ? (
              <Badge className="ml-auto bg-green-500/15 text-green-400 border-green-500/30 text-[10px]">
                Active
              </Badge>
            ) : (
              <Badge className="ml-auto bg-red-500/15 text-red-400 border-red-500/30 text-[10px]">
                Inactive
              </Badge>
            )}
          </div>
          <div>
            <p className="text-[#606060] text-xs">Total Earnings</p>
            <p className="text-gold font-black text-3xl font-display gold-text-glow">
              ₹{totalEarnings.toLocaleString("en-IN")}
            </p>
          </div>
        </div>
      </div>

      {/* Stat Cards Row 1 */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Wallet",
            value: `₹${userData.walletBalance.toLocaleString("en-IN")}`,
            icon: Wallet,
            color: "#F4C542",
          },
          {
            label: "Direct",
            value: `₹${userData.directIncome.toLocaleString("en-IN")}`,
            icon: TrendingUp,
            color: "#4ade80",
          },
          {
            label: "Level",
            value: `₹${userData.levelIncome.toLocaleString("en-IN")}`,
            icon: Users,
            color: "#60a5fa",
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-xl p-3 border border-white/5 flex flex-col gap-2"
            style={{ background: "#141414" }}
          >
            <Icon size={16} style={{ color }} />
            <div className="text-white font-bold text-sm leading-none">
              {value}
            </div>
            <div className="text-[#606060] text-[10px]">{label}</div>
          </div>
        ))}
      </div>

      {/* Stat Cards Row 2 — Total & Active Users */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className="rounded-xl p-3 border border-white/5 flex flex-col gap-2"
          style={{ background: "#141414" }}
          data-ocid="dashboard.total_users.card"
        >
          <Users size={16} style={{ color: "#60a5fa" }} />
          <div className="text-white font-bold text-lg leading-none">
            {totalUsers}
          </div>
          <div className="text-[#606060] text-[10px]">Total Users</div>
        </div>
        <div
          className="rounded-xl p-3 border border-white/5 flex flex-col gap-2"
          style={{ background: "#141414" }}
          data-ocid="dashboard.active_users.card"
        >
          <UserCheck size={16} style={{ color: "#4ade80" }} />
          <div className="text-white font-bold text-lg leading-none">
            {activeUsers}
          </div>
          <div className="text-[#606060] text-[10px]">Active Users</div>
        </div>
      </div>

      {/* Plan Status */}
      <div
        className="rounded-2xl p-4 border border-gold/15"
        style={{ background: "#141414" }}
        data-ocid="dashboard.plan.card"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-white font-semibold text-sm">Active Plan</span>
          {userData.planStatus === "active" ? (
            <CheckCircle size={16} className="text-green-400" />
          ) : userData.planStatus === "pending" ? (
            <Clock size={16} className="text-yellow-400" />
          ) : (
            <AlertCircle size={16} className="text-red-400" />
          )}
        </div>

        {plan && userData.planStatus === "active" ? (
          <div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gold font-black text-xl font-display">
                  {plan.name} Plan
                </div>
                <div className="text-[#808080] text-xs">
                  ₹{plan.price}/month
                </div>
              </div>
              <div className="text-right">
                <div className="text-white font-bold text-sm">
                  {daysLeft} days
                </div>
                <div className="text-[#606060] text-xs">remaining</div>
              </div>
            </div>
            {userData.planExpiry && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-[#606060] mb-1">
                  <span>Plan Progress</span>
                  <span>Expires {formatDate(userData.planExpiry)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                  <div
                    className="h-full bg-gold rounded-full"
                    style={{
                      width: `${Math.min(100, ((30 - daysLeft) / 30) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : userData.planStatus === "pending" ? (
          <div className="text-center py-2">
            <Clock size={24} className="text-yellow-400 mx-auto mb-2" />
            <p className="text-yellow-400 font-semibold text-sm">
              Payment Under Review
            </p>
            <p className="text-[#606060] text-xs">Admin will approve shortly</p>
          </div>
        ) : (
          <div className="text-center py-2">
            <AlertCircle size={24} className="text-red-400/70 mx-auto mb-2" />
            <p className="text-[#A0A0A0] text-sm mb-3">No active plan</p>
            <button
              type="button"
              onClick={() => onNavigate("plans")}
              className="inline-flex items-center gap-1 px-4 py-1.5 rounded-lg bg-gold text-black text-sm font-bold"
              data-ocid="dashboard.buy_plan.primary_button"
            >
              Buy Plan <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Referral */}
      <div
        className="rounded-2xl p-4 border border-gold/15"
        style={{ background: "#141414" }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-white font-semibold text-sm">
            Your Referral Link
          </span>
          <button
            type="button"
            onClick={copyReferral}
            className="flex items-center gap-1 text-gold text-xs font-semibold"
            data-ocid="dashboard.referral_link.button"
          >
            <Copy size={12} /> Copy
          </button>
        </div>
        <div className="bg-surface-3 rounded-lg px-3 py-2 flex items-center gap-2">
          <span className="text-[#A0A0A0] text-xs flex-1 truncate">
            {window.location.origin}?ref={userData.referralCode}
          </span>
          <span className="text-gold font-bold text-xs bg-gold/10 px-2 py-0.5 rounded">
            {userData.referralCode}
          </span>
        </div>
      </div>

      {/* Recent Transactions */}
      <div
        className="rounded-2xl p-4 border border-gold/15"
        style={{ background: "#141414" }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-white font-semibold text-sm">
            Recent Transactions
          </span>
          <button
            type="button"
            onClick={() => onNavigate("wallet")}
            className="text-gold text-xs font-semibold flex items-center gap-1"
          >
            View all <ArrowRight size={12} />
          </button>
        </div>
        {recentTxns.length === 0 ? (
          <p className="text-[#606060] text-sm text-center py-4">
            No transactions yet
          </p>
        ) : (
          <div className="space-y-2">
            {recentTxns.map((txn) => (
              <div
                key={txn.id}
                className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {txn.description}
                  </p>
                  <p className="text-[#606060] text-xs">
                    {formatDate(txn.timestamp)}
                  </p>
                </div>
                <span
                  className={`text-sm font-bold ml-2 ${
                    txn.type === "debit" ? "text-red-400" : "text-green-400"
                  }`}
                >
                  {txn.type === "debit" ? "-" : "+"}₹{txn.amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
