import { test, expect } from "./helpers/test";
import { JAIPUR_EVENT_TITLE, openEventFromListing } from "./helpers/events";
import { CLOCK_FORWARD_DAYS, HRITHIK_ARTIST_ID } from "./helpers/upcoming-fixtures";

/**
 * BUG-2610-013 - the specs that need an upcoming event, re-run with the
 * browser clock CLOCK_FORWARD_DAYS (30) days on. Both pages decide
 * "upcoming" in the browser (the /events tabs and carousels, the artist
 * profile's Upcoming shows), so this is a month of drift without waiting a
 * month. If a fixture were dated by hand, or the re-dating in
 * global-setup.ts stopped, these go red before the real clock gets there.
 *
 * Same steps as smoke.spec.ts (GEN-2609-004) and colour-rules.spec.ts
 * (GEN-2609-121, Hrithik's shows). Read-only.
 */

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(Date.now() + CLOCK_FORWARD_DAYS * 24 * 60 * 60 * 1000));
});

test("[BUG-2610-013] 30 days on: Jaipur Mic Gala 100 is still reachable from /events and offers seat selection", async ({ page, isMobile }) => {
  await openEventFromListing(page, JAIPUR_EVENT_TITLE, isMobile);
  await expect(page.getByRole("heading", { level: 1, name: JAIPUR_EVENT_TITLE })).toBeVisible();
  await expect(page.getByRole("link", { name: /select tickets/i }).first()).toHaveAttribute("href", /\/events\/[^/]+\/seats\/?$/);
});

test("[BUG-2610-013] 30 days on: Hrithik still has an upcoming show with a Book link", async ({ page }) => {
  await page.goto(`/artists/${HRITHIK_ARTIST_ID}/`);
  const shows = page.locator("h2", { hasText: /^Upcoming shows$/i }).locator("xpath=../..");
  await expect(shows.getByRole("link", { name: "Book" }).first(), "Hrithik has an upcoming show 30 days from now").toBeVisible();
});
