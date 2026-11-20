import { supabase } from "../lib/supabase";
import { createApiClient } from "./api-client";
import { errorNotifications } from "./error-notifications";
import { redirectToLogin } from "../features/auth/auth-navigation";

let expiring: Promise<void> | undefined;
export const apiRequest = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL || "http://localhost:4000",
  getToken: async () => (await supabase.auth.getSession()).data.session?.access_token,
  onUnauthorized: async () => {
    if (!expiring) expiring = (async () => {
      try { await supabase.auth.signOut({ scope: "local" }); }
      finally { window.dispatchEvent(new Event("admin-session-expired")); redirectToLogin(); }
    })().finally(() => { expiring = undefined; });
    await expiring;
  },
  onError: error => errorNotifications.show(error.status === 401 ? "Your session has expired. Please sign in again." : error.message),
});
