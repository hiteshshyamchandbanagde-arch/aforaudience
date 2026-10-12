import { test, expect, gotoDashboard, hideFloatingOverlays } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { useRuleViewport } from "./helpers/viewports";

/**
 * BUG-2608-090 - venue Sales: "no platform cut on rentals" sat under the
 * Venues count card. It is revenue copy (the venue owner keeps the whole
 * rental; AFA's fee is on audience tickets only), so it now sits on the
 * Total Revenue card, after "by event date", and the Venues card has no
 * line under its count.
 *
 * As Vinayak. Read-only. At 390 and 1440.
 */

test.use({ storageState: authFile("vinayak") });

test.beforeEach(async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
});

test("[BUG-2608-090] venue Sales: 'no platform cut on rentals' is on Total Revenue, not on the Venues card", async ({ page, isMobile }) => {
  await gotoDashboard(page, "/dashboard/venue/sales");
  const main = page.getByRole("main");
  // data-afa-stat hooks, not the English labels: venue Sales follows the UI language (GEN-2610-007).
  const revenue = main.locator('[data-afa-stat="total-revenue"]');
  const venues = main.locator('[data-afa-stat="venues"]');
  await expect(revenue).toContainText("Total Revenue");
  await expect(venues).toContainText("Venues");

  await expect(revenue).toContainText("by event date · no platform cut on rentals");
  await expect(venues).not.toContainText("no platform cut on rentals");
  // The Venues card is just its label and its count.
  await expect(venues.locator("p")).toHaveCount(2);

  // The Venues card's count is QA data; masked so the baseline is the card itself.
  await hideFloatingOverlays(page);
  // Mid-screen, clear of the fixed phone tab bar at the bottom.
  await venues.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await expect(venues).toHaveScreenshot(`venue-sales-venues-card-${isMobile ? 390 : 1440}.png`, {
    animations: "disabled",
    mask: [venues.locator("p:not([data-afa-stat-label])")],
  });
});
