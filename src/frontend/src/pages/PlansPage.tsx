import { Button } from "@/components/ui/button";
import { CheckCircle, CreditCard, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useGuccora } from "../context/GuccoraContext";

type PlanConfig = {
  amount: 599 | 999 | 1999 | 2999;
  label: string;
  tag: string;
  tagClass: string;
  link: string;
  commission: number;
  image: string;
  direct: number;
  levelPer: number;
  pair: number;
  features: string[];
};

const PLANS: PlanConfig[] = [
  {
    amount: 599,
    label: "₹599 Plan",
    tag: "Starter",
    tagClass: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
    link: "https://rzp.io/rzp/4EG1XhZz",
    commission: 40,
    image:
      "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=600&q=80",
    direct: 40,
    levelPer: 5,
    pair: 30,
    features: [
      "Direct Income: ₹40 per referral",
      "Level Income: ₹5 × 10 levels = ₹50",
      "Pair Income: ₹30 per pair",
    ],
  },
  {
    amount: 999,
    label: "₹999 Plan",
    tag: "Silver",
    tagClass: "bg-slate-400/15 text-slate-300 border-slate-400/25",
    link: "https://rzp.io/rzp/AIDYAnv1",
    commission: 70,
    image:
      "https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=600&q=80",
    direct: 70,
    levelPer: 8,
    pair: 50,
    features: [
      "Direct Income: ₹70 per referral",
      "Level Income: ₹8 × 10 levels = ₹80",
      "Pair Income: ₹50 per pair",
    ],
  },
  {
    amount: 1999,
    label: "₹1999 Plan",
    tag: "Gold",
    tagClass: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    link: "https://rzp.io/rzp/rdiKuwK",
    commission: 140,
    image:
      "https://images.unsplash.com/photo-1607082349566-187342175e2f?w=600&q=80",
    direct: 140,
    levelPer: 16,
    pair: 100,
    features: [
      "Direct Income: ₹140 per referral",
      "Level Income: ₹16 × 10 levels = ₹160",
      "Pair Income: ₹100 per pair",
    ],
  },
  {
    amount: 2999,
    label: "₹2999 Plan",
    tag: "Platinum",
    tagClass: "bg-gold/15 text-gold border-gold/25",
    link: "https://rzp.io/rzp/eKYODKB",
    commission: 210,
    image:
      "https://images.unsplash.com/photo-1607082349567-0fdb7a5cbb6b?w=600&q=80",
    direct: 210,
    levelPer: 24,
    pair: 150,
    features: [
      "Direct Income: ₹210 per referral",
      "Level Income: ₹24 × 10 levels = ₹240",
      "Pair Income: ₹150 per pair",
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
      <div className="space-y-5">
        {PLANS.map((plan) => {
          const isActive = activePlan === plan.amount;
          const isConfirming = confirmingPlan === plan.amount;
          return (
            <div
              key={plan.amount}
              className={`rounded-[12px] border overflow-hidden transition-all ${
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
                boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
              }}
              data-ocid={`plans.plan_${plan.amount}.card`}
            >
              {/* Plan Image */}
              <div
                style={{
                  height: 150,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <img
                  src={plan.image}
                  alt={plan.label}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                  loading="lazy"
                />
                {/* Gradient overlay for seamless blend */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 48,
                    background: `linear-gradient(to bottom, transparent, ${
                      plan.amount === 2999 ? "#141414" : "#141414"
                    })`,
                  }}
                />
                {/* Tag badge on image */}
                <span
                  className={`absolute top-3 left-3 text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide backdrop-blur-sm ${
                    plan.tagClass
                  }`}
                  style={{ background: "rgba(0,0,0,0.55)" }}
                >
                  {plan.tag}
                </span>
                {isActive && (
                  <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/80 text-white border border-green-400/30 backdrop-blur-sm">
                    ✓ ACTIVE
                  </span>
                )}
              </div>

              {/* Card Body */}
              <div className="p-5">
                {/* Plan name + price */}
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-white font-black text-xl">
                    {plan.label}
                  </h2>
                  <span className="text-gold font-black text-2xl font-display">
                    ₹{plan.amount.toLocaleString("en-IN")}
                  </span>
                </div>

                {/* Income details row */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div
                    className="rounded-xl p-2.5 text-center"
                    style={{
                      background: "rgba(255,215,0,0.06)",
                      border: "1px solid rgba(255,215,0,0.12)",
                    }}
                  >
                    <p className="text-[#808080] text-[10px] uppercase tracking-wide mb-0.5">
                      Direct
                    </p>
                    <p className="text-gold font-bold text-sm">
                      ₹{plan.direct}
                    </p>
                  </div>
                  <div
                    className="rounded-xl p-2.5 text-center"
                    style={{
                      background: "rgba(255,215,0,0.06)",
                      border: "1px solid rgba(255,215,0,0.12)",
                    }}
                  >
                    <p className="text-[#808080] text-[10px] uppercase tracking-wide mb-0.5">
                      Level
                    </p>
                    <p className="text-gold font-bold text-sm">
                      ₹{plan.levelPer}×10
                    </p>
                  </div>
                  <div
                    className="rounded-xl p-2.5 text-center"
                    style={{
                      background: "rgba(255,215,0,0.06)",
                      border: "1px solid rgba(255,215,0,0.12)",
                    }}
                  >
                    <p className="text-[#808080] text-[10px] uppercase tracking-wide mb-0.5">
                      Pair
                    </p>
                    <p className="text-gold font-bold text-sm">₹{plan.pair}</p>
                  </div>
                </div>

                {/* Level income total note */}
                <p className="text-[#505050] text-xs mb-4">
                  Level total: ₹{plan.levelPer} × 10 = ₹{plan.levelPer * 10}
                </p>

                {/* Action buttons */}
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
