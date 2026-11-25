import { z } from "zod";

export function parseRuntime(env: NodeJS.ProcessEnv) {
  const schema = z.object({
    BODY_LIMIT_BYTES: z.coerce.number().int().min(1024).max(1048576).default(1048576),
    REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
    TRUST_PROXY: z.string().default(""),
  });
  const result = schema.safeParse(env);
  if (!result.success) throw new Error("Invalid backend runtime limits");
  const origins = (env.FRONTEND_ORIGINS || env.FRONTEND_ORIGIN || "http://localhost:5173").split(",").map(s => s.trim());
  if (origins.some(origin => {
    try { const url = new URL(origin); return !["http:", "https:"].includes(url.protocol) || url.origin !== origin; }
    catch { return true; }
  })) throw new Error("Invalid frontend origin allowlist");
  if (env.NODE_ENV === "production") {
    for (const name of ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "FRONTEND_ORIGIN"]) {
      if (!env[name]?.trim()) throw new Error(`Missing production configuration: ${name}`);
    }
    if (origins.some(origin => !origin.startsWith("https://"))) throw new Error("Production frontend origins must use HTTPS");
  }
  const proxy = result.data.TRUST_PROXY.trim();
  if (proxy === "true" || proxy === "*") throw new Error("TRUST_PROXY must identify trusted proxy addresses or CIDRs");
  return { bodyLimit: result.data.BODY_LIMIT_BYTES, requestTimeout: result.data.REQUEST_TIMEOUT_MS,
    trustProxy: proxy && proxy !== "false" ? proxy.split(",").map(s => s.trim()) : false as false,
    origins: [...new Set(origins.concat(env.NODE_ENV === "production" ? [] : ["http://localhost:5173", "http://127.0.0.1:5173"]))] };
}
