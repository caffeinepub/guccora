import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Hash, Lock, Phone, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { GLogo } from "../components/GLogo";
import { useGuccora } from "../context/GuccoraContext";
import type { AppPage } from "../types/pages";

type RegisterPageProps = {
  onNavigate: (page: AppPage) => void;
  onSwitchToLogin: () => void;
};

export function RegisterPage({
  onNavigate,
  onSwitchToLogin,
}: RegisterPageProps) {
  const { register } = useGuccora();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [position, setPosition] = useState<"left" | "right">("left");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Full name is required");
      return;
    }
    if (phone.trim().length !== 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsLoading(true);
    const result = await register(
      name.trim(),
      phone.trim(),
      password,
      referralCode.trim() || undefined,
      position,
    );
    setIsLoading(false);

    if (result.success) {
      toast.success("Account created! Welcome to GUCCORA");
      onNavigate("dashboard");
    } else {
      toast.error(result.error || "Registration failed");
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5 py-8"
      style={{ background: "#0A0A0A" }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
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
          <h2 className="text-white font-bold text-xl mb-1">Join GUCCORA</h2>
          <p className="text-[#606060] text-sm mb-5">
            Create your free account
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[#A0A0A0] text-sm font-medium flex items-center gap-1.5">
                <User size={13} /> Full Name
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rahul Kumar"
                className="bg-[#1A1A1A] border-gold/20 text-white placeholder:text-[#404040] focus:border-gold h-11"
                data-ocid="register.name.input"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[#A0A0A0] text-sm font-medium flex items-center gap-1.5">
                <Phone size={13} /> Phone Number
              </Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="10-digit mobile number"
                type="tel"
                maxLength={10}
                className="bg-[#1A1A1A] border-gold/20 text-white placeholder:text-[#404040] focus:border-gold h-11"
                data-ocid="register.phone.input"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[#A0A0A0] text-sm font-medium flex items-center gap-1.5">
                <Lock size={13} /> Password
              </Label>
              <div className="relative">
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  type={showPass ? "text" : "password"}
                  className="bg-[#1A1A1A] border-gold/20 text-white placeholder:text-[#404040] focus:border-gold h-11 pr-10"
                  data-ocid="register.password.input"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606060] hover:text-gold transition-colors"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[#A0A0A0] text-sm font-medium flex items-center gap-1.5">
                <Lock size={13} /> Confirm Password
              </Label>
              <div className="relative">
                <Input
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  type={showConfirm ? "text" : "password"}
                  className="bg-[#1A1A1A] border-gold/20 text-white placeholder:text-[#404040] focus:border-gold h-11 pr-10"
                  data-ocid="register.confirm_password.input"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606060] hover:text-gold transition-colors"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[#A0A0A0] text-sm font-medium flex items-center gap-1.5">
                <Hash size={13} /> Referral Code{" "}
                <span className="text-[#505050] font-normal">(optional)</span>
              </Label>
              <Input
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                placeholder="Enter referral code"
                className="bg-[#1A1A1A] border-gold/20 text-white placeholder:text-[#404040] focus:border-gold h-11"
                data-ocid="register.referral.input"
              />
            </div>

            {/* Position Selector */}
            <div className="space-y-1.5">
              <Label className="text-[#A0A0A0] text-sm font-medium">
                Choose Position
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPosition("left")}
                  className={`h-11 rounded-xl font-bold text-sm transition-all ${
                    position === "left"
                      ? "bg-gold text-black shadow-[0_0_12px_rgba(255,215,0,0.25)]"
                      : "bg-[#1A1A1A] border border-gold/20 text-[#A0A0A0] hover:border-gold/40 hover:text-white"
                  }`}
                  data-ocid="register.position_left.toggle"
                >
                  ◄ LEFT
                </button>
                <button
                  type="button"
                  onClick={() => setPosition("right")}
                  className={`h-11 rounded-xl font-bold text-sm transition-all ${
                    position === "right"
                      ? "bg-gold text-black shadow-[0_0_12px_rgba(255,215,0,0.25)]"
                      : "bg-[#1A1A1A] border border-gold/20 text-[#A0A0A0] hover:border-gold/40 hover:text-white"
                  }`}
                  data-ocid="register.position_right.toggle"
                >
                  RIGHT ►
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-gold hover:bg-gold-light text-black font-black rounded-xl mt-2"
              data-ocid="register.submit.primary_button"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                  Creating account...
                </span>
              ) : (
                "Join GUCCORA"
              )}
            </Button>
          </form>

          <p className="text-center text-[#505050] text-sm mt-5">
            Already have an account?{" "}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-gold font-semibold hover:text-gold-light transition-colors"
              data-ocid="register.login.link"
            >
              Login
            </button>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-[#404040] text-xs mt-8">
          © {new Date().getFullYear()}. Built with love using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold/50 hover:text-gold transition-colors"
          >
            caffeine.ai
          </a>
        </p>
      </div>
    </div>
  );
}
