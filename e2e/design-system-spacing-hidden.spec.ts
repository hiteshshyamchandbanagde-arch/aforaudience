import type { Browser } from "@playwright/test";
import { test, expect, gotoDashboard } from "./helpers/test";
import { markFirstVisitDone } from "./helpers/first-visit";
import { DESKTOP, PHONE } from "./helpers/viewports";
import { ADMIN_AUTH_FILE, readTempAdminRun } from "./helpers/temp-admin";

/**
 * GEN-2609-107 phase 2 (decision 24 Sep): spacing moves onto the
 * --afa-space-* scale for hygiene, but individual spacing tokens are NOT
 * admin knobs. Admin -> Design System shows no Spacing group and no
 * --afa-space-* field, at 1440 and 390, even when the admin searches for
 * one. The DB rows and the runtime injection stay: the admin API still
 * returns every spacing row (phase 2's 5 new ones included) and the
 * runtime <style> still sets them for visitors.
 *
 * As the run's temp admin (@needs-db, helpers/temp-admin.ts; never
 * Hitesh's account). Read-only: nothing is saved.
 */

const NEW_SPACING = ["--afa-space-36px", "--afa-space-40px", "--afa-space-56px", "--afa-space-64px", "--afa-space-80px"];

async function adminPage(browser: Browser, viewport: { width: number; height: number }) {
  const phone = viewport.width < 600;
  const context = await browser.newContext({
    storageState: ADMIN_AUTH_FILE,
    viewport,
    ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : {}),
  });
  await markFirstVisitDone(context);
  return { context, page: await context.newPage() };
}

test.describe("@needs-db design system spacing hidden", () => {
  test("@needs-db [GEN-2609-107] the spacing group is not shown to the admin; its rows and runtime injection stay", async ({ browser }) => {
    test.setTimeout(120_000);
    expect(readTempAdminRun(), "global-setup.ts created no temp admin (needs E2E_DATABASE_URL on the QA project)").not.toBeNull();

    for (const [label, viewport] of [["1440", DESKTOP], ["390", PHONE]] as const) {
      await test.step(`${label}: no Spacing group, no --afa-space-* field`, async () => {
        const { context, page } = await adminPage(browser, viewport);
        try {
          // The DB rows are still there (the editor hides them, it doesn't drop them).
          const res = await context.request.get("/api/admin/design-tokens/");
          expect(res.ok(), `GET /api/admin/design-tokens as the temp admin: HTTP ${res.status()}`).toBeTruthy();
          const { tokens } = (await res.json()) as { tokens: { key: string; value: string; group: string }[] };
          const spacing = tokens.filter((t) => t.group === "spacing").map((t) => t.key);
          for (const key of NEW_SPACING) expect(spacing, `${key} row on QA`).toContain(key);

          await gotoDashboard(page, "/dashboard/admin/design-system/");
          // Positive control: the editor rendered its groups.
          await expect(page.getByRole("heading", { level: 2, name: "Radius", exact: true })).toBeVisible();
          await expect(page.getByRole("heading", { level: 2, name: "Spacing", exact: true })).toHaveCount(0);
          // A token field's mono caption is its raw key; a radius one is there, no spacing one is.
          await expect(page.locator("span", { hasText: /^--afa-radius-md$/ }).first()).toBeVisible();
          for (const key of spacing) {
            await expect(page.locator("span", { hasText: new RegExp(`^${key}$`) }), `${key} field`).toHaveCount(0);
          }

          // Searching for one finds nothing.
          await page.locator("#token-search").fill("--afa-space-40px");
          await expect(page.getByText("No token matches “--afa-space-40px”.")).toBeVisible();
          await page.screenshot({ path: test.info().outputPath(`design-system-${label}.png`), fullPage: true });
        } finally {
          await context.close();
        }
      });
    }

    await test.step("visitors still get the spacing tokens from the runtime injection", async () => {
      const context = await browser.newContext({ viewport: DESKTOP });
      await markFirstVisitDone(context);
      try {
        const page = await context.newPage();
        await page.goto("/events/");
        const runtime = await page.locator("style#afa-design-tokens-runtime").textContent();
        for (const key of NEW_SPACING) {
          expect(runtime ?? "", `runtime <style> sets ${key}`).toContain(`${key}: ${key.slice("--afa-space-".length)} !important;`);
        }
        const computed = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--afa-space-40px").trim());
        expect(computed).toBe("40px");
      } finally {
        await context.close();
      }
    });
  });
});
