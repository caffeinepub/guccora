import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle,
  ChevronRight,
  Clock,
  CreditCard,
  Edit2,
  LogOut,
  Phone,
  Shield,
  User,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PLANS, useGuccora } from "../context/GuccoraContext";
import type { AppPage } from "../types/pages";

type ProfilePageProps = {
  onNavigate: (page: AppPage) => void;
};

export function ProfilePage({ onNavigate }: ProfilePageProps) {
  const { userData, updateProfile, updateBankDetails, isAdmin, logout } =
    useGuccora();
  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState(userData.name);
  const [phone, setPhone] = useState(userData.phone);
  const [upiId, setUpiId] = useState(userData.bankDetails?.upiId || "");

  const plan = PLANS.find((p) => p.id === userData.planId);
  const initials = userData.name
    ? userData.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "G";

  function handleSave() {
    if (!name.trim() || !phone.trim()) {
      toast.error("Name and phone required");
      return;
    }
    updateProfile(name.trim(), phone.trim());
    updateBankDetails({ ...userData.bankDetails, upiId: upiId.trim() });
    setEditMode(false);
    toast.success("Profile updated!");
  }

  function handleLogout() {
    logout();
    toast.success("Logged out");
  }

  const kycIcon = {
    none: <Shield size={14} className="text-[#606060]" />,
    pending: <Clock size={14} className="text-yellow-400" />,
    approved: <CheckCircle size={14} className="text-green-400" />,
    rejected: <XCircle size={14} className="text-red-400" />,
  }[userData.kycStatus];

  const kycLabel = {
    none: "Not submitted",
    pending: "Under review",
    approved: "Verified",
    rejected: "Rejected",
  }[userData.kycStatus];

  return (
    <div className="px-4 py-5 max-w-lg mx-auto animate-fade-in">
      {/* Avatar & Name */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-20 h-20 rounded-full bg-gold/20 border-2 border-gold/40 flex items-center justify-center mb-3">
          <span className="text-gold font-black text-2xl">{initials}</span>
        </div>
        <h1 className="text-white font-bold text-xl">
          {userData.name || "User"}
        </h1>
        <p className="text-[#606060] text-sm">{userData.phone}</p>
        {plan && userData.planStatus === "active" && (
          <Badge className="mt-2 bg-gold/15 text-gold border-gold/30 text-xs">
            {plan.name} Plan Active
          </Badge>
        )}
      </div>

      {/* Edit Profile */}
      <div
        className="rounded-2xl p-4 border border-gold/15 mb-4"
        style={{ background: "#141414" }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold text-sm">Personal Info</h2>
          <button
            type="button"
            onClick={() => (editMode ? handleSave() : setEditMode(true))}
            className="flex items-center gap-1 text-gold text-xs font-semibold"
            data-ocid="profile.edit.edit_button"
          >
            <Edit2 size={12} />
            {editMode ? "Save" : "Edit"}
          </button>
        </div>

        {editMode ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[#A0A0A0] text-xs">Full Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-surface-3 border-gold/20 text-white h-9 text-sm"
                data-ocid="profile.name.input"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[#A0A0A0] text-xs">Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bg-surface-3 border-gold/20 text-white h-9 text-sm"
                data-ocid="profile.phone.input"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[#A0A0A0] text-xs">UPI ID</Label>
              <Input
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="yourname@upi"
                className="bg-surface-3 border-gold/20 text-white h-9 text-sm"
                data-ocid="profile.upi.input"
              />
            </div>
            <Button
              onClick={handleSave}
              className="w-full bg-gold hover:bg-gold-light text-black font-bold h-9 text-sm rounded-xl"
              data-ocid="profile.save.save_button"
            >
              Save Changes
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <User size={14} className="text-gold/60" />
              <span className="text-[#808080] text-xs w-20">Name</span>
              <span className="text-white text-sm">{userData.name || "—"}</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone size={14} className="text-gold/60" />
              <span className="text-[#808080] text-xs w-20">Phone</span>
              <span className="text-white text-sm">
                {userData.phone || "—"}
              </span>
            </div>
            {userData.bankDetails?.upiId && (
              <div className="flex items-center gap-3">
                <CreditCard size={14} className="text-gold/60" />
                <span className="text-[#808080] text-xs w-20">UPI</span>
                <span className="text-white text-sm">
                  {userData.bankDetails.upiId}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Links */}
      {[
        {
          label: "KYC Verification",
          sublabel: kycLabel,
          icon: kycIcon,
          page: "kyc" as AppPage,
          ocid: "profile.kyc.link",
        },
        {
          label: "My Orders",
          sublabel: `${userData.orders.length} order(s)`,
          icon: <CreditCard size={14} className="text-gold/60" />,
          page: "orders" as AppPage,
          ocid: "profile.orders.link",
        },
        {
          label: "Notifications",
          sublabel: `${userData.notifications.filter((n) => !n.isRead).length} unread`,
          icon: <Shield size={14} className="text-gold/60" />,
          page: "notifications" as AppPage,
          ocid: "profile.notifications.link",
        },
      ].map(({ label, sublabel, icon, page, ocid }) => (
        <button
          type="button"
          key={page}
          onClick={() => onNavigate(page)}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-gold/10 mb-2 hover:border-gold/25 transition-colors"
          style={{ background: "#141414" }}
          data-ocid={ocid}
        >
          {icon}
          <div className="flex-1 text-left">
            <p className="text-white text-sm font-medium">{label}</p>
            <p className="text-[#606060] text-xs">{sublabel}</p>
          </div>
          <ChevronRight size={14} className="text-[#505050]" />
        </button>
      ))}

      {/* Referral */}
      <div
        className="rounded-xl p-3 border border-gold/10 mb-4"
        style={{ background: "#141414" }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[#A0A0A0] text-xs">Your Referral Code</span>
          <span className="text-gold font-bold font-mono tracking-widest">
            {userData.referralCode}
          </span>
        </div>
      </div>

      {/* Admin Panel Button — only for admin users (phone 6305462887) */}
      {isAdmin && (
        <Button
          onClick={() => onNavigate("admin")}
          className="w-full bg-gold hover:bg-gold-light text-black font-bold h-11 rounded-xl mb-3 flex items-center justify-center gap-2"
          data-ocid="profile.admin_panel.button"
        >
          <Shield size={16} />
          Admin Panel
        </Button>
      )}

      {/* Logout */}
      <Button
        onClick={handleLogout}
        variant="outline"
        className="w-full border-red-500/20 text-red-400 hover:bg-red-500/10 h-11 rounded-xl mt-2"
        data-ocid="profile.logout.button"
      >
        <LogOut size={16} className="mr-2" />
        Sign Out
      </Button>
    </div>
  );
}
