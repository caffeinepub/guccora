import { Button } from "@/components/ui/button";
import { CreditCard, Package } from "lucide-react";
import { useProducts } from "../hooks/useProducts";
import type { Product } from "../hooks/useProducts";

// Per-price Razorpay payment links
const RAZORPAY_LINKS: Record<number, string> = {
  599: "https://rzp.io/rzp/LINK_599",
  999: "https://rzp.io/rzp/AIDYAnv1",
  1999: "https://rzp.io/rzp/LINK_1999",
  2999: "https://rzp.io/rzp/LINK_2999",
};

// Fallback if price doesn't match any known plan
const RAZORPAY_DEFAULT = "https://rzp.io/rzp/AIDYAnv1";

function getRazorpayLink(price: number): string {
  return RAZORPAY_LINKS[price] ?? RAZORPAY_DEFAULT;
}

const PLAN_TYPE_BADGE: Record<string, { label: string; className: string }> = {
  starter: {
    label: "Starter",
    className: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20",
  },
  silver: {
    label: "Silver",
    className: "bg-slate-400/15 text-slate-300 border border-slate-400/20",
  },
  gold: {
    label: "Gold",
    className: "bg-amber-500/15 text-amber-400 border border-amber-500/20",
  },
  platinum: {
    label: "Platinum",
    className: "bg-violet-500/15 text-violet-400 border border-violet-500/20",
  },
};

function PlanTypeBadge({ planType }: { planType: string }) {
  const badge = PLAN_TYPE_BADGE[planType.toLowerCase()] ?? {
    label: planType,
    className: "bg-gold/15 text-gold border border-gold/20",
  };
  return (
    <span
      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}

export function ProductsPage() {
  // Use the hook directly — gets real-time Firestore updates
  const { products } = useProducts();

  function handleBuyNow(product: Product) {
    const link = getRazorpayLink(product.price);
    window.open(link, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="px-4 py-5 max-w-lg mx-auto animate-fade-in">
      <h1 className="text-white font-black font-display text-2xl mb-1">
        Products
      </h1>
      <p className="text-[#606060] text-sm mb-6">
        Choose a product to activate your membership plan.
      </p>

      {products.length === 0 ? (
        <div
          className="text-center py-16 rounded-2xl border border-gold/10"
          style={{ background: "#141414" }}
          data-ocid="products.list.empty_state"
        >
          <Package size={48} className="mx-auto mb-3 text-gold/20" />
          <p className="text-[#606060] text-base font-semibold">
            No products available
          </p>
          <p className="text-[#404040] text-xs mt-1">Check back soon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {products.map((product, idx) => (
            <div
              key={product.id}
              className="rounded-2xl border border-gold/15 overflow-hidden hover:border-gold/40 transition-all"
              style={{ background: "#141414" }}
              data-ocid={`products.product.item.${idx + 1}`}
            >
              {/* Product Image */}
              <div
                className="w-full h-40 flex items-center justify-center overflow-hidden border-b border-gold/10"
                style={{ background: "#0A0A0A" }}
              >
                {product.imageDataUrl ? (
                  <img
                    src={product.imageDataUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package size={40} className="text-gold/20" />
                )}
              </div>

              {/* Card Content */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-white font-bold text-base leading-tight">
                    {product.name}
                  </h3>
                  <PlanTypeBadge planType={product.planType} />
                </div>

                {product.description && (
                  <p className="text-[#606060] text-xs mb-3 line-clamp-2">
                    {product.description}
                  </p>
                )}

                <div className="flex items-center justify-between mt-3">
                  <span className="text-gold font-black text-xl font-display">
                    ₹{product.price.toLocaleString("en-IN")}
                  </span>
                </div>

                {/* Buy Now Button */}
                <div className="mt-3">
                  <Button
                    onClick={() => handleBuyNow(product)}
                    className="w-full bg-gold hover:bg-gold-light text-black font-bold h-11 rounded-xl text-sm flex items-center justify-center gap-2"
                    data-ocid={`products.buy_now.button.${idx + 1}`}
                  >
                    <CreditCard size={15} />
                    Buy Now
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Keep backward-compat export
export { ProductsPage as PlansPage };
