import type { Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { JAIPUR_EVENT_TITLE, openEventFromListing } from "./helpers/events";

/**
 * BUG-2610-013 - openEventFromListing (helpers/events.ts) on a phone, in
 * both states /events can open in:
 * - carousel rows, with the full list behind "See all events" (some row
 *   holds 3+ events), and
 * - the plain list with no button (every row under 3 events), which is
 *   how QA opened on 5 Oct 2026 and why the helper hung there.
 * Which one QA shows depends on today's date and the seed, so each state
 * is made in the browser from the real listing: the real Jaipur event is
 * kept as it is (so the click really navigates) and, for the carousel
 * state, three copies of it are added as Open Mic a month out.
 * Read-only.
 */

async function serveListing(page: Page, withCarousel: boolean) {
  // Each test loads /events twice (its own check, then the helper's). The
  // real listing is fetched once and reused, so the second load is not a
  // second slow call to QA.
  let real: { id: string; title: string; date: string; type: string }[] | null = null;
  await page.route(
    (url) => /^\/api\/events\/?$/.test(url.pathname),
    async (route) => {
      if (!real) real = (await (await route.fetch()).json()) as typeof real;
      const jaipur = real!.find((e) => e.title === JAIPUR_EVENT_TITLE);
      expect(jaipur, "the listing API has Jaipur Mic Gala 100").toBeTruthy();
      const date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      // Midweek, so the copies never fall in This Weekend's range.
      while (date.getDay() === 0 || date.getDay() === 5 || date.getDay() === 6) date.setDate(date.getDate() + 1);
      const copies = withCarousel
        ? [0, 1, 2].map((i) => ({ ...jaipur!, id: `${jaipur!.id}-e2e-${i}`, title: `E2E carousel ${i}`, type: "OPEN_MIC", date: date.toISOString() }))
        : [];
      // Jaipur itself as some other type, so it never adds a 4th to the copies' row.
      const events = [{ ...jaipur!, type: withCarousel ? "THEATER" : jaipur!.type }, ...copies];
      await route.fulfill({ json: events });
    }
  );
}

test("[BUG-2610-013] phone /events with carousels: the helper goes through 'See all events' to the event", async ({ page, isMobile }) => {
  expect(isMobile).toBe(true);
  await serveListing(page, true);
  await page.goto("/events/");
  await expect(page.getByRole("button", { name: /see all events/i }), "this state shows the carousel rows").toBeVisible();
  await openEventFromListing(page, JAIPUR_EVENT_TITLE, isMobile);
  await expect(page.getByRole("heading", { level: 1, name: JAIPUR_EVENT_TITLE })).toBeVisible();
});

test("[BUG-2610-013] phone /events with no carousel (too few events): the helper opens the event from the plain list", async ({ page, isMobile }) => {
  expect(isMobile).toBe(true);
  await serveListing(page, false);
  await page.goto("/events/");
  await expect(page.getByRole("link", { name: new RegExp(JAIPUR_EVENT_TITLE, "i") }).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /see all events/i }), "this state has no carousel rows").toHaveCount(0);
  await openEventFromListing(page, JAIPUR_EVENT_TITLE, isMobile);
  await expect(page.getByRole("heading", { level: 1, name: JAIPUR_EVENT_TITLE })).toBeVisible();
});
