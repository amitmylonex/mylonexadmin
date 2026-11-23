import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { importCatalog, validateImportRows } from "../src/modules/catalog/catalog.import.js";
import { createImportRow } from "../src/modules/catalog/catalog-import.repository.js";
import { setCatalogActive } from "../src/modules/catalog/catalog.service.js";
import { updateConsent } from "../src/modules/suppliers/supplier.service.js";

const row = { fabricName: "Bamboo", composition: "70% Poly / 30% Bamboo", count: "40s", construction: "96 x 72",
  weightValue: 310, weightUnit: "GLM", widthValue: 147.32, widthUnit: "cm", weaveType: "2/1 Fancy Twill",
  fabricState: "greige", productionCycle: "made-to-order", stockQuantity: 0, pricePerMeter: 145.5,
  minimumOrderQuantity: 1000, leadTimeDays: 21, sampleAvailability: "Available" };

test("browser and server spreadsheet engines remain identical across module resolution formats", () => {
  for (const file of ["row-schema", "row-types", "allowed-values", "validation", "units", "range-parser", "semantic", "weave-text", "fields", "requirements", "types"]) {
    const front = readFileSync(new URL(`../../adminfr/src/features/catalog/excel/${file}.ts`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
    const back = readFileSync(new URL(`../src/modules/catalog/excel/${file}.ts`, import.meta.url), "utf8").replace(/\r\n/g, "\n").replace(/\.js(["'])/g, "$1");
    assert.equal(back, front, `${file} validation drift`);
  }
});

test("server recalculates dimensions, merges count, permits blank names and preserves free weave", () => {
  const result = validateImportRows([{ ...row, fabricName: " ", gsm: 999, widthInches: 1 }])[0];
  assert.equal(result.error, undefined);
  assert.equal(result.data?.fabricName, ""); assert.equal(result.data?.gsm, 210);
  assert.equal(result.data?.widthInches, 58); assert.equal(result.data?.construction, "40s / 96 x 72");
  assert.equal(result.data?.weaveType, "2/1 Fancy Twill");
  assert.equal(validateImportRows([{ ...row, weightValue: 6, weightUnit: "OZ" }])[0].data?.gsm, 203);
});

test("missing weave, unconfirmed defaults, unsupported yarn, invalid width and ready-stock block writes", async () => {
  for (const change of [{ weaveType: "" }, { weaveType: "a".repeat(201) }, { widthValue: 0 }, { yarnType: "combed" },
    { minimumOrderQuantity: undefined }, { productionCycle: "ready-stock", stockQuantity: 0 }]) {
    assert.ok(validateImportRows([{ ...row, ...change }])[0].error);
  }
  let writes = 0;
  const client: any = { supplierProfile: { findUnique: async () => ({ id: "supplier" }) }, $transaction: async () => { writes++; } };
  await assert.rejects(importCatalog("supplier", { rows: [row, { ...row, weaveType: "" }] }, client), /Import not saved/);
  assert.equal(writes, 0);
});

test("allocator lock precedes active duplicate check and every source field is persisted", async () => {
  const calls: string[] = []; let saved: any;
  const tx: any = {
    $queryRaw: async () => { calls.push("supplier"); return [{ id: "supplier" }]; },
    systemCounter: { update: async (query: any) => { calls.push(query.data.value.increment ? "allocate" : "lock"); return { value: 42 }; } },
    supplierCatalog: { findFirst: async ({ where }: any) => { calls.push("duplicate"); assert.equal(where.isActive, true); assert.equal(where.weaveType.mode, "insensitive"); return null; },
      create: async ({ data }: any) => { saved = data; calls.push("save"); return data; } },
  };
  await createImportRow(tx, "supplier", validateImportRows([{ ...row, fabricName: "" }])[0].data!, true);
  assert.deepEqual(calls, ["supplier", "lock", "duplicate", "allocate", "save"]);
  assert.equal(saved.mylonexCode, "MYLO0042"); assert.equal(saved.fabricName, "");
  assert.equal(saved.isActive, true); assert.equal(saved.fabricType, null); assert.equal(saved.materialPurity, null);
  assert.equal(saved.weightUnit, "GLM"); assert.equal(saved.weightValue, 310);
  assert.equal(saved.widthUnit, "cm"); assert.equal(saved.widthValue, 147.32);
  assert.equal(saved.sampleAvailability, "Available"); assert.equal(saved.construction, "40s / 96 x 72");
});

test("row failure preserves earlier commits, continues later rows and retries skip active successes", async () => {
  const stored = new Set<string>(); let counter = 0; let fail = true;
  const tx: any = {
    $queryRaw: async () => [{ id: "supplier" }],
    systemCounter: { update: async (query: any) => ({ value: counter += query.data.value.increment }) },
    supplierCatalog: { findFirst: async ({ where }: any) => stored.has(where.fabricName.equals) ? { id: "saved" } : null,
      create: async ({ data }: any) => { if (data.fabricName === "Bad" && fail) throw new Error("private database detail"); stored.add(data.fabricName); } },
  };
  let transactions = 0;
  const client: any = { supplierProfile: { findUnique: async () => ({ id: "supplier" }) }, $transaction: async (fn: any) => {
    transactions++; const previous = counter; try { return await fn(tx); } catch (error) { counter = previous; throw error; }
  } };
  const rows = [row, { ...row, fabricName: "Bad", sourceRowNumber: 7 }, { ...row, fabricName: "Last" }, row];
  const result = await importCatalog("supplier", { rows }, client);
  assert.equal(result.createdCount, 2); assert.equal(result.failedCount, 1); assert.equal(result.skippedCount, 1);
  assert.equal(result.failures[0].rowNumber, 7); assert.doesNotMatch(result.failures[0].reason, /private/);
  assert.equal(transactions, 4); assert.equal(counter, 2);
  fail = false;
  const retry = await importCatalog("supplier", { rows }, client);
  assert.equal(retry.createdCount, 1); assert.equal(retry.skippedCount, 3); assert.equal(retry.failedCount, 0);
});

test("consent requires explicit confirmation and persists normalized phone", async () => {
  let saved: any;
  const storage: any = { detail: async () => ({ id: "supplier", phone: "98765 43210", phoneCountryCode: "91" }),
    consent: async (_id: string, data: any) => { saved = data; return data; } };
  await assert.rejects(updateConsent("supplier", { consent: true, explicitConfirmation: false }, storage), /Explicit confirmation/);
  assert.equal(saved, undefined);
  await updateConsent("supplier", { consent: true, explicitConfirmation: true }, storage);
  assert.equal(saved.phone, "919876543210"); assert.ok(saved.whatsappConsentAt instanceof Date);
  await updateConsent("supplier", { consent: false, explicitConfirmation: false }, storage);
  assert.equal(saved.whatsappConsentAt, null); assert.equal(saved.whatsappConsent, false);
});

test("empty image cells are allowed and preview never opens a write transaction", async () => {
  assert.equal(validateImportRows([{ ...row, imageUrl: "" }])[0].error, undefined);
  let writes = 0;
  const client: any = { supplierProfile: { findUnique: async () => ({ id: "supplier" }) }, $transaction: async () => { writes++; } };
  const result = await importCatalog("supplier", { rows: [row, { ...row, weaveType: "" }], preview: true }, client);
  assert.equal(result.validCount, 1); assert.equal(result.failures.length, 1); assert.equal(writes, 0);
});

test("missing historical allocator fails closed before catalog writes", async () => {
  let touched = false;
  const tx: any = { $queryRaw: async () => [{ id: "supplier" }], systemCounter: { update: async () => { throw new Error("missing allocator"); } },
    supplierCatalog: { findFirst: async () => { touched = true; } } };
  await assert.rejects(createImportRow(tx, "supplier", validateImportRows([row])[0].data!, true), /missing allocator/);
  assert.equal(touched, false);
});

test("an imported blank title can be reactivated using its existing MYLO display code", async () => {
  let active = false;
  const data = validateImportRows([{ ...row, fabricName: "" }])[0].data!;
  const tx: any = { $queryRaw: async () => [{ id: "supplier" }], supplierCatalog: {
    findFirst: async () => ({ ...data, mylonexCode: "MYLO0042", productionCycle: "made_to_order" }),
    updateMany: async ({ data }: any) => { active = data.isActive; return { count: 1 }; },
  } };
  await setCatalogActive("supplier", "fabrics", "fabric", true, { $transaction: async (fn: any) => fn(tx) } as any);
  assert.equal(active, true);
});
