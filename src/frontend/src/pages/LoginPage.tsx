import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock, Phone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { GLogo } from "../components/GLogo";
import { useGuccora } from "../context/GuccoraContext";
import type { AppPage } from "../types/pages";

type LoginPageProps = {
  onNavigate: (page: AppPage) => void;
  onSwitchToRegister: () => void;
};

export function LoginPage({ onNavigate, onSwitchToRegister }: LoginPageProps) {
  const { login } = useGuccora();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim() || !password.trim()) {
      toast.error("Phone and password are required");
      return;
    }
    setIsLoading(true);
    const result = login(phone.trim(), password.trim());
    setIsLoading(false);

    if (result.success) {
      if (result.role === "admin") {
        onNavigate("admin");
      } else {
        onNavigate("dashboard");
      }
    } else {
      toast.error(result.error || "Login failed");
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
          <h2 className="text-white font-bold text-xl mb-1">Welcome Back</h2>
          <p className="text-[#606060] text-sm mb-6">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                data-ocid="login.phone.input"
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
                  placeholder="Enter your password"
                  type={showPass ? "text" : "password"}
                  className="bg-[#1A1A1A] border-gold/20 text-white placeholder:text-[#404040] focus:border-gold h-11 pr-10"
                  data-ocid="login.password.input"
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

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-gold hover:bg-gold-light text-black font-black rounded-xl mt-2"
              data-ocid="login.submit.primary_button"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                  Signing in...
                </span>
              ) : (
                "Login"
              )}
            </Button>
          </form>

          <p className="text-center text-[#505050] text-sm mt-5">
            New here?{" "}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="text-gold font-semibold hover:text-gold-light transition-colors"
              data-ocid="login.register.link"
            >
              Register
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
