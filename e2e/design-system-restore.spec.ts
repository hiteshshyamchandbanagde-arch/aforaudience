import type { Browser, BrowserContext, Page } from "@playwright/test";
import { test, expect, AFTER_WRITE, gotoDashboard } from "./helpers/test";
import { markFirstVisitDone } from "./helpers/first-visit";
import { DESKTOP } from "./helpers/viewports";
import { ADMIN_AUTH_FILE, GOAL_TEST_VALUE, GOAL_TOKEN, lockGoalToken, readTempAdminRun, type TempAdminRun } from "./helpers/temp-admin";

/**
 * GEN-2609-115: a Design System restore gets the same contrast check a
 * save does, and says what it found. (The ticket's other half, the
 * form-submit button's text contrast, is auth-submit-contrast.spec.ts.)
 *
 * As the run's temp admin (@needs-db, helpers/temp-admin.ts; never
 * Hitesh's account), through the editor and its version history, on the
 * token the goal spec uses (global teardown puts it back in the DB if
 * this could not):
 *   1. save --afa-selected = the goal test value (passes the check);
 *   2. save it = a dark grey that fails "Selected text on its tint": the
 *      save's own contrast dialog lists it, "Save anyway";
 *   3. restore version 1: the check passes, so no contrast dialog, and
 *      the token is restored;
 *   4. restore version 2: the restore's contrast dialog lists the failing
 *      pair with its ratio; Cancel, and the token is unchanged;
 *   5. finally the original value is saved back through the editor and
 *      read back from the API: the token ends as it started.
 * Each restore button must say it changes exactly 1 token, so a restore
 * can never touch any other token on QA. Like the goal spec, it holds the
 * cross-run GOAL_TOKEN lock throughout (helpers/temp-admin.ts, BUG-2610-011).
 */

/** Fails "Selected text on its tint" (about 1.1:1 on the dark tint). Never a real choice. */
const FAILING_VALUE = "#2A2A2A";
const SAVED_TOAST = "Saved. Live on the next page load everywhere.";

async function liveValue(admin: BrowserContext) {
  const res = await admin.request.get("/api/admin/design-tokens/");
  expect(res.ok(), `GET /api/admin/design-tokens as the temp admin: HTTP ${res.status()}`).toBeTruthy();
  const { tokens } = (await res.json()) as { tokens: { key: string; value: string }[] };
  return tokens.find((t) => t.key === GOAL_TOKEN)?.value;
}

/** Types `value` into GOAL_TOKEN's field and presses Save, the way an admin does. */
async function editAndSave(page: Page, value: string) {
  await gotoDashboard(page, "/dashboard/admin/design-system/");
  await page.locator("#token-search").fill(GOAL_TOKEN);
  const input = page.locator(`xpath=//span[normalize-space(text())="${GOAL_TOKEN}"]/parent::div`).locator('input[type="text"]');
  await expect(input).toBeVisible();
  await input.fill(value);
  await page.getByRole("button", { name: /^Save 1 change$/ }).click();
}

/** Version history entries (one per save or restore), newest first. */
function versions(page: Page) {
  return page.locator("li").filter({ has: page.getByRole("button", { name: /^(Restore this version|Already current)/ }) });
}

test.describe("@needs-db design system restore", () => {
  test("@needs-db [GEN-2609-115] a design-token restore runs the contrast check and reports it; the token ends as it started", async ({ browser }) => {
    // Three editor saves and two restores, each a write on QA that waits
    // for its toast (AFTER_WRITE): honestly longer than 60 s. Each single
    // wait still fails in 10-25 s. Plus up to GOAL_LOCK_WAIT_MS (120 s)
    // waiting for another run to finish with the token.
    test.setTimeout(300_000);

    const run = readTempAdminRun();
    expect(run, "global-setup.ts created no temp admin (needs E2E_DATABASE_URL on the QA project)").not.toBeNull();
    const unlock = await lockGoalToken();
    try {
      await editRestoreAndRevert(browser, run!);
    } finally {
      await unlock();
    }
  });
});

/** The test body, run holding the GOAL_TOKEN lock. */
async function editRestoreAndRevert(browser: Browser, run: TempAdminRun) {
  const admin = await browser.newContext({ storageState: ADMIN_AUTH_FILE, viewport: DESKTOP });
  await markFirstVisitDone(admin);
  const page = await admin.newPage();

  const original = await liveValue(admin);
  expect(original, `${GOAL_TOKEN} is a token row`).toBeTruthy();
  expect(original, "the value global-setup recorded for teardown").toBe(run.originalValue);
  test.info().annotations.push({ type: "token", description: `${GOAL_TOKEN}: ${original} -> ${GOAL_TEST_VALUE} -> ${FAILING_VALUE} -> restore -> ${original}` });

  try {
    await test.step(`Save ${GOAL_TOKEN} = ${GOAL_TEST_VALUE}`, async () => {
      await editAndSave(page, GOAL_TEST_VALUE);
      await expect(page.getByText(SAVED_TOAST)).toBeVisible(AFTER_WRITE);
    });

    await test.step(`Save ${GOAL_TOKEN} = ${FAILING_VALUE}: the save's contrast dialog lists the pair; Save anyway`, async () => {
      await editAndSave(page, FAILING_VALUE);
      const dialog = page.getByRole("dialog", { name: "This lowers text contrast" });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText("Selected text on its tint");
      await dialog.getByRole("button", { name: "Save anyway" }).click();
      await expect(page.getByText(SAVED_TOAST)).toBeVisible(AFTER_WRITE);
      expect(await liveValue(admin)).toBe(FAILING_VALUE);
    });

    await page.getByRole("button", { name: "Show version history" }).click();

    await test.step(`Restore the ${GOAL_TEST_VALUE} version: the check passes, no contrast dialog, restored`, async () => {
      // This run's first save is the second-newest entry. (Its own diff
      // line is matched by the dialog below, not here: a version whose
      // predecessor predates the token shows no diff line.)
      const version = versions(page).nth(1);
      await expect(version).toContainText("by E2E temp admin");
      await version.getByRole("button", { name: /^Restore this version \(1\)$/ }).click();
      const confirm = page.getByRole("dialog", { name: "Restore this version?" });
      await expect(confirm).toContainText(`${GOAL_TOKEN}: ${FAILING_VALUE} → ${GOAL_TEST_VALUE}`);
      await confirm.getByRole("button", { name: "Yes, restore" }).click();
      await expect(page.getByText("Restored 1 token(s).")).toBeVisible(AFTER_WRITE);
      await expect(page.getByRole("dialog", { name: "This restore lowers text contrast" })).toHaveCount(0);
      expect(await liveValue(admin)).toBe(GOAL_TEST_VALUE);
    });

    await test.step(`Restore the ${FAILING_VALUE} version: the check reports the failing pair; Cancel leaves the token alone`, async () => {
      const version = versions(page).filter({ hasText: "by E2E temp admin" }).filter({ hasText: `${GOAL_TEST_VALUE} → ${FAILING_VALUE}` }).first();
      await version.getByRole("button", { name: /^Restore this version \(1\)$/ }).click();
      const confirm = page.getByRole("dialog", { name: "Restore this version?" });
      await expect(confirm).toContainText(`${GOAL_TOKEN}: ${GOAL_TEST_VALUE} → ${FAILING_VALUE}`);
      await confirm.getByRole("button", { name: "Yes, restore" }).click();
      const report = page.getByRole("dialog", { name: "This restore lowers text contrast" });
      await expect(report).toBeVisible();
      const pair = report.locator("li", { hasText: "Selected text on its tint" }).first();
      await expect(pair).toBeVisible();
      // "<label>: <before>:1 → <after>:1 (needs 4.5:1)": before passes, after does not.
      const text = (await pair.textContent()) ?? "";
      const [, before, after] = text.match(/([\d.]+):1 → ([\d.]+):1/) ?? [];
      test.info().annotations.push({ type: "restore contrast report", description: text });
      expect(Number(before), text).toBeGreaterThanOrEqual(4.5);
      expect(Number(after), text).toBeLessThan(4.5);
      await expect(pair).toContainText("(needs 4.5:1)");
      await report.getByRole("button", { name: "Cancel" }).click();
      await expect(report).toHaveCount(0);
      expect(await liveValue(admin), "nothing restored after Cancel").toBe(GOAL_TEST_VALUE);
    });
  } finally {
    await test.step(`Put ${GOAL_TOKEN} back to ${original} through the editor`, async () => {
      if ((await liveValue(admin)) !== original) {
        await editAndSave(page, original!);
        await expect(page.getByText(SAVED_TOAST)).toBeVisible(AFTER_WRITE);
      }
      expect(await liveValue(admin), "the token ends as it started").toBe(original);
    });
    await admin.close();
  }
}
