import { test, expect } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { useRuleViewport } from "./helpers/viewports";
import { JAIPUR_EVENT_TITLE, openArtistEventsAllCities } from "./helpers/events";

/**
 * BUG-2609-079 - an event priced by TicketTier (Event.ticketPrice null)
 * showed "–" on its card. Since BUG-2610-003 the listing carried the
 * cheapest tier's price, but as a plain "₹250" that reads as the one
 * price. Every card that shows Event.ticketPrice now says "From ₹<cheapest
 * tier>" for such an event (EventCard's eventPriceLabel); the saved and
 * organiser lists get the tier price too (scripts/booking-tiers.test.ts).
 *
 * Jaipur Mic Gala 100 is QA's one tiered event (one tier, General ₹250).
 * At 390 and 1440. Read-only.
 */

test.beforeEach(async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
});

test("[BUG-2609-079] the /events card of a tiered event reads 'From ₹<cheapest tier>'", async ({ page }) => {
  await page.goto(`/events/?search=${encodeURIComponent(JAIPUR_EVENT_TITLE)}`);
  const card = page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { level: 3, name: JAIPUR_EVENT_TITLE }) })
    .filter({ visible: true })
    .first();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card).toContainText(/From ₹250(?!\d)/);
  await expect(card.getByText(/^[–—]$/)).toHaveCount(0);
});

test("[BUG-2609-079] a flat-priced event's card keeps its plain price, no 'From'", async ({ page }) => {
  const res = await page.request.get("/api/events/");
  type Listed = { title: string; date: string; status: string; isFree: boolean; ticketPrice: number | null; priceFromTiers?: boolean };
  const events = (await res.json()) as Listed[];
  // Upcoming (the /events default tab) and a plain title the search matches as typed.
  const flat = events.find(
    (e) => !e.isFree && e.ticketPrice && !e.priceFromTiers && e.status === "APPROVED" && new Date(e.date) > new Date() && /^[\w ]+$/.test(e.title),
  );
  expect(flat, "QA lists a flat-priced upcoming event").toBeTruthy();

  await page.goto(`/events/?search=${encodeURIComponent(flat!.title)}`);
  const card = page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { level: 3, name: flat!.title }) })
    .filter({ visible: true })
    .first();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card).toContainText(`₹${flat!.ticketPrice}`);
  await expect(card).not.toContainText(/from ₹/i);
});

test.describe("signed in as Hrithik", () => {
  test.use({ storageState: authFile("hrithik") });

  test("[BUG-2609-079] artist Browse Events: a tiered event's 'Audience pays' reads 'From ₹<cheapest tier>'", async ({ page }) => {
    const card = page
      .getByRole("main")
      .locator("div")
      .filter({ has: page.getByRole("heading", { level: 3, name: JAIPUR_EVENT_TITLE }) })
      .filter({ hasText: "Audience pays" })
      .last();
    await openArtistEventsAllCities(page, card);
    await expect(card.getByText(/^Audience pays:/)).toHaveText(/Audience pays: From ₹250$/);
  });
});
