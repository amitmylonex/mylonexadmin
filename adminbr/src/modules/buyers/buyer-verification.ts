import { createClient } from "@supabase/supabase-js";
import { config } from "../../config.js";
export type BuyerVerification = { emailVerified: boolean | null; emailVerifiedAt: string | null; gstVerified: null };
export const unknownBuyerVerification = (): BuyerVerification => ({ emailVerified: null, emailVerifiedAt: null, gstVerified: null });
type AuthProvider = { getUserById: (id: string) => Promise<any> };
const cache = new Map<string, { expires: number; value: BuyerVerification }>();
export async function readBuyerVerification(id: string, email: string, provider?: AuthProvider): Promise<BuyerVerification> {
  if (!provider && (!config.supabaseSecretKey || !config.supabaseUrl)) return unknownBuyerVerification();
  const key = `${id}:${email.toLowerCase()}`;
  if (!provider) {
    const now = Date.now();
    for (const [entry, value] of cache) if (value.expires <= now) cache.delete(entry);
    const existing = cache.get(key); if (existing) return existing.value;
  }
  try {
    const auth = provider || createClient(config.supabaseUrl, config.supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(3000) }) },
    }).auth.admin;
    const { data, error } = await auth.getUserById(id);
    if (error || data?.user?.id !== id || data.user.email?.toLowerCase() !== email.toLowerCase()) return unknownBuyerVerification();
    const verifiedAt = data.user.email_confirmed_at;
    if (verifiedAt && !Number.isFinite(new Date(verifiedAt).getTime())) return unknownBuyerVerification();
    const value: BuyerVerification = { emailVerified: Boolean(verifiedAt), emailVerifiedAt: verifiedAt || null, gstVerified: null };
    if (!provider) {
      if (cache.size >= 500) cache.delete(cache.keys().next().value!);
      cache.set(key, { expires: Date.now() + 60000, value });
    }
    return value;
  } catch { return unknownBuyerVerification(); }
}
