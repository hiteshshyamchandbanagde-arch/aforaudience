import { test, expect, gotoDashboard } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { useRuleViewport } from "./helpers/viewports";

/**
 * BUG-2609-070 - venue Sales, "By venue": with no revenue at any venue the
 * bar chart drew the venue names over a ₹0-₹4 axis with no bars. It now
 * shows the page's empty state ("No bookings in this range"), and the
 * venue table stays. The "View all" / "Show top 5 only" pair are now the
 * same kind of button.
 *
 * As Vinayak (7 venues). The all-zero range is made by zeroing the
 * revenue in the browser's copy of /api/venues/sales-overview, so it does
 * not depend on QA's bookings. Read-only. At 390 and 1440.
 */

test.use({ storageState: authFile("vinayak") });

type Overview = { venues: { id: string; name: string; revenue: number; bookings: number }[] } & Record<string, unknown>;

test.beforeEach(async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
});

function byVenueSection(page: import("@playwright/test").Page) {
  return page
    .getByRole("main")
    .locator("div")
    .filter({ has: page.getByRole("heading", { level: 2, name: "By venue", exact: true }) })
    .last();
}

test("[BUG-2609-070] By venue with no revenue anywhere shows the empty state, not an empty ₹0 chart; the venue table stays", async ({ page }) => {
  let venueCount = 0;
  await page.route("**/api/venues/sales-overview**", async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as Overview;
    body.venues = body.venues.map((v) => ({ ...v, revenue: 0, bookings: 0 }));
    venueCount = body.venues.length;
    await route.fulfill({ response: res, json: body });
  });
  await gotoDashboard(page, "/dashboard/venue/sales");

  const section = byVenueSection(page);
  await expect(section.getByText("No bookings in this range")).toBeVisible();
  await expect(section.locator(".recharts-wrapper")).toHaveCount(0);
  expect(venueCount, "Vinayak has venues on QA").toBeGreaterThan(0);

  // The venue table is still there (behind "View all" when there are more than 5).
  const viewAll = section.getByRole("button", { name: /^View all \d+ venues$/ });
  if (venueCount > 5) {
    const expandClass = await viewAll.getAttribute("class");
    await viewAll.click();
    // The collapse control is the same outline button as the one that expanded.
    const showTop = section.getByRole("button", { name: /^Show top \d+ only$/ });
    await expect(showTop).toBeVisible();
    expect(await showTop.getAttribute("class")).toBe(expandClass);
  }
  await expect(section.getByRole("link").filter({ hasText: "₹0" })).toHaveCount(venueCount);
});

test("[BUG-2609-070] By venue with revenue still draws the bar chart", async ({ page }) => {
  await page.route("**/api/venues/sales-overview**", async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as Overview;
    if (body.venues.length > 0) body.venues[0] = { ...body.venues[0], revenue: 5000, bookings: 1 };
    await route.fulfill({ response: res, json: body });
  });
  await gotoDashboard(page, "/dashboard/venue/sales");

  const section = byVenueSection(page);
  await expect(section.locator(".recharts-wrapper")).toHaveCount(1);
  await expect(section.getByText("No bookings in this range")).toHaveCount(0);
});
