import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { buildApp } from "../src/app.js";
import { AdminSessionError, resolveAdminSession } from "../src/modules/auth/admin-session.js";
import { pooledDatabaseUrl } from "../src/database/pool-config.js";
import { createApiClient, ApiError } from "../../adminfr/src/services/api-client.js";
import { safeAdminReturnPath } from "../../adminfr/src/features/auth/auth-navigation.js";

const admin = { id: "foundation-admin", email: "admin@example.invalid", fullName: "Admin", role: "ADMIN" as const };
test("namespace guard, ADMIN access, CORS preflight and security headers", async () => {
  let verified = 0;
  const app = buildApp({ resolveSession: async token => {
    verified++;
    if (token === "expired") throw new AdminSessionError(401, "Expired token");
    if (token === "supplier") throw new AdminSessionError(403, "Admin privileges required");
    return admin;
  }, checkSchema: async () => [] });
  try {
    for (const url of ["/api/v1/admin/auth/me", "/api/v1/admin/future-module", "/api/v1/admin"]) {
      const response = await app.inject({ url });
      assert.equal(response.statusCode, 401);
      assert.equal(response.json().success, false); assert.equal(response.json().error.code, "UNAUTHENTICATED");
      assert.equal(response.json().error.details, null); assert.ok(response.headers["x-content-type-options"]);
    }
    const malformed = await app.inject({ method: "POST", url: "/api/v1/admin/suppliers", headers: { "content-type": "application/json" }, payload: "{" });
    assert.equal(malformed.statusCode, 401);
    assert.equal(verified, 0);
    const allowed = await app.inject({ url: "/api/v1/admin/auth/me", headers: { authorization: "Bearer admin" } });
    assert.equal(allowed.statusCode, 200); assert.equal(allowed.json().user.email, admin.email);
    assert.equal(verified, 1, "global and legacy route hook must not verify twice");
    for (const [token, status] of [["expired", 401], ["supplier", 403]] as const) {
      assert.equal((await app.inject({ url: "/api/v1/admin/auth/me", headers: { authorization: `Bearer ${token}` } })).statusCode, status);
    }
    const preflight = await app.inject({ method: "OPTIONS", url: "/api/v1/admin/auth/me", headers: { origin: "http://localhost:5173", "access-control-request-method": "GET", "access-control-request-headers": "authorization" } });
    assert.equal(preflight.statusCode, 204); assert.equal(preflight.headers["access-control-allow-origin"], "http://localhost:5173");
    const disallowed = await app.inject({ url: "/health", headers: { origin: "https://untrusted.example" } });
    assert.equal(disallowed.headers["access-control-allow-origin"], undefined);
    assert.equal(disallowed.statusCode, 200); assert.ok(disallowed.headers["content-security-policy"]);
    assert.equal((await app.inject({ url: "/ready" })).json().status, "ready");
  } finally { await app.close(); }
});

test("error envelopes retain validation details and mask unexpected failures", async () => {
  const app = buildApp({ checkSchema: async () => { throw new Error("private DB URL"); } });
  app.get("/test-validation", async () => z.object({ value: z.number() }).parse({}));
  app.get("/test-failure", async () => { throw new Error("private connection string"); });
  try {
    const invalid = await app.inject({ url: "/test-validation" });
    assert.equal(invalid.statusCode, 400); assert.equal(invalid.json().error.code, "VALIDATION_ERROR");
    assert.equal(invalid.json().error.details[0].path, "value");
    const failed = await app.inject({ url: "/test-failure" });
    assert.equal(failed.statusCode, 500); assert.doesNotMatch(failed.body, /private connection/);
    assert.ok(failed.json().requestId);
    const readiness = await app.inject({ url: "/ready" });
    assert.equal(readiness.statusCode, 503); assert.equal(readiness.json().error.code, "DATABASE_UNAVAILABLE");
    assert.doesNotMatch(readiness.body, /private DB/);
  } finally { await app.close(); }
});

test("database role is authoritative and an absent user is forbidden", async () => {
  const provider = { getUser: async () => ({ data: { user: { id: "identity" } } }) };
  await assert.rejects(resolveAdminSession("valid", provider, { findUnique: async () => null }), (e: any) => e.statusCode === 403);
  await assert.rejects(resolveAdminSession("valid", { getUser: async () => ({ error: { status: 503 } }) }, { findUnique: async () => null }), (e: any) => e.statusCode === 503);
});

test("pool defaults are bounded and preserve Supabase pooler options", () => {
  const url = new URL(pooledDatabaseUrl("postgresql://user:example@localhost/test?pgbouncer=true", "8", "12")!);
  assert.equal(url.searchParams.get("pgbouncer"), "true"); assert.equal(url.searchParams.get("connection_limit"), "8");
  assert.equal(url.searchParams.get("pool_timeout"), "12");
  assert.throws(() => pooledDatabaseUrl("postgresql://localhost/test", "0"));
});

test("API client attaches JWT, reads structured errors and expires 401 sessions", async () => {
  let expired = 0; const errors: ApiError[] = [];
  const request = createApiClient({ baseUrl: "http://localhost:4000", getToken: async () => "admin-jwt",
    onUnauthorized: () => { expired++; }, onError: error => errors.push(error), fetch: async (_url, options) => {
      assert.equal(new Headers(options?.headers).get("authorization"), "Bearer admin-jwt");
      return new Response(JSON.stringify({ success: false, error: { code: "UNAUTHENTICATED", message: "Expired session", details: null } }), { status: 401 });
    } });
  await assert.rejects(request("/api/v1/admin/auth/me"), (e: any) => e.message === "Expired session" && e.status === 401);
  assert.equal(expired, 1); assert.equal(errors.length, 1);
  await assert.rejects(request("https://untrusted.example"), /relative/);
  assert.equal(safeAdminReturnPath("https://untrusted.example"), "/admin/dashboard");
  assert.equal(safeAdminReturnPath("/admin/suppliers/catalog"), "/admin/suppliers/catalog");
});
