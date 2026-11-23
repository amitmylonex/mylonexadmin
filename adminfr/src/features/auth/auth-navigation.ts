export function safeAdminReturnPath(value: string | null) {
  return value && /^\/admin(?:\/|$)/.test(value) && !/[\\\r\n]/.test(value) ? value : "/admin/dashboard";
}
export function redirectToLogin() {
  if (window.location.pathname === "/login") return;
  const destination = safeAdminReturnPath(window.location.pathname + window.location.search + window.location.hash);
  window.history.replaceState(null, "", `/login?returnTo=${encodeURIComponent(destination)}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
export function restoreAdminRoute() {
  if (window.location.pathname === "/login" || !window.location.pathname.startsWith("/admin/")) {
    const destination = safeAdminReturnPath(new URLSearchParams(window.location.search).get("returnTo"));
    window.history.replaceState(null, "", destination);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
}
