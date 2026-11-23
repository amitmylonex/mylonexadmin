import { test, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { quickAddSchema, wovenListingSchema, supplierCapabilitySchema } from "../src/modules/catalog/catalog.schema.js";
import { createSupplierSchema, supplierListSchema } from "../src/modules/suppliers/supplier.schema.js";
import { validateImportRows, importCatalog } from "../src/modules/catalog/catalog.import.js";
import { validateImage } from "../src/modules/catalog/catalog.upload.js";
import { saveInTransaction, setCatalogActive } from "../src/modules/catalog/catalog.service.js";
import { prisma } from "../src/infrastructure/db.js";
import { allowAdminWrite } from "../src/modules/auth/write-limit.js";
const fabric = { fabricType: "cotton", productionCycle: "made-to-order", fabricName: "Cotton twill", gsm: 180, weaveType: "twill", fabricState: "greige", pricePerMeter: 150, minimumOrderQuantity: 500, leadTimeDays: 21 };
const importFabric = { ...fabric, composition: "100% Cotton", construction: "120 x 60", widthInches: 58, sampleAvailability: "Available", stockQuantity: 0 };
afterEach(() => mock.restoreAll());
test("publication requires genuine positive commercial values, GSM and state", () => {
  assert.equal(quickAddSchema.safeParse(fabric).success, true);
  for (const [key, value] of [["pricePerMeter", 0], ["gsm", -1], ["leadTimeDays", "bad"], ["fabricState", "invalid"], ["fabricName", " "]]) assert.equal(quickAddSchema.safeParse({ ...fabric, [key as string]: value }).success, false);
  assert.equal(quickAddSchema.safeParse({ ...fabric, pricePerMeter: undefined }).success, false);
  assert.equal(quickAddSchema.safeParse({ ...fabric, fabricState: "dyed" }).success, false);
  assert.equal(quickAddSchema.safeParse({ ...fabric, materialPurity: "blended" }).success, false);
  assert.equal(quickAddSchema.safeParse({ ...fabric, productionCycle: "ready-stock", stockQuantity: 0 }).success, false);
});
test("supplier input normalizes email and rejects invalid GST, phone, location and roles", () => {
  const input = { fullName: "Amit Shah", companyName: "Amit Fabrics", email: "AMIT@example.com", phone: "+919876543210", supplierType: "manufacturer", city: "Surat", locationState: "Gujarat" };
  assert.equal(createSupplierSchema.parse(input).email, "amit@example.com");
  for (const bad of [{ phone: "x" }, { gstNumber: "fake" }, { supplierType: "ADMIN" }, { city: "" }]) assert.equal(createSupplierSchema.safeParse({ ...input, ...bad }).success, false);
});
test("query validation bounds pages and supported statuses", () => {
  for (const query of [{ page: "NaN" }, { page: "1.5" }, { pageSize: "1000" }, { status: "REJECTED" }]) assert.equal(supplierListSchema.safeParse(query).success, false);
});
test("capability ranges and blended material requirements", () => {
  assert.equal(supplierCapabilitySchema.safeParse({ capabilityName: "Cotton", gsmMin: 200, gsmMax: 100 }).success, false);
  assert.equal(supplierCapabilitySchema.safeParse({ capabilityName: "Cotton", countRangeMin: 50, countRangeMax: 20 }).success, false);
  assert.equal(supplierCapabilitySchema.safeParse({ capabilityName: "Cotton", structures: ["custom structure"], gsmMin: 100, gsmMax: 200 }).success, true);
});
test("woven specs reject unknown and duplicate keys", () => {
  const woven = { compositionText: "Cotton", weaveType: "poplin", finishCategory: "greige", gsmFinished: 100, widthFinishedIn: 58, priceInrPerM: 150, leadTimeDays: 21 };
  assert.equal(wovenListingSchema.safeParse({ ...woven, specs: [{ specKey: "secret", valueText: "a" }] }).success, false);
  assert.equal(wovenListingSchema.safeParse({ ...woven, specs: [{ specKey: "epi", valueNum: 100 }, { specKey: "epi", valueNum: 50 }] }).success, false);
});
test("import validation never invents required prices and reports original row numbers", () => {
  const result = validateImportRows([importFabric, { fabricName: "Missing price" }]);
  assert.ok(result[0].data);
  assert.equal(result[1].rowNumber, 3); assert.match(result[1].error!, /pricePerMeter/);
});
test("image upload rejects spoofed content, SVG and oversize input", () => {
  assert.throws(() => validateImage({ contentType: "image/png", data: Buffer.from("<svg/>").toString("base64") }));
  assert.throws(() => validateImage({ contentType: "image/svg+xml", data: "YWJj" }));
  assert.throws(() => validateImage({ contentType: "image/jpeg", data: Buffer.alloc(10*1024*1024+1).toString("base64") }));
  assert.equal(validateImage({ contentType: "image/png", data: Buffer.from([137,80,78,71,13,10,26,10,0]).toString("base64") }).bytes.length, 9);
});
test("foreign collection association is rejected before any write", async () => {
  const tx: any = { fabricCollection: { findFirst: async () => null } };
  await assert.rejects(saveInTransaction(tx, "supplier-a", "fabrics", { ...fabric, fabricCollectionId: "11111111-1111-4111-8111-111111111111" }), /belonging to this supplier/);
});
test("capability linked products must belong to the organization", async () => {
  const tx: any = { supplierCatalog: { count: async () => 0 }, wovenProduct: { count: async () => 0 } };
  await assert.rejects(saveInTransaction(tx, "supplier-a", "capabilities", { capabilityName: "Cotton", linkedSupplierCatalogIds: ["11111111-1111-4111-8111-111111111111"] }), /belong to this supplier/);
});
test("duplicate fabric is rejected without generating another code", async () => {
  const tx: any = { systemCounter: { update: async () => ({ value: 1 }) }, supplierCatalog: { findFirst: async () => ({ id: "existing" }) } };
  await assert.rejects(saveInTransaction(tx, "supplier-a", "fabrics", fabric), /already exists/);
});
test("foreign edit and foreign activation are rejected", async () => {
  const tx: any = { $queryRaw: async () => [{ id: "supplier-a" }], fabricCollection: { findFirst: async () => null, updateMany: async () => ({ count: 0 }) }, supplierCatalog: { findFirst: async () => null } };
  await assert.rejects(saveInTransaction(tx, "supplier-a", "collections", { name: "Summer", imageUrl: "https://example.com/image.png" }, "foreign"), /not found/);
  await assert.rejects(setCatalogActive("supplier-a", "fabrics", "foreign", true, { $transaction: async (fn: any) => fn(tx) } as any), /not found/);
});
test("activation revalidates legacy listings and explicit deactivate remains possible", async () => {
  let active: boolean | undefined;
  const tx: any = { $queryRaw: async () => [{ id: "supplier" }], supplierCatalog: { findFirst: async () => ({ ...fabric, pricePerMeter: 0, productionCycle: "made_to_order" }), updateMany: async ({ data }: any) => { active = data.isActive; return { count: 1 }; } } };
  const client: any = { $transaction: async (fn: any) => fn(tx) };
  await assert.rejects(setCatalogActive("supplier", "fabrics", "listing", true, client));
  assert.equal(active, undefined);
  await setCatalogActive("supplier", "fabrics", "listing", false, client); assert.equal(active, false);
});
test("import detects duplicates inside transaction and reports skipped counts", async () => {
  const tx: any = { $queryRaw: async () => [{ id: "supplier" }], systemCounter: { update: async () => ({ value: 1 }) }, supplierCatalog: { findFirst: async () => ({ id: "duplicate" }) } };
  const client: any = { $transaction: async (fn: any) => fn(tx), supplierProfile: { findUnique: async () => ({ id: "supplier" }) } };
  const result: any = await importCatalog("supplier", { rows: [importFabric] }, client);
  assert.equal(result.skippedCount, 1); assert.equal(result.createdCount, 0);
  const failed: any = await importCatalog("supplier", { rows: [importFabric], skipDuplicates: false }, client);
  assert.equal(failed.failedCount, 1); assert.match(failed.failures[0].reason, /Duplicate/);
});
test("rate limiter bounds writes per actor and resets", () => {
  for (let i=0; i<60; i++) assert.equal(allowAdminWrite("test-actor", 1000), true);
  assert.equal(allowAdminWrite("test-actor", 1000), false);
  assert.equal(allowAdminWrite("test-actor", 62000), true);
});

import { createSupplierAccount } from "../src/modules/suppliers/supplier-create.service.js";
test("supplier creation links invited identity and starts pending", async () => {
  let written: any, invitations = 0;
  const tx: any = { $queryRaw: async () => [], user: { findFirst: async () => null, create: async (query: any) => { written = query.data; return { supplierProfile: { id: "new-supplier" } }; } }, supplierProfile: { findFirst: async () => null } };
  const client: any = { $transaction: async (fn: any) => fn(tx) };
  const input = { fullName: "Amit Shah", companyName: "Amit Fabrics", email: "AMIT@example.com", phone: "9876543210", supplierType: "manufacturer", city: "Surat", locationState: "Gujarat" };
  const provider = { createUser: async () => { invitations++; return "verified-auth-id"; }, deleteUser: async () => {} };
  await createSupplierAccount(input, client, provider);
  assert.equal(written.id, "verified-auth-id"); assert.equal(written.supplierProfile.create.status, "PENDING"); assert.equal(written.supplierProfile.create.dispatchLocation, "Surat, Gujarat"); assert.equal(invitations, 1);
  written = undefined;
  tx.user.findFirst = async () => ({ id: "existing" });
  await assert.rejects(createSupplierAccount(input, client, provider), (e: any) => e.statusCode === 409);
  assert.equal(invitations, 1); assert.equal(written, undefined);
  tx.user.findFirst = async () => null; tx.supplierProfile.findFirst = async () => ({ id: "same-company" });
  await assert.rejects(createSupplierAccount(input, client, provider), (e: any) => e.statusCode === 409);
  assert.equal(invitations, 1);
});
test("invitation failure never creates a disconnected supplier profile", async () => {
  let written = false;
  const tx: any = { $queryRaw: async () => [], user: { findFirst: async () => null, create: async () => { written = true; } }, supplierProfile: { findFirst: async () => null } };
  const input = { fullName: "Amit Shah", companyName: "Amit Fabrics", email: "amit@example.com", phone: "9876543210", supplierType: "manufacturer", city: "Surat", locationState: "Gujarat" };
  await assert.rejects(createSupplierAccount(input, { $transaction: async (fn: any) => fn(tx) } as any, { createUser: async () => { throw new Error("provider unavailable"); }, deleteUser: async () => {} }));
  assert.equal(written, false);
});
