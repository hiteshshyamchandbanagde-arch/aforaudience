import type { Page } from "@playwright/test";
import { test, expect, gotoDashboard, hideFloatingOverlays } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { useRuleViewport } from "./helpers/viewports";

/**
 * BUG-2610-027 - venue Sales, "By venue": the revenue axis read
 * ₹0 ₹10K ₹19K ₹29K ₹38K (the max split in four). Both money axes on the
 * page now take round ticks from src/lib/money-axis.ts
 * (scripts/money-axis.test.ts covers the helper itself).
 *
 * As Vinayak. The browser's copy of /api/venues/sales-overview gets the
 * reported shape (one venue at ₹38,000) and a four-day timeline peaking at
 * ₹18,000, so the ticks are known whatever QA's bookings are. Read-only.
 * At 390 and 1440, with a screenshot baseline of the By venue chart.
 */

test.use({ storageState: authFile("vinayak") });

type Overview = {
  venues: { id: string; name: string; revenue: number; bookings: number }[];
  timeline: { date: string; revenue: number }[];
} & Record<string, unknown>;

test.beforeEach(async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  await page.route("**/api/venues/sales-overview**", async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as Overview;
    body.venues = body.venues.map((v, i) => ({ ...v, name: i === 0 ? "E2E Axis Venue" : v.name, revenue: i === 0 ? 38000 : 0, bookings: i === 0 ? 3 : 0 }));
    const today = new Date();
    body.timeline = [3, 2, 1, 0].map((back, i) => {
      const d = new Date(today.getTime() - back * 86_400_000);
      return { date: d.toISOString().slice(0, 10), revenue: [12000, 0, 8000, 18000][i] };
    });
    await route.fulfill({ response: res, json: body });
  });
});

function section(page: Page, heading: string) {
  return page
    .getByRole("main")
    .locator("div")
    .filter({ has: page.getByRole("heading", { level: 2, name: heading, exact: true }) })
    .last();
}

async function tickLabels(page: Page, heading: string, axis: "x" | "y") {
  const chart = section(page, heading);
  const ticks = chart.locator(`.recharts-${axis}Axis-tick-labels .recharts-cartesian-axis-tick-value`);
  await expect(ticks.first()).toBeVisible();
  return (await ticks.allTextContents()).map((t) => t.trim());
}

test("[BUG-2610-027] By venue: a ₹38,000 max reads ₹0 ₹10K ₹20K ₹30K ₹40K", async ({ page, isMobile }) => {
  await gotoDashboard(page, "/dashboard/venue/sales");
  await hideFloatingOverlays(page);
  expect(await tickLabels(page, "By venue", "x")).toEqual(["₹0", "₹10K", "₹20K", "₹30K", "₹40K"]);
  const chart = section(page, "By venue").locator(".recharts-wrapper");
  await chart.scrollIntoViewIfNeeded();
  await expect(chart).toHaveScreenshot(`by-venue-axis-${isMobile ? 390 : 1440}.png`, { animations: "disabled" });
});

test("[BUG-2610-027] Revenue over time: the money axis is round too (₹18,000 peak -> ₹0 ... ₹20K)", async ({ page }) => {
  await gotoDashboard(page, "/dashboard/venue/sales");
  expect(await tickLabels(page, "Revenue over time", "y")).toEqual(["₹0", "₹5K", "₹10K", "₹15K", "₹20K"]);
});
