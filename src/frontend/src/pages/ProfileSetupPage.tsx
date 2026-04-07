import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Hash, Phone, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { GLogo } from "../components/GLogo";
import { useGuccora } from "../context/GuccoraContext";

export function ProfileSetupPage() {
  const { updateProfile } = useGuccora();
  const actor = null as unknown as null | {
    saveCallerUserProfile: (p: {
      name: string;
      phone: string;
    }) => Promise<void>;
  };
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }
    setIsSubmitting(true);
    try {
      if (actor) {
        await actor.saveCallerUserProfile({
          name: name.trim(),
          phone: phone.trim(),
        });
      }
      updateProfile(
        name.trim(),
        phone.trim(),
        referralCode.trim() || undefined,
      );
      toast.success("Profile saved! Welcome to GUCCORA");
    } catch (err) {
      console.error(err);
      // Even if backend fails, save locally
      updateProfile(
        name.trim(),
        phone.trim(),
        referralCode.trim() || undefined,
      );
      toast.success("Profile saved! Welcome to GUCCORA");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5 py-8"
      style={{ background: "#0A0A0A" }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <GLogo size={56} />
          <h1 className="text-gold font-black font-display text-2xl tracking-widest mt-3">
            GUCCORA
          </h1>
          <p className="text-[#606060] text-sm mt-1">
            Build people, build income
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-6 border border-gold/15 shadow-card"
          style={{ background: "#141414" }}
        >
          <h2 className="text-white font-bold text-xl mb-1">
            Complete Your Profile
          </h2>
          <p className="text-[#606060] text-sm mb-6">
            Just a few details to get you started
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[#A0A0A0] text-sm font-medium flex items-center gap-1.5">
                <User size={13} /> Full Name
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rahul Kumar"
                className="bg-surface-3 border-gold/20 text-white placeholder:text-[#404040] focus:border-gold"
                data-ocid="profile_setup.name.input"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[#A0A0A0] text-sm font-medium flex items-center gap-1.5">
                <Phone size={13} /> Phone Number
              </Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile number"
                type="tel"
                maxLength={10}
                className="bg-surface-3 border-gold/20 text-white placeholder:text-[#404040] focus:border-gold"
                data-ocid="profile_setup.phone.input"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[#A0A0A0] text-sm font-medium flex items-center gap-1.5">
                <Hash size={13} /> Referral Code{" "}
                <span className="text-[#505050]">(optional)</span>
              </Label>
              <Input
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                placeholder="Enter referral code"
                className="bg-surface-3 border-gold/20 text-white placeholder:text-[#404040] focus:border-gold"
                data-ocid="profile_setup.referral.input"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-gold hover:bg-gold-light text-black font-black rounded-xl mt-2"
              data-ocid="profile_setup.submit.primary_button"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                  Saving...
                </span>
              ) : (
                "Join GUCCORA →"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
