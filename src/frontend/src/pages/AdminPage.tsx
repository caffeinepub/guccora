import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import {
  Bell,
  CheckCircle,
  CreditCard,
  Edit2,
  ImageIcon,
  LayoutDashboard,
  Package,
  Plus,
  Shield,
  ShoppingBag,
  Trash2,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PLANS, useGuccora } from "../context/GuccoraContext";
import { db, isFirebaseConfigured } from "../firebase";
import { useProducts } from "../hooks/useProducts";
import type { Product } from "../hooks/useProducts";
import { callApproveOrder } from "../utils/mlmFunctions";

type FirestoreUser = {
  id: string;
  name?: string;
  phone?: string;
  wallet?: number;
  sponsorId?: string;
  position?: string;
  isActive?: boolean;
  userStatus?: "active" | "inactive" | "hold";
  directIncome?: number;
  levelIncome?: number;
  pairIncome?: number;
  leftCount?: number;
  rightCount?: number;
  referralCode?: string;
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    pending: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20",
    approved: "bg-green-400/10 text-green-400 border-green-400/20",
    rejected: "bg-red-400/10 text-red-400 border-red-400/20",
    active: "bg-green-400/10 text-green-400 border-green-400/20",
    inactive: "bg-red-400/10 text-red-400 border-red-400/20",
    hold: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20",
    none: "bg-surface-3 text-[#808080] border-white/10",
  };
  return (
    <span
      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
        variants[status] ?? variants.none
      }`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── Product Form ──────────────────────────────────────────────────────────────
type ProductFormState = {
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  planType: string;
};

function emptyFormState(): ProductFormState {
  return {
    name: "",
    description: "",
    price: "",
    imageUrl: "",
    planType: "starter",
  };
}

function productToFormState(p: Product): ProductFormState {
  return {
    name: p.name,
    description: p.description,
    price: String(p.price),
    imageUrl: p.imageUrl ?? "",
    planType: p.planType ?? "starter",
  };
}

interface ProductFormProps {
  initial?: ProductFormState;
  onSubmit: (data: ProductFormState) => void;
  onCancel?: () => void;
  submitLabel?: string;
}

function ProductForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = "Add Product",
}: ProductFormProps) {
  const [form, setForm] = useState<ProductFormState>(
    initial ?? emptyFormState(),
  );
  const [imageLoading, setImageLoading] = useState(false);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageLoading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setForm((p) => ({ ...p, imageUrl: base64 }));
      setImageLoading(false);
    };
    reader.onerror = () => {
      toast.error("Failed to read image file");
      setImageLoading(false);
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.price) {
      toast.error("Name and price are required");
      return;
    }
    const price = Number.parseFloat(form.price);
    if (Number.isNaN(price) || price <= 0) {
      toast.error("Enter a valid price");
      return;
    }
    onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Image Upload */}
      <div className="space-y-2">
        <Label className="text-[#A0A0A0] text-xs flex items-center gap-1.5">
          <ImageIcon size={11} /> Product Image
        </Label>

        {/* Preview */}
        {form.imageUrl && (
          <div
            className="w-full rounded-xl border border-gold/20 overflow-hidden"
            style={{ background: "#0A0A0A", height: "150px" }}
          >
            <img
              src={form.imageUrl}
              alt="Preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}

        {/* Upload button */}
        <label
          className="flex items-center justify-center gap-2 w-full h-9 rounded-xl border border-gold/40 cursor-pointer text-gold text-sm font-semibold hover:bg-gold/5 transition-colors"
          style={{ background: "#141414" }}
          data-ocid="admin.product_image.upload_button"
        >
          {imageLoading ? (
            <span className="text-xs text-[#A0A0A0]">Loading…</span>
          ) : (
            <>
              <ImageIcon size={13} />
              {form.imageUrl ? "Change Image" : "Choose Image"}
            </>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
        </label>

        {/* Clear button */}
        {form.imageUrl && (
          <button
            type="button"
            onClick={() => setForm((p) => ({ ...p, imageUrl: "" }))}
            className="text-xs text-red-400 hover:text-red-300 underline underline-offset-2"
            data-ocid="admin.product_image.delete_button"
          >
            Remove image
          </button>
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-[#A0A0A0] text-xs">Product Name *</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          placeholder="e.g. Premium Hair Oil"
          className="bg-surface-3 border-gold/20 text-white text-sm h-9"
          data-ocid="admin.product_name.input"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-[#A0A0A0] text-xs">Description</Label>
        <Textarea
          value={form.description}
          onChange={(e) =>
            setForm((p) => ({ ...p, description: e.target.value }))
          }
          placeholder="Short product description..."
          className="bg-surface-3 border-gold/20 text-white text-sm resize-none"
          rows={2}
          data-ocid="admin.product_description.textarea"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-[#A0A0A0] text-xs">Price (₹) *</Label>
        <Input
          type="number"
          value={form.price}
          onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
          placeholder="e.g. 499"
          min="0"
          className="bg-surface-3 border-gold/20 text-white text-sm h-9"
          data-ocid="admin.product_price.input"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-[#A0A0A0] text-xs">Plan Type *</Label>
        <select
          value={form.planType}
          onChange={(e) => setForm((p) => ({ ...p, planType: e.target.value }))}
          className="w-full bg-surface-3 border border-gold/20 text-white text-sm h-9 rounded-lg px-3 focus:outline-none focus:border-gold/50"
          data-ocid="admin.product_plan_type.select"
        >
          <option value="starter">Starter</option>
          <option value="silver">Silver</option>
          <option value="gold">Gold</option>
          <option value="platinum">Platinum</option>
        </select>
      </div>
      <div className="flex gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1 border-gold/20 text-[#808080] hover:text-white h-9 rounded-xl text-sm"
            data-ocid="admin.product.cancel_button"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          className="flex-1 bg-gold hover:bg-gold-light text-black font-bold h-9 rounded-xl text-sm"
          data-ocid="admin.product.submit_button"
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

// ── Products Tab ──────────────────────────────────────────────────────────────
function ProductsTab() {
  const { products, addProduct, updateProduct, deleteProduct } = useProducts();
  const { isAdmin } = useGuccora();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  async function handleAdd(form: ProductFormState) {
    await addProduct({
      name: form.name,
      description: form.description,
      price: Number.parseFloat(form.price),
      imageUrl: form.imageUrl,
      planType: (form.planType || "starter") as
        | "starter"
        | "silver"
        | "gold"
        | "platinum",
    });
    setShowAddForm(false);
    toast.success("Product added!");
  }

  function handleUpdate(id: string, form: ProductFormState) {
    updateProduct(id, {
      name: form.name,
      description: form.description,
      price: Number.parseFloat(form.price),
      imageUrl: form.imageUrl,
      planType: (form.planType || "starter") as
        | "starter"
        | "silver"
        | "gold"
        | "platinum",
    });
    setEditingId(null);
    toast.success("Product updated!");
  }

  function handleDelete(id: string) {
    if (!isAdmin) {
      alert("Only admin can delete products");
      return;
    }
    if (!window.confirm("Delete this product? This cannot be undone.")) return;
    deleteProduct(id);
    toast.success("Product deleted");
  }

  return (
    <div className="space-y-4">
      {/* Add Product Form */}
      {showAddForm ? (
        <div
          className="rounded-2xl p-4 border border-gold/15"
          style={{ background: "#141414" }}
          data-ocid="admin.product.panel"
        >
          <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
            <Plus size={14} className="text-gold" /> Add New Product
          </h3>
          <ProductForm
            onSubmit={handleAdd}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      ) : (
        <Button
          onClick={() => setShowAddForm(true)}
          className="w-full bg-gold hover:bg-gold-light text-black font-bold h-10 rounded-xl text-sm"
          data-ocid="admin.add_product.primary_button"
        >
          <Plus size={16} className="mr-2" /> Add New Product
        </Button>
      )}

      {/* Products List */}
      <div
        className="rounded-2xl border border-gold/10 overflow-hidden"
        style={{ background: "#141414" }}
        data-ocid="admin.products.table"
      >
        <div className="px-4 py-3 border-b border-gold/10 flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm">Products</h3>
          <Badge className="bg-gold/10 text-gold border-gold/20 text-[9px]">
            {products.length}
          </Badge>
        </div>

        {products.length === 0 ? (
          <div
            className="text-center py-8 text-[#606060]"
            data-ocid="admin.products.empty_state"
          >
            <Package size={28} className="mx-auto mb-2 text-gold/20" />
            <p className="text-sm">No products yet</p>
            <p className="text-xs mt-1">Add your first product above</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {products.map((product, i) =>
              editingId === product.id ? (
                <div
                  key={product.id}
                  className="p-4"
                  data-ocid={`admin.product.item.${i + 1}`}
                >
                  <p className="text-[#A0A0A0] text-xs mb-3">Editing product</p>
                  <ProductForm
                    initial={productToFormState(product)}
                    onSubmit={(form) => handleUpdate(product.id, form)}
                    onCancel={() => setEditingId(null)}
                    submitLabel="Save Changes"
                  />
                </div>
              ) : (
                <div
                  key={product.id}
                  className="flex items-center gap-3 px-4 py-3"
                  data-ocid={`admin.product.item.${i + 1}`}
                >
                  {/* Thumbnail */}
                  <div
                    className="w-10 h-10 rounded-lg border border-gold/10 flex items-center justify-center overflow-hidden flex-shrink-0"
                    style={{ background: "#0A0A0A" }}
                  >
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package size={14} className="text-gold/30" />
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">
                      {product.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-gold text-xs font-bold">
                        ₹{product.price.toLocaleString("en-IN")}
                      </p>
                      {product.planType && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gold/10 text-gold border border-gold/20 uppercase">
                          {product.planType}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditingId(product.id)}
                      className="w-7 h-7 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 flex items-center justify-center transition-colors"
                      data-ocid={`admin.product.edit_button.${i + 1}`}
                    >
                      <Edit2 size={12} />
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDelete(product.id)}
                        className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-colors"
                        data-ocid={`admin.product.delete_button.${i + 1}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Orders Tab ────────────────────────────────────────────────────────────────────────────────
type GlobalOrder = {
  id: string;
  userId?: string;
  userName: string;
  phone: string;
  productName: string;
  amount: number;
  status: "pending" | "approved";
  isAmountAdded?: boolean;
  date: string;
  createdAt?: { seconds: number; nanoseconds: number } | null;
};

function OrdersTab() {
  const [orders, setOrders] = useState<GlobalOrder[]>([]);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // ── Load orders from Firestore in real-time ────────────────────────────
  useEffect(() => {
    // Load from localStorage immediately as primary source
    try {
      const stored = localStorage.getItem("orders");
      if (stored) {
        const localOrders = JSON.parse(stored) as GlobalOrder[];
        setOrders(localOrders);
      }
    } catch {
      // ignore
    }

    // Also listen for storage changes from other tabs
    function onStorage() {
      try {
        const stored = localStorage.getItem("orders");
        if (stored) setOrders(JSON.parse(stored) as GlobalOrder[]);
      } catch {}
    }
    window.addEventListener("storage", onStorage);

    const ordersRef = collection(db, "orders");
    const unsubscribe = onSnapshot(
      ordersRef,
      (snap) => {
        const fetched: GlobalOrder[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: data.userId ?? "",
            userName: data.userName ?? data.name ?? "Unknown",
            phone: data.phone ?? "",
            productName: data.productName ?? data.product ?? "",
            amount: data.amount ?? 0,
            status: data.status ?? "pending",
            isAmountAdded: data.isAmountAdded ?? false,
            date: data.createdAt?.seconds
              ? new Date(data.createdAt.seconds * 1000).toLocaleDateString(
                  "en-IN",
                  {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  },
                )
              : (data.date ?? ""),
            createdAt: data.createdAt ?? null,
          };
        });
        // Sort by createdAt descending (newest first)
        fetched.sort((a, b) => {
          const aTime = a.createdAt?.seconds ?? 0;
          const bTime = b.createdAt?.seconds ?? 0;
          return bTime - aTime;
        });
        setOrders(fetched);
      },
      () => {
        // Firestore unavailable — keep localStorage data already loaded
      },
    );
    return () => {
      unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const displayed =
    filter === "pending"
      ? orders.filter((o) => o.status === "pending")
      : orders;

  async function handleApprove(orderId: string) {
    if (!orderId) {
      toast.error("Order not found.");
      return;
    }
    setApprovingId(orderId);
    try {
      // Try Firebase Cloud Function first (works when real credentials are set)
      await callApproveOrder(orderId);
      toast.success("Order approved! Income distributed securely.");
      return;
    } catch {
      // Firebase not configured — fall back to localStorage approval
    }

    // ── localStorage fallback ──────────────────────────────────────────
    try {
      const raw = localStorage.getItem("orders");
      const allOrders: GlobalOrder[] = raw ? JSON.parse(raw) : [];
      const idx = allOrders.findIndex((o) => o.id === orderId);

      if (idx === -1) {
        toast.error("Order not found in records.");
        setApprovingId(null);
        return;
      }

      const order = allOrders[idx];

      // Guard: already approved
      if (order.status === "approved" || order.isAmountAdded) {
        toast.error("This order is already approved.");
        setApprovingId(null);
        return;
      }

      // Update status and flag
      allOrders[idx] = { ...order, status: "approved", isAmountAdded: true };
      localStorage.setItem("orders", JSON.stringify(allOrders));

      // Credit admin wallet (once only)
      try {
        const adminWalletRaw = localStorage.getItem("guccora_admin_wallet");
        const adminWallet = adminWalletRaw
          ? JSON.parse(adminWalletRaw)
          : { balance: 0, history: [] };
        adminWallet.balance = (adminWallet.balance || 0) + order.amount;
        adminWallet.history = [
          { orderId, amount: order.amount, date: new Date().toISOString() },
          ...(adminWallet.history || []),
        ];
        localStorage.setItem(
          "guccora_admin_wallet",
          JSON.stringify(adminWallet),
        );
      } catch {
        // wallet update non-critical
      }

      // ── MLM income distribution (localStorage fallback) ──────────────────
      try {
        type FullUser = {
          id: string;
          name?: string;
          phone?: string;
          wallet?: number;
          sponsorId?: string | null;
          position?: string | null;
          isActive?: boolean;
          userStatus?: "active" | "inactive" | "hold";
          planStatus?: string;
          directIncome?: number;
          levelIncome?: number;
          pairIncome?: number;
          leftCount?: number;
          rightCount?: number;
          referralCode?: string;
          leftChild?: string | null;
          rightChild?: string | null;
        };

        const allUsers: FullUser[] = JSON.parse(
          localStorage.getItem("users") || "[]",
        );

        const updateUserInStorage = (
          userId: string,
          updates: Partial<FullUser>,
        ) => {
          const idx = allUsers.findIndex(
            (u) => u.id === userId || u.phone === userId,
          );
          if (idx !== -1) {
            allUsers[idx] = { ...allUsers[idx], ...updates };
          }
        };

        // 1. Activate the buyer
        const buyer = allUsers.find(
          (u) => u.id === order.userId || u.phone === order.phone,
        );
        if (buyer) {
          updateUserInStorage(buyer.id, {
            isActive: true,
            userStatus: "active",
            planStatus: "active",
          });
        }

        // 2. MLM income amounts — derive from plan based on order amount
        const matchedPlan = PLANS.find(
          (p) =>
            p.price === order.amount ||
            String(p.price) === String(order.amount),
        );
        const directAmt = matchedPlan?.directIncome ?? 40;
        const levelAmt = matchedPlan?.levelIncome ?? 5;
        const pairAmt = matchedPlan?.pairIncome ?? 3;

        // 3. Direct income to sponsor
        if (buyer?.sponsorId) {
          const sponsor = allUsers.find(
            (u) =>
              u.id === buyer.sponsorId || u.referralCode === buyer.sponsorId,
          );
          if (sponsor) {
            updateUserInStorage(sponsor.id, {
              wallet: (sponsor.wallet || 0) + directAmt,
              directIncome: (sponsor.directIncome || 0) + directAmt,
            });
          }
        }

        // 4. Level income — walk up 10 levels from buyer's sponsor
        let currentId: string | null | undefined = buyer?.sponsorId;
        let level = 0;
        while (currentId && level < 10) {
          const upline = allUsers.find(
            (u) => u.id === currentId || u.referralCode === currentId,
          );
          if (!upline) break;
          updateUserInStorage(upline.id, {
            wallet: (upline.wallet || 0) + levelAmt,
            levelIncome: (upline.levelIncome || 0) + levelAmt,
          });
          currentId = upline.sponsorId ?? null;
          level++;
        }

        // 5. Pair income — walk up 10 levels, credit ₹3 per matched pair
        currentId = buyer?.sponsorId;
        level = 0;
        while (currentId && level < 10) {
          const upline = allUsers.find(
            (u) => u.id === currentId || u.referralCode === currentId,
          );
          if (!upline) break;
          const leftCount = upline.leftCount || 0;
          const rightCount = upline.rightCount || 0;
          const newLeftCount =
            buyer?.position === "left" ? leftCount + 1 : leftCount;
          const newRightCount =
            buyer?.position === "right" ? rightCount + 1 : rightCount;
          const pairs = Math.min(newLeftCount, newRightCount);
          const prevPairs = Math.min(leftCount, rightCount);
          if (pairs > prevPairs) {
            updateUserInStorage(upline.id, {
              wallet: (upline.wallet || 0) + pairAmt,
              pairIncome: (upline.pairIncome || 0) + pairAmt,
              leftCount: newLeftCount,
              rightCount: newRightCount,
            });
          } else {
            updateUserInStorage(upline.id, {
              leftCount: newLeftCount,
              rightCount: newRightCount,
            });
          }
          currentId = upline.sponsorId ?? null;
          level++;
        }

        // Save all user updates at once
        localStorage.setItem("users", JSON.stringify(allUsers));
      } catch (incomeErr) {
        console.warn(
          "MLM income distribution error (non-critical):",
          incomeErr,
        );
      }

      // Update local state immediately — no reload needed
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, status: "approved", isAmountAdded: true }
            : o,
        ),
      );

      toast.success(
        "Order approved! Income distributed to sponsor and upline.",
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Approval failed. Try again.";
      toast.error(message);
    } finally {
      setApprovingId(null);
    }
  }

  const pendingCount = orders.filter((o) => o.status === "pending").length;

  return (
    <div className="space-y-4">
      {/* Filter Toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setFilter("pending")}
          className={`flex-1 h-8 rounded-lg text-xs font-semibold transition-all ${
            filter === "pending"
              ? "bg-gold text-black"
              : "bg-surface-3 text-[#808080] border border-gold/10"
          }`}
          data-ocid="admin.orders.filter_pending"
        >
          Pending{pendingCount > 0 ? ` (${pendingCount})` : ""}
        </button>
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`flex-1 h-8 rounded-lg text-xs font-semibold transition-all ${
            filter === "all"
              ? "bg-gold text-black"
              : "bg-surface-3 text-[#808080] border border-gold/10"
          }`}
          data-ocid="admin.orders.filter_all"
        >
          All Orders ({orders.length})
        </button>
      </div>

      <div
        className="rounded-2xl border border-gold/10 overflow-hidden"
        style={{ background: "#141414" }}
        data-ocid="admin.orders.panel"
      >
        <div className="px-4 py-3 border-b border-gold/10 flex items-center justify-between">
          <h2 className="text-white font-semibold text-sm">
            {filter === "pending" ? "Pending Orders" : "All Orders"}
          </h2>
          <Badge className="bg-gold/10 text-gold border-gold/20 text-[9px]">
            {displayed.length}
          </Badge>
        </div>

        {displayed.length === 0 ? (
          <div
            className="text-center py-10 text-[#606060]"
            data-ocid="admin.orders.empty_state"
          >
            <ShoppingBag size={28} className="mx-auto mb-2 text-gold/20" />
            <p className="text-sm">
              {filter === "pending" ? "No pending orders" : "No orders yet"}
            </p>
            <p className="text-xs mt-1">
              {filter === "pending"
                ? "All caught up!"
                : "Orders will appear here after users purchase products"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {displayed.map((order, i) => (
              <div
                key={order.id}
                className="px-4 py-3"
                data-ocid={`admin.order.item.${i + 1}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">
                      {order.userName}
                    </p>
                    <p className="text-[#606060] text-xs">{order.phone}</p>
                    <p className="text-[#808080] text-xs mt-0.5 truncate">
                      {order.productName}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 ml-3 flex-shrink-0">
                    <span className="text-gold font-bold text-sm">
                      ₹{order.amount.toLocaleString("en-IN")}
                    </span>
                    <StatusBadge status={order.status} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[#505050] text-[10px]">{order.date}</p>
                  {order.status === "pending" && (
                    <Button
                      size="sm"
                      onClick={() => handleApprove(order.id)}
                      disabled={approvingId === order.id}
                      className="h-7 px-3 bg-green-500/20 text-green-400 hover:bg-green-500/30 text-xs rounded-lg disabled:opacity-60"
                      data-ocid={`admin.order.approve_button.${i + 1}`}
                    >
                      {approvingId === order.id ? (
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded-full border-2 border-green-400 border-t-transparent animate-spin" />
                          Processing...
                        </span>
                      ) : (
                        <>
                          <CheckCircle size={12} className="mr-1" /> Approve
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Firestore Users Section ───────────────────────────────────────────────────
function FirestoreUsersSection() {
  const { adminSetUserStatus } = useGuccora();
  const [firestoreUsers, setFirestoreUsers] = useState<FirestoreUser[]>([]);
  const [localUsers, setLocalUsers] = useState<FirestoreUser[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingStatusId, setSettingStatusId] = useState<string | null>(null);

  // Load from localStorage immediately (sync, no Firestore needed)
  useEffect(() => {
    function loadLocal() {
      try {
        const stored = JSON.parse(
          localStorage.getItem("users") || "[]",
        ) as FirestoreUser[];
        setLocalUsers(stored);
      } catch {
        setLocalUsers([]);
      }
    }
    loadLocal();

    // Re-load when another tab writes to "users"
    function onStorage(e: StorageEvent) {
      if (e.key === "users") loadLocal();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Also listen to localStorage changes within same tab (after status changes)
  function reloadLocal() {
    try {
      const stored = JSON.parse(
        localStorage.getItem("users") || "[]",
      ) as FirestoreUser[];
      setLocalUsers(stored);
    } catch {
      setLocalUsers([]);
    }
  }

  // Also try Firestore (secondary — works only when credentials are real)
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "users"),
      (snap) => {
        const users: FirestoreUser[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<FirestoreUser, "id">),
        }));
        setFirestoreUsers(users);
      },
      () => {
        // Firestore unavailable — localStorage data shown instead
      },
    );
    return () => unsubscribe();
  }, []);

  // Merge: localStorage is base, Firestore overwrites if available
  const allDisplayUsers = useMemo(() => {
    const merged = new Map<string, FirestoreUser>();
    for (const u of localUsers) merged.set(u.id, u);
    for (const u of firestoreUsers) merged.set(u.id, u);
    return Array.from(merged.values());
  }, [firestoreUsers, localUsers]);

  async function handleSetStatus(
    user: FirestoreUser,
    status: "active" | "inactive" | "hold",
  ) {
    setSettingStatusId(user.id);
    try {
      adminSetUserStatus(user.id, status);
      reloadLocal();
      const labels: Record<string, string> = {
        active: "Activated",
        inactive: "Deactivated",
        hold: "Put on Hold",
      };
      toast.success(`${user.name ?? user.phone ?? "User"} — ${labels[status]}`);
    } catch {
      toast.error("Failed to update status");
    } finally {
      setSettingStatusId(null);
    }
  }

  async function handleDeleteUser(user: FirestoreUser) {
    const confirmed = window.confirm(
      `Delete ${user.name ?? user.phone ?? "this user"}? This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingId(user.id);
    try {
      // Remove user from localStorage "users" key only — do NOT touch wallet or orders
      const stored: FirestoreUser[] = JSON.parse(
        localStorage.getItem("users") || "[]",
      );
      const updated = stored.filter((u) => u.id !== user.id);
      localStorage.setItem("users", JSON.stringify(updated));

      // Update both state arrays instantly so UI reflects the change immediately
      setLocalUsers(updated);
      setFirestoreUsers((prev) => prev.filter((u) => u.id !== user.id));

      // Also delete from Firestore if configured (non-blocking)
      if (isFirebaseConfigured) {
        try {
          await deleteDoc(doc(db, "users", user.id));
        } catch {
          // ignore — localStorage delete already succeeded
        }
      }

      toast.success(
        `${user.name ?? user.phone ?? "User"} deleted successfully`,
      );
    } catch (err) {
      console.error("Delete user error:", err);
      toast.error("Failed to delete user. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  if (allDisplayUsers.length === 0) {
    return (
      <div
        className="rounded-2xl border border-gold/10 overflow-hidden mb-4"
        style={{ background: "#141414" }}
      >
        <div className="px-4 py-3 border-b border-gold/10">
          <h2 className="text-white font-semibold text-sm">Registered Users</h2>
        </div>
        <div className="text-center py-8 text-[#606060]">
          <Users size={28} className="mx-auto mb-2 text-gold/20" />
          <p className="text-sm">No users registered yet</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-gold/10 overflow-hidden mb-4"
      style={{ background: "#141414" }}
      data-ocid="admin.firestore_users.panel"
    >
      <div className="px-4 py-3 border-b border-gold/10 flex items-center justify-between">
        <h2 className="text-white font-semibold text-sm">Registered Users</h2>
        <Badge className="bg-gold/10 text-gold border-gold/20 text-[9px]">
          {allDisplayUsers.length}
        </Badge>
      </div>

      <div className="divide-y divide-white/5">
        {allDisplayUsers.map((user, i) => {
          const status: "active" | "inactive" | "hold" =
            user.userStatus ?? (user.isActive ? "active" : "inactive");
          return (
            <div
              key={user.id}
              className="px-4 py-3"
              data-ocid={`admin.firestore_user.item.${i + 1}`}
            >
              {/* Top row: avatar + info + status badge */}
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-gold/15 border border-gold/25 flex items-center justify-center flex-shrink-0">
                  <span className="text-gold text-xs font-bold">
                    {(user.name ?? user.phone ?? "?").charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {user.name ?? "—"}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[#606060] text-xs">
                      {user.phone ?? "—"}
                    </p>
                    {user.wallet !== undefined && (
                      <p className="text-gold text-xs font-semibold">
                        ₹{user.wallet.toLocaleString("en-IN")}
                      </p>
                    )}
                  </div>
                </div>
                <StatusBadge status={status} />
              </div>

              {/* Bottom row: status action buttons + delete */}
              <div className="flex items-center gap-1.5 ml-11">
                <button
                  type="button"
                  onClick={() => handleSetStatus(user, "active")}
                  disabled={settingStatusId === user.id || status === "active"}
                  className={`flex-1 h-7 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-40 ${
                    status === "active"
                      ? "bg-green-500/30 text-green-400 border border-green-500/40 cursor-default"
                      : "bg-green-500/10 text-green-400 hover:bg-green-500/25 border border-green-500/20"
                  }`}
                  data-ocid={`admin.user.status_active.${i + 1}`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => handleSetStatus(user, "inactive")}
                  disabled={
                    settingStatusId === user.id || status === "inactive"
                  }
                  className={`flex-1 h-7 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-40 ${
                    status === "inactive"
                      ? "bg-red-500/30 text-red-400 border border-red-500/40 cursor-default"
                      : "bg-red-500/10 text-red-400 hover:bg-red-500/25 border border-red-500/20"
                  }`}
                  data-ocid={`admin.user.status_inactive.${i + 1}`}
                >
                  Inactive
                </button>
                <button
                  type="button"
                  onClick={() => handleSetStatus(user, "hold")}
                  disabled={settingStatusId === user.id || status === "hold"}
                  className={`flex-1 h-7 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-40 ${
                    status === "hold"
                      ? "bg-yellow-400/30 text-yellow-400 border border-yellow-400/40 cursor-default"
                      : "bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/25 border border-yellow-400/20"
                  }`}
                  data-ocid={`admin.user.status_hold.${i + 1}`}
                >
                  Hold
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteUser(user)}
                  disabled={deletingId === user.id}
                  className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-colors disabled:opacity-50 flex-shrink-0"
                  data-ocid={`admin.firestore_user.delete_button.${i + 1}`}
                >
                  {deletingId === user.id ? (
                    <span className="w-3 h-3 rounded-full border-2 border-red-400 border-t-transparent animate-spin" />
                  ) : (
                    <Trash2 size={12} />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main AdminPage ─────────────────────────────────────────────────────────────
export function AdminPage() {
  const {
    userData,
    isAdmin,
    adminApproveKyc,
    adminRejectKyc,
    adminApproveWithdrawal,
    adminRejectWithdrawal,
    adminAdjustWallet,
    adminAdjustUserWallet,
    getWalletMap,
    adminSendNotification,
  } = useGuccora();

  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustDesc, setAdjustDesc] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("current");
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMsg, setNotifMsg] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [allPaymentRequests, setAllPaymentRequests] = useState<any[]>([]);

  // Fetch all payment requests from Firestore so admin sees ALL users
  useEffect(() => {
    if (!isAdmin) return;
    const unsub = onSnapshot(collection(db, "paymentRequests"), (snap) => {
      setAllPaymentRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [isAdmin]);

  async function handleApproveFirestorePayment(req: any) {
    try {
      await setDoc(
        doc(db, "paymentRequests", req.id),
        { status: "approved" },
        { merge: true },
      );
      if (req.userId) {
        await setDoc(
          doc(db, "users", req.userId),
          {
            paidUser: true,
            selectedPlan: Number(req.planId),
            planStatus: "active",
            isActive: true,
            userStatus: "active",
          },
          { merge: true },
        );
      }
      setAllPaymentRequests((prev) =>
        prev.map((r) => (r.id === req.id ? { ...r, status: "approved" } : r)),
      );
      toast.success("Payment approved — plan activated!");
    } catch {
      toast.error("Failed to approve. Try again.");
    }
  }

  async function handleRejectFirestorePayment(req: any) {
    try {
      await setDoc(
        doc(db, "paymentRequests", req.id),
        { status: "rejected" },
        { merge: true },
      );
      setAllPaymentRequests((prev) =>
        prev.map((r) => (r.id === req.id ? { ...r, status: "rejected" } : r)),
      );
      toast.success("Payment rejected");
    } catch {
      toast.error("Failed to reject. Try again.");
    }
  }

  const pendingWithdrawals = userData.withdrawals.filter(
    (w) => w.status === "pending",
  );
  const isKycPending = userData.kycStatus === "pending";

  // Admin dashboard stats
  const totalUsers = userData.team.length + 1;
  const activeUsers =
    userData.team.filter((m) => m.isActive).length +
    (userData.isActive ? 1 : 0);
  const withdrawRequests = userData.withdrawals.filter(
    (w) => w.status === "pending",
  ).length;
  const kycPendingCount = userData.kycStatus === "pending" ? 1 : 0;
  const planApprovals = userData.paymentRequests.filter(
    (r) => r.status === "pending",
  ).length;

  const totalOrders = (() => {
    try {
      const stored = localStorage.getItem("orders");
      return stored ? (JSON.parse(stored) as unknown[]).length : 0;
    } catch {
      return 0;
    }
  })();

  const adminWalletBalance = (() => {
    try {
      const stored = localStorage.getItem("guccora_admin_wallet");
      if (stored) {
        const w = JSON.parse(stored) as { balance: number };
        return w.balance;
      }
    } catch {
      // ignore
    }
    return 0;
  })();

  const walletMap = getWalletMap();

  function handleAdjust() {
    const amt = Number.parseFloat(adjustAmount);
    if (Number.isNaN(amt)) {
      toast.error("Enter a valid amount");
      return;
    }
    if (selectedUserId === "current") {
      adminAdjustWallet(amt, adjustDesc || "Admin adjustment");
      toast.success(`Wallet adjusted by ₹${amt}`);
    } else {
      adminAdjustUserWallet(
        selectedUserId,
        amt,
        adjustDesc || "Admin adjustment",
      );
      const member = userData.team.find((m) => m.principal === selectedUserId);
      toast.success(
        `Wallet for ${member?.name ?? selectedUserId} adjusted by ₹${amt}`,
      );
    }
    setAdjustAmount("");
    setAdjustDesc("");
  }

  function handleNotification() {
    if (!notifTitle || !notifMsg) {
      toast.error("Title and message required");
      return;
    }
    adminSendNotification(notifTitle, notifMsg);
    setNotifTitle("");
    setNotifMsg("");
    toast.success("Notification sent!");
  }

  return (
    <div className="px-4 py-5 max-w-lg mx-auto animate-fade-in">
      {/* Admin Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center">
          <Shield size={20} className="text-gold" />
        </div>
        <div>
          <h1 className="text-white font-black font-display text-xl">
            Admin Panel
          </h1>
          <p className="text-[#606060] text-xs">GUCCORA Management Console</p>
        </div>
      </div>

      <Tabs defaultValue="dashboard" data-ocid="admin.tabs.tab">
        <TabsList className="grid grid-cols-6 bg-surface-2 border border-gold/10 rounded-xl mb-4 h-9 w-full">
          <TabsTrigger
            value="dashboard"
            className="text-[10px] data-[state=active]:bg-gold data-[state=active]:text-black rounded-lg"
          >
            <LayoutDashboard size={12} />
          </TabsTrigger>
          <TabsTrigger
            value="users"
            className="text-[10px] data-[state=active]:bg-gold data-[state=active]:text-black rounded-lg"
          >
            <Users size={12} />
          </TabsTrigger>
          <TabsTrigger
            value="payments"
            className="text-[10px] data-[state=active]:bg-gold data-[state=active]:text-black rounded-lg"
          >
            <CreditCard size={12} />
          </TabsTrigger>
          <TabsTrigger
            value="products"
            className="text-[10px] data-[state=active]:bg-gold data-[state=active]:text-black rounded-lg"
          >
            <Package size={12} />
          </TabsTrigger>
          <TabsTrigger
            value="orders"
            className="text-[10px] data-[state=active]:bg-gold data-[state=active]:text-black rounded-lg"
            data-ocid="admin.orders.tab"
          >
            <ShoppingBag size={12} />
          </TabsTrigger>
          <TabsTrigger
            value="more"
            className="text-[10px] data-[state=active]:bg-gold data-[state=active]:text-black rounded-lg"
          >
            <Bell size={12} />
          </TabsTrigger>
        </TabsList>

        {/* Dashboard */}
        <TabsContent value="dashboard">
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              {
                label: "Total Users",
                value: totalUsers.toString(),
                color: "text-blue-400",
              },
              {
                label: "Active Users",
                value: activeUsers.toString(),
                color: "text-green-400",
              },
              {
                label: "Withdraw Requests",
                value: withdrawRequests.toString(),
                color: "text-orange-400",
              },
              {
                label: "KYC Approvals",
                value: kycPendingCount.toString(),
                color: "text-yellow-400",
              },
              {
                label: "Plan Approvals",
                value: planApprovals.toString(),
                color: "text-purple-400",
              },
              {
                label: "Wallet Balance",
                value: `₹${userData.walletBalance.toLocaleString("en-IN")}`,
                color: "text-gold",
              },
              {
                label: "Admin Wallet",
                value: `₹${adminWalletBalance.toLocaleString("en-IN")}`,
                color: "text-gold",
              },
              {
                label: "Total Orders",
                value: totalOrders.toString(),
                color: "text-blue-400",
              },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="rounded-xl p-3 border border-gold/10"
                style={{ background: "#141414" }}
                data-ocid="admin.stat.card"
              >
                <div className={`font-black text-xl font-display ${color}`}>
                  {value}
                </div>
                <div className="text-[#606060] text-xs mt-1">{label}</div>
              </div>
            ))}
          </div>

          <div
            className="rounded-xl p-4 border border-gold/10"
            style={{ background: "#141414" }}
          >
            <h3 className="text-white font-semibold text-sm mb-3">
              User Overview
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-[#808080] text-xs">Name</span>
                <span className="text-white text-xs">
                  {userData.name || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#808080] text-xs">Phone</span>
                <span className="text-white text-xs">
                  {userData.phone || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#808080] text-xs">Plan</span>
                <span className="text-white text-xs">
                  {PLANS.find((p) => p.id === userData.planId)?.name ?? "None"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#808080] text-xs">Status</span>
                <StatusBadge
                  status={userData.isActive ? "active" : "inactive"}
                />
              </div>
              <div className="flex justify-between">
                <span className="text-[#808080] text-xs">Referral Code</span>
                <span className="text-gold text-xs font-mono">
                  {userData.referralCode}
                </span>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Users */}
        <TabsContent value="users">
          <FirestoreUsersSection />
        </TabsContent>

        {/* Payments + KYC + Withdrawals */}
        <TabsContent value="payments">
          <div className="space-y-4">
            {/* All Users Payment Requests (Firestore) */}
            <div
              className="rounded-2xl border border-gold/10 overflow-hidden"
              style={{ background: "#141414" }}
            >
              <div className="px-4 py-3 border-b border-gold/10 flex items-center justify-between">
                <h2 className="text-white font-semibold text-sm">
                  Payment Requests
                </h2>
                {allPaymentRequests.filter((r) => r.status === "pending")
                  .length > 0 && (
                  <span className="text-xs text-yellow-400 font-semibold">
                    {
                      allPaymentRequests.filter((r) => r.status === "pending")
                        .length
                    }{" "}
                    pending
                  </span>
                )}
              </div>
              {allPaymentRequests.length === 0 ? (
                <div
                  className="text-center py-6 text-[#606060] text-sm"
                  data-ocid="admin.payments.empty_state"
                >
                  No payment requests yet
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {allPaymentRequests.map((req, i) => {
                    const plan = PLANS.find((p) => p.id === req.planId);
                    return (
                      <div
                        key={req.id}
                        className="px-4 py-3"
                        data-ocid={`admin.payment.item.${i + 1}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-white text-sm font-semibold">
                              {req.userName || "User"} — {req.userPhone || ""}
                            </p>
                            <p className="text-[#808080] text-xs">
                              {plan?.name ?? "Plan"} — ₹{req.planId}
                            </p>
                            <p className="text-[#606060] text-xs">
                              UTR: {req.upiRef}
                            </p>
                            <p className="text-[#505050] text-xs">
                              {req.timestamp ? formatDate(req.timestamp) : ""}
                            </p>
                          </div>
                          <StatusBadge status={req.status} />
                        </div>
                        {req.screenshotUrl && (
                          <div className="mt-2 mb-2">
                            <a
                              href={req.screenshotUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              data-ocid={`admin.payment.screenshot.${i + 1}`}
                            >
                              <img
                                src={req.screenshotUrl}
                                alt="Payment screenshot"
                                className="w-16 h-16 object-cover rounded-lg border border-gold/20 hover:border-gold/50 transition-colors cursor-pointer"
                              />
                            </a>
                            <p className="text-[#505050] text-[10px] mt-1">
                              Tap to view full screenshot
                            </p>
                          </div>
                        )}
                        {req.status === "pending" && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApproveFirestorePayment(req)}
                              className="flex-1 h-7 bg-green-500/20 text-green-400 hover:bg-green-500/30 text-xs rounded-lg"
                              data-ocid={`admin.payment.confirm_button.${i + 1}`}
                            >
                              <CheckCircle size={12} className="mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleRejectFirestorePayment(req)}
                              className="flex-1 h-7 bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs rounded-lg"
                              data-ocid={`admin.payment.delete_button.${i + 1}`}
                            >
                              <XCircle size={12} className="mr-1" /> Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* KYC */}
            <div
              className="rounded-2xl border border-gold/10 overflow-hidden"
              style={{ background: "#141414" }}
            >
              <div className="px-4 py-3 border-b border-gold/10">
                <h2 className="text-white font-semibold text-sm">KYC Review</h2>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-white text-sm">
                      {userData.name || "User"}
                    </p>
                    <p className="text-[#606060] text-xs">{userData.phone}</p>
                  </div>
                  <StatusBadge status={userData.kycStatus} />
                </div>
                {isKycPending && (
                  <div className="space-y-2">
                    {userData.kycAadharFront && (
                      <img
                        src={userData.kycAadharFront}
                        alt="Aadhar Front"
                        className="w-full h-24 object-cover rounded-lg border border-gold/10"
                      />
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          adminApproveKyc();
                          toast.success("KYC approved!");
                        }}
                        className="flex-1 h-7 bg-green-500/20 text-green-400 hover:bg-green-500/30 text-xs rounded-lg"
                        data-ocid="admin.kyc.confirm_button"
                      >
                        <CheckCircle size={12} className="mr-1" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          const reason = rejectReason || "Documents unclear";
                          adminRejectKyc(reason);
                          setRejectReason("");
                          toast.success("KYC rejected");
                        }}
                        className="flex-1 h-7 bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs rounded-lg"
                        data-ocid="admin.kyc.delete_button"
                      >
                        <XCircle size={12} className="mr-1" /> Reject
                      </Button>
                    </div>
                    <Input
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Rejection reason (optional)"
                      className="bg-surface-3 border-gold/20 text-white text-xs h-8"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Withdrawals */}
            <div
              className="rounded-2xl border border-gold/10 overflow-hidden"
              style={{ background: "#141414" }}
            >
              <div className="px-4 py-3 border-b border-gold/10 flex items-center justify-between">
                <h2 className="text-white font-semibold text-sm">
                  Withdrawal Requests
                </h2>
                {pendingWithdrawals.length > 0 && (
                  <span className="text-xs text-yellow-400 font-semibold">
                    {pendingWithdrawals.length} pending
                  </span>
                )}
              </div>
              {userData.withdrawals.length === 0 ? (
                <div
                  className="text-center py-6 text-[#606060] text-sm"
                  data-ocid="admin.withdrawals.empty_state"
                >
                  No withdrawal requests
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {userData.withdrawals.map((w, i) => (
                    <div
                      key={w.id}
                      className="px-4 py-3"
                      data-ocid={`admin.withdrawal.item.${i + 1}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-white text-sm font-semibold">
                            ₹{w.amount.toLocaleString("en-IN")}
                          </p>
                          <p className="text-[#606060] text-xs">{w.upiId}</p>
                          <p className="text-[#505050] text-xs">
                            {formatDate(w.timestamp)}
                          </p>
                        </div>
                        <StatusBadge status={w.status} />
                      </div>
                      {w.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              adminApproveWithdrawal(w.id);
                              toast.success("Withdrawal approved!");
                            }}
                            className="flex-1 h-7 bg-green-500/20 text-green-400 hover:bg-green-500/30 text-xs rounded-lg"
                            data-ocid={`admin.withdrawal.confirm_button.${i + 1}`}
                          >
                            <CheckCircle size={12} className="mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              adminRejectWithdrawal(w.id);
                              toast.success("Withdrawal rejected");
                            }}
                            className="flex-1 h-7 bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs rounded-lg"
                            data-ocid={`admin.withdrawal.delete_button.${i + 1}`}
                          >
                            <XCircle size={12} className="mr-1" /> Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Products */}
        <TabsContent value="products">
          <ProductsTab />
        </TabsContent>

        {/* Orders */}
        <TabsContent value="orders">
          <OrdersTab />
        </TabsContent>

        {/* Wallet + Notifications */}
        <TabsContent value="more">
          <div className="space-y-4">
            {/* Wallet Adjust */}
            <div
              className="rounded-2xl p-4 border border-gold/15"
              style={{ background: "#141414" }}
              data-ocid="admin.wallet.panel"
            >
              <h2 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                <Wallet size={14} className="text-gold" /> Adjust Wallet
              </h2>
              <div className="space-y-3">
                {/* User Selector */}
                <div className="space-y-1">
                  <Label className="text-[#A0A0A0] text-xs">Select User</Label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full h-9 rounded-lg px-3 text-sm text-white border border-gold/20 bg-surface-3 focus:outline-none focus:border-gold/50 appearance-none"
                    data-ocid="admin.wallet.select"
                  >
                    <option value="current">
                      Current User (Admin)
                      {walletMap.current !== undefined
                        ? ` — ₹${walletMap.current}`
                        : ""}
                    </option>
                    {userData.team.map((member) => (
                      <option key={member.principal} value={member.principal}>
                        {member.name} — {member.referralCode}
                        {walletMap[member.principal] !== undefined
                          ? ` (₹${walletMap[member.principal]})`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[#A0A0A0] text-xs">
                    Amount (use − for deductions)
                  </Label>
                  <Input
                    type="number"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    placeholder="e.g. 500 or -200"
                    className="bg-surface-3 border-gold/20 text-white text-sm h-9"
                    data-ocid="admin.wallet.input"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[#A0A0A0] text-xs">Description</Label>
                  <Input
                    value={adjustDesc}
                    onChange={(e) => setAdjustDesc(e.target.value)}
                    placeholder="Reason for adjustment"
                    className="bg-surface-3 border-gold/20 text-white text-sm h-9"
                    data-ocid="admin.wallet.textarea"
                  />
                </div>
                <Button
                  onClick={handleAdjust}
                  className="w-full bg-gold hover:bg-gold-light text-black font-bold h-9 rounded-xl text-sm"
                  data-ocid="admin.wallet.submit_button"
                >
                  Apply Adjustment
                </Button>
              </div>
            </div>

            {/* Notifications */}
            <div
              className="rounded-2xl p-4 border border-gold/15"
              style={{ background: "#141414" }}
              data-ocid="admin.notifications.panel"
            >
              <h2 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                <Bell size={14} className="text-gold" /> Send Notification
              </h2>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-[#A0A0A0] text-xs">Title</Label>
                  <Input
                    value={notifTitle}
                    onChange={(e) => setNotifTitle(e.target.value)}
                    placeholder="Notification title"
                    className="bg-surface-3 border-gold/20 text-white text-sm h-9"
                    data-ocid="admin.notification_title.input"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[#A0A0A0] text-xs">Message</Label>
                  <Textarea
                    value={notifMsg}
                    onChange={(e) => setNotifMsg(e.target.value)}
                    placeholder="Type your message here..."
                    className="bg-surface-3 border-gold/20 text-white text-sm resize-none"
                    rows={3}
                    data-ocid="admin.notification_message.textarea"
                  />
                </div>
                <Button
                  onClick={handleNotification}
                  className="w-full bg-gold hover:bg-gold-light text-black font-bold h-9 rounded-xl text-sm"
                  data-ocid="admin.send_notification.primary_button"
                >
                  Send Notification
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
