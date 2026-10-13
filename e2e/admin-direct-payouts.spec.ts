import { test, expect, gotoDashboard, hideFloatingOverlays } from "./helpers/test";
import { ADMIN_AUTH_FILE } from "./helpers/temp-admin";
import { withQaDb } from "./helpers/qa-db";
import { useRuleViewport } from "./helpers/viewports";

/**
 * BUG-2609-051 - admin Settings showed the Direct payouts toggle ON when
 * the flag was still true in the DB but its auto-disable time had passed
 * (the payout API already treats that as off). It now shows the effective
 * state: OFF, with "Expired on {date} — currently off." under it, and Save
 * stays disabled until the admin changes something, so opening and leaving
 * the page writes nothing.
 *
 * With the run's temp admin (needs the QA database). The settings row is
 * set to "ON until 2 Aug 2026, 11 pm IST" (effectively off, so nothing else on QA
 * changes) and put back to what it was afterwards. Nothing is saved.
 */
test.use({ storageState: ADMIN_AUTH_FILE });

type Flag = { directPayoutsEnabled: boolean; directPayoutsEnabledUntil: Date | null };
let original: Flag | null = null;

test.beforeEach(async () => {
  await withQaDb(async (db) => {
    const { rows } = await db.query<Flag>(`SELECT "directPayoutsEnabled", "directPayoutsEnabledUntil" FROM "PlatformSettings" WHERE id = 'singleton'`);
    expect(rows.length, "the platform settings row exists on QA").toBe(1);
    original = rows[0];
    await db.query(`UPDATE "PlatformSettings" SET "directPayoutsEnabled" = true, "directPayoutsEnabledUntil" = '2026-08-02T17:30:00Z' WHERE id = 'singleton'`);
  });
});

test.afterEach(async () => {
  if (!original) return;
  const flag = original;
  original = null;
  await withQaDb((db) =>
    db.query(`UPDATE "PlatformSettings" SET "directPayoutsEnabled" = $1, "directPayoutsEnabledUntil" = $2 WHERE id = 'singleton'`, [
      flag.directPayoutsEnabled,
      flag.directPayoutsEnabledUntil,
    ])
  );
});

test("[BUG-2609-051] Direct payouts past its auto-disable time shows OFF with an 'Expired on' note; nothing to save @needs-db", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  await gotoDashboard(page, "/dashboard/admin/settings/");

  const card = page.locator("div").filter({ has: page.getByRole("heading", { name: "Direct payouts (Razorpay Route)" }) }).last();
  const toggle = card.getByRole("checkbox");
  const note = card.locator("[data-afa-direct-payouts-expired]");
  const save = card.getByRole("button", { name: "Save", exact: true });

  await expect(toggle).not.toBeChecked();
  await expect(note).toHaveText("Expired on 2 Aug 2026, 11:00 pm — currently off.");
  await expect(save).toBeDisabled();
  await hideFloatingOverlays(page);
  await toggle.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await expect(toggle.locator("xpath=ancestor::label")).toHaveScreenshot(`direct-payouts-toggle-expired-${isMobile ? 390 : 1440}.png`, { animations: "disabled" });
  await expect(note).toHaveScreenshot(`direct-payouts-expired-note-${isMobile ? 390 : 1440}.png`, { animations: "disabled" });

  // Switching it on is a real change (the note goes, Save is offered);
  // switching it back off is no change at all.
  await toggle.check();
  await expect(note).toHaveCount(0);
  await expect(save).toBeEnabled();
  await toggle.uncheck();
  await expect(note).toBeVisible();
  await expect(save).toBeDisabled();
});
