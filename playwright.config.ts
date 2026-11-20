import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./test/browser",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:5183", browserName: "chromium", headless: true },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5183 --strictPort",
    url: "http://127.0.0.1:5183", reuseExistingServer: false,
    env: { VITE_API_URL: "http://127.0.0.1:4183", VITE_SUPABASE_URL: "http://127.0.0.1:4184", VITE_SUPABASE_PUBLISHABLE_KEY: "synthetic-public-test-key" },
  },
});
