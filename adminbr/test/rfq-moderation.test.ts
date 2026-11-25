import { test } from "node:test";
import assert from "node:assert/strict";
import { compositionsMatchByPercentage, normalizedListingFromCatalog, parseRequirementFromRequest, scoreListingMatch } from "../src/modules/rfqs/matching/engine.js";
import { findRoutingCandidates } from "../src/modules/rfqs/matching/candidates.js";
import { moderationBulkSchema, moderationQuerySchema } from "../src/modules/rfqs/moderation.schema.js";
import { createModerationService } from "../src/modules/rfqs/moderation.service.js";
import { commitModeration } from "../src/modules/rfqs/moderation.transaction.js";
import { listModeration } from "../src/modules/rfqs/moderation.repository.js";
import { visibleRfq } from "../src/modules/rfqs/moderation.privacy.js";
import { drainQueuedRfqNotifications } from "../src/modules/notifications/rfq-queue.js";
import { buildApp } from "../src/app.js";
const id = "11111111-1111-4111-8111-111111111111", other = "22222222-2222-4222-8222-222222222222";
const now = new Date("2026-11-19T00:00:00Z");
const spec = {composition: "100% Cotton", fabricStructure: "woven", data: { weaveType: "Plain", gsm: 120, width: "58", quantity: 999 }};
const supplier = { id: "mill", companyName: "Test Mill", status: "APPROVED", phone: "9876548099", phoneCountryCode: "91", whatsappConsent: true, whatsappConsentAt: now };
const listing = { id: "fabric", supplierId: "mill", supplier, isActive: true, fabricName: "Cotton", compositionText: "100% Cotton", weaveType: "Plain", gsm: 120, widthInches: 58,
  minimumOrderQuantity: 100, leadTimeDays: 14, pricePerMeter: 90, productionCycle: "make_to_order", materialPurity: "pure", blendDescription: null, fabricState: "greige" };
const request = { id, rfqNumber: "RFQ-001", requesterRole: "BUYER", status: "pending", updatedAt: now, specPayload: spec, quantity: 1000, deliveryPincode: "395001", buyerMessage: "No remarks" };
const candidate = { supplierId: "mill", supplierName: "Test Mill", sourceType: "supplier_catalog" as const, sourceId: "fabric", score: 90, explanation: "Specs aligned", listingSnapshot: {} };
function memory(overrides: any = {}) {
  let rfq: any = structuredClone({...request, ...overrides}); let matches: any[] = []; const sql: any[] = [];
  const tx: any = {
    $queryRaw: async (query: any, ...values: any[]) => {sql.push({query, values}); return [{id: "mill"}];},
    communicationRequest: {findUnique: async () => rfq, update: async ({data}: any) => Object.assign(rfq, data)},
    supplierProfile: {findMany: async () => supplier.status === "APPROVED" ? [supplier] : []},
    supplierCatalog: {findFirst: async () => listing}, wovenProduct: {findFirst: async () => null},
    communicationRequestMatch: {
      findUnique: async ({where}: any) => matches.find(m => m.sourceId === where.communicationRequestId_sourceType_sourceId_supplierId.sourceId) || null,
      findFirst: async ({where}: any) => matches.find(m => m.status === where.status) || null,
      create: async ({data}: any) => {const row = {...data, id: `match-${matches.length}`}; matches.push(row); return row;},
      update: async ({where, data}: any) => Object.assign(matches.find(m => m.id === where.id), data),
      updateMany: async ({where, data}: any) => {matches.filter(m => m.status === where.status).forEach(m => Object.assign(m, data)); return {count: 1};},
    },
  };
  const client: any = {...tx, $transaction: async (run: any) => {
    const saved = structuredClone({rfq, matches}); try {return await run(tx);} catch (e) {rfq = saved.rfq; matches = saved.matches; throw e;}
  }};
  return {client, tx, sql, get request() {return rfq;}, get matches() {return matches;}};
}
test("composition scoring compares fiber identities, ratios and percentages", () => {
  assert.equal(compositionsMatchByPercentage("70% Cotton - 30% Polyester", "70% Polyester - 30% Cotton")?.matched, false);
  assert.equal(compositionsMatchByPercentage("65/35 PC", "35% cotton / 65% polyester")?.matched, true);
  assert.equal(compositionsMatchByPercentage("100% Cotton", "100% Viscose")?.matched, false);
  const normalized = normalizedListingFromCatalog(listing as any), requirement = parseRequirementFromRequest(spec);
  assert.ok(scoreListingMatch(normalized, requirement));
  for (const patch of [{weave: "Twill"}, {gsm: 200}, {width: 70}, {composition: "100% Viscose"}, {composition: ""}]) assert.equal(scoreListingMatch({...normalized, ...patch}, requirement), null);
});
test("exact selected fabric never broadens to another listing or a manual match", async () => {
  let query: any;
  const client: any = {supplierCatalog: {findFirst: async (q: any) => {query = q; return null;}}};
  assert.deepEqual(await findRoutingCandidates({...request, specPayload: {origin: "fabric_quick_rfq", selectedFabricId: "gone"}} as any, client), []);
  assert.equal(query.where.id, "gone"); assert.equal(query.where.isActive, true); assert.equal(query.where.supplier.status, "APPROVED");
});
test("matching reads keyset catalog pages of 200 and retains eight distinct approved suppliers", async () => {
  const queries: any[] = [];
  const client: any = { supplierCatalog: { findMany: async (q: any) => {queries.push(q); return q.where.id ? [{...listing, id: "z", supplierId: "s0"}] : Array.from({length:200}, (_, n) => ({...listing, id: `a${String(n).padStart(3,"0")}`, supplierId: `s${n % 10}`}));}},
    wovenProduct: {findMany: async () => []}, communicationRequestMatch: {findMany: async () => []} };
  const rows = await findRoutingCandidates(request as any, client);
  assert.equal(rows.length, 8); assert.equal(new Set(rows.map(r => r.supplierId)).size, 8);
  assert.equal(queries[0].take, 200); assert.deepEqual(queries[1].where.id, {gt:"a199"}); assert.equal(queries[0].where.supplier.status, "APPROVED");
});
test("approval commits dashboard routes, approval metadata and consented durable queue together", async () => {
  const db = memory(); const result = await commitModeration(id, "approve", "admin", "Verified", {updatedAt: now, candidates: [candidate]}, db.client);
  assert.equal(result.queuedCount, 1); assert.equal(result.matchedSupplierCount, 1); assert.equal(db.request.status, "approved"); assert.equal(db.request.adminReviewNote, "Verified");
  assert.equal(db.matches[0].whatsappStatus, "QUEUED"); assert.equal(db.matches[0].status, "FORWARDED_TO_SUPPLIER");
  assert.ok(db.sql[0].query.join("").includes("FOR UPDATE")); assert.ok(db.sql[1].query.sql.includes("FOR SHARE"));
  const replay = await commitModeration(id, "approve", "admin", undefined, {updatedAt:now, candidates:[candidate]}, db.client);
  assert.equal(replay.alreadyReviewed, true); assert.equal(replay.queuedCount, 0); assert.equal(db.matches.length, 1);
});
test("non-consented suppliers receive dashboard routing without WhatsApp calls or queue entries", async () => {
  const db = memory(); db.tx.supplierProfile.findMany = async () => [{...supplier, whatsappConsent:false, whatsappConsentAt:null}];
  const result = await commitModeration(id, "approve", "admin", undefined, {updatedAt:now, candidates:[candidate]}, db.client);
  assert.equal(result.dashboardOnlyCount,1); assert.equal(result.queuedCount,0); assert.equal(db.matches[0].whatsappStatus,"SKIPPED_NO_CONSENT");
});

test("unmatched RFQ can be approved for later sourcing without routes or notifications", async () => {
  const db = memory();
  const result = await commitModeration(id,"approve","admin","Source suppliers later",{updatedAt:now,candidates:[]},db.client);
  assert.equal(db.request.status,"approved");
  assert.equal(db.request.adminReviewedByUserId,"admin");
  assert.equal(db.request.adminReviewNote,"Source suppliers later");
  assert.ok(db.request.adminReviewedAt instanceof Date);
  assert.equal(result.routingPending,true);
  assert.equal(result.matchedSupplierCount,0); assert.equal(result.queuedCount,0);
  assert.equal(db.matches.length,0);
  assert.equal(db.sql.length,1); // Only the RFQ lock; no supplier locks or routing writes.
  const replay = await commitModeration(id,"approve","admin",undefined,{updatedAt:now,candidates:[]},db.client);
  assert.equal(replay.alreadyReviewed,true); assert.equal(db.matches.length,0);
});

test("bulk approval counts unmatched RFQs awaiting sourcing", async () => {
  const db = memory();
  const service = createModerationService(db.client,async () => [],commitModeration);
  const result = await service.bulk({ids:[id],decision:"approve",note:"Ready for sourcing"},"admin");
  assert.equal(result.changedCount,1); assert.equal(result.failedCount,0);
  assert.equal(result.awaitingSupplierCount,1); assert.equal(result.queuedCount,0);
  assert.equal(db.request.status,"approved");
});
test("supplier suspended after preview and inactive listings cannot receive matches", async () => {
  for (const change of ["supplier", "listing"]) {
    const db = memory(); if (change === "supplier") db.tx.supplierProfile.findMany = async () => []; else db.tx.supplierCatalog.findFirst = async () => null;
    await assert.rejects(commitModeration(id,"approve","admin",undefined,{updatedAt:now,candidates:[candidate]},db.client), /eligibility or listings changed/);
    assert.equal(db.request.status,"pending"); assert.equal(db.matches.length,0);
  }
});
test("stale RFQs and opposing decisions conflict; rejection preserves forwarded history", async () => {
  const db = memory(); await assert.rejects(commitModeration(id,"approve","admin",undefined,{updatedAt:new Date(0),candidates:[candidate]},db.client), /requirements changed/);
  db.tx.communicationRequestMatch.findFirst = async () => ({id:"existing"});
  await assert.rejects(commitModeration(id,"reject","admin","Reason",{updatedAt:now,candidates:[]},db.client), /forwarded matches/);
  assert.equal(db.request.status,"pending");
  const rejected = memory({status:"rejected"}); await assert.rejects(commitModeration(id,"approve","admin",undefined,{updatedAt:now,candidates:[]},rejected.client), /no longer pending/);
});
test("rejection persists required reason and actor without creating supplier matches", async () => {
  const db = memory(), service = createModerationService(db.client);
  await assert.rejects(service.reject(id,{reason:"   "},"admin")); assert.equal(db.sql.length,0);
  await service.reject(id,{reason:"Incomplete specification"},"admin");
  assert.equal(db.request.status,"rejected"); assert.equal(db.request.adminReviewedByUserId,"admin"); assert.equal(db.request.adminReviewNote,"Incomplete specification"); assert.equal(db.matches.length,0);
});
test("bulk validates all IDs, reasons and size before writes, and isolates per-RFQ failures", async () => {
  for (const input of [{ids:[id,id],decision:"approve"}, {ids:[id],decision:"reject"}, {ids:Array(51).fill(id),decision:"approve"}]) assert.equal(moderationBulkSchema.safeParse(input).success,false);
  let commits = 0;
  const db = memory(); db.client.communicationRequest.findUnique = async ({where}: any) => where.id === other ? null : request;
  const service = createModerationService(db.client, async () => [candidate], async () => {commits++; return {rfqId:id,status:"approved",alreadyReviewed:false,queuedCount:1,matchedSupplierCount:1,dashboardOnlyCount:0};});
  await assert.rejects(service.bulk({ids:[id,"bad"],decision:"approve"},"admin")); assert.equal(commits,0);
  const result = await service.bulk({ids:[id,other],decision:"approve"},"admin"); assert.equal(result.changedCount,1); assert.equal(result.failedCount,1); assert.equal(result.queuedCount,1);
});
test("queue list is paginated and sanitizes anonymous buyer contacts from nested specs", async () => {
  let query: any;
  const client: any = { communicationRequest: {findMany: async (q:any) => {query=q;return [{...request,buyer:{email:"private@example.invalid",fullName:"Private"},buyerIdentityDisclosed:false,specPayload:{...spec,data:{...spec.data,buyerEmail:"private@example.invalid",remarks:"Email private@example.invalid or +91 9876548099"}}}];},count:async () => 40}, supplierProfile:{findMany:async () => [supplier]} };
  const result = await listModeration(moderationQuerySchema.parse({page:2,pageSize:10}),client,async () => [candidate]);
  assert.equal(query.take,10); assert.equal(query.skip,10); assert.equal(query.where.status,"pending"); assert.equal(query.where.requesterRole,"BUYER");
  const json = JSON.stringify(result); assert.ok(!json.includes("private@example.invalid")); assert.ok(!json.includes("9876548099")); assert.equal(result.rfqs[0].proposedMatches.length,1);
  assert.equal(visibleRfq({...request,buyerIdentityDisclosed:false}).buyerAnonymized,true);
});
function queueDb(profile: any = supplier) {
  let status = "QUEUED", messageId: string | null = null;
  const row = {id:"match",supplier:profile,communicationRequest:{status:"approved"},communicationRequestId:id,quoteDeadlineAt:new Date(Date.now()+3600000)};
  const client:any = {rfqDispatchAttempt:{create:async () => ({id:"initial"}),updateMany:async () => ({count:1})},communicationRequestMatch:{findFirst:async () => null,findMany:async () => status === "QUEUED" ? [{id:"match"}] : [], findUnique:async () => row,
    updateMany:async ({where,data}:any) => {if(status !== where.whatsappStatus || messageId) return {count:0}; status = data.whatsappStatus; messageId = data.whatsappMessageId || null; return {count:1};}}};
  return {client,get status(){return status;},get messageId(){return messageId;}};
}
test("two notification workers claim a queued entry only once", async () => {
  const db = queueDb(); let calls = 0;
  await Promise.all([drainQueuedRfqNotifications(async ({phone}) => {calls++; assert.equal(phone,"919876548099"); return {messageId:"provider-id"};},db.client),drainQueuedRfqNotifications(async () => {calls++;return {messageId:"duplicate"};},db.client)]);
  assert.equal(calls,1); assert.equal(db.status,"SENT"); assert.equal(db.messageId,"provider-id");
});
test("worker rechecks revocation/suspension, and never retries ambiguous provider failures", async () => {
  for (const profile of [{...supplier,whatsappConsent:false},{...supplier,status:"SUSPENDED"},{...supplier,phone:"invalid"}]) {
    const db=queueDb(profile); let calls=0; await drainQueuedRfqNotifications(async () => {calls++;return {messageId:"bad"};},db.client); assert.equal(calls,0); assert.equal(db.status,"SKIPPED_INELIGIBLE");
  }
  const db=queueDb();let calls=0;const send=async () => {calls++;throw new Error("timeout after provider accepted");};
  await drainQueuedRfqNotifications(send,db.client); await drainQueuedRfqNotifications(send,db.client); assert.equal(calls,1); assert.equal(db.status,"AMBIGUOUS_ERROR");
});
test("RFQ moderation HTTP routes require authentication and use RFQ-level handlers", async () => {
  const db=memory();const service=createModerationService(db.client,async () => [candidate]);
  const app=buildApp({resolveSession:async () => ({id:"admin",email:"admin@example.invalid",fullName:null,role:"ADMIN"}),moderationHandlers:service});
  try {
    for(const path of ["/rfq-approvals",`/rfq-approvals/${id}/approve`,`/rfq-approvals/${id}/reject`,"/rfq-approvals/bulk"]) assert.equal((await app.inject({method:path === "/rfq-approvals" ? "GET":"POST",url:`/api/v1/admin${path}`})).statusCode,401);
    const headers={authorization:"Bearer synthetic-admin"};
    assert.equal((await app.inject({method:"POST",url:`/api/v1/admin/rfq-approvals/${id}/reject`,headers,payload:{}})).statusCode,400);
    const response=await app.inject({method:"POST",url:`/api/v1/admin/rfq-approvals/${id}/approve`,headers,payload:{}});assert.equal(response.statusCode,200);assert.equal(response.json().queuedCount,1);
  } finally {await app.close();}
});
