import { test, expect, type Page } from "@playwright/test";
import { seedAdminSession } from "./admin-session";

const matchId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";
async function setup(page: Page) {
  await seedAdminSession(page);
  let reads = 0;
  const writes: Array<{ path: string; body: any }> = [];
  const request = { id: "rfq-id", rfqNumber: "RFQ-TEST-0001", fabricName: "Cotton Poplin", quantity: 1200, deliveryPincode: "400020", requesterRole: "BUYER", buyer: { fullName: "Test Buyer", email: "buyer@example.invalid" } };
  let matches = [matchId, secondId].map((id, index) => ({ id, sourceType: "supplier_catalog", score: 100 - index, createdAt: "2026-10-23T00:00:00Z", communicationRequest: request,
    supplier: { companyName: `Test Mill ${index + 1}`, status: "APPROVED", user: { email: `mill${index + 1}@example.invalid` } } }));
  await page.route("http://127.0.0.1:4184/**", route => route.fulfill({ json: {} }));
  await page.route("http://127.0.0.1:4183/**", route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    const send = (json: object) => route.fulfill({ json: { success: true, ...json } });
    if (path.endsWith("/auth/me")) return send({ user: { id: "synthetic-admin", role: "ADMIN" } });
    if (path === "/api/v1/admin/rfq-match-approvals" && req.method() === "GET") {
      reads++; return send({ matches, totalCount: matches.length, totalPages: 1 });
    }
    if (path.includes("/rfq-match-approvals/") && req.method() === "POST") {
      const body = req.postDataJSON(); writes.push({ path, body });
      const ids = path.endsWith("/bulk") ? body.ids : [path.split("/").at(-2)];
      matches = matches.filter(row => !ids.includes(row.id));
      return send({ changedCount: ids.length, requestedCount: ids.length, notification: { message: "Decision saved. External delivery is not enabled." } });
    }
    return send({ rfqs: [], totalCount: 0, totalPages: 1 });
  });
  return { writes, reads: () => reads };
}

test("old-style queue forwards only the selected supplier match with its review note", async ({ page }) => {
  const api = await setup(page);
  await page.setViewportSize({ width: 1600, height: 950 });
  await page.goto("/admin/rfq-approvals?queue=matches");
  await expect(page.getByRole("tab", { name: "Supplier match approvals" })).toHaveAttribute("aria-selected", "true");
  const row = page.getByRole("row").filter({ hasText: "Test Mill 1" });
  await expect(row).toContainText("buyer@example.invalid");
  await expect(row).toContainText("supplier_catalog");
  await page.screenshot({ path: "docs/screenshots/rfq-match-approval.png", fullPage: true });
  await row.getByRole("textbox").fill("Forward this mill only");
  await row.getByRole("button", { name: "Forward to Supplier" }).click();
  await expect(page.getByRole("status").filter({hasText: "supplier matches"})).toContainText("1 of 1 supplier matches forwarded");
  await expect(page.getByRole("row").filter({ hasText: "Test Mill 2" })).toBeVisible();
  expect(api.writes).toEqual([{ path: `/api/v1/admin/rfq-match-approvals/${matchId}/forward`, body: { note: "Forward this mill only" } }]);
  await expect.poll(api.reads).toBe(2);
});

test("bulk notes use match IDs and workflow tab revisits reuse cached data", async ({ page }) => {
  const api = await setup(page);
  await page.goto("/admin/rfq-approvals?queue=matches");
  await expect(page.getByRole("row").filter({ hasText: "Test Mill 1" })).toBeVisible();
  await page.getByRole("tab", { name: "Supplier match approvals" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Buyer RFQ review" })).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("row").filter({ hasText: "Test Mill 1" })).toBeVisible();
  expect(api.reads()).toBe(1);
  await page.getByLabel("Bulk Review Note (Optional)").fill("Review completed");
  await page.getByLabel("Select all RFQ matches").check();
  await page.getByRole("button", { name: "Reject Selected (2)", exact: true }).click();
  await expect(page.getByRole("status").filter({hasText: "supplier matches"})).toContainText("2 of 2 supplier matches rejected");
  expect(api.writes[0]).toEqual({ path: "/api/v1/admin/rfq-match-approvals/bulk", body: { ids: [matchId, secondId], decision: "reject", note: "Review completed" } });
  await expect(page.getByText("No RFQ matches pending admin forward.")).toBeVisible();
});

test("mobile supplier queue keeps table overflow inside its scroll container", async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/rfq-approvals?queue=matches");
  await expect(page.getByRole("heading", { name: "RFQ Approval Queue" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Test Mill 1" })).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "docs/screenshots/rfq-match-approval-mobile.png", fullPage: true });
});
