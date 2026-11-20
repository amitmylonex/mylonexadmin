import { useAdminRoute } from "../routes/useAdminRoute";
import { AdminAccess } from "../features/auth/AdminAccess";
import React, { useEffect, useState, lazy, Suspense } from "react";
import { supabase } from "../lib/supabase";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { AdminSidebar } from "../components/layout/AdminSidebar";
import { Header } from "../components/layout/Header";
import { redirectToLogin, restoreAdminRoute } from "../features/auth/auth-navigation";
import { PortalFooter } from "../components/layout/PortalFooter";
import { FabricLoader } from "../components/FabricLoader";

// Lazy-loaded pages with code splitting for maximum performance
const DashboardPage = lazy(() =>
  import("../features/dashboard/pages/DashboardPage").then((m) => ({
    default: m.DashboardPage,
  })),
);
const SuppliersPage = lazy(() =>
  import("../features/suppliers/pages/SuppliersPage").then((m) => ({
    default: m.SuppliersPage,
  })),
);
const SupplierDetailPage = lazy(() =>
  import("../features/suppliers/pages/SupplierDetailPage").then((m) => ({
    default: m.SupplierDetailPage,
  })),
);
const BuyersPage = lazy(() =>
  import("../features/buyers/pages/BuyersPage").then((m) => ({
    default: m.BuyersPage,
  })),
);
const RfqApprovalsPage = lazy(() =>
  import("../features/rfqs/pages/RfqApprovalsPage").then((m) => ({
    default: m.RfqApprovalsPage,
  })),
);
const QuoteApprovalsPage = lazy(() =>
  import("../features/quotes/pages/QuoteApprovalsPage").then((m) => ({
    default: m.QuoteApprovalsPage,
  })),
);
const AllRfqsPage = lazy(() =>
  import("../features/rfqs/pages/AllRfqsPage").then((m) => ({
    default: m.AllRfqsPage,
  })),
);
const RfqTrackingPage = lazy(() =>
  import("../features/rfqs/pages/RfqTrackingPage").then((m) => ({
    default: m.RfqTrackingPage,
  })),
);
const CatalogControlPage = lazy(() =>
  import("../features/catalog/pages/CatalogControlPage").then((m) => ({
    default: m.CatalogControlPage,
  })),
);
const SamplesPage = lazy(() =>
  import("../features/samples/pages/SamplesPage").then((m) => ({
    default: m.SamplesPage,
  })),
);
const AcceptedOrdersPage = lazy(() =>
  import("../features/orders/pages/AcceptedOrdersPage").then((m) => ({
    default: m.AcceptedOrdersPage,
  })),
);

const BuyerDetailPage = lazy(() =>
  import("../features/buyers/pages/BuyerDetailPage").then((m) => ({
    default: m.BuyerDetailPage,
  })),
);
const RfqDetailPage = lazy(() =>
  import("../features/rfqs/pages/RfqDetailPage").then((m) => ({
    default: m.RfqDetailPage,
  })),
);
const RfqTrackingDetailPage = lazy(() =>
  import("../features/rfqs/pages/RfqTrackingDetailPage").then((m) => ({
    default: m.RfqTrackingDetailPage,
  })),
);

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [route, navigate] = useAdminRoute();
  const currentView = route.view,
    selectedSupplierId = route.supplierId;
  const setCurrentView = (view: string) => navigate({ view });
  const setSelectedSupplierId = (id: string | null) =>
    navigate({ view: currentView, supplierId: id || undefined });

  useEffect(() => {
    let isMounted = true;

    // Check stored session
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (isMounted) {
          setSession(session);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Session restore error:", err);
        if (isMounted) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (isMounted) {
        setSession(newSession);
        setLoading(false);
      }
    });

    // Safety timeout: Never stay stuck on full-screen loading for more than 1.5s
    const timeout = setTimeout(() => {
      if (isMounted && loading) {
        setLoading(false);
      }
    }, 1500);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw error;
    setSession(null);
    redirectToLogin();
  };

  useEffect(() => {
    const expired = () => { setSession(null); setLoading(false); };
    window.addEventListener("admin-session-expired", expired);
    return () => window.removeEventListener("admin-session-expired", expired);
  }, []);
  useEffect(() => {
    if (loading) return;
    if (session) restoreAdminRoute();
    else redirectToLogin();
  }, [loading, session]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <FabricLoader label="Verifying admin credentials..." />
      </div>
    );
  }

  if (!session) {
    return (
      <LoginPage
        onLoginSuccess={(newSession) => {
          setSession(newSession);
          setLoading(false);
        }}
      />
    );
  }

  const renderCurrentView = () => {
    if (route.buyerId)
      return (
        <BuyerDetailPage
          key={route.buyerId}
          id={route.buyerId}
          onBack={() => navigate({ view: "buyers" })}
        />
      );
    if (route.rfqId)
      return (
        <RfqDetailPage
          id={route.rfqId}
          onBack={() => navigate({ view: "rfqs" })}
        />
      );
    if (route.trackingId)
      return (
        <RfqTrackingDetailPage
          id={route.trackingId}
          onBack={() => navigate({ view: "rfq-tracking" })}
        />
      );
    if (selectedSupplierId) {
      return (
        <SupplierDetailPage
          supplierId={selectedSupplierId}
          initialTab={currentView === "catalog" ? "catalog" : "overview"}
          onBack={() => setSelectedSupplierId(null)}
        />
      );
    }

    switch (currentView) {
      case "dashboard":
        return (
          <DashboardPage
            onSelectSupplier={(id) => setSelectedSupplierId(id)}
            onNavigate={(view) => setCurrentView(view)}
          />
        );
      case "suppliers":
        return (
          <SuppliersPage onSelectSupplier={(id) => setSelectedSupplierId(id)} onManageCatalog={supplierId => navigate({ view: "catalog", supplierId })} />
        );
      case "buyers":
        return (
          <BuyersPage
            onSelectBuyer={(buyerId) => navigate({ view: "buyers", buyerId })}
          />
        );
      case "rfq-approvals":
        return (
          <RfqApprovalsPage
            onSelectRfq={(rfqId) => navigate({ view: "rfqs", rfqId })}
          />
        );
      case "quote-approvals":
        return <QuoteApprovalsPage />;
      case "rfqs":
        return (
          <AllRfqsPage
            onSelectRfq={(rfqId) => navigate({ view: "rfqs", rfqId })}
          />
        );
      case "rfq-tracking":
        return (
          <RfqTrackingPage
            onSelectRfq={(trackingId) =>
              navigate({ view: "rfq-tracking", trackingId })
            }
          />
        );
      case "catalog":
        return (
          <CatalogControlPage
            onSelectSupplier={(id) => setSelectedSupplierId(id)}
          />
        );
      case "samples":
        return <SamplesPage />;
      case "accepted-orders":
        return <AcceptedOrdersPage />;
      default:
        return (
          <DashboardPage
            onSelectSupplier={(id) => setSelectedSupplierId(id)}
            onNavigate={(view) => setCurrentView(view)}
          />
        );
    }
  };

  return (
    <AdminAccess identity={session.access_token} onSignOut={handleSignOut}>
      <div className="flex min-h-screen bg-canvas flex-col lg:flex-row text-ink font-sans antialiased">
        {/* Responsive Sidebar (Mobile top bar + drawer, desktop sticky sidebar) */}
        <AdminSidebar
          currentView={selectedSupplierId && currentView === "catalog" ? "suppliers" : currentView}
          userEmail={session.user.email}
          onNavigate={(view) => {
            setCurrentView(view);
          }}
          onSignOut={handleSignOut}
        />

        {/* Main Content Shell with responsive container */}
        <main className="flex flex-1 flex-col min-w-0 max-w-full overflow-x-hidden">
          {!(selectedSupplierId && currentView === "catalog") && <Header userEmail={session.user.email || "Admin"} onSignOut={handleSignOut} />}
          <div className="flex-1 min-w-0 max-w-full">
            <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-7 lg:py-8 min-w-0">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-32">
                    <FabricLoader label="Weaving view data..." />
                  </div>
                }
              >
                {renderCurrentView()}
              </Suspense>
            </div>
          </div>

          {/* Responsive Portal Footer */}
          <PortalFooter />
        </main>
      </div>
    </AdminAccess>
  );
}
