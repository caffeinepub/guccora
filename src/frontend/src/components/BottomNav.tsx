import { CreditCard, Home, MoreHorizontal, Users, Wallet } from "lucide-react";
import type { AppPage } from "../types/pages";

type BottomNavProps = {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  isAdmin?: boolean;
};

const NAV_ITEMS: {
  page: AppPage;
  label: string;
  icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;
}[] = [
  { page: "dashboard", label: "Home", icon: Home },
  { page: "plans", label: "Plans", icon: CreditCard },
  { page: "wallet", label: "Wallet", icon: Wallet },
  { page: "team", label: "Team", icon: Users },
  { page: "profile", label: "More", icon: MoreHorizontal },
];

export function BottomNav({ currentPage, onNavigate }: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-gold/20"
      style={{ background: "#0A0A0A" }}
      data-ocid="bottom_nav"
    >
      <div className="flex items-center justify-around px-2 h-16 max-w-lg mx-auto">
        {NAV_ITEMS.map(({ page, label, icon: Icon }) => {
          const isActive = currentPage === page;
          return (
            <button
              key={page}
              type="button"
              onClick={() => onNavigate(page)}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all relative"
              style={{
                color: isActive ? "#F4C542" : "#606060",
              }}
              data-ocid={`nav.${page}.link`}
            >
              <Icon
                size={20}
                strokeWidth={isActive ? 2.5 : 1.8}
                className="transition-all"
              />
              <span
                className="text-[10px] font-semibold tracking-wide"
                style={{ fontFamily: "Satoshi, sans-serif" }}
              >
                {label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-gold" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
