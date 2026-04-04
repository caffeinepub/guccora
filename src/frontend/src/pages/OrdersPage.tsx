import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle,
  Clock,
  Edit2,
  MapPin,
  Package,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useGuccora } from "../context/GuccoraContext";

const ORDER_STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock size={14} className="text-yellow-400" />,
  processing: <Package size={14} className="text-blue-400" />,
  shipped: <Truck size={14} className="text-blue-400" />,
  delivered: <CheckCircle size={14} className="text-green-400" />,
};

const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-400 bg-yellow-400/10",
  processing: "text-blue-400 bg-blue-400/10",
  shipped: "text-blue-400 bg-blue-400/10",
  delivered: "text-green-400 bg-green-400/10",
};

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
  const badge = PLAN_TYPE_BADGE[planType?.toLowerCase()] ?? {
    label: planType ?? "Plan",
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

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type AddressFormProps = {
  initial?: {
    name: string;
    phone: string;
    line1: string;
    city: string;
    state: string;
    pincode: string;
  };
  onSave: (addr: {
    name: string;
    phone: string;
    line1: string;
    city: string;
    state: string;
    pincode: string;
  }) => void;
  onCancel?: () => void;
  submitLabel?: string;
};

function AddressForm({
  initial,
  onSave,
  onCancel,
  submitLabel = "Save Address",
}: AddressFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [line1, setLine1] = useState(initial?.line1 ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [addrState, setAddrState] = useState(initial?.state ?? "");
  const [pincode, setPincode] = useState(initial?.pincode ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !phone || !line1 || !city || !addrState || !pincode) {
      toast.error("Please fill all address fields");
      return;
    }
    onSave({ name, phone, line1, city, state: addrState, pincode });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[#A0A0A0] text-xs">Full Name *</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Recipient name"
            className="bg-surface-3 border-gold/20 text-white text-sm h-9"
            data-ocid="orders.name.input"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[#A0A0A0] text-xs">Phone *</Label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="10-digit number"
            className="bg-surface-3 border-gold/20 text-white text-sm h-9"
            data-ocid="orders.phone.input"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-[#A0A0A0] text-xs">Address Line 1 *</Label>
        <Input
          value={line1}
          onChange={(e) => setLine1(e.target.value)}
          placeholder="House No., Street, Area"
          className="bg-surface-3 border-gold/20 text-white text-sm h-9"
          data-ocid="orders.address.input"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[#A0A0A0] text-xs">City *</Label>
          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            className="bg-surface-3 border-gold/20 text-white text-sm h-9"
            data-ocid="orders.city.input"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[#A0A0A0] text-xs">State *</Label>
          <Input
            value={addrState}
            onChange={(e) => setAddrState(e.target.value)}
            placeholder="State"
            className="bg-surface-3 border-gold/20 text-white text-sm h-9"
            data-ocid="orders.state.input"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[#A0A0A0] text-xs">Pincode *</Label>
          <Input
            value={pincode}
            onChange={(e) => setPincode(e.target.value)}
            placeholder="6-digit"
            className="bg-surface-3 border-gold/20 text-white text-sm h-9"
            data-ocid="orders.pincode.input"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1 border-gold/20 text-[#808080] hover:text-white h-10 rounded-xl"
            data-ocid="orders.address.cancel_button"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          className="flex-1 bg-gold hover:bg-gold-light text-black font-bold h-10 rounded-xl"
          data-ocid="orders.address.save_button"
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function OrdersPage() {
  const { userData, saveDeliveryAddress } = useGuccora();
  const [showForm, setShowForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);

  const savedAddress = userData.savedAddress;

  function handleSaveAddress(addr: {
    name: string;
    phone: string;
    line1: string;
    city: string;
    state: string;
    pincode: string;
  }) {
    saveDeliveryAddress(addr);
    setShowForm(false);
    setEditingAddress(false);
    toast.success("Address saved successfully!");
  }

  return (
    <div className="px-4 py-5 max-w-lg mx-auto animate-fade-in">
      {/* Page Header */}
      <div className="mb-5">
        <h1 className="text-white font-black font-display text-2xl">
          My Orders
        </h1>
        <p className="text-[#606060] text-sm">Your purchase history</p>
      </div>

      {/* Saved Delivery Address Section */}
      <div className="mb-5">
        {savedAddress && !editingAddress ? (
          <div
            className="rounded-2xl p-4 border border-gold/15"
            style={{ background: "#141414" }}
            data-ocid="orders.saved_address.card"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-gold" />
                <span className="text-white font-semibold text-sm">
                  Delivery Address
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingAddress(true)}
                className="flex items-center gap-1 text-gold text-xs font-semibold bg-gold/10 px-2.5 py-1 rounded-lg"
                data-ocid="orders.address.edit_button"
              >
                <Edit2 size={11} /> Edit
              </button>
            </div>
            <div className="space-y-1">
              <p className="text-white text-sm font-semibold">
                {savedAddress.name}
              </p>
              <p className="text-[#A0A0A0] text-xs">{savedAddress.phone}</p>
              <p className="text-[#808080] text-xs">
                {savedAddress.line1}, {savedAddress.city}, {savedAddress.state}{" "}
                — {savedAddress.pincode}
              </p>
            </div>
          </div>
        ) : editingAddress ? (
          <div
            className="rounded-2xl p-4 border border-gold/15 animate-fade-in"
            style={{ background: "#141414" }}
            data-ocid="orders.edit_address.panel"
          >
            <h2 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
              <Edit2 size={14} className="text-gold" /> Edit Delivery Address
            </h2>
            <AddressForm
              initial={savedAddress}
              onSave={handleSaveAddress}
              onCancel={() => setEditingAddress(false)}
            />
          </div>
        ) : showForm ? (
          <div
            className="rounded-2xl p-4 border border-gold/15 animate-fade-in"
            style={{ background: "#141414" }}
            data-ocid="orders.add_address.panel"
          >
            <h2 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
              <MapPin size={14} className="text-gold" /> Add Delivery Address
            </h2>
            <AddressForm
              onSave={handleSaveAddress}
              onCancel={() => setShowForm(false)}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="w-full rounded-2xl p-4 border border-dashed border-gold/25 flex items-center gap-3 text-left hover:border-gold/50 transition-colors"
            style={{ background: "#0D0D0D" }}
            data-ocid="orders.add_address.button"
          >
            <div className="w-9 h-9 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
              <MapPin size={16} className="text-gold" />
            </div>
            <div>
              <p className="text-white text-sm font-semibold">
                Add Delivery Address
              </p>
              <p className="text-[#606060] text-xs">
                Save your address for shipping
              </p>
            </div>
          </button>
        )}
      </div>

      {/* Orders List */}
      <div className="mb-2">
        <div className="flex items-center gap-2 mb-3">
          <ShoppingBag size={15} className="text-gold" />
          <h2 className="text-white font-bold text-sm">Purchase History</h2>
          {userData.orders.length > 0 && (
            <span className="ml-auto text-[10px] font-bold text-gold bg-gold/10 px-2 py-0.5 rounded-full">
              {userData.orders.length}
            </span>
          )}
        </div>

        {userData.orders.length === 0 ? (
          <div
            className="text-center py-12 rounded-2xl border border-gold/10"
            style={{ background: "#141414" }}
            data-ocid="orders.list.empty_state"
          >
            <ShoppingBag size={40} className="mx-auto mb-3 text-gold/20" />
            <p className="text-[#606060] text-sm font-semibold">
              No orders yet
            </p>
            <p className="text-[#404040] text-xs mt-1">
              Buy a product to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3" data-ocid="orders.list.table">
            {userData.orders.map((order, i) => (
              <div
                key={order.id}
                className="rounded-2xl p-4 border border-gold/10"
                style={{ background: "#141414" }}
                data-ocid={`orders.order.item.${i + 1}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-bold text-sm truncate">
                      {order.productName || "Product"}
                    </p>
                    <p className="text-[#606060] text-xs mt-0.5">
                      {formatDate(order.timestamp)}
                    </p>
                  </div>
                  <span
                    className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg flex-shrink-0 ${
                      ORDER_STATUS_COLORS[order.status] ??
                      ORDER_STATUS_COLORS.pending
                    }`}
                  >
                    {ORDER_STATUS_ICONS[order.status]}
                    {order.status.charAt(0).toUpperCase() +
                      order.status.slice(1)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <PlanTypeBadge planType={order.planType || "starter"} />
                  <span className="text-gold font-black text-base font-display">
                    ₹{(order.amount ?? 0).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
