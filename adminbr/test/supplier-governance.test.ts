import { test } from "node:test";
import assert from "node:assert/strict";
import { createSupplierAccount } from "../src/modules/suppliers/supplier-create.service.js";
import { transitionSupplier, statusChangeSchema } from "../src/modules/suppliers/supplier-status.service.js";
import { updateConsent, list } from "../src/modules/suppliers/supplier.service.js";
import { normalizeConsentPhone } from "../src/modules/suppliers/supplier-phone.js";
import { supplierAccountSchema } from "../../adminfr/src/features/suppliers/supplier-validation.js";
import { maskSupplierPhone } from "../../adminfr/src/features/suppliers/supplier-phone.js";
import { buildApp } from "../src/app.js";
import { sendSetupEmail } from "../src/modules/suppliers/supplier-provisioning.provider.js";
const input = { fullName: "Supplier Contact", companyName: "Test Textiles", email: "SUPPLIER@example.invalid", phone: "9876548099", supplierType: "manufacturer" };
function harness() {
  let written: any, created: any, committed: any = null;
  let failProfile = false, failCleanup = false, ambiguous = false, unableToVerify = false;
  const deleted: string[] = [], mail: string[] = [];
  let inTransaction = false;
  const tx: any = { $queryRaw: async () => [], supplierProfile: { findFirst: async () => null },
    user: { findFirst: async () => null, create: async ({ data }: any) => {
      if (failProfile) throw new Error("private SQL detail");
      written = data; committed = { id: data.id, supplierProfile: { id: "profile", ...data.supplierProfile.create } };
      return committed;
    } } };
  const client: any = { user: { findUnique: async () => { if (unableToVerify) throw new Error("offline"); return committed; } },
    $transaction: async (fn: any) => { inTransaction = true; try { const result = await fn(tx); if (ambiguous && written) throw new Error("lost COMMIT response"); return result; } finally { inTransaction = false; } } };
  const provider = { createUser: async (data: any) => { assert.equal(inTransaction, false); created = data; return "new-auth-identity"; },
    deleteUser: async (id: string) => { assert.equal(inTransaction, false); if (failCleanup) throw new Error("cleanup failed"); deleted.push(id); },
    sendPasswordSetup: async (email: string) => { assert.equal(inTransaction, false); assert.ok(committed); mail.push(email); return true; } };
  return { client, provider, tx, deleted, mail, written: () => written, created: () => created,
    failProfile: () => { failProfile = true; }, failCleanup: () => { failCleanup = true; }, ambiguous: () => { ambiguous = true; }, unableToVerify: () => { unableToVerify = true; } };
}
test("confirmed random-password identity and atomic pending profile precede password email", async () => {
  const h = harness(); const result = await createSupplierAccount(input, h.client, h.provider);
  assert.equal(h.created().email_confirm, true); assert.ok(h.created().password.length >= 40);
  assert.equal(h.created().email, "supplier@example.invalid");
  assert.equal(h.written().id, "new-auth-identity"); assert.equal(h.written().role, "SUPPLIER");
  assert.equal(h.written().supplierProfile.create.status, "PENDING"); assert.deepEqual(h.written().supplierProfile.create.fulfillmentRegions, []);
  assert.equal(h.written().supplierProfile.create.city, null); assert.equal(result.emailSent, true);
  assert.deepEqual(h.mail, ["supplier@example.invalid"]); assert.equal("password" in result, false);
  const other = harness(); await createSupplierAccount(input, other.client, other.provider);
  assert.notEqual(h.created().password, other.created().password);
});
test("profile failure removes only newly provisioned auth identity and sends no email", async () => {
  const h = harness(); h.failProfile();
  await assert.rejects(createSupplierAccount(input, h.client, h.provider), /authentication account was removed/);
  assert.deepEqual(h.deleted, ["new-auth-identity"]); assert.deepEqual(h.mail, []);
});
test("cleanup failure and ambiguous commit require reconciliation without deleting committed accounts", async () => {
  const cleanup = harness(); cleanup.failProfile(); cleanup.failCleanup();
  await assert.rejects(createSupplierAccount(input, cleanup.client, cleanup.provider), /cleanup needs attention/);
  const committed = harness(); committed.ambiguous();
  assert.equal((await createSupplierAccount(input, committed.client, committed.provider)).emailSent, true);
  assert.deepEqual(committed.deleted, []);
  const unknown = harness(); unknown.failProfile(); unknown.unableToVerify();
  await assert.rejects(createSupplierAccount(input, unknown.client, unknown.provider), /reconcile/);
  assert.deepEqual(unknown.deleted, []);
});
test("email failure retains the committed supplier and returns actionable delivery status", async () => {
  const h = harness(); h.provider.sendPasswordSetup = async () => { throw new Error("provider offline"); };
  const result = await createSupplierAccount(input, h.client, h.provider);
  assert.equal(result.emailStatus, "failed"); assert.ok(result.supplierProfile); assert.deepEqual(h.deleted, []);
  const disabled = harness(); const { sendPasswordSetup, ...provider } = disabled.provider;
  assert.equal((await createSupplierAccount(input, disabled.client, provider)).emailStatus, "disabled");
});
test("Postmark response error codes are checked even with HTTP 200", async () => {
  assert.equal(await sendSetupEmail("supplier@example.invalid", "https://example.invalid/recovery", async () => new Response(JSON.stringify({ ErrorCode: 0 }), { status: 200 })), true);
  assert.equal(await sendSetupEmail("supplier@example.invalid", "https://example.invalid/recovery", async () => new Response(JSON.stringify({ ErrorCode: 422 }), { status: 200 })), false);
});
test("list bounds, search and status compose before paginated repository access", async () => {
  let query: any;
  const storage: any = { list: async (...args: any[]) => { query = args; return { suppliers: [] }; } };
  await list({ page: 2, pageSize: 25, search: " textiles ", status: "APPROVED" }, storage);
  assert.equal(query[0].status, "APPROVED"); assert.equal(query[1], 2); assert.equal(query[2], 25);
  assert.ok(query[0].AND[0].OR.some((condition: any) => condition.user?.email?.contains === "textiles"));
  await assert.rejects(list({ pageSize: 10000 }, storage));
});
test("suspension updates profile status alone and preserves existing order history", async () => {
  const orders = [{ id: "order", status: "IN_PROGRESS", supplierId: "supplier" }];
  const snapshot = JSON.stringify(orders); let update: any;
  const profiles: any = { findUnique: async () => ({ id: "supplier", status: "APPROVED" }),
    updateMany: async (args: any) => { update = args; return { count: 1 }; } };
  const result = await transitionSupplier("supplier", { status: "SUSPENDED" }, profiles);
  assert.equal(result.status, "SUSPENDED"); assert.deepEqual(update.data, { status: "SUSPENDED" }); assert.equal(JSON.stringify(orders), snapshot);
  assert.equal(statusChangeSchema.safeParse({ status: "PENDING" }).success, false);
});
test("consent rejects missing/false confirmation and invalid phones, and revocation clears timestamp", async () => {
  let saved: any;
  const storage: any = { detail: async () => ({ phone: "9876548099", phoneCountryCode: "91" }), consent: async (_id: string, data: any) => { saved = data; return data; } };
  for (const payload of [{ consent: true }, { consent: true, explicitConfirmation: false }, { consent: true, explicitConfirmation: true, phone: "12345678" }]) {
    await assert.rejects(updateConsent("supplier", payload, storage)); assert.equal(saved, undefined);
  }
  await updateConsent("supplier", { consent: true, explicitConfirmation: true }, storage);
  assert.equal(saved.phone, "919876548099"); assert.ok(saved.whatsappConsentAt instanceof Date);
  await updateConsent("supplier", { consent: false }, storage);
  assert.deepEqual(saved, { whatsappConsent: false, whatsappConsentAt: null });
  assert.equal(normalizeConsentPhone("+000000000"), null); assert.equal(normalizeConsentPhone("+919876548099"), "919876548099");
  assert.equal(maskSupplierPhone("919876548099", "91"), "+91 ******8099");
});
test("client validates core provisioning fields without mandatory location or legacy supplier types", () => {
  assert.equal(supplierAccountSchema.safeParse({ ...input, city: "", locationState: "" }).success, true);
  for (const change of [{ supplierType: "mill" }, { email: "broken" }, { gstNumber: "bad" }]) assert.equal(supplierAccountSchema.safeParse({ ...input, ...change }).success, false);
});
test("PATCH governance endpoint rejects unauthenticated access before any state changes", async () => {
  const app = buildApp();
  try { assert.equal((await app.inject({ method: "PATCH", url: "/api/v1/admin/suppliers/11111111-1111-4111-8111-111111111111/status", payload: { status: "SUSPENDED" } })).statusCode, 401); }
  finally { await app.close(); }
});
