import { test, expect, type Page } from "@playwright/test";
import { seedAdminSession } from "./admin-session";
const supplierId = "11111111-1111-4111-8111-111111111111";
async function suppliersApi(page: Page) {
  await seedAdminSession(page);
  const supplier = { id: supplierId, companyName: "Test Textiles", city: "Surat", address: "Test warehouse street", phone: "919876548099", phoneCountryCode: "91",
    supplierType: "manufacturer", gstNumber: "24AAACA1234A1Z5", dispatchLocation: "Surat Dispatch", warehouseLocation: "Surat Warehouse", fulfillmentRegions: [],
    status: "APPROVED", whatsappConsent: false, whatsappConsentAt: null as string | null, createdAt: "2026-11-01T00:00:00Z",
    user: { id: "synthetic-supplier", email: "supplier@example.invalid", fullName: "Test Contact", createdAt: "2026-11-01T00:00:00Z" },
    _count: { supplierCatalogEntries: 7, fabricCollections: 1, wovenProducts: 0, communicationRequestMatches: 2, capabilities: 0 } };
  const records = [supplier, ...Array.from({ length: 15 }, (_, i) => ({ ...supplier, id: `22222222-2222-4222-8222-${String(i).padStart(12, "0")}`, companyName: `Other Supplier ${i}`, status: i % 2 ? "PENDING" : "SUSPENDED" }))];
  const posts: Array<{ path: string; method: string; body: any }> = [];
  const orders = [{ id: "existing-order", supplierId, status: "IN_PROGRESS" }];
  await page.route("http://127.0.0.1:4184/**", route => route.fulfill({ json: {} }));
  await page.route("http://127.0.0.1:4183/**", route => {
    const request = route.request(), url = new URL(request.url());
    const body = request.method() === "GET" ? undefined : request.postDataJSON();
    const send = (json: object, status = 200) => route.fulfill({ status, headers: { "access-control-allow-origin": "*" }, json: { success: status < 400, ...json } });
    if (url.pathname.endsWith("/auth/me")) return send({ user: { id: "synthetic-admin", role: "ADMIN", email: "admin@example.invalid" } });
    if (request.method() !== "GET") posts.push({ path: url.pathname, method: request.method(), body });
    if (url.pathname === "/api/v1/admin/suppliers" && request.method() === "POST") {
      return send({ supplier: { id: "new-supplier", status: "PENDING" }, emailStatus: "sent", message: "Supplier account created. Password setup email sent. Approval is pending." }, 201);
    }
    if (url.pathname.endsWith("/whatsapp-consent")) {
      if (body.consent && !body.explicitConfirmation) return send({ error: { code: "BAD_REQUEST", message: "Explicit confirmation required", details: null } }, 400);
      supplier.whatsappConsent = body.consent; supplier.whatsappConsentAt = body.consent ? "2026-11-19T10:00:00Z" : null;
      if (body.phone) supplier.phone = body.phone.replace(/\D/g, "");
      return send({ supplier });
    }
    if (url.pathname.endsWith("/status")) { supplier.status = body.nextStatus || body.status; return send({ supplier }); }
    if (url.pathname.endsWith("/catalog")) return send({ supplier, fabricCollections: [], catalogEntries: [], wovenProducts: [], capabilities: [], totalPages: 1 });
    if (url.pathname === `/api/v1/admin/suppliers/${supplierId}`) return send({ supplier });
    if (url.pathname === "/api/v1/admin/suppliers") {
      const status = url.searchParams.get("status"), term = (url.searchParams.get("search") || "").toLowerCase();
      const matches = records.filter(s => (!status || status === "ALL" || s.status === status) && `${s.companyName} ${s.city} ${s.user.email}`.toLowerCase().includes(term));
      const size = Number(url.searchParams.get("pageSize") || 15), index = Number(url.searchParams.get("page") || 1);
      return send({ suppliers: matches.slice((index - 1) * size, index * size), totalCount: matches.length, totalPages: Math.max(1, Math.ceil(matches.length / size)) });
    }
    return send({ items: [], totalPages: 1 });
  });
  return { supplier, posts, orders };
}
test("supplier list supports pagination, filters, search and catalog deep links", async ({ page }) => {
  await suppliersApi(page); await page.goto("/admin/suppliers");
  await expect(page.getByRole("link", { name: "Test Textiles", exact: true })).toBeVisible();
  await expect(page.getByText("16 suppliers · Page 1 of 2")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("16 suppliers · Page 2 of 2")).toBeVisible();
  await page.getByRole("searchbox", { name: "Search suppliers" }).fill("Test Textiles");
  await expect(page.getByRole("link", { name: "Test Textiles", exact: true })).toBeVisible();
  await expect(page.getByText("1 suppliers · Page 1 of 1")).toBeVisible();
  await page.getByRole("button", { name: "Approved", exact: true }).click();
  await expect(page.getByRole("button", { name: "Approved", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: "Manage Catalog", exact: true })).toHaveAttribute("href", `/admin/suppliers/${supplierId}/catalog`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "docs/screenshots/phase2-suppliers.png", fullPage: true, animations: "disabled" });
  await page.getByRole("link", { name: "Manage Catalog", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/suppliers/${supplierId}/catalog$`));
  await expect(page.getByRole("heading", { name: "Catalog Control: Test Textiles" })).toBeVisible();
});
test("suspend from actions dropdown updates status and preserves order fixture", async ({ page }) => {
  const { posts, orders } = await suppliersApi(page); const before = JSON.stringify(orders);
  await page.goto("/admin/suppliers");
  await page.getByRole("combobox", { name: "Actions for Test Textiles" }).selectOption("status");
  const dialog = page.getByRole("dialog", { name: "Update Supplier Status" });
  await dialog.getByRole("textbox", { name: "Audit reason" }).fill("Supplier requested a temporary suspension");
  await dialog.getByRole("button", { name: "Confirm Transition" }).click();
  const row = page.getByRole("row").filter({ has: page.getByRole("link", { name: "Test Textiles", exact: true }) });
  await expect(row.getByText("Suspended", { exact: true })).toBeVisible();
  expect(posts.find(p => p.path.endsWith("/status"))?.method).toBe("PATCH"); expect(JSON.stringify(orders)).toBe(before);
});
test("create form blocks invalid input and submits only the confirmed supplier fields", async ({ page }) => {
  const { posts } = await suppliersApi(page); await page.goto("/admin/suppliers");
  await page.getByRole("button", { name: /Create Supplier Account.*Onboard/i }).click();
  const form = page.locator("#supplier-create-form");
  await form.getByRole("button", { name: "Create supplier account", exact: true }).click();
  await expect(form.getByRole("status")).toContainText("fullName"); expect(posts).toHaveLength(0);
  await form.getByLabel("Full Name", { exact: false }).fill("New Supplier Contact");
  await form.getByLabel("Company Name", { exact: false }).fill("New Textile Company");
  await form.getByLabel("Company Email Address", { exact: false }).fill("NEW@example.invalid");
  await form.getByLabel("Phone Number", { exact: false }).fill("9876548099");
  await form.getByRole("button", { name: "Create supplier account", exact: true }).click();
  await expect(form.getByRole("status")).toContainText("Password setup email sent");
  const created = posts.find(p => p.path.endsWith("/suppliers"))!;
  expect(created.body.email).toBe("new@example.invalid"); expect(created.body.supplierType).toBe("manufacturer");
  expect(created.body.city).toBeUndefined(); expect(created.body.password).toBeUndefined();
});
test("detail masks phone, requires explicit consent, edits phone and confirms revocation", async ({ page }) => {
  const { posts } = await suppliersApi(page); await page.goto(`/admin/suppliers/${supplierId}`);
  await expect(page.getByText("Test warehouse street", { exact: true })).toBeVisible();
  const card = page.getByRole("region", { name: "Supplier WhatsApp consent" });
  await expect(card.getByText("+91 ******8099", { exact: true })).toBeVisible();
  const record = card.getByRole("button", { name: "Record WhatsApp Consent" });
  await expect(record).toBeDisabled(); expect(posts).toHaveLength(0);
  await card.getByRole("checkbox", { name: /Explicit Consent Confirmation/ }).check();
  await record.click(); await expect(card.getByText("Consented", { exact: true })).toBeVisible();
  expect(posts[0].body.explicitConfirmation).toBe(true);
  await card.getByRole("button", { name: "Edit phone" }).click();
  await card.getByRole("textbox", { name: "WhatsApp phone" }).fill("+91 9876547000");
  await expect(card.getByRole("button", { name: "Record WhatsApp Consent" })).toBeDisabled();
  await card.getByRole("checkbox", { name: /Explicit Consent Confirmation/ }).check();
  await card.getByRole("button", { name: "Record WhatsApp Consent" }).click();
  await expect(card.getByText("+91 ******7000", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Revoke WhatsApp Consent", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Revoke WhatsApp consent?" });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click(); expect(posts).toHaveLength(2);
  await card.getByRole("button", { name: "Revoke WhatsApp Consent", exact: true }).click();
  await dialog.getByRole("button", { name: "Revoke Consent", exact: true }).click();
  await expect(card.getByText("Not recorded", { exact: true })).toBeVisible();
  expect(posts[2].body.consent).toBe(false);
});
