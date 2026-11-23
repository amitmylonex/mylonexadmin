import { createClient } from "@supabase/supabase-js";
import { config } from "../../config.js";
import { PublicError } from "../../common/errors/public-error.js";

export interface SupplierProvisioner {
  createUser: (input: { email: string; password: string; email_confirm: true; user_metadata: { fullName: string } }) => Promise<string>;
  deleteUser: (id: string) => Promise<void>;
  sendPasswordSetup?: (email: string) => Promise<boolean>;
}
export function supplierProvisioner(): SupplierProvisioner {
  if (!config.supabaseSecretKey || !config.supabaseUrl) throw new PublicError(503, "Supplier account provisioning is not configured. No supplier was created.");
  if (config.postmarkEnabled && (!config.postmarkToken || !config.postmarkFrom || !config.appBaseUrl)) {
    throw new PublicError(503, "Password setup email configuration is incomplete. No supplier was created.");
  }
  const auth = createClient(config.supabaseUrl, config.supabaseSecretKey, { auth: { autoRefreshToken: false, persistSession: false } });
  return {
    createUser: async input => {
      const { data, error } = await auth.auth.admin.createUser(input);
      if (error || !data.user) {
        if (error && ["email_exists", "user_already_exists"].includes(error.code || "")) throw new PublicError(409, "An account already exists for this email address.");
        throw new PublicError(502, "Could not create the supplier authentication account. Retry or contact support.");
      }
      return data.user.id;
    },
    deleteUser: async id => {
      const { error } = await auth.auth.admin.deleteUser(id);
      if (error) throw new Error("Auth account cleanup failed");
    },
    ...(config.postmarkEnabled ? { sendPasswordSetup: async (email: string) => {
      const { data, error } = await auth.auth.admin.generateLink({ type: "recovery", email });
      if (error || !data.properties?.hashed_token) return false;
      // Use the existing supplier application's token-hash recovery handler,
      // rather than a server-created PKCE link with no supplier browser verifier.
      const link = new URL("/auth/confirm", config.appBaseUrl);
      link.searchParams.set("token_hash", data.properties.hashed_token);
      link.searchParams.set("type", "recovery");
      link.searchParams.set("next", "/auth/reset-password");
      return sendSetupEmail(email, link.toString());
    } } : {}),
  };
}
export async function sendSetupEmail(email: string, link: string, send = fetch) {
  // Plain text avoids HTML interpolation of recovery tokens and supplier text.
  const response = await send("https://api.postmarkapp.com/email", {
    method: "POST", signal: AbortSignal.timeout(10000),
    headers: { "Content-Type": "application/json", Accept: "application/json", "X-Postmark-Server-Token": config.postmarkToken },
    body: JSON.stringify({ From: config.postmarkFrom, To: email, Subject: "Set up your MyloNex supplier password",
      TextBody: `Your MyloNex supplier account has been created. Choose your password using this link:\n\n${link}\n\nIf you did not expect this account, contact MyloNex support.`,
      MessageStream: config.postmarkStream, TrackLinks: "None" }),
  });
  if (!response.ok) return false;
  const result = await response.json() as { ErrorCode?: number };
  return result.ErrorCode === 0;
}
