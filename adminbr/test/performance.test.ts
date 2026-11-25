import { test } from "node:test";
import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";
import { MemoryCache } from "../src/shared/cache/ttl-cache.js";
import { createFixedWindow } from "../src/common/auth/fixed-window.js";
import { parseRuntime } from "../src/config/runtime.js";
import { listQuerySchema, paging } from "../src/common/pagination/query.js";
import { list } from "../src/modules/suppliers/supplier.repository.js";
import { prisma } from "../src/infrastructure/db.js";
import { buildApp } from "../src/app.js";

test("cache coalesces concurrent loads, expires, bounds entries and retries failures", async () => {
  let now = 0, loads = 0;
  const cache = new MemoryCache(1, () => now);
  const load = async () => ++loads;
  assert.deepEqual(await Promise.all([cache.remember("x", 10, load), cache.remember("x", 10, load)]), [1, 1]);
  now = 11;
  assert.equal(await cache.remember("x", 10, load), 2);
  await cache.remember("y", 10, load);
  assert.equal(await cache.remember("x", 10, load), 4);
  await assert.rejects(cache.remember("bad", 10, async () => { throw new Error("down"); }));
  assert.equal(await cache.remember("bad", 10, load), 5);
  cache.clear();
  assert.equal(await cache.remember("bad", 10, load), 6);
});

test("rate windows isolate keys, reject over budget and recover capacity after expiry", () => {
  const allow = createFixedWindow(2, 100, 2);
  assert.equal(allow("a", 0), true); assert.equal(allow("a", 1), true); assert.equal(allow("a", 2), false);
  assert.equal(allow("b", 2), true); assert.equal(allow("c", 3), false);
  assert.equal(allow("a", 100), true); assert.equal(allow("c", 102), true);
});

test("runtime configuration rejects permissive proxy trust, unsafe origins and invalid limits", () => {
  for (const env of [{ TRUST_PROXY: "true" }, { FRONTEND_ORIGINS: "*" }, { BODY_LIMIT_BYTES: "-1" }, { NODE_ENV: "production" }]) {
    assert.throws(() => parseRuntime(env));
  }
  const runtime = parseRuntime({ TRUST_PROXY: "127.0.0.1/32", FRONTEND_ORIGINS: "https://admin.example.invalid" });
  assert.deepEqual(runtime.trustProxy, ["127.0.0.1/32"]);
  assert.equal(runtime.bodyLimit, 1048576);
});

test("pagination rejects unbounded inputs and uses deterministic bounded queries", async () => {
  for (const q of [{ page: 0 }, { pageSize: 51 }, { pageSize: "NaN" }, { search: "x".repeat(151) }]) assert.equal(listQuerySchema.safeParse(q).success, false);
  assert.deepEqual(paging(listQuerySchema.parse({ page: 3, pageSize: 10 })), { take: 10, skip: 20, orderBy: [{ createdAt: "desc" }, { id: "asc" }] });
  const originalFind = prisma.supplierProfile.findMany, originalCount = prisma.supplierProfile.count;
  let args: any;
  try {
    prisma.supplierProfile.findMany = (async (q: any) => { args = q; return []; }) as any;
    prisma.supplierProfile.count = (async () => 101) as any;
    const result = await list({ status: "APPROVED" }, 2, 25);
    assert.equal(args.take, 25); assert.equal(args.skip, 25); assert.deepEqual(args.where, { status: "APPROVED" });
    assert.deepEqual(args.select.user, { select: { email: true, fullName: true } });
    assert.equal(args.include, undefined); assert.equal(result.totalPages, 5);
  } finally { prisma.supplierProfile.findMany = originalFind; prisma.supplierProfile.count = originalCount; }
});

test("widgets stay protected and independent; readiness coalesces; JSON compresses", async () => {
  let checks = 0;
  const app = buildApp({ resolveSession: async () => ({ id: "performance-admin", email: "a@example.invalid", fullName: null, role: "ADMIN" }),
    checkSchema: async () => { checks++; return []; }, dashboardHandlers: {
      dashboard: async () => { throw new Error("must not load combined dashboard"); },
      platformWidget: async () => { throw new Error("private provider failure"); },
      buyerWidget: async () => ({ totalBuyers: 12 }) as any,
      moderationWidget: async () => ({ recentPending: [], metrics: {} }) as any,
    } });
  // Register after buildApp's plugins so @fastify/compress's onRoute hook
  // sees this fixture, just as it sees the actual registered API modules.
  app.register(async scope => { scope.get("/large-test", async () => ({ text: "fabric ".repeat(1000) })); });
  try {
    for (const widget of ["platform", "buyers", "moderation"]) assert.equal((await app.inject({ url: `/api/v1/admin/dashboard/${widget}` })).statusCode, 401);
    const headers = { authorization: "Bearer test" };
    assert.equal((await app.inject({ url: "/api/v1/admin/dashboard/platform", headers })).statusCode, 500);
    assert.equal((await app.inject({ url: "/api/v1/admin/dashboard/buyers", headers })).json().buyerMetrics.totalBuyers, 12);
    await Promise.all([app.inject({ url: "/ready" }), app.inject({ url: "/ready" })]); assert.equal(checks, 1);
    const compressed = await app.inject({ url: "/large-test", headers: { "accept-encoding": "gzip" } });
    assert.equal(compressed.headers["content-encoding"], "gzip"); assert.equal(JSON.parse(gunzipSync(compressed.rawPayload).toString()).text.length, 7000);
    assert.equal(compressed.headers["cache-control"], "no-store");
    const large = await app.inject({ method: "POST", url: "/api/v1/admin/suppliers", headers, payload: { data: "x".repeat(1048576) } });
    assert.equal(large.statusCode, 413);
  } finally { await app.close(); }
});

test("session endpoint has a separate throttle and ignores untrusted forwarded IPs", async () => {
  let resolved = 0;
  const app = buildApp({ resolveSession: async () => { resolved++; return { id: "rate-admin", email: "a@example.invalid", fullName: null, role: "ADMIN" }; } });
  try {
    for (let i = 0; i < 30; i++) assert.equal((await app.inject({ url: "/api/v1/admin/auth/me", remoteAddress: "192.0.2.80", headers: { authorization: "Bearer test", "x-forwarded-for": `198.51.100.${i}` } })).statusCode, 200);
    const denied = await app.inject({ url: "/api/v1/admin/auth/me", remoteAddress: "192.0.2.80", headers: { authorization: "Bearer test" } });
    assert.equal(denied.statusCode, 429); assert.equal(denied.headers["retry-after"], "60"); assert.equal(resolved, 30);
    assert.equal((await app.inject({ url: "/health", remoteAddress: "192.0.2.80" })).statusCode, 200);
  } finally { await app.close(); }
});
