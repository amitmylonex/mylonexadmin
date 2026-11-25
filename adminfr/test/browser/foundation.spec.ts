import { test, expect, type Page } from "@playwright/test";
const email = "admin@example.invalid";
async function setup(page: Page, authenticated = true, role = "ADMIN") {
  let expire = false;
  await page.route("http://127.0.0.1:4184/**", route => route.fulfill({ json: {}, headers: { "access-control-allow-origin": "*" } }));
  await page.route("http://127.0.0.1:4183/**", route => {
    const status = expire ? 401 : role === "ADMIN" ? 200 : 403;
    return route.fulfill({ status, headers: { "access-control-allow-origin": "*" }, json: status === 200
      ? { success: true, user: { id: "synthetic-admin", email, role }, buyers: [], suppliers: [], items: [], recentPending: [], totalCount: 0, totalPages: 1 }
      : { success: false, error: { code: status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN", message: status === 401 ? "Expired session" : "Admin privileges required", details: null } } });
  });
  if (authenticated) await page.addInitScript(({ email }) => {
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "synthetic-admin", exp: expires, role: "authenticated" })}.synthetic`;
    localStorage.setItem("sb-127-auth-token", JSON.stringify({ access_token: token, refresh_token: "synthetic-refresh", expires_at: expires, expires_in: 3600, token_type: "bearer", user: { id: "synthetic-admin", email, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } }));
  }, { email });
  return () => { expire = true; };
}

test("unauthenticated admin deep link redirects to login with safe return path", async ({ page }) => {
  await setup(page, false);
  await page.goto("/admin/suppliers/catalog");
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await expect(page.getByRole("heading", { name: "Admin Console Sign In" })).toBeVisible();
  await expect(page.locator("#admin-sidebar")).toHaveCount(0);
});

test("desktop shell matches original sidebar and page heading layout", async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin/buyers");
  const sidebar = page.locator("#admin-sidebar");
  await expect(sidebar).toBeVisible();
  await expect(sidebar.getByText(email, { exact: true })).toBeVisible();
  await expect(sidebar.getByRole("link")).toHaveCount(10);
  await expect(sidebar.getByRole("link", { name: "Buyers" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Buyers", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Admin Management Console" })).toHaveCount(0);
  const paths = ["dashboard", "suppliers", "buyers", "rfq-approvals", "quote-approvals", "rfqs", "rfq-tracking", "suppliers/catalog", "samples", "accepted-orders"];
  expect(await sidebar.getByRole("link").evaluateAll(nodes => nodes.map(node => node.getAttribute("href")))).toEqual(paths.map(path => `/admin/${path}`));
  await page.screenshot({ path: "docs/screenshots/phase1-desktop.png", fullPage: true });
  await sidebar.getByRole("link", { name: "Dashboard" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(sidebar.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
});

test("mobile drawer toggles, traps focus, closes on Escape and navigates", async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/buyers");
  const toggle = page.getByRole("button", { name: "Toggle navigation menu" });
  await expect(toggle).toBeVisible();
  await expect(page.locator("#admin-sidebar")).toHaveAttribute("inert", "");
  await toggle.click(); await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "Close navigation" })).toBeFocused();
  await expect(page.locator("#admin-sidebar")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  await page.screenshot({ path: "docs/screenshots/phase1-mobile.png", fullPage: true });
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("#admin-sidebar").getByRole("button", { name: "Sign out" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false"); await expect(toggle).toBeFocused();
  await toggle.click(); await page.locator("#admin-sidebar").getByRole("link", { name: "Dashboard" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/); await expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("API 401 clears the console, redirects to login and displays a session toast", async ({ page }) => {
  const expire = await setup(page);
  await Promise.all([page.waitForResponse(response => response.url().includes("/api/v1/admin/dashboard")), page.goto("/admin/dashboard")]);
  const sidebar = page.locator("#admin-sidebar");
  await expect(sidebar).toBeVisible();
  expire(); await sidebar.getByRole("link", { name: "Buyers" }).click();
  await expect(page).toHaveURL(/\/login\?/);
  await expect(page.getByText("Your session has expired. Please sign in again.")).toBeVisible();
  await expect(sidebar).toHaveCount(0);
});

test("sign out confirmation clears the shell and returns to login", async ({ page }) => {
  await setup(page);
  await page.goto("/admin/buyers");
  await page.locator("#admin-sidebar").getByRole("button", { name: "Sign out" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login\?/);
  await expect(page.locator("#admin-sidebar")).toHaveCount(0);
});

test("non-admin session never renders the admin shell", async ({ page }) => {
  await setup(page, true, "SUPPLIER");
  await page.goto("/admin/dashboard");
  await expect(page.getByRole("heading", { name: "Admin access required" })).toBeVisible();
  await expect(page.locator("#admin-sidebar")).toHaveCount(0);
});

test('database verification outage shows the cause and Retry verifies access again',async({page})=>{
 await setup(page);
 let unavailable=true;
 await page.route('http://127.0.0.1:4183/api/v1/admin/auth/me',route=>route.fulfill({status:unavailable?503:200,headers:{'access-control-allow-origin':'*'},json:unavailable?{success:false,error:{code:'ADMIN_ROLE_LOOKUP_UNAVAILABLE',message:'The database is temporarily unavailable. Admin access could not be verified. Please retry shortly.'}}:{success:true,user:{id:'synthetic-admin',email,role:'ADMIN'}}}));
 await page.goto('/admin/dashboard');
 await expect(page.getByRole('heading',{name:'Could not verify your session'})).toBeVisible();
 await expect(page.getByRole('main').getByText(/database is temporarily unavailable/)).toBeVisible();
 await expect(page.locator('#admin-sidebar')).toHaveCount(0);
 unavailable=false;
 await page.getByRole('button',{name:'Retry',exact:true}).click();
 await expect(page.locator('#admin-sidebar')).toBeVisible();
});
