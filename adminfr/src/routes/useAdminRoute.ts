import {adminNavigation} from "./admin-navigation";
import { useEffect, useState } from "react";
export type AdminRoute = {
  view: string;
  supplierId?: string;
  buyerId?: string;
  rfqId?: string;
  trackingId?: string;
};
const slugs = Object.fromEntries(adminNavigation.map(item=>[item.id,item.slug]));
export function routePath(route: AdminRoute) {
  if (route.supplierId)
    return `/admin/suppliers/${encodeURIComponent(route.supplierId)}${route.view === "catalog" ? "/catalog" : ""}`;
  if (route.buyerId)
    return `/admin/buyers/${encodeURIComponent(route.buyerId)}`;
  if (route.rfqId) return `/admin/rfqs/${encodeURIComponent(route.rfqId)}`;
  if (route.trackingId)
    return `/admin/rfq-tracking/${encodeURIComponent(route.trackingId)}`;
  return "/admin/" + (slugs[route.view] || "dashboard");
}
export function parseRoute(path: string): AdminRoute {
  const parts = path.replace(/\/+$/, "").split("/").filter(Boolean);
  if (parts[0] !== "admin") return { view: "dashboard" };
  if (parts[1] === "suppliers" && parts[2] === "catalog")
    return { view: "catalog" };
  if (parts[1] === "suppliers" && parts[2])
    return {
      view: parts[3] === "catalog" ? "catalog" : "suppliers",
      supplierId: parts[2],
    };
  if (parts[1] === "buyers" && parts[2])
    return { view: "buyers", buyerId: parts[2] };
  if (parts[1] === "rfqs" && parts[2]) return { view: "rfqs", rfqId: parts[2] };
  if (parts[1] === "rfq-tracking" && parts[2])
    return { view: "rfq-tracking", trackingId: parts[2] };
  return {
    view: Object.keys(slugs).includes(parts[1]) ? parts[1] : "dashboard",
  };
}
export function useAdminRoute() {
  const [route, setRoute] = useState(() =>
    parseRoute(window.location.pathname),
  );
  useEffect(() => {
    const pop = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  return [
    route,
    (next: AdminRoute) => {
      const destination = routePath(next);
      if (window.location.pathname === destination) return;
      window.history.pushState(null, "", destination);
      setRoute(next);
      window.scrollTo({ top: 0 });
    },
  ] as const;
}
