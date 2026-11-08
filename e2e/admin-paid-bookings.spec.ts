import { test, expect, gotoDashboard } from "./helpers/test";
import { ADMIN_AUTH_FILE } from "./helpers/temp-admin";
import { withQaDb } from "./helpers/qa-db";
import { useRuleViewport } from "./helpers/viewports";

/**
 * S1a (Hitesh, 8 Nov) - "paid bookings" master switch. The admin Settings
 * page has a Paid bookings card with the toggle and the real-payments
 * warning, and the settings API validates the new field.
 *
 * Read-only on purpose: the switch is global and these specs run in
 * parallel, so nothing here saves it. The toggle is checked against the
 * row's current value (read, never written) and only flipped client-side.
 * The OFF behaviour of the money routes (403 PAID_BOOKINGS_DISABLED, free
 * still allowed) is covered with the flag injected in
 * scripts/paid-bookings.test.ts.
 */
test.use({ storageState: ADMIN_AUTH_FILE });

test("[S1a] admin Settings shows the Paid bookings toggle with the real-payments warning; nothing saved @needs-db", async ({ page, isMobile }) => {
  const stored = await withQaDb(async (db) => {
    const { rows } = await db.query<{ paidBookingsEnabled: boolean }>(
      `SELECT "paidBookingsEnabled" FROM "PlatformSettings" WHERE id = 'singleton'`
    );
    expect(rows.length, "the platform settings row exists on QA").toBe(1);
    return rows[0].paidBookingsEnabled;
  });

  await useRuleViewport(page, isMobile);
  await gotoDashboard(page, "/dashboard/admin/settings/");

  const card = page.locator("[data-afa-paid-bookings-card]");
  await expect(card.getByRole("heading", { name: "Paid bookings" })).toBeVisible();
  await expect(card.locator("[data-afa-paid-bookings-warning]")).toHaveText(
    "Turns on real payments. Needs Razorpay live keys + GST/compliance sign-off."
  );

  const toggle = card.locator("[data-afa-paid-bookings-toggle]");
  const save = card.getByRole("button", { name: "Save", exact: true });
  if (stored) await expect(toggle).toBeChecked();
  else await expect(toggle).not.toBeChecked();
  await expect(save).toBeDisabled();

  // Flipping it is a change (Save offered); flipping back is no change.
  await toggle.click();
  await expect(save).toBeEnabled();
  await toggle.click();
  await expect(save).toBeDisabled();
});

// S1a amend - the card first shipped 312.1875px tall at 390 (20.8px and
// 16.5px line heights), which moved every card below it by a sub-pixel and
// broke BUG-2609-051's Direct payouts toggle baseline. A whole-pixel height
// keeps everything under it exactly where it sits without the card.
test("[S1a] Paid bookings card has a whole-pixel height so the cards below don't shift @needs-db", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  await gotoDashboard(page, "/dashboard/admin/settings/");

  const card = page.locator("[data-afa-paid-bookings-card]");
  await expect(card.getByRole("heading", { name: "Paid bookings" })).toBeVisible();
  const height = await card.evaluate((el) => el.getBoundingClientRect().height);
  expect(height % 1, `card height ${height}px is a whole number of pixels`).toBe(0);
});

test("[S1a] settings API rejects a non-boolean paidBookingsEnabled (nothing written)", async ({ page }) => {
  const res = await page.request.patch("/api/admin/platform-settings", {
    data: { paidBookingsEnabled: "yes" },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toBe("paidBookingsEnabled must be a boolean");
});
