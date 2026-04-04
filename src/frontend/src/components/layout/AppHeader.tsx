import { Bell } from "lucide-react";
import { useGuccora } from "../../context/GuccoraContext";
import type { AppPage } from "../../types/pages";
import { GLogo } from "../GLogo";

type AppHeaderProps = {
  onNavigate: (page: AppPage) => void;
  currentPage: AppPage;
};

export function AppHeader({
  onNavigate,
  currentPage: _currentPage,
}: AppHeaderProps) {
  const { userData } = useGuccora();
  const unread = userData.notifications.filter((n) => !n.isRead).length;
  const initials = userData.name
    ? userData.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "G";

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14 border-b border-gold/10"
      style={{ background: "#0A0A0A" }}
    >
      <div className="flex items-center gap-2">
        <GLogo size={32} />
        <span className="text-gold font-black tracking-widest text-base uppercase font-display">
          GUCCORA
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onNavigate("notifications")}
          className="relative p-2 rounded-full hover:bg-surface-3 transition-colors"
          data-ocid="header.notifications.button"
        >
          <Bell size={20} className="text-gold/80" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-gold text-black text-[9px] font-black flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onNavigate("profile")}
          className="w-8 h-8 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center"
          data-ocid="header.profile.button"
        >
          <span className="text-gold text-xs font-bold">{initials}</span>
        </button>
      </div>
    </header>
  );
}
