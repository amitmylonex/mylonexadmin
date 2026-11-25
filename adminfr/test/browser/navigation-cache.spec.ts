import { test, expect, type Page } from "@playwright/test";
import { seedAdminSession } from "./admin-session";

const supplierId = "11111111-1111-4111-8111-111111111111";
async function setup(page: Page) {
  await seedAdminSession(page);
  const counts = new Map<string, number>();
  let holdBuyers: Promise<void> | undefined;
  let release = () => {};
  const supplier = { id: supplierId, companyName: "Cache Test Mill", status: "APPROVED", city: "Surat", fulfillmentRegions: [],
    user: { email: "mill@example.invalid", fullName: "Test", createdAt: "2026-11-01" },
    _count: { supplierCatalogEntries: 0, fabricCollections: 0, wovenProducts: 0, capabilities: 0, communicationRequestMatches: 0 } };
  await page.route("http://127.0.0.1:4184/**", route => route.fulfill({ json: {} }));
  await page.route("http://127.0.0.1:4183/**", async route => {
    const url = new URL(route.request().url());
    counts.set(url.pathname, (counts.get(url.pathname) || 0) + 1);
    if (url.pathname.endsWith("/buyers") && holdBuyers) await holdBuyers;
    let body: object = {};
    if (url.pathname.endsWith("/auth/me")) body = { user: { id: "synthetic-admin", role: "ADMIN" } };
    else if (url.pathname.endsWith("/buyers")) body = { buyers: [{ id: "buyer", fullName: "Cached Buyer", email: "buyer@example.invalid" }], totalCount: 1, totalPages: 1 };
    else if (url.pathname.endsWith(`/suppliers/${supplierId}`)) body = { supplier };
    else if (url.pathname.endsWith("/catalog")) body = { fabricCollections: [], catalogEntries: [], wovenProducts: [], capabilities: [], totalPages: 1 };
    else if (url.pathname.endsWith("/suppliers")) body = { suppliers: [supplier], totalCount: 1, totalPages: 1 };
    await route.fulfill({ json: { success: true, ...body } });
  });
  return { count: (suffix: string) => counts.get("/api/v1/admin/" + suffix) || 0,
    hold: () => { holdBuyers = new Promise<void>(resolve => { release = resolve; }); }, release: () => { release(); holdBuyers = undefined; } };
}
const sidebar = (page: Page) => page.locator("#admin-sidebar");
async function navigate(page: Page, name: string) { await sidebar(page).getByRole("link", { name, exact: false }).click(); }

test("fresh sidebar revisits preserve records and filters without document reloads or extra API hits", async ({ page }) => {
  const api = await setup(page);
  let documents = 0;
  page.on("request", request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++; });
  await page.goto("/admin/buyers");
  await expect(page.getByRole("link", { name: "Cached Buyer", exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search buyers" }).fill("Cached");
  await expect.poll(() => api.count("buyers")).toBe(2);
  await expect(page.getByRole("link", { name: "Cached Buyer", exact: true })).toBeVisible();
  await navigate(page, "Suppliers");
  await expect(page.getByRole("heading", { name: "Manage Suppliers" })).toBeVisible();
  await navigate(page, "Buyers");
  await expect(page.getByRole("searchbox", { name: "Search buyers" })).toHaveValue("Cached");
  await expect(page.getByRole("link", { name: "Cached Buyer", exact: true })).toBeVisible();
  expect(api.count("buyers")).toBe(2);
  expect(api.count("auth/me")).toBe(1);
  expect(documents).toBe(1);
  const historyLength = await page.evaluate(() => history.length);
  await navigate(page, "Buyers");
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect.poll(() => api.count("buyers")).toBe(3);
});

test("stale revisit refreshes once in the background while retaining the table", async ({ page }) => {
  const api = await setup(page);
  await page.clock.install();
  await page.goto("/admin/buyers");
  await expect(page.getByRole("link", { name: "Cached Buyer", exact: true })).toBeVisible();
  await navigate(page, "Dashboard");
  await expect(page.getByRole("heading", { name: "Platform Metrics" })).toBeVisible();
  await page.clock.fastForward(61_000);
  api.hold();
  await navigate(page, "Buyers");
  await expect.poll(() => api.count("buyers")).toBe(2);
  await expect(page.getByRole("link", { name: "Cached Buyer", exact: true })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Updating records" })).toBeVisible();
  api.release();
  await expect(page.getByRole("status").filter({ hasText: "Updating records" })).toHaveCount(0);
});

test("same-user auth events and browser focus preserve loaded data", async ({ page }) => {
  const api = await setup(page);
  await page.goto("/admin/buyers");
  await expect(page.getByRole("link", { name: "Cached Buyer", exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const session = JSON.parse(localStorage.getItem("sb-127-auth-token")!);
    const channel = new BroadcastChannel("sb-127-auth-token");
    channel.postMessage({ event: "TOKEN_REFRESHED", session: { ...session, access_token: session.access_token + "rotated" } });
    channel.postMessage({ event: "SIGNED_IN", session });
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    await new Promise(resolve => setTimeout(resolve, 100));
    channel.close();
  });
  await navigate(page, "Dashboard");
  await navigate(page, "Buyers");
  await expect(page.getByRole("link", { name: "Cached Buyer", exact: true })).toBeVisible();
  expect(api.count("buyers")).toBe(1);
  expect(api.count("auth/me")).toBe(1);
});

test("supplier overview and catalog reuse independent cached requests", async ({ page }) => {
  const api = await setup(page);
  await page.goto(`/admin/suppliers/${supplierId}`);
  await expect(page.getByRole("heading", { name: "Cache Test Mill", exact: true })).toBeVisible();
  expect(api.count(`suppliers/${supplierId}/catalog`)).toBe(0);
  await page.getByRole("button", { name: /Manage Catalog/ }).first().click();
  await expect(page.getByRole("heading", { name: "Catalog Control: Cache Test Mill" })).toBeVisible();
  await expect.poll(() => api.count(`suppliers/${supplierId}/catalog`)).toBe(1);
  await page.getByRole("button", { name: /Overview/ }).first().click();
  await page.getByRole("button", { name: /Manage Catalog/ }).first().click();
  await expect(page.getByRole("heading", { name: "Catalog Control: Cache Test Mill" })).toBeVisible();
  expect(api.count(`suppliers/${supplierId}`)).toBe(1);
  expect(api.count(`suppliers/${supplierId}/catalog`)).toBe(1);
});

test("failed background refresh keeps the last table and offers Retry", async ({ page }) => {
  await setup(page);
  await page.goto("/admin/buyers");
  await expect(page.getByRole("link", { name: "Cached Buyer", exact: true })).toBeVisible();
  await page.route("http://127.0.0.1:4183/api/v1/admin/buyers?*", route => route.fulfill({ status: 503, json: { success: false, error: { message: "Temporarily unavailable" } } }));
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  const feedback = page.getByRole("alert").filter({ hasText: "Showing the last loaded data" });
  await expect(feedback).toBeVisible();
  await expect(feedback.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cached Buyer", exact: true })).toBeVisible();
});

test("switching account clears the previous account cache and verifies access again", async ({ page }) => {
  const api = await setup(page);
  await page.goto("/admin/buyers");
  await expect(page.getByRole("link", { name: "Cached Buyer", exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const session = JSON.parse(localStorage.getItem("sb-127-auth-token")!);
    const channel = new BroadcastChannel("sb-127-auth-token");
    channel.postMessage({ event: "SIGNED_IN", session: { ...session, user: { ...session.user, id: "second-admin" } } });
    await new Promise(resolve => setTimeout(resolve, 100)); channel.close();
  });
  await expect.poll(() => api.count("auth/me")).toBe(2);
  await expect.poll(() => api.count("buyers")).toBe(2);
});
