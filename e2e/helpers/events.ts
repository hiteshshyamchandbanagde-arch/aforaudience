import { Page, expect } from "@playwright/test";

/**
 * "Jaipur Mic Gala 100": the seeded NUMBERED-seat event (scripts/qa-seed.ts
 * keeps it dated in the future on every reseed). Literal title, used by the
 * smoke, seat-booking and language specs.
 */
export const JAIPUR_EVENT_TITLE = "Jaipur Mic Gala 100";

/**
 * Opens an event from the /events listing by its title, the way a visitor
 * does, and waits for the detail page.
 *
 * On mobile the listing opens as carousel rows of a few events each
 * (GEN-2609-012); the full list is behind "See all events". The specs that
 * predate that looked for the card straight away and hung on mobile.
 */
export async function openEventFromListing(page: Page, title: string, isMobile: boolean) {
  await page.goto("/events");
  if (isMobile) {
    await page.getByRole("button", { name: /see all events/i }).click();
  }
  // The whole card is one role="link" whose accessible name is the full
  // card text. Match on the unique title: every card shares the rest.
  await page.getByRole("link", { name: new RegExp(escapeRegExp(title), "i") }).click();
  // Require an id segment after /events/ - a looser pattern matches the
  // listing itself and would pass with no navigation at all.
  await expect(page).toHaveURL(/\/events\/[^/?]+\/?($|\?)/);
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
