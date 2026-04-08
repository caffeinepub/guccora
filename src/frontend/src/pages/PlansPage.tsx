import { Button } from "@/components/ui/button";
import { CheckCircle, CreditCard, Loader2, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useGuccora } from "../context/GuccoraContext";
import { useProducts } from "../hooks/useProducts";
import type { Product } from "../hooks/useProducts";
import { savePaymentToFirestore } from "../utils/firestorePayments";

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=600&q=80";

const UPI_ID = "6305462887-3@ybl";
const UPI_NAME = "GUCCORA";

function payUPI(amount: number) {
  const url = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_NAME)}&am=${amount}&cu=INR&tn=${encodeURIComponent("GUCCORA Plan")}`;
  window.location.href = url;
}

type PlanIncome = {
  direct: number;
  levelPer: number;
  pair: number;
  tag: string;
  tagClass: string;
  commission: number;
};

const INCOME_BY_PLAN_TYPE: Record<string, PlanIncome> = {
  starter: {
    direct: 40,
    levelPer: 5,
    pair: 30,
    tag: "Starter",
    tagClass: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
    commission: 40,
  },
  silver: {
    direct: 70,
    levelPer: 8,
    pair: 50,
    tag: "Silver",
    tagClass: "bg-slate-400/15 text-slate-300 border-slate-400/25",
    commission: 70,
  },
  gold: {
    direct: 140,
    levelPer: 16,
    pair: 100,
    tag: "Gold",
    tagClass: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    commission: 140,
  },
  platinum: {
    direct: 210,
    levelPer: 24,
    pair: 150,
    tag: "Platinum",
    tagClass: "bg-gold/15 text-gold border-gold/25",
    commission: 210,
  },
};

const INCOME_BY_PRICE: Record<number, PlanIncome> = {
  599: INCOME_BY_PLAN_TYPE.starter,
  999: INCOME_BY_PLAN_TYPE.silver,
  1999: INCOME_BY_PLAN_TYPE.gold,
  2999: INCOME_BY_PLAN_TYPE.platinum,
};

function getPlanIncome(product: Product): PlanIncome {
  if (product.planType && INCOME_BY_PLAN_TYPE[product.planType]) {
    return INCOME_BY_PLAN_TYPE[product.planType];
  }
  if (INCOME_BY_PRICE[product.price]) {
    return INCOME_BY_PRICE[product.price];
  }
  return INCOME_BY_PLAN_TYPE.starter;
}

export function ProductsPage() {
  const { userData, currentUser, submitPaymentRequest } = useGuccora();
  const { products: firestoreProducts, loading } = useProducts();

  const [utrMap, setUtrMap] = useState<Record<string, string>>({});
  const [screenshotMap, setScreenshotMap] = useState<
    Record<string, File | null>
  >({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Use Firestore products; fallback to localStorage cache if Firestore hasn't loaded yet
  const products: Product[] = (() => {
    if (firestoreProducts.length > 0) return firestoreProducts;
    if (!loading) {
      try {
        const cached = localStorage.getItem("guccora_products");
        if (cached) {
          const parsed = JSON.parse(cached) as Product[];
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {
        // ignore
      }
    }
    return firestoreProducts;
  })();

  async function handleSubmitPayment(product: Product) {
    if (!currentUser) {
      toast.error("Please login first");
      return;
    }
    const utr = utrMap[product.id] || "";
    const file = screenshotMap[product.id];
    if (!utr.trim() || !file) {
      toast.error("Please enter UTR and upload screenshot");
      return;
    }
    setSubmittingId(product.id);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;

      // Save to Firestore "payments" collection (primary)
      const result = await savePaymentToFirestore({
        userId: currentUser.id || currentUser.phone || "",
        name: currentUser.name ?? "",
        phone: currentUser.phone ?? "",
        planAmount: Number(product.price),
        UTR: utr.trim(),
        screenshot: base64,
      });

      if (result.success) {
        toast.success("Payment submitted. Waiting for admin approval");
      } else {
        toast.error("Failed to submit payment. Please try again.");
        setSubmittingId(null);
        return;
      }

      // Update local plan status to "pending"
      submitPaymentRequest(String(product.price), utr.trim(), base64);

      setUtrMap((prev) => ({ ...prev, [product.id]: "" }));
      setScreenshotMap((prev) => ({ ...prev, [product.id]: null }));
      setSubmittingId(null);
    };
    reader.onerror = () => {
      toast.error("Failed to read screenshot. Please try again.");
      setSubmittingId(null);
    };
    reader.readAsDataURL(file);
  }

  const activePlan = userData.paidUser ? userData.selectedPlan : null;

  return (
    <div className="px-4 py-5 max-w-lg mx-auto animate-fade-in">
      <h1 className="text-white font-black font-display text-2xl mb-1">
        Choose Your Plan
      </h1>
      <p className="text-[#606060] text-sm mb-6">
        Select a plan and pay via UPI (GPay, PhonePe, Paytm). After completing
        payment, submit your UTR number and screenshot for admin verification.
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
              ₹{activePlan} Plan — Active
            </p>
            <p className="text-[#606060] text-xs">
              Your plan is active. Start earning!
            </p>
          </div>
        </div>
      )}

      {/* UPI info banner */}
      <div
        className="flex items-start gap-3 rounded-2xl border border-gold/15 p-4 mb-6"
        style={{ background: "#0e0c00" }}
        data-ocid="plans.upi_info.banner"
      >
        <div className="w-9 h-9 rounded-full bg-gold/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Smartphone size={16} className="text-gold" />
        </div>
        <div>
          <p className="text-gold font-bold text-sm mb-0.5">UPI Payment</p>
          <p className="text-[#808080] text-xs leading-relaxed">
            UPI ID:{" "}
            <span className="text-white font-mono font-semibold">{UPI_ID}</span>
          </p>
          <p className="text-[#606060] text-xs mt-1">
            Tap "Pay via UPI" to open GPay / PhonePe. After payment, submit your
            UTR number and screenshot below for admin approval.
          </p>
        </div>
      </div>

      {loading && (
        <div
          className="flex items-center justify-center py-16"
          data-ocid="plans.loading_state"
        >
          <Loader2 size={28} className="animate-spin text-gold" />
        </div>
      )}

      {!loading && products.length === 0 && (
        <div
          className="text-center py-16 text-[#505050]"
          data-ocid="plans.empty_state"
        >
          <CreditCard size={36} className="mx-auto mb-3 text-gold/20" />
          <p className="text-base font-semibold text-[#808080]">
            No plans available yet
          </p>
          <p className="text-sm mt-1">Check back soon or contact admin.</p>
        </div>
      )}

      {!loading && products.length > 0 && (
        <div className="space-y-5">
          {products.map((product, i) => {
            const income = getPlanIncome(product);
            const isActive = activePlan === product.price;
            const isPlatinum = product.price === 2999;
            const imageUrl = product.imageUrl || DEFAULT_IMAGE;

            const hasPending = userData.paymentRequests.some(
              (r) =>
                r.planId === String(product.price) && r.status === "pending",
            );
            const isSubmitting = submittingId === product.id;

            return (
              <div
                key={product.id}
                className={`rounded-[12px] border overflow-hidden transition-all ${
                  isActive
                    ? "border-green-500/30"
                    : isPlatinum
                      ? "border-gold/40"
                      : "border-gold/15 hover:border-gold/35"
                }`}
                style={{
                  background: isPlatinum
                    ? "linear-gradient(135deg, #141414 0%, #1a1200 100%)"
                    : "#141414",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
                }}
                data-ocid={`plans.plan.item.${i + 1}`}
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
                    src={imageUrl}
                    alt={product.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = DEFAULT_IMAGE;
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 48,
                      background:
                        "linear-gradient(to bottom, transparent, #141414)",
                    }}
                  />
                  <span
                    className={`absolute top-3 left-3 text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide backdrop-blur-sm ${income.tagClass}`}
                    style={{ background: "rgba(0,0,0,0.55)" }}
                  >
                    {income.tag}
                  </span>
                  {isActive && (
                    <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/80 text-white border border-green-400/30 backdrop-blur-sm">
                      ✓ ACTIVE
                    </span>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-white font-black text-xl">
                      {product.name}
                    </h2>
                    <span className="text-gold font-black text-2xl font-display">
                      ₹{product.price.toLocaleString("en-IN")}
                    </span>
                  </div>

                  {/* Income details */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                      { label: "Direct", value: `₹${income.direct}` },
                      { label: "Level", value: `₹${income.levelPer}×10` },
                      { label: "Pair", value: `₹${income.pair}` },
                    ].map(({ label, value }) => (
                      <div
                        key={label}
                        className="rounded-xl p-2.5 text-center"
                        style={{
                          background: "rgba(255,215,0,0.06)",
                          border: "1px solid rgba(255,215,0,0.12)",
                        }}
                      >
                        <p className="text-[#808080] text-[10px] uppercase tracking-wide mb-0.5">
                          {label}
                        </p>
                        <p className="text-gold font-bold text-sm">{value}</p>
                      </div>
                    ))}
                  </div>

                  <p className="text-[#505050] text-xs mb-4">
                    Level total: ₹{income.levelPer} × 10 = ₹
                    {income.levelPer * 10}
                  </p>

                  {/* Action buttons */}
                  {isActive ? (
                    <div className="flex items-center justify-center gap-2 h-11 rounded-xl border border-green-500/20 bg-green-500/10">
                      <CheckCircle size={15} className="text-green-400" />
                      <span className="text-green-400 font-bold text-sm">
                        Plan Active
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Button
                        onClick={() => payUPI(product.price)}
                        className="w-full bg-gold hover:bg-gold-light text-black font-black h-11 rounded-xl text-sm flex items-center justify-center gap-2"
                        data-ocid={`plans.plan.pay_button.${i + 1}`}
                      >
                        <Smartphone size={15} />
                        Pay ₹{product.price} via UPI
                      </Button>

                      {!currentUser ? (
                        <p className="text-[#505050] text-[11px] text-center py-2">
                          Login required to submit payment
                        </p>
                      ) : hasPending ? (
                        <div
                          className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5"
                          data-ocid={`plans.plan.pending_state.${i + 1}`}
                        >
                          <Loader2
                            size={13}
                            className="text-yellow-400 animate-spin"
                          />
                          <span className="text-yellow-400 text-xs font-semibold">
                            ⏳ Awaiting admin approval
                          </span>
                        </div>
                      ) : (
                        <div
                          className="space-y-2 mt-2 pt-3 border-t border-white/5"
                          data-ocid={`plans.payment_form.panel.${i + 1}`}
                        >
                          <p className="text-[#606060] text-[11px] font-medium uppercase tracking-wide">
                            Submit Payment Proof
                          </p>
                          <input
                            type="text"
                            placeholder="Enter UTR Number"
                            value={utrMap[product.id] || ""}
                            onChange={(e) =>
                              setUtrMap((prev) => ({
                                ...prev,
                                [product.id]: e.target.value,
                              }))
                            }
                            className="w-full bg-[#1a1a1a] border border-[#282828] text-white text-xs px-3 py-2 rounded-lg placeholder:text-[#505050] focus:outline-none focus:border-gold/40"
                            data-ocid={`plans.plan.utr.input.${i + 1}`}
                          />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              setScreenshotMap((prev) => ({
                                ...prev,
                                [product.id]: e.target.files?.[0] || null,
                              }))
                            }
                            className="w-full text-xs text-[#808080] file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-gold/10 file:text-gold file:text-xs cursor-pointer"
                            data-ocid={`plans.plan.screenshot.upload_button.${i + 1}`}
                          />
                          <Button
                            onClick={() => handleSubmitPayment(product)}
                            disabled={isSubmitting}
                            className="w-full bg-gold hover:bg-gold-light text-black font-bold h-9 rounded-xl text-xs"
                            data-ocid={`plans.plan.submit_button.${i + 1}`}
                          >
                            {isSubmitting ? (
                              <>
                                <Loader2
                                  size={12}
                                  className="animate-spin mr-1"
                                />
                                Submitting...
                              </>
                            ) : (
                              "Submit Payment"
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Commission info footer */}
      {!loading && products.length > 0 && (
        <div
          className="mt-6 rounded-2xl border border-gold/10 p-4"
          style={{ background: "#0A0A0A" }}
          data-ocid="plans.commission_info.card"
        >
          <p className="text-[#606060] text-xs font-semibold mb-2 uppercase tracking-wide">
            Referral Commission Structure
          </p>
          <div className="space-y-1.5">
            {products.map((product) => {
              const income = getPlanIncome(product);
              return (
                <div
                  key={product.id}
                  className="flex items-center justify-between"
                >
                  <span className="text-[#808080] text-xs">
                    ₹{product.price} Plan
                  </span>
                  <span className="text-gold font-bold text-xs">
                    ₹{income.commission} per referral
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export { ProductsPage as PlansPage };
