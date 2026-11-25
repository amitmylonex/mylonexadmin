import React, { lazy } from "react";
import type { AdminRoute } from "./useAdminRoute";
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

export function AdminRouteContent({route,navigate}:{route:AdminRoute;navigate:(route:AdminRoute)=>void}) {
  const currentView=route.view, selectedSupplierId=route.supplierId;
  const setCurrentView=(view:string)=>navigate({view});
  const setSelectedSupplierId=(supplierId:string|null)=>navigate({view:currentView,supplierId:supplierId||undefined});
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
          key={route.rfqId}
          id={route.rfqId}
          onBack={() => navigate({ view: "rfqs" })}
            onSelectSupplier={supplierId => navigate({ view: "suppliers", supplierId })}
          onTrackRfq={trackingId=>navigate({view:"rfq-tracking",trackingId})}
        />
      );
    if (route.trackingId)
      return (
        <RfqTrackingDetailPage
          key={route.trackingId}
          id={route.trackingId}
          onBack={() => navigate({ view: "rfq-tracking" })}
          onManageRfq={rfqId=>navigate({view:"rfqs",rfqId})}
        />
      );
    if (selectedSupplierId) {
      return (
        <SupplierDetailPage
          key={selectedSupplierId}
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
            onTrackRfq={trackingId=>navigate({view:"rfq-tracking",trackingId})}
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
  return renderCurrentView();
}
