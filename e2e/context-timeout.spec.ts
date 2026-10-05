import { spawnSync } from "child_process";
import path from "path";
import { test, expect } from "./helpers/test";

/**
 * BUG-2610-011 cause 2: the goal spec (design-system-goal.spec.ts) failed
 * with "browserContext.close: Target page, context or browser has been
 * closed", at a context.close() in a `finally`. That is what a test
 * timeout looks like when the test closes its own contexts in `finally`:
 * Playwright ends the pages, the waiting action rejects, the `finally`
 * runs and its close() throws, and that error replaces the one naming the
 * action the test was stuck on.
 *
 * The suite's `newContext` fixture (helpers/test.ts) closes contexts after
 * the test instead. This runs both patterns in a separate Playwright run
 * (fixtures/context-timeout.inner.ts, no site, no database) where each
 * test times out mid-click, and checks the reported error: the old pattern
 * blames close(), the fixture leaves it on the click.
 */

type Result = { status: string; errors: { message?: string }[] };
type Spec = { title: string; tests: { results: Result[] }[] };

test("[BUG-2610-011] a timed-out test's error names the stuck action, not context.close()", async () => {
  test.setTimeout(90_000);
  const root = path.join(__dirname, "..");
  // The outer run's TEST_* / PW_* variables would make the inner runner act as one of its workers.
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(TEST_|PW_|PLAYWRIGHT_)/.test(k)));
  const inner = spawnSync(
    process.execPath,
    [path.join(root, "node_modules/@playwright/test/cli.js"), "test", "-c", path.join(__dirname, "fixtures/context-timeout.config.ts")],
    { cwd: root, env, encoding: "utf8", timeout: 80_000 }
  );
  expect(inner.error, "the inner Playwright run started").toBeUndefined();
  const report = JSON.parse(inner.stdout) as { suites: { specs: Spec[] }[] };
  const results = new Map(report.suites.flatMap((s) => s.specs).map((s) => [s.title, s.tests[0].results[0]]));
  const errors = (title: string) => (results.get(title)?.errors ?? []).map((e) => e.message ?? "").join("\n");

  expect(results.get("finally close")?.status, "inner test 'finally close'").toBe("timedOut");
  expect(results.get("newContext fixture")?.status, "inner test 'newContext fixture'").toBe("timedOut");

  // The mechanism: close() in `finally` throws and hides the click. Which
  // of Playwright's two wordings depends on how far its teardown has got.
  expect(errors("finally close")).toMatch(/browserContext\.close: (Target page, context or browser has been closed|Test ended)/);
  // The fix: the error is on the click, and close() is never blamed.
  expect(errors("newContext fixture")).toMatch(/locator\.click/);
  expect(errors("newContext fixture")).not.toMatch(/browserContext\.close/);
});
