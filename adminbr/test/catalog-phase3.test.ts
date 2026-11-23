import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { buildApp } from "../src/app.js";
import { generateCatalogTemplate } from "../src/modules/catalog/catalog-template.service.js";
import { validateImportRows, importCatalog } from "../src/modules/catalog/catalog.import.js";
import { saveInTransaction } from "../src/modules/catalog/catalog.service.js";
import { createApiClient } from "../../adminfr/src/services/api-client.js";
import { readWorkbook, analyzeWorkbook, getSheetRawRows } from "../../adminfr/src/features/catalog/excel/analyzer.js";
import { stageSheet, editStagedRow, confirmStagedDefaults, remapStagedRow } from "../../adminfr/src/features/catalog/excel/staging.js";
const supplier = "11111111-1111-4111-8111-111111111111", product = "22222222-2222-4222-8222-222222222222";
const fabric = { fabricName: "Manual Cotton", composition: "100% Cotton", construction: "96 x 72", weaveType: "Custom 2/1 twill", gsm: 180, widthInches: 58,
  fabricState: "greige", productionCycle: "made-to-order", stockQuantity: 0, minimumOrderQuantity: 1000, leadTimeDays: 21, pricePerMeter: 145.5, sampleAvailability: "Available" };
test("server template is binary XLSX with instructions and a sample accepted by the real browser/server engines", async () => {
  const buffer = await generateCatalogTemplate(); assert.equal(buffer.subarray(0, 2).toString(), "PK");
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer as any);
  assert.ok(workbook.getWorksheet("Instructions")); assert.equal(workbook.getWorksheet("Fabric Catalog Import")!.rowCount, 2);
  const parsed = readWorkbook(buffer); const analysis = analyzeWorkbook(parsed);
  const rows = stageSheet(getSheetRawRows(parsed, analysis.selectedSheet), analysis, analysis.mappings);
  assert.equal(rows.length, 1); assert.equal(rows[0].status, "ready", JSON.stringify(rows[0].issues));
  assert.equal(validateImportRows([rows[0].data])[0].error, undefined);
  const source = readFileSync(new URL("../../adminfr/src/features/catalog/excel/headers.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const server = readFileSync(new URL("../src/modules/catalog/excel/headers.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n").replace(/\.js(["'])/g, "$1");
  assert.equal(server, source, "template columns must match the browser registry");
});
test("active template, quick-add and PATCH publication routes enforce ADMIN access and validate parameters", async () => {
  const calls: any[] = [];
  const app = buildApp({ resolveSession: async () => ({ id: "admin", email: "admin@example.invalid", fullName: null, role: "ADMIN" }), catalogActions: {
    requireSupplier: async id => { calls.push(["supplier", id]); return { id, status: "APPROVED" } as any; },
    generateCatalogTemplate,
    saveCatalogItem: async (id, kind, body) => { calls.push(["quick", id, kind, body]); return { id: product } as any; },
    setCatalogActive: async (id, kind, item, active) => { calls.push(["active", id, kind, item, active]); return { updated: true }; },
  } });
  try {
    for (const [method, suffix] of [["GET", "excel-template"], ["POST", "quick-add"], ["PATCH", `products/${product}`]]) {
      assert.equal((await app.inject({ method: method as any, url: `/api/v1/admin/suppliers/${supplier}/catalog/${suffix}` })).statusCode, 401);
    }
    assert.equal(calls.length, 0);
    const headers = { authorization: "Bearer synthetic-admin" };
    const template = await app.inject({ url: `/api/v1/admin/suppliers/${supplier}/catalog/excel-template`, headers });
    assert.equal(template.statusCode, 200); assert.match(String(template.headers["content-type"]), /spreadsheetml/);
    assert.match(String(template.headers["content-disposition"]), /\.xlsx/); assert.equal(template.rawPayload.subarray(0, 2).toString(), "PK");
    assert.equal((await app.inject({ method: "POST", url: `/api/v1/admin/suppliers/${supplier}/catalog/quick-add`, headers, payload: fabric })).statusCode, 201);
    const toggled = await app.inject({ method: "PATCH", url: `/api/v1/admin/suppliers/${supplier}/catalog/products/${product}`, headers, payload: { isActive: false, sourceType: "woven" } });
    assert.equal(toggled.statusCode, 200); assert.deepEqual(calls.at(-1), ["active", supplier, "woven", product, false]);
    const before = calls.length;
    assert.equal((await app.inject({ method: "PATCH", url: `/api/v1/admin/suppliers/${supplier}/catalog/products/${product}`, headers, payload: { isActive: "false" } })).statusCode, 400);
    assert.equal((await app.inject({ url: "/api/v1/admin/suppliers/not-uuid/catalog/excel-template", headers })).statusCode, 400);
    assert.equal(calls.length, before);
  } finally { await app.close(); }
});
test("manual quick-add and imports share allocator ordering, free weave and active duplicate checks", async () => {
  const calls: string[] = []; let saved: any;
  const tx: any = { systemCounter: { update: async (query: any) => { calls.push(query.data.value.increment ? "allocate" : "lock"); return { value: 99 }; } },
    supplierCatalog: { findFirst: async ({ where }: any) => { assert.equal(where.isActive, true); calls.push("duplicate"); return null; }, create: async ({ data }: any) => { saved = data; return data; } } };
  await saveInTransaction(tx, supplier, "fabrics", fabric);
  assert.deepEqual(calls, ["lock", "duplicate", "allocate"]); assert.equal(saved.mylonexCode, "MYLO0099"); assert.equal(saved.weaveType, "Custom 2/1 twill");
});
test("501 import rows fail before any supplier lookup or writes", async () => {
  let touched = false;
  const client: any = { supplierProfile: { findUnique: async () => { touched = true; } } };
  await assert.rejects(importCatalog(supplier, { rows: Array.from({ length: 501 }, () => fabric) }, client));
  assert.equal(touched, false);
});
test("staging keeps physical row coordinates through removal, remapping, defaults and width recalculation", () => {
  const csv = "Fabric Name,Composition,GLM,Width (cm),Warp,Weft,Construction,Weave,Price,Sample Availability\nA,100% Cotton,310,147.32,40s,30s,96x72,Custom weave,145,Available\nB,100% Cotton,310,147.32,40s,30s,96x72,Custom weave,145,Available";
  const workbook = readWorkbook(Buffer.from(csv)); const analysis = analyzeWorkbook(workbook);
  const original = stageSheet(getSheetRawRows(workbook, analysis.selectedSheet), analysis, analysis.mappings);
  assert.equal(original[1].sourceRowNumber, 3);
  const remaining = original.filter(row => row.id !== original[0].id);
  const remapped = remapStagedRow(remaining[0], getSheetRawRows(workbook, analysis.selectedSheet)[0], analysis.mappings);
  assert.equal(remapped.sourceRowNumber, 3); assert.equal(remapped.rawCells?.[0], "B");
  const confirmed = confirmStagedDefaults(remapped); assert.equal(confirmed.status, "ready", JSON.stringify(confirmed.issues));
  assert.equal(confirmed.data.count, "Warp: 40s / Weft: 30s"); assert.equal(confirmed.data.gsm, 210);
  const width = editStagedRow(confirmed, "widthValue", 100); assert.equal(width.data.gsm, 310);
  assert.equal(editStagedRow(width, "widthValue", "").status, "invalid");
});
test("authenticated binary API downloads preserve data without attempting JSON parsing", async () => {
  const request = createApiClient({ baseUrl: "http://localhost", getToken: async () => "token", onUnauthorized: () => {}, onError: () => {},
    fetch: async (_url, options) => { assert.equal(new Headers(options?.headers).get("authorization"), "Bearer token"); return new Response(new Uint8Array([80, 75, 3, 4])); } });
  assert.deepEqual(new Uint8Array(await (await request<Blob>("/template", { responseType: "blob" })).arrayBuffer()), new Uint8Array([80, 75, 3, 4]));
});

test("woven listing creation saves technical specs with the newly created product identity", async () => {
  let specs: any, record: any;
  const tx: any = { wovenProduct: { create: async ({ data }: any) => { record = data; return { id: product }; } },
    wovenProductSpec: { createMany: async ({ data }: any) => { specs = data; } } };
  await saveInTransaction(tx, supplier, "woven", { compositionText: "100% Cotton", weaveType: "poplin", finishCategory: "greige", gsmFinished: 180,
    widthFinishedIn: 58, priceInrPerM: 145, moqMeters: 1000, leadTimeDays: 21,
    specs: [{ specKey: "warp_count_ply", valueText: "2/60s" }, { specKey: "weft_count_ply", valueText: "40s" }, { specKey: "epi", valueNum: 132 }, { specKey: "ppi", valueNum: 72 }] });
  assert.equal(record.supplierId, supplier); assert.match(record.specSummary, /132/);
  assert.equal(specs.length, 4); assert.ok(specs.every((spec: any) => spec.productId === product));
});
