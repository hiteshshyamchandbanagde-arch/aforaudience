import { test, expect } from "@playwright/test";

/**
 * Real target: browse -> pick seats -> checkout -> confirm, on a NUMBERED
 * venue event ("Jaipur Mic Gala 100" / "Jaipur Ja Mic 100").
 *
 * BLOCKED ON A REAL DECISION, NOT A SCRIPTING PROBLEM:
 * `POST /api/bookings` requires phone verification (thirteenth amendment).
 * A real OTP is sent via MSG91 to a real phone number - Playwright can't
 * complete that without one of:
 *   (a) a fixed test OTP code that only works for a designated QA-only test
 *       phone number (common pattern - needs a deliberate code change,
 *       gated so it can never work in prod), or
 *   (b) an MSG91 test/sandbox mode that returns a known code without
 *       sending a real SMS, or
 *   (c) a test-only API route (QA env only) that marks a specific test
 *       user's phone pre-verified, bypassing the OTP screen entirely.
 *
 * Not implemented here - this is a product/security decision (a standing
 * test-auth bypass is exactly the kind of thing that must never leak into
 * prod), not something to default into silently. Flagging for Hitesh.
 *
 * Until one of those exists, this suite documents the intended flow and
 * stops right before the OTP wall so it's ready to complete the moment
 * a bypass is chosen. Skipped by default so it doesn't fail CI on a known,
 * not-yet-resolved gap.
 */

test.skip("audience member can select seats on a Numbered event", async ({ page }) => {
  await page.goto("/events");
  await page.getByText("Jaipur Mic Gala 100", { exact: false }).first().click();

  // Select at least one available (non-greyed-out) seat.
  const seat = page.locator("[data-seat-status='available']").first();
  await seat.click();

  await expect(page.getByText(/continue to checkout/i)).toBeEnabled();
  await page.getByText(/continue to checkout/i).click();

  await expect(page).toHaveURL(/checkout/);
  // Numbered bookings should show seat labels + per-tier amount (PR #157),
  // not just a bare fee + total.
  await expect(page.locator("body")).toContainText(/seat/i);
});

test.skip("audience member completes a real booking end to end (needs OTP bypass - see file header)", async ({
  page,
}) => {
  // Intentionally left unimplemented until Hitesh picks an OTP-bypass approach.
});
