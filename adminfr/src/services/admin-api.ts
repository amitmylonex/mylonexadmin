import { supabase } from "../lib/supabase";
import { createApiClient } from "./api-client";
import { errorNotifications } from "./error-notifications";
import { redirectToLogin } from "../features/auth/auth-navigation";
import { queryClient } from "./query-client";

let expiring: Promise<void> | undefined;
const request = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL || "http://localhost:4000",
  getToken: async () => (await supabase.auth.getSession()).data.session?.access_token,
  onUnauthorized: async () => {
    queryClient.clear();
    if (!expiring) expiring = (async () => {
      try { await supabase.auth.signOut({ scope: "local" }); }
      finally { window.dispatchEvent(new Event("admin-session-expired")); redirectToLogin(); }
    })().finally(() => { expiring = undefined; });
    await expiring;
  },
  onError: error => errorNotifications.show(error.status === 401 ? "Your session has expired. Please sign in again." : error.message),
});
export async function apiRequest<T = any>(path: string, options: import("./api-client").ApiRequestOptions = {}): Promise<T> {
  const result = await request<T>(path, options);
  if (!["GET", "HEAD", "OPTIONS"].includes((options.method || "GET").toUpperCase())) {
    void queryClient.invalidateQueries({ queryKey: ["admin"] });
  }
  return result;
}
