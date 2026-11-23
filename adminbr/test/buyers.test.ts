import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { buyerListSchema, buyerDetailSchema, buyerDateRange, buyerPaging } from "../src/modules/buyers/buyer.schema.js";
import { list as directory } from "../src/modules/buyers/buyer-directory.repository.js";
import { detail as profile } from "../src/modules/buyers/buyer-detail.repository.js";
import { buyerOrders, buyerOrderSummary } from "../src/modules/buyers/buyer-orders.repository.js";
import { orderEstimate } from "../src/modules/buyers/buyer-order-values.js";
import { readBuyerVerification, unknownBuyerVerification } from "../src/modules/buyers/buyer-verification.js";
import * as service from "../src/modules/buyers/buyer.service.js";
import { buildApp } from "../src/app.js";
const id = "11111111-1111-4111-8111-111111111111";
const user = { id, email: "buyer@example.invalid", fullName: "Test Buyer", createdAt: new Date("2026-11-01"), buyerProfile: null,
  _count: { inquiries: 2, communicationRequests: 3, samples: 1, orders: 0 } };
test("buyer filters reject invalid dates and bound pagination, with inclusive IST date boundaries", () => {
  for (const input of [{ page: 0 }, { pageSize: 51 }, { sort: "arbitrary-sql" }, { from: "2026-02-30" }, { from: "2026-11-20", to: "2026-11-19" }]) assert.equal(buyerListSchema.safeParse(input).success, false);
  assert.equal(buyerDetailSchema.safeParse({ tab: "invented" }).success, false);
  const range = buyerDateRange(buyerListSchema.parse({ from: "2026-11-19", to: "2026-11-19" }))!;
  assert.equal(range.gte?.toISOString(), "2026-11-18T18:30:00.000Z"); assert.equal(range.lt?.toISOString(), "2026-11-19T18:30:00.000Z");
  const paging = buyerPaging(buyerListSchema.parse({ page: 2, pageSize: 10, sort: "name-asc" }));
  assert.equal(paging.take, 10); assert.equal(paging.skip, 10); assert.deepEqual(paging.orderBy.at(-1), { id: "asc" });
});
test("directory loads only the requested page and aggregates only those buyer IDs", async () => {
  let query: any; const grouped: any[] = [];
  const users = Array.from({ length: 50 }, (_, index) => ({ ...user, id: `${id}-${index}` }));
  const client: any = { user: { findMany: async (input: any) => { query = input; return users; }, count: async () => 1000000 },
    communicationRequest: { groupBy: async (input: any) => { grouped.push(input); return []; } },
    sample: { count: async () => 0, groupBy: async (input: any) => { grouped.push(input); return []; } },
    communicationRequestResponse: { count: async () => 0 }, $queryRaw: async () => [] };
  const result = await directory(buyerListSchema.parse({ page: 3, pageSize: 50, search: "Textiles", from: "2026-11-01", sort: "name-desc" }), client);
  assert.equal(query.take, 50); assert.equal(query.skip, 100); assert.equal(query.where.role, "BUYER");
  assert.ok(query.where.createdAt.gte instanceof Date); assert.ok(query.where.OR.some((entry: any) => entry.buyerProfile?.city?.contains === "Textiles"));
  assert.ok(query.where.OR.some((entry: any) => entry.email?.contains === "Textiles"));
  assert.equal(result.buyers.length, 50); assert.equal(result.totalCount, 1000000);
  assert.ok(grouped.every(input => input.where.buyerId.in.length === 50));
  assert.equal(result.buyers[0].totalInquiries, 2); assert.equal(result.buyers[0].totalRfqs, 3); assert.equal(result.buyers[0].company, null);
});
test("an empty directory page skips page-scoped grouping and returns a bounded empty result", async () => {
  const client: any = { user: { findMany: async () => [], count: async () => 0 }, sample: { count: async () => 0 }, communicationRequestResponse: { count: async () => 0 } };
  const result = await directory(buyerListSchema.parse({}), client);
  assert.deepEqual(result.buyers, []); assert.equal(result.totalPages, 1);
});
test("order estimates use recorded totals, exact decimal multiplication and sample/courier values", () => {
  const response = { price: new Prisma.Decimal("100.55"), requestMatch: { communicationRequest: { quantity: 3 } } };
  assert.equal(orderEstimate({ orderType: "production", response }), "301.65");
  assert.equal(orderEstimate({ orderType: "production", response: { ...response, totalValueEstimate: { total: "330.25" } } }), "330.25");
  assert.equal(orderEstimate({ orderType: "sampling", sample: { quoteSampleCostInr: "10.10", quoteCourierCostInr: "1.25" } }), "11.35");
  assert.equal(orderEstimate({ orderType: "sampling", sample: { quoteSampleCostInr: "0", quoteCourierCostInr: "0" } }), "0.00");
  assert.equal(orderEstimate({ orderType: "production", response: null }), null);
});
test("order summary is a database aggregate with a bound buyer ID and explicit unknown values", async () => {
  let sql: any;
  const result = await buyerOrderSummary(id, { $queryRaw: async (query: any) => { sql = query; return [{ total: 3n, production: 2n, sampling: 1n, valued: 2n, amount: new Prisma.Decimal("313.00") }]; } } as any);
  assert.deepEqual(sql.values, [id]); assert.match(sql.sql, /WHERE o.buyer_id =/);
  assert.equal(result.totalCount, 3); assert.equal(result.unknownValueCount, 1); assert.equal(result.totalValueEstimateInr, "313.00");
  const unknown = await buyerOrderSummary(id, { $queryRaw: async () => [{ total: 1n, valued: 0n, amount: null }] } as any);
  assert.equal(unknown.totalValueEstimateInr, null);
});
test("actual order tab is independently paginated and does not expose raw quote metadata", async () => {
  let query: any;
  const client: any = { order: { count: async () => 51, findMany: async (input: any) => { query = input; return [{ id: "order", orderNumber: "ORD-001", orderType: "sampling", status: "PRODUCTION", createdAt: new Date(), sample: { quoteSampleCostInr: "15", quoteCourierCostInr: "5", fabricName: "Cotton" }, response: null }]; } } };
  const result = await buyerOrders(id, buyerListSchema.parse({ page: 2, pageSize: 25 }), client);
  assert.equal(query.where.buyerId, id); assert.equal(query.take, 25); assert.equal(query.skip, 25);
  assert.equal(result.activity[0].orderNumber, "ORD-001"); assert.equal(result.activity[0].totalValueEstimate, "20.00");
  assert.equal("response" in result.activity[0], false); assert.equal(result.totalPages, 3);
});
test("profile scopes BUYER role, bounds activity, returns sample type and never invents billing address", async () => {
  const queries: any[] = [];
  const client: any = { user: { findFirst: async (input: any) => { assert.deepEqual(input.where, { id, role: "BUYER" }); return user; } },
    $queryRaw: async () => [{ total: 0n, production: 0n, sampling: 0n, valued: 0n, amount: null }],
    communicationRequest: { findMany: async (query: any) => { queries.push(query); return []; }, count: async () => 0 },
    sample: { findMany: async (query: any) => { queries.push(query); return []; }, count: async () => 0 } };
  for (const tab of ["rfqs", "samples"] as const) {
    const result = await profile(id, tab, buyerListSchema.parse({ page: 2, pageSize: 10 }), client);
    assert.equal(result?.buyer.billingAddress, null); assert.deepEqual(result?.activity, []);
    assert.equal(queries.at(-1).take, 10); assert.equal(queries.at(-1).skip, 10); assert.equal(queries.at(-1).where.buyerId, id);
  }
  assert.equal(queries[0].where.requesterRole, "BUYER"); assert.equal(queries[1].select.sampleType, true);
  client.user.findFirst = async () => ({ ...user, buyerProfile: { billingAddress: "Buyer billing office" } });
  assert.equal((await profile(id, "rfqs", buyerListSchema.parse({}), client))?.buyer.billingAddress, "Buyer billing office");
  assert.equal(await profile(id, "rfqs", buyerListSchema.parse({}), { user: { findFirst: async () => null } } as any), null);
});
test("verified email needs matching authoritative email confirmation; GST is never automatically verified", async () => {
  const read = (user: any) => readBuyerVerification(id, "buyer@example.invalid", { getUserById: async () => ({ data: { user } }) });
  assert.deepEqual(await read({ id, email: "buyer@example.invalid", email_confirmed_at: "2026-11-01T00:00:00Z" }), { emailVerified: true, emailVerifiedAt: "2026-11-01T00:00:00Z", gstVerified: null });
  assert.equal((await read({ id, email: "buyer@example.invalid", confirmed_at: "2026-11-01", phone_confirmed_at: "2026-11-01" })).emailVerified, false);
  assert.equal((await read({ id, email: "someone-else@example.invalid", email_confirmed_at: "2026-11-01" })).emailVerified, null);
  assert.equal((await readBuyerVerification(id, "buyer@example.invalid", { getUserById: async () => { throw new Error("provider down"); } })).emailVerified, null);
});
test("buyer routes validate queries, enforce ADMIN and return 404 for an absent buyer", async () => {
  const storage: any = { list: async () => ({ buyers: [], totalCount: 0 }), detail: async (buyer: string, tab: string) => buyer === id ? { buyer: user, activity: [], tab } : null };
  const app = buildApp({ resolveSession: async () => ({ id: "admin", email: "admin@example.invalid", fullName: null, role: "ADMIN" }), buyerHandlers: {
    list: query => service.list(query, storage), detail: (params, query) => service.detail(params, query, storage, async () => unknownBuyerVerification()),
  } });
  try {
    assert.equal((await app.inject({ url: "/api/v1/admin/buyers" })).statusCode, 401);
    const headers = { authorization: "Bearer synthetic-admin" };
    assert.equal((await app.inject({ url: "/api/v1/admin/buyers?pageSize=1000", headers })).statusCode, 400);
    assert.equal((await app.inject({ url: `/api/v1/admin/buyers/${id}?tab=orders`, headers })).statusCode, 200);
    assert.equal((await app.inject({ url: "/api/v1/admin/buyers/22222222-2222-4222-8222-222222222222", headers })).statusCode, 404);
    assert.equal((await app.inject({ url: "/api/v1/admin/buyers/not-a-uuid", headers })).statusCode, 400);
  } finally { await app.close(); }
});
