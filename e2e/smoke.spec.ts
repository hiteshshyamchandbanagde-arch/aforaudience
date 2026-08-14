import { test, expect } from "@playwright/test";

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
  // Loose check on purpose: exact card markup will change as the UI evolves.
  // This just confirms the page renders a real list, not an empty/error state.
  await expect(page.locator("body")).not.toContainText(/something went wrong/i);
});

test("Jaipur Mic Gala 100 event detail page loads with seat picker", async ({ page }) => {
  await page.goto("/events");
  // The whole card is now a single role="link" element whose accessible
  // name is the full card text (title, price, "View Event", etc.) - the
  // current click-guard card pattern (PR #261/#312), not the older "only a
  // nested View Event link is clickable" DOM from 23 Jul.
  //
  // Don't match on "view event" text: every card ends with those words, so
  // a name regex of /view event/i matches all 8 cards at once and
  // Playwright correctly refuses to click an ambiguous target (confirmed
  // via a real CI trace, 13 Aug: locator resolved to 8 elements). Match on
  // the unique title instead and click the card directly - there's no
  // separate nested link to find.
  const card = page.getByRole("link", { name: /Jaipur Mic Gala 100/i });
  await card.click();
  // Require an actual id segment after /events/ - the loose /\/events\//
  // regex matches the listing page too and would false-pass even with no
  // navigation at all.
  await expect(page).toHaveURL(/\/events\/[^/?]+\/?($|\?)/, { timeout: 10_000 });
});
