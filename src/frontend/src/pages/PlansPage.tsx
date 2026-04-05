import { Button } from "@/components/ui/button";
import { CheckCircle, CreditCard, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useGuccora } from "../context/GuccoraContext";

type PlanConfig = {
  amount: 599 | 1999 | 2999;
  label: string;
  tag: string;
  tagClass: string;
  link: string;
  commission: number;
  features: string[];
};

const PLANS: PlanConfig[] = [
  {
    amount: 599,
    label: "₹599 Plan",
    tag: "Starter",
    tagClass: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
    link: "https://rzp.io/rzp/4EG1XhZz",
    commission: 100,
    features: [
      "Referral commission: ₹100",
      "Instant activation",
      "Access to all features",
    ],
  },
  {
    amount: 1999,
    label: "₹1999 Plan",
    tag: "Premium",
    tagClass: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    link: "https://rzp.io/rzp/rdiKuwK",
    commission: 300,
    features: [
      "Referral commission: ₹300",
      "Priority support",
      "Higher earning potential",
    ],
  },
  {
    amount: 2999,
    label: "₹2999 Gold Plan",
    tag: "Gold",
    tagClass: "bg-gold/15 text-gold border-gold/25",
    link: "https://rzp.io/rzp/eKYODKB",
    commission: 500,
    features: [
      "Referral commission: ₹500",
      "VIP support",
      "Maximum earning potential",
    ],
  },
];

export function ProductsPage() {
  const { userData, currentUser, markUserPaid } = useGuccora();
  const [confirmingPlan, setConfirmingPlan] = useState<number | null>(null);

  function handleJoin(plan: PlanConfig) {
    window.open(plan.link, "_blank", "noopener,noreferrer");
  }

  async function handleConfirmPayment(plan: PlanConfig) {
    if (!currentUser) {
      toast.error("Please login first");
      return;
    }
    setConfirmingPlan(plan.amount);
    try {
      await markUserPaid(plan.amount);
      toast.success(
        `₹${plan.amount} Plan activated! You're now a paid member.`,
      );
    } catch {
      toast.error("Failed to confirm. Please try again.");
    } finally {
      setConfirmingPlan(null);
    }
  }

  const activePlan = userData.paidUser ? userData.selectedPlan : null;

  return (
    <div className="px-4 py-5 max-w-lg mx-auto animate-fade-in">
      <h1 className="text-white font-black font-display text-2xl mb-1">
        Choose Your Plan
      </h1>
      <p className="text-[#606060] text-sm mb-6">
        Select a plan to activate your membership and start earning referral
        rewards.
      </p>

      {/* Active plan banner */}
      {userData.paidUser && activePlan && (
        <div
          className="flex items-center gap-3 rounded-2xl border border-green-500/25 p-4 mb-6"
          style={{ background: "#0a1a0a" }}
          data-ocid="plans.active_plan.banner"
        >
          <div className="w-9 h-9 rounded-full bg-green-500/15 flex items-center justify-center flex-shrink-0">
            <CheckCircle size={18} className="text-green-400" />
          </div>
          <div>
            <p className="text-green-400 font-bold text-sm">
              ₹{activePlan} Plan Active
            </p>
            <p className="text-[#606060] text-xs">
              Referral rewards enabled. Share your code to earn!
            </p>
          </div>
        </div>
      )}

      {/* Plan Cards */}
      <div className="space-y-4">
        {PLANS.map((plan) => {
          const isActive = activePlan === plan.amount;
          const isConfirming = confirmingPlan === plan.amount;
          return (
            <div
              key={plan.amount}
              className={`rounded-2xl border p-5 relative overflow-hidden transition-all ${
                isActive
                  ? "border-green-500/30"
                  : plan.amount === 2999
                    ? "border-gold/40"
                    : "border-gold/15 hover:border-gold/35"
              }`}
              style={{
                background:
                  plan.amount === 2999
                    ? "linear-gradient(135deg, #141414 0%, #1a1200 100%)"
                    : "#141414",
              }}
              data-ocid={`plans.plan_${plan.amount}.card`}
            >
              {/* Gold glow for ₹2999 */}
              {plan.amount === 2999 && (
                <div
                  className="absolute right-0 top-0 w-32 h-32 rounded-full opacity-10 pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(circle, #FFD700 0%, transparent 70%)",
                    transform: "translate(30%, -30%)",
                  }}
                />
              )}

              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide ${
                        plan.tagClass
                      }`}
                    >
                      {plan.tag}
                    </span>
                    {isActive && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
                        ✓ ACTIVE
                      </span>
                    )}
                  </div>
                  <h2 className="text-white font-black text-xl">
                    {plan.label}
                  </h2>
                </div>
                <span className="text-gold font-black text-2xl font-display">
                  ₹{plan.amount.toLocaleString("en-IN")}
                </span>
              </div>

              {/* Features */}
              <ul className="space-y-1 mb-4">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-center gap-2 text-xs text-[#909090]"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-gold/60 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {isActive ? (
                <div className="flex items-center justify-center gap-2 h-11 rounded-xl border border-green-500/20 bg-green-500/10">
                  <CheckCircle size={15} className="text-green-400" />
                  <span className="text-green-400 font-bold text-sm">
                    Plan Active
                  </span>
                </div>
              ) : currentUser ? (
                <div className="space-y-2">
                  <Button
                    onClick={() => handleJoin(plan)}
                    className="w-full bg-gold hover:bg-gold-light text-black font-black h-11 rounded-xl text-sm flex items-center justify-center gap-2"
                    data-ocid={`plans.plan_${plan.amount}.join_button`}
                  >
                    <CreditCard size={15} />
                    Join {plan.label} — Pay Now
                  </Button>
                  <button
                    type="button"
                    onClick={() => handleConfirmPayment(plan)}
                    disabled={isConfirming}
                    className="w-full text-center text-[#808080] hover:text-gold text-xs py-2 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    data-ocid={`plans.plan_${plan.amount}.confirm_button`}
                  >
                    {isConfirming ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        Confirming...
                      </>
                    ) : (
                      "I've already paid — confirm payment"
                    )}
                  </button>
                </div>
              ) : (
                <Button
                  onClick={() => handleJoin(plan)}
                  className="w-full bg-gold hover:bg-gold-light text-black font-black h-11 rounded-xl text-sm flex items-center justify-center gap-2"
                >
                  <CreditCard size={15} />
                  Join {plan.label}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Commission info footer */}
      <div
        className="mt-6 rounded-2xl border border-gold/10 p-4"
        style={{ background: "#0A0A0A" }}
        data-ocid="plans.commission_info.card"
      >
        <p className="text-[#606060] text-xs font-semibold mb-2 uppercase tracking-wide">
          Referral Commission Structure
        </p>
        <div className="space-y-1.5">
          {PLANS.map((plan) => (
            <div
              key={plan.amount}
              className="flex items-center justify-between"
            >
              <span className="text-[#808080] text-xs">
                ₹{plan.amount} Plan
              </span>
              <span className="text-gold font-bold text-xs">
                ₹{plan.commission} per referral
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Keep backward-compat export
export { ProductsPage as PlansPage };
