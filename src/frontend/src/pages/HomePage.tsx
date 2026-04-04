import { Button } from "@/components/ui/button";
import { Shield, TrendingUp, Users, Zap } from "lucide-react";
import { GLogo } from "../components/GLogo";
import { PLANS } from "../context/GuccoraContext";
import { useInternetIdentity } from "../hooks/useInternetIdentity";

export function HomePage() {
  const { login, isLoggingIn } = useInternetIdentity();

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#0A0A0A" }}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-gold/10">
        <div className="flex items-center gap-2">
          <GLogo size={36} />
          <span className="text-gold font-black tracking-widest text-xl font-display">
            GUCCORA
          </span>
        </div>
        <span className="text-xs font-bold px-3 py-1 rounded-full border border-gold/40 text-gold">
          Free Joining
        </span>
      </header>

      {/* Hero */}
      <div className="flex-1 flex flex-col px-5 pt-10 pb-6 max-w-md mx-auto w-full">
        <div className="animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-8 h-0.5 bg-gold" />
            <span className="text-gold/70 text-xs font-semibold tracking-widest uppercase">
              Network Marketing
            </span>
          </div>
          <h1 className="text-white font-black font-display text-3xl leading-tight mb-3">
            Guccora Product Based{" "}
            <span className="text-gold">Network Marketing</span>
          </h1>
          <p className="text-[#A0A0A0] text-base mb-2">
            Build people, build income
          </p>
          <p className="text-[#606060] text-sm mb-8">
            Join India's fastest growing product-based MLM network. Earn through
            direct referrals, level income, and pair bonuses across 10 levels.
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 mb-8 animate-fade-in">
          {[
            { icon: Users, label: "Members", value: "10K+" },
            { icon: TrendingUp, label: "Paid Out", value: "₹5Cr+" },
            { icon: Shield, label: "Levels", value: "10" },
          ].map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="rounded-xl p-3 text-center border border-gold/10"
              style={{ background: "#141414" }}
            >
              <Icon size={18} className="text-gold mx-auto mb-1" />
              <div className="text-white font-bold text-sm">{value}</div>
              <div className="text-[#606060] text-[10px]">{label}</div>
            </div>
          ))}
        </div>

        {/* Plans */}
        <div className="mb-8">
          <h2 className="text-white font-bold text-base mb-3 flex items-center gap-2">
            <Zap size={16} className="text-gold" /> Choose Your Plan
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className="rounded-xl p-4 border border-gold/20 relative overflow-hidden"
                style={{ background: "#141414" }}
              >
                {plan.id === "999" && (
                  <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-gold text-black">
                    POPULAR
                  </span>
                )}
                <div className="text-gold font-black text-xl font-display">
                  ₹{plan.price}
                </div>
                <div className="text-white font-semibold text-sm mb-2">
                  {plan.name}
                </div>
                <div className="space-y-0.5">
                  <div className="text-[#808080] text-[11px]">
                    Direct: ₹{plan.directIncome}
                  </div>
                  <div className="text-[#808080] text-[11px]">
                    Level: ₹{plan.levelIncome} × 10
                  </div>
                  <div className="text-[#808080] text-[11px]">
                    Pair: ₹{plan.pairIncome} × 10
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-3">
          <Button
            onClick={login}
            disabled={isLoggingIn}
            className="w-full h-13 bg-gold hover:bg-gold-light text-black font-black text-base rounded-xl shadow-gold transition-all"
            data-ocid="home.login.primary_button"
          >
            {isLoggingIn ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                Connecting...
              </span>
            ) : (
              "Login with Internet Identity"
            )}
          </Button>
          <p className="text-center text-[#505050] text-xs">
            Free to join · No credit card needed · Earn from day one
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="px-5 py-4 border-t border-gold/10 text-center">
        <p className="text-[#404040] text-xs">
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
      </footer>
    </div>
  );
}
