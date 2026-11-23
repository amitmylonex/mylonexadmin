/** Prisma's PostgreSQL pool is bounded per API process. Keep deployment totals
 * below the database/pooler connection budget; preserve provider URL options. */
export function pooledDatabaseUrl(raw: string, limit = "10", timeout = "10") {
  if (!raw) return undefined;
  if (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 100 || !/^\d+$/.test(timeout) || Number(timeout) < 1 || Number(timeout) > 300) {
    throw new Error("Invalid database pool settings");
  }
  const url = new URL(raw);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("DATABASE_URL must use PostgreSQL");
  if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", limit);
  if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", timeout);
  return url.toString();
}
