import { Toaster } from "@/components/ui/sonner";
import { useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import { GuccoraProvider, useGuccora } from "./context/GuccoraContext";
import { isFirebaseConfigured } from "./firebase";
import { AdminPage } from "./pages/AdminPage";
import { DashboardPage } from "./pages/DashboardPage";
import { KycPage } from "./pages/KycPage";
import { LoginPage } from "./pages/LoginPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { OrdersPage } from "./pages/OrdersPage";
import { ProductsPage } from "./pages/PlansPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RegisterPage } from "./pages/RegisterPage";
import { TeamPage } from "./pages/TeamPage";
import { WalletPage } from "./pages/WalletPage";
import type { AppPage } from "./types/pages";

function FirebaseBanner() {
  if (isFirebaseConfigured) return null;
  return (
    <div
      style={{
        background: "#1a0a00",
        borderBottom: "1px solid rgba(245,158,11,0.2)",
      }}
      className="px-4 py-2 flex items-center gap-2"
      data-ocid="firebase.warning.banner"
    >
      <span className="text-yellow-400 text-xs font-semibold">
        ⚠ Firebase not configured — app is running in offline mode. See{" "}
        <a
          href="/FIREBASE_SETUP.md"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-yellow-300"
        >
          FIREBASE_SETUP.md
        </a>{" "}
        to connect your database.
      </span>
    </div>
  );
}

function AppRouter() {
  const { isProfileComplete, currentUser, isAdmin } = useGuccora();
  const [page, setPage] = useState<AppPage>("dashboard");
  const [authView, setAuthView] = useState<"login" | "register">("login");

  function handleNavigate(p: AppPage) {
    setPage(p);
  }

  // Not logged in — show login or register
  if (!isProfileComplete) {
    if (authView === "register") {
      return (
        <>
          <FirebaseBanner />
          <RegisterPage
            onNavigate={handleNavigate}
            onSwitchToLogin={() => setAuthView("login")}
          />
        </>
      );
    }
    return (
      <>
        <FirebaseBanner />
        <LoginPage
          onNavigate={handleNavigate}
          onSwitchToRegister={() => setAuthView("register")}
        />
      </>
    );
  }

  function renderPage() {
    switch (page) {
      case "dashboard":
        return <DashboardPage onNavigate={handleNavigate} />;
      case "plans":
        return <ProductsPage />;
      case "wallet":
        return <WalletPage />;
      case "kyc":
        return <KycPage />;
      case "team":
        return <TeamPage />;
      case "orders":
        return <OrdersPage />;
      case "notifications":
        return <NotificationsPage />;
      case "profile":
        return <ProfilePage onNavigate={handleNavigate} />;
      case "admin":
        // Block direct access for non-admins
        return currentUser?.phone === "6305462887" ? (
          <AdminPage />
        ) : (
          <DashboardPage onNavigate={handleNavigate} />
        );
      default:
        return <DashboardPage onNavigate={handleNavigate} />;
    }
  }

  return (
    <>
      <FirebaseBanner />
      <AppShell
        currentPage={page}
        onNavigate={handleNavigate}
        isAdmin={isAdmin}
      >
        {renderPage()}
      </AppShell>
    </>
  );
}

export default function App() {
  return (
    <GuccoraProvider>
      <AppRouter />
      <Toaster
        theme="dark"
        toastOptions={{
          style: {
            background: "#1B1B1B",
            border: "1px solid rgba(244,197,66,0.2)",
            color: "#F2F2F2",
          },
        }}
      />
    </GuccoraProvider>
  );
}
