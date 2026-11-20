import type { Page } from "@playwright/test";
export async function seedAdminSession(page: Page) {
  await page.addInitScript(() => {
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "synthetic-admin", exp: expires, role: "authenticated" })}.synthetic`;
    localStorage.setItem("sb-127-auth-token", JSON.stringify({ access_token: token, refresh_token: "synthetic-refresh", expires_at: expires, expires_in: 3600, token_type: "bearer", user: { id: "synthetic-admin", email: "admin@example.invalid", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } }));
  });
}
