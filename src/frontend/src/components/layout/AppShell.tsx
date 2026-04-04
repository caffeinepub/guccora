import type { ReactNode } from "react";
import type { AppPage } from "../../types/pages";
import { BottomNav } from "../BottomNav";
import { AppHeader } from "./AppHeader";

type AppShellProps = {
  children: ReactNode;
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  isAdmin?: boolean;
};

export function AppShell({
  children,
  currentPage,
  onNavigate,
  isAdmin,
}: AppShellProps) {
  return (
    <div className="min-h-screen" style={{ background: "#0A0A0A" }}>
      <AppHeader onNavigate={onNavigate} currentPage={currentPage} />
      <main className="pt-14 pb-20 min-h-screen">{children}</main>
      <BottomNav
        currentPage={currentPage}
        onNavigate={onNavigate}
        isAdmin={isAdmin}
      />
    </div>
  );
}
