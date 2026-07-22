import { defineConfig, devices } from "@playwright/test";

/**
 * AforAudience E2E config.
 *
 * Defaults to running against the live QA branch deployment (the same
 * environment Hitesh live-tests against), not a locally-spun-up dev server —
 * this repo's dev server needs a live Supabase connection + env vars that
 * aren't available in every environment, so pointing at the real QA
 * deployment is the most reliable default.
 *
 * Override with PLAYWRIGHT_BASE_URL to run against localhost or a PR preview:
 *   PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test
 *   PLAYWRIGHT_BASE_URL=https://<preview-url>.vercel.app npx playwright test
 */
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ??
  "https://aforaudience-git-qa-hitesh-shyamchand-bangade-s-projects.vercel.app";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // QA is a single shared environment/DB — avoid racing bookings against each other
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 60_000, // generous: first request of a run can hit a cold Vercel function + Supabase pool wake-up
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      // Hitesh tests mobile-first / mobile-only for extended periods —
      // this project mirrors that, since several fixed layout bugs
      // (SeatPicker, sticky nudge banners) have only shown up at narrow widths.
      use: { ...devices["Pixel 7"] },
    },
  ],
});
