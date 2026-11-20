import { test, expect, type Page } from "@playwright/test";
import { seedAdminSession } from "./admin-session";
const id = "11111111-1111-4111-8111-111111111111";
async function buyerApi(page: Page, empty = false) {
  await seedAdminSession(page);
  const calls: string[] = [];
  const buyers = Array.from({ length: 26 }, (_, i) => ({ id: i === 0 ? id : `22222222-2222-4222-8222-${String(i).padStart(12, "0")}`,
    fullName: i === 0 ? "Test Buyer" : `Buyer ${String(i).padStart(2, "0")}`, email: `buyer${i}@example.invalid`, company: i === 0 ? "Test Sourcing Company" : "Other Company",
    phone: "9876548099", city: i === 0 ? "Surat" : "Mumbai", gstNumber: "24AAACA1234A1Z5", totalRfqs: i, totalInquiries: 2,
    createdAt: `2026-11-${String(i + 1).padStart(2, "0")}T09:00:00Z` }));
  const profile = { id, fullName: "Test Buyer", email: "buyer0@example.invalid", createdAt: "2026-11-01T09:00:00Z",
    buyerProfile: empty ? null : { id: "profile", company: "Test Sourcing Company", phone: "9876548099", city: "Surat", gstNumber: "24AAACA1234A1Z5", billingAddress: "Test billing office, Surat" },
    billingAddress: empty ? null : "Test billing office, Surat", verification: { emailVerified: empty ? null : true, emailVerifiedAt: empty ? null : "2026-11-01T09:00:00Z", gstVerified: null },
    _count: { inquiries: 0, communicationRequests: empty ? 0 : 2, samples: empty ? 0 : 1, orders: empty ? 0 : 3 } };
  const activity: Record<string, any[]> = {
    rfqs: [{ id: "rfq", rfqNumber: "RFQ-001", fabricName: "Production Cotton", quantity: 1000, status: "open", createdAt: "2026-11-10T09:00:00Z" }],
    samples: [{ id: "sample", sampleNumber: "SMP-001", fabricName: "Sample Cotton", sampleType: "cut_length", status: "requested", createdAt: "2026-11-11T09:00:00Z" }],
    orders: [{ id: "order", orderNumber: "ORD-001", orderType: "production", status: "PRODUCTION", totalValueEstimate: "301.65", createdAt: "2026-11-12T09:00:00Z" },
      { id: "sample-order", orderNumber: "ORD-002", orderType: "sampling", status: "PENDING_PAYMENT", totalValueEstimate: "11.35", createdAt: "2026-11-13T09:00:00Z" },
      { id: "unknown", orderNumber: "ORD-003", orderType: "production", status: "PENDING_PAYMENT", totalValueEstimate: null, createdAt: "2026-11-14T09:00:00Z" }],
  };
  await page.route("http://127.0.0.1:4184/**", route => route.fulfill({ json: {} }));
  await page.route("http://127.0.0.1:4183/**", route => {
    const url = new URL(route.request().url()); calls.push(url.pathname + url.search);
    const send = (body: any, status = 200) => route.fulfill({ status, json: { success: status < 400, ...body }, headers: { "access-control-allow-origin": "*" } });
    if (url.pathname.endsWith("/auth/me")) return send({ user: { id: "admin", role: "ADMIN", email: "admin@example.invalid" } });
    if (url.pathname === "/api/v1/admin/buyers") {
      const term = (url.searchParams.get("search") || "").toLowerCase(), from = url.searchParams.get("from"), to = url.searchParams.get("to"), sort = url.searchParams.get("sort");
      const matches = (empty ? [] : buyers).filter(b => `${b.fullName} ${b.email} ${b.company} ${b.city}`.toLowerCase().includes(term) && (!from || b.createdAt.slice(0, 10) >= from) && (!to || b.createdAt.slice(0, 10) <= to));
      matches.sort((a, b) => sort === "name-asc" ? a.fullName.localeCompare(b.fullName) : sort === "name-desc" ? b.fullName.localeCompare(a.fullName) : sort === "oldest" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt));
      const page = Number(url.searchParams.get("page") || 1), size = Number(url.searchParams.get("pageSize") || 25);
      return send({ buyers: matches.slice((page - 1) * size, page * size), totalCount: matches.length, totalPages: Math.max(1, Math.ceil(matches.length / size)) });
    }
    if (url.pathname.startsWith("/api/v1/admin/buyers/")) {
      if (url.pathname !== `/api/v1/admin/buyers/${id}`) return send({ error: { code: "NOT_FOUND", message: "Buyer not found", details: null } }, 404);
      const tab = url.searchParams.get("tab") || "rfqs";
      const rows = empty ? [] : activity[tab] || [];
      return send({ tab, buyer: profile, activity: rows, totalCount: rows.length, totalPages: 1,
        orderSummary: { totalCount: empty ? 0 : 3, productionCount: empty ? 0 : 2, sampleCount: empty ? 0 : 1,
          valuedOrderCount: empty ? 0 : 2, unknownValueCount: empty ? 0 : 1, totalValueEstimateInr: empty ? "0.00" : "313.00", currency: "INR", basis: "Actual orders only; estimates are not payment receipts." } });
    }
    return send({});
  });
  return calls;
}
test("buyer directory paginates, searches, sorts and applies joined-date filters", async ({ page }) => {
  const calls = await buyerApi(page); await page.goto("/admin/buyers");
  await expect(page.getByText("26 records · Page 1 of 2")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "GST Number", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("26 records · Page 2 of 2")).toBeVisible();
  await page.getByRole("searchbox", { name: "Search buyers" }).fill("Surat");
  await expect(page.getByRole("link", { name: "Test Buyer", exact: true })).toBeVisible();
  await expect(page.getByText("1 records · Page 1 of 1")).toBeVisible();
  await page.getByRole("searchbox", { name: "Search buyers" }).fill("");
  await page.getByRole("combobox", { name: "Sort", exact: true }).selectOption("name-asc");
  await expect(page.getByText("26 records · Page 1 of 2")).toBeVisible();
  await page.getByLabel("Joined from", { exact: true }).fill("2026-11-05");
  await page.getByLabel("Joined through", { exact: true }).fill("2026-11-10");
  await expect(page.getByText("6 records · Page 1 of 1")).toBeVisible();
  expect(calls.some(value => value.includes("sort=name-asc") && value.includes("from=2026-11-05") && value.includes("to=2026-11-10"))).toBe(true);
  await page.screenshot({ path: "../docs/phase4-buyer-directory.png", fullPage: true, animations: "disabled" });
  await page.getByLabel("Joined through", { exact: true }).fill("2026-11-01");
  await expect(page.getByRole("alert")).toContainText("End date must follow start date");
});
test("buyer profile shows authoritative badges, billing details and all three activity tabs", async ({ page }) => {
  await buyerApi(page); await page.goto("/admin/buyers");
  await page.getByRole("searchbox", { name: "Search buyers" }).fill("Test Buyer");
  await expect(page.getByRole("link", { name: "View Profile", exact: true })).toHaveCount(1);
  await page.getByRole("link", { name: "View Profile", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/buyers/${id}$`));
  const overview = page.getByRole("region", { name: "Buyer overview" });
  await expect(overview.getByText("Email verified", { exact: true })).toBeVisible();
  await expect(overview.getByText("GST recorded", { exact: true })).toBeVisible();
  await expect(overview.getByText("Test billing office, Surat", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "RFQ-001", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Production RFQs", exact: true }).focus(); await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Sample Requests", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("cell", { name: "SMP-001", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "cut length", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Orders", exact: true }).click();
  await expect(page.getByRole("cell", { name: "ORD-001", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Not available", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Buyer order summary" })).toContainText("1 order has no value estimate");
  await page.screenshot({ path: "../docs/phase4-buyer-profile.png", fullPage: true, animations: "disabled" });
});
test("buyer without a business profile has honest badges and graceful RFQ/sample/order empty states", async ({ page }) => {
  await buyerApi(page, true); await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/admin/buyers/${id}`);
  await expect(page.getByText("Email verification not recorded", { exact: true })).toBeVisible();
  await expect(page.getByText("Email verified", { exact: true })).toHaveCount(0);
  await expect(page.getByText("No production RFQs submitted yet.", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Sample Requests", exact: true }).click();
  await expect(page.getByText("No sample requests submitted yet.", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Orders", exact: true }).click();
  await expect(page.getByText("No orders recorded yet.", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("empty directory and missing buyer profile offer clear feedback", async ({ page }) => {
  await buyerApi(page, true); await page.goto("/admin/buyers");
  await expect(page.getByText("No buyers found. Try another search or date range.", { exact: true })).toBeVisible();
  await page.goto("/admin/buyers/33333333-3333-4333-8333-333333333333");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Buyer not found");
  await expect(page.getByRole("button", { name: "← Back to buyers", exact: true })).toBeVisible();
});
