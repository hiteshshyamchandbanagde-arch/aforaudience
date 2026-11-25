import { defineConfig } from "@playwright/test";

/**
 * The inner run of context-timeout.spec.ts: one file, no global setup, no
 * site, no retries. Its tests time out on purpose; the outer spec reads
 * the JSON report.
 */
export default defineConfig({
  testDir: ".",
  testMatch: "context-timeout.inner.ts",
  workers: 1,
  retries: 0,
  reporter: "json",
  outputDir: "../../test-results/context-timeout-inner",
});
