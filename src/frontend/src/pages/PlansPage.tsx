import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { CheckCircle, ExternalLink, Package } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useGuccora } from "../context/GuccoraContext";
import { db, isFirebaseConfigured } from "../firebase";
import type { Product } from "../hooks/useProducts";

const PRODUCTS_KEY = "guccora_products";
const UPI_ID = "6305462887-3@ybl";
const PAYEE_NAME = "GUCCORA";

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

function buildUpiLink(amount: number) {
  return `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(PAYEE_NAME)}&am=${amount}&cu=INR`;
}

export function ProductsPage() {
  const { addOrder, submitPaymentRequest, currentUser } = useGuccora();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [utrNumber, setUtrNumber] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [upiLaunched, setUpiLaunched] = useState(false);

  // Load products from localStorage
  useEffect(() => {
    function loadFromStorage() {
      try {
        const stored = localStorage.getItem(PRODUCTS_KEY);
        if (stored) setProducts(JSON.parse(stored) as Product[]);
        else setProducts([]);
      } catch {
        // ignore
      }
    }
    loadFromStorage(); // initial load
    window.addEventListener("storage", loadFromStorage);
    return () => window.removeEventListener("storage", loadFromStorage);
  }, []);

  function handleBuyClick(product: Product) {
    setSelectedProduct(product);
    setUtrNumber("");
    setScreenshotUrl("");
    setUpiLaunched(false);
    const upiLink = buildUpiLink(product.price);
    window.location.href = upiLink;
    setTimeout(() => setUpiLaunched(true), 1500);
  }

  function handleOpenUpiAgain() {
    if (!selectedProduct) return;
    const upiLink = buildUpiLink(selectedProduct.price);
    window.location.href = upiLink;
    setTimeout(() => setUpiLaunched(true), 1500);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setScreenshotUrl(ev.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!selectedProduct) return;
    if (!utrNumber.trim()) {
      toast.error("Please enter the UTR / Transaction ID");
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));

    addOrder({
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      amount: selectedProduct.price,
      planType: selectedProduct.planType,
      address: {
        name: "",
        phone: "",
        line1: "",
        city: "",
        state: "",
        pincode: "",
      },
    });

    // Push order to global "orders" localStorage key for admin panel
    // Include userId (Firestore doc ID) so income can be distributed on approval
    try {
      const currentUserRaw = localStorage.getItem("guccora_currentUser");
      const storedUser = currentUserRaw
        ? (JSON.parse(currentUserRaw) as {
            name?: string;
            phone?: string;
            id?: string;
          })
        : {};
      const userId = currentUser?.id ?? storedUser.id ?? "";
      const globalOrders = JSON.parse(localStorage.getItem("orders") || "[]");
      globalOrders.unshift({
        id: Date.now().toString(),
        userId,
        userName: storedUser.name || "Unknown",
        phone: storedUser.phone || "Unknown",
        productName: selectedProduct.name,
        amount: selectedProduct.price,
        status: "pending",
        isAmountAdded: false,
        date: new Date().toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
      });
      localStorage.setItem("orders", JSON.stringify(globalOrders));
    } catch {
      // ignore
    }

    // Also write to Firestore orders collection if configured
    if (isFirebaseConfigured) {
      try {
        const currentUserRaw2 = localStorage.getItem("guccora_currentUser");
        const storedUser2 = currentUserRaw2
          ? (JSON.parse(currentUserRaw2) as {
              name?: string;
              phone?: string;
              id?: string;
            })
          : {};
        const userId2 = currentUser?.id ?? storedUser2.id ?? "";
        await addDoc(collection(db, "orders"), {
          userId: userId2,
          userName: storedUser2.name || "Unknown",
          phone: storedUser2.phone || "Unknown",
          productName: selectedProduct.name,
          amount: selectedProduct.price,
          planType: selectedProduct.planType,
          status: "pending",
          isAmountAdded: false,
          createdAt: serverTimestamp(),
        });
      } catch {
        // ignore — localStorage order already saved above
      }
    }

    submitPaymentRequest(
      selectedProduct.planType,
      utrNumber.trim(),
      screenshotUrl,
    );

    toast.success(
      "Payment submitted! Admin will verify and activate your plan.",
    );
    setSelectedProduct(null);
    setUtrNumber("");
    setScreenshotUrl("");
    setUpiLaunched(false);
    setSubmitting(false);
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
                  <Button
                    onClick={() => handleBuyClick(product)}
                    className="bg-gold hover:bg-gold-light text-black font-bold px-5 h-9 rounded-xl text-sm"
                    data-ocid={`products.buy.primary_button.${idx + 1}`}
                  >
                    Buy Now
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* UTR Entry Dialog */}
      <Dialog
        open={!!selectedProduct}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedProduct(null);
            setUpiLaunched(false);
          }
        }}
      >
        <DialogContent
          className="border-gold/20 max-w-sm mx-auto"
          style={{ background: "#141414" }}
          data-ocid="products.payment.dialog"
        >
          <DialogHeader>
            <DialogTitle className="text-gold font-black font-display">
              Enter UTR Number
            </DialogTitle>
            <DialogDescription className="text-[#606060]">
              {upiLaunched
                ? "Complete the payment in your UPI app, then enter the UTR / Transaction ID below."
                : "Your UPI app is opening. Once done, enter the UTR / Transaction ID below."}
            </DialogDescription>
          </DialogHeader>

          {selectedProduct && (
            <div className="space-y-4">
              {/* Amount + plan summary */}
              <div
                className="rounded-xl p-3 border border-gold/20"
                style={{ background: "#0A0A0A" }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    <div className="text-[#808080] text-xs">Product</div>
                    <div className="text-white font-semibold text-sm">
                      {selectedProduct.name}
                    </div>
                  </div>
                  <PlanTypeBadge planType={selectedProduct.planType} />
                </div>
                <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
                  <div>
                    <div className="text-[#808080] text-xs">Amount</div>
                    <div className="text-gold font-black text-xl font-display">
                      ₹{selectedProduct.price.toLocaleString("en-IN")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[#808080] text-xs">UPI ID</div>
                    <div className="text-white font-mono text-xs">{UPI_ID}</div>
                  </div>
                </div>
              </div>

              {/* Re-open UPI button */}
              <Button
                type="button"
                variant="outline"
                onClick={handleOpenUpiAgain}
                className="w-full border-gold/30 text-gold bg-transparent hover:bg-gold/10 font-bold rounded-xl h-10 flex items-center gap-2"
                data-ocid="products.open_upi.button"
              >
                <ExternalLink size={15} />
                Open UPI App Again
              </Button>

              {/* UTR input */}
              <div className="space-y-1.5">
                <Label className="text-[#A0A0A0] text-sm">
                  UTR / Transaction ID *
                </Label>
                <Input
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  placeholder="e.g. 123456789012"
                  className="bg-surface-3 border-gold/20 text-white placeholder:text-[#404040]"
                  data-ocid="products.utr.input"
                />
                <p className="text-[#505050] text-xs">
                  Find the UTR/Ref number in your UPI app transaction history.
                </p>
              </div>

              {/* Screenshot */}
              <div className="space-y-1.5">
                <Label className="text-[#A0A0A0] text-sm">
                  Payment Screenshot (optional)
                </Label>
                <label
                  className="flex items-center gap-2 cursor-pointer rounded-lg px-3 py-2.5 border border-dashed border-gold/20 hover:border-gold/40 transition-colors"
                  style={{ background: "#0A0A0A" }}
                  data-ocid="products.screenshot.upload_button"
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <span className="text-[#606060] text-sm">
                    {screenshotUrl ? (
                      <span className="text-green-400 flex items-center gap-1">
                        <CheckCircle size={14} /> Screenshot uploaded
                      </span>
                    ) : (
                      "Click to upload screenshot"
                    )}
                  </span>
                </label>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full bg-gold hover:bg-gold-light text-black font-black h-11 rounded-xl"
                data-ocid="products.payment.submit_button"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  "Submit Payment"
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Keep backward-compat export
export { ProductsPage as PlansPage };
