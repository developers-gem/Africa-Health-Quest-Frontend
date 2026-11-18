import { defineConfig, devices } from "@playwright/test";
import { BACKEND_ENV } from "./e2e/support";

/**
 * End-to-end tests run the real backend (needs MongoDB: `npm run db:up`) and the Vite dev server.
 * Each run uses a fresh database, the file mail transport (to read emailed links) and the deterministic
 * fake AI provider — never the real Anthropic API.
 * Set PLAYWRIGHT_CHROMIUM_EXECUTABLE to use a pre-installed Chromium instead of `npx playwright install`.
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const launch = executablePath ? { launchOptions: { executablePath } } : {};

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://localhost:5173", trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 }, ...launch },
    },
    {
      name: "tablet-chromium",
      use: { ...devices["iPad Mini"], defaultBrowserType: "chromium", ...launch },
      testMatch: /responsive/,
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"], ...launch },
      testMatch: /responsive|connection/,
    },
  ],
  webServer: [
    {
      command: "npm run dev -w @ahq/backend",
      cwd: "../..",
      url: "http://localhost:4000/ready",
      reuseExistingServer: false,
      timeout: 90_000,
      env: BACKEND_ENV,
    },
    {
      command: "npm run dev",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { VITE_API_BASE_URL: "http://localhost:4000" },
    },
  ],
});
