import { test, expect } from "./helpers/test";
import { JAIPUR_EVENT_TITLE, openEventFromListing } from "./helpers/events";

/**
 * No-auth smoke tests. These need no test account and no OTP, so they're
 * the fastest signal that the site is up and the framework itself is wired
 * correctly. Good candidate to run on every PR before anything heavier.
 */

test("homepage loads and shows persona value props", async ({ page }) => {
  await page.goto("/");
  // Real title has spaces: "A for Audience — Where Art Finds Its Crowd" -
  // not "AforAudience" as one word (confirmed via a real QA run, 22 Jul).
  await expect(page).toHaveTitle(/A\s*for\s*Audience/i);
});

test("events listing renders at least one published event", async ({ page }) => {
  await page.goto("/events");
  await expect(page.locator("body")).not.toContainText(/something went wrong/i);
  // A real list, not an empty or error state: at least one event card is
  // on the page. Every card is a link holding the event title as an h3.
  await expect(page.getByRole("link").filter({ has: page.getByRole("heading", { level: 3 }) }).first()).toBeVisible();
});

test("Jaipur Mic Gala 100 event detail page loads and offers seat selection", async ({ page, isMobile }) => {
  await openEventFromListing(page, JAIPUR_EVENT_TITLE, isMobile);
  await expect(page.getByRole("heading", { level: 1, name: JAIPUR_EVENT_TITLE })).toBeVisible();
  // Numbered event: the seat map lives on its own page, linked from here
  // (the seat picker itself is exercised in registration.spec.ts).
  await expect(page.getByRole("link", { name: /select tickets/i }).first()).toHaveAttribute(
    "href",
    /\/events\/[^/]+\/seats\/?$/
  );
});
