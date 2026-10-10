import type { Page } from "@playwright/test";
import { test, expect, gotoDashboard } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { useRuleViewport } from "./helpers/viewports";

/**
 * BUG-2609-082 - counts did not pluralise: "Showing 1 events", "1 events
 * happening near you", "1 bookings". Since #722 the /events strings come
 * from one/other dictionary pairs (src/lib/i18n/plural.ts countText) and
 * the dashboard counts from countNoun.
 *
 * /events is shown exactly 1 and then 2 events by trimming the real
 * /api/events answer in the browser, so the check does not depend on how
 * many events QA has. The venue Sales page is checked as Vinayak for
 * whatever counts it shows. Read-only.
 */

const NOUNS = ["event", "booking", "seat", "row", "section", "ticket"];

/** Every "<n> <noun>" on the page whose noun disagrees with n ("1 events", "2 booking"). */
async function badCounts(page: Page) {
  const text = await page.locator("body").innerText();
  const bad: string[] = [];
  const re = new RegExp(`\\b(\\d+)\\s+(${NOUNS.join("|")})(s?)\\b`, "gi");
  for (const [match, n, , s] of text.matchAll(re)) {
    if ((Number(n) === 1) !== (s === "")) bad.push(match);
  }
  return bad;
}

type ApiEvent = { date: string; startTime: string };

/** A day after the event's date: upcoming by the page's own rule whatever the zone (its isPastEvent). */
function clearlyUpcoming(e: ApiEvent) {
  return new Date(e.date).getTime() > Date.now() + 24 * 60 * 60 * 1000;
}

/** Serves the real /api/events answer cut down to `n` upcoming events. */
async function serveEvents(page: Page, n: number) {
  await page.route(
    (url) => /^\/api\/events\/?$/.test(url.pathname),
    async (route) => {
      const res = await route.fetch();
      const upcoming = ((await res.json()) as ApiEvent[]).filter(clearlyUpcoming);
      expect(upcoming.length, "QA has enough upcoming events to cut down").toBeGreaterThanOrEqual(n);
      await route.fulfill({ response: res, json: upcoming.slice(0, n) });
    }
  );
}

for (const n of [1, 2]) {
  const noun = n === 1 ? "event" : "events";
  test(`[BUG-2609-082] /events with ${n} ${noun}: the counts read "${n} ${noun}"`, async ({ page, isMobile }) => {
    await useRuleViewport(page, isMobile);
    await serveEvents(page, n);
    await page.goto("/events/");

    await expect(page.getByText(`${n} ${noun} happening near you`, { exact: true })).toBeVisible();
    if (isMobile) {
      // The count is on the filter sheet's Apply button at phone width.
      await page.getByRole("banner").getByRole("button", { name: "Open filters" }).click();
      await expect(page.getByRole("dialog", { name: "Filter events" }).getByText(`Showing ${n} ${noun}`, { exact: true })).toBeVisible();
    } else {
      await expect(page.getByText(new RegExp(`^Showing ${n} ${noun}$`, "i"))).toBeVisible();
    }
    expect(await badCounts(page)).toEqual([]);
  });
}

test.describe("venue sales", () => {
  test.use({ storageState: authFile("vinayak") });

  test("[BUG-2609-082] venue Sales: booking counts agree with their number", async ({ page, isMobile }) => {
    await useRuleViewport(page, isMobile);
    await gotoDashboard(page, "/dashboard/venue/sales/");
    // data-afa-* hook, not the English text: venue Sales follows the UI language (GEN-2610-007).
    await expect(page.locator('[data-afa-section="by-organiser"] [data-afa-section-title]')).toHaveText("By organiser");
    expect(await badCounts(page)).toEqual([]);
  });
});
