import type { Locator, Page } from "@playwright/test";
import { test, expect, gotoDashboard } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { useRuleViewport } from "./helpers/viewports";
import { contrastOf } from "./helpers/contrast";

/**
 * BUG-2610-026 - venue Sales, "By venue": the tapped bar's tooltip showed
 * the venue name, but its value line ("Revenue : ₹0") was black on the
 * black tooltip box. Every Recharts tooltip now takes its colours from
 * src/lib/chart-tooltip.ts (scripts/chart-tooltip.test.ts checks that
 * statically); this checks what a person actually sees on both charts.
 *
 * As Vinayak. Revenue figures come from the browser's copy of
 * /api/venues/sales-overview, so the bars and the timeline exist whatever
 * QA's bookings are, and one bar is ₹0 like the report. Read-only.
 * At 390 (tap) and 1440 (hover).
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
    body.venues = body.venues.map((v, i) => ({ ...v, revenue: i === 0 ? 38000 : 0, bookings: i === 0 ? 3 : 0 }));
    const today = new Date();
    body.timeline = [3, 2, 1, 0].map((back, i) => {
      const d = new Date(today.getTime() - back * 86_400_000);
      return { date: d.toISOString().slice(0, 10), revenue: [12000, 0, 8000, 18000][i] };
    });
    await route.fulfill({ response: res, json: body });
  });
});

// data-afa-* hooks, not the English text: venue Sales follows the UI language (GEN-2610-007).
const SECTION_IDS: Record<string, string> = { "By venue": "by-venue", "Revenue over time": "revenue-over-time" };

/** The section card, by its hook; it still has to carry the English heading. */
function section(page: Page, heading: string) {
  return page
    .getByRole("main")
    .locator(`[data-afa-section="${SECTION_IDS[heading]}"]`)
    .filter({ has: page.locator("h2[data-afa-section-title]").getByText(heading, { exact: true }) });
}

/** Hovers (desktop) or taps (phone) a point inside the chart, then returns its tooltip. */
async function openTooltip(chart: Locator, isMobile: boolean, at: { x: number; y: number }): Promise<Locator> {
  const wrapper = chart.locator(".recharts-wrapper");
  await expect(wrapper).toBeVisible();
  await wrapper.scrollIntoViewIfNeeded();
  if (isMobile) await wrapper.tap({ position: at });
  else await wrapper.hover({ position: at });
  const tooltip = chart.locator(".recharts-default-tooltip");
  await expect(tooltip).toBeVisible();
  return tooltip;
}

async function expectReadable(tooltip: Locator) {
  const label = tooltip.locator(".recharts-tooltip-label");
  const item = tooltip.locator(".recharts-tooltip-item").first();
  await expect(item).toContainText(/Revenue\s*:\s*₹/);
  const itemContrast = await contrastOf(item);
  const labelContrast = await contrastOf(label);
  test.info().annotations.push({ type: "contrast", description: `value ${itemContrast}:1, label ${labelContrast}:1` });
  // WCAG AA for normal text.
  expect(itemContrast, "value line against the tooltip box").toBeGreaterThanOrEqual(4.5);
  expect(labelContrast, "label against the tooltip box").toBeGreaterThanOrEqual(4.5);
}

test("[BUG-2610-026] By venue: the bar tooltip's value line is readable (AA) on the tooltip box", async ({ page, isMobile }) => {
  await gotoDashboard(page, "/dashboard/venue/sales");
  const chart = section(page, "By venue");
  const wrapper = chart.locator(".recharts-wrapper");
  await expect(wrapper).toBeVisible();
  // The first bar's row: a little right of the 140px name axis, 10px + half a 44px row down.
  const tooltip = await openTooltip(chart, isMobile, { x: 170, y: 30 });
  await expectReadable(tooltip);
  await expect(tooltip).toHaveScreenshot(`by-venue-tooltip-${isMobile ? 390 : 1440}.png`, { animations: "disabled" });
});

test("[BUG-2610-026] Revenue over time: the area chart's tooltip is readable (AA) too", async ({ page, isMobile }) => {
  await gotoDashboard(page, "/dashboard/venue/sales");
  const chart = section(page, "Revenue over time");
  const wrapper = chart.locator(".recharts-wrapper");
  await expect(wrapper).toBeVisible();
  const box = (await wrapper.boundingBox())!;
  const tooltip = await openTooltip(chart, isMobile, { x: Math.round(box.width * 0.6), y: Math.round(box.height / 2) });
  await expectReadable(tooltip);
});
