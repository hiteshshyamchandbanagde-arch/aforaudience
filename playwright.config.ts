import { defineConfig, devices } from "@playwright/test";
import { hasQaDatabase } from "./e2e/helpers/qa-db";

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

const isCI = !!process.env.CI;

// Specs tagged @needs-db put a fixture back through the QA database
// (e2e/helpers/qa-db.ts). Where there is no database URL they are left out;
// global-setup.ts says so with a warning, so it is never silent.
const needsDb = /@needs-db/;

// Flows that are about data and rules, not layout: three people and a chain
// of saves on one shared fixture. A second pass at phone width would repeat
// the same server logic for minutes and write to the fixture twice.
// design-system-goal edits a site-wide token and sets its own 390 and 1440
// viewports, so a second project pass would only repeat the edit.
// design-system-restore saves and restores the same site-wide token, and
// artist-tour-stop saves Hrithik's profile twice: one pass each.
// goal-token-lock is a database check with no page at all.
const desktopOnly = [
  "**/waitlist-wallet-credit.spec.ts",
  "**/competition-show.spec.ts",
  "**/design-system-goal.spec.ts",
  "**/design-system-restore.spec.ts",
  "**/artist-tour-stop.spec.ts",
  "**/goal-token-lock.spec.ts",
];

// *.mobile.spec.ts: things that only exist at phone width (the filter sheet,
// the bottom tab bar). The desktop project leaves them out.
const mobileOnly = "**/*.mobile.spec.ts";

export default defineConfig({
  testDir: "./e2e",
  // Warm-up request + one login per persona, saved to e2e/.auth (see the file).
  globalSetup: "./e2e/global-setup.ts",
  // Deletes the run's temp admin (and puts the goal test's token back if
  // the spec could not); see e2e/helpers/temp-admin.ts.
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: false, // QA is a single shared environment/DB — avoid racing bookings against each other
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 1,
  grepInvert: hasQaDatabase() ? undefined : needsDb,
  // A broken deploy fails most tests the same way: stop after 10 instead of
  // grinding through the rest. The reporters below still write their output.
  maxFailures: isCI ? 10 : 0,
  // `github` turns each failure into a check-run annotation naming the test
  // (readable through the GitHub API without the logs or artifacts); `json`
  // feeds e2e/ci-summary.mjs, which adds the one-line pass/fail count.
  reporter: [
    ...(isCI ? ([["github"]] as const) : []),
    ["list"],
    ["html", { open: "never" }],
    ["json", { outputFile: "test-results/results.json" }],
  ],
  // A whole test may take 60 s (multi-step flows on a cold function), but a
  // single missing element must fail in 10-15 s, not hang until the test
  // timeout: that hang, on every test of a stale spec, is what pushed CI
  // past its job limit with no report written (3 Oct 2026 diagnosis).
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    actionTimeout: 15_000,
    navigationTimeout: 15_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: mobileOnly,
    },
    {
      name: "mobile-chrome",
      // Hitesh tests mobile-first / mobile-only for extended periods —
      // this project mirrors that, since several fixed layout bugs
      // (SeatPicker, sticky nudge banners) have only shown up at narrow widths.
      use: { ...devices["Pixel 7"] },
      testIgnore: desktopOnly,
    },
  ],
});
