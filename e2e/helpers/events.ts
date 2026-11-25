import { Locator, Page, expect } from "@playwright/test";
import { gotoDashboard } from "./test";

/**
 * "Jaipur Mic Gala 100": the seeded NUMBERED-seat event (scripts/qa-seed.ts
 * keeps it dated in the future on every reseed). Literal title, used by the
 * smoke, seat-booking and language specs.
 */
export const JAIPUR_EVENT_TITLE = "Jaipur Mic Gala 100";

/**
 * Opens the artist's "Browse Events" page with every city showing, and
 * waits until `target` (something on a card there) stays visible.
 *
 * The page first lists everything, then narrows itself to the artist's own
 * city once its city list and /api/user/location have both answered
 * (Hrithik: Ballari; the buy-in fixture event is in Bengaluru), so a card
 * seen before that vanishes, and a click made too early is undone. Let the
 * page finish its own requests, then choose "All Cities" until `target`
 * stays. (Moved here from waitlist-wallet-credit.spec.ts; colour-closeout
 * measured before the narrowing and failed once responses got faster.)
 */
export async function openArtistEventsAllCities(page: Page, target: Locator) {
  await gotoDashboard(page, "/dashboard/artist/events");
  await page.waitForLoadState("networkidle");
  await expect(async () => {
    // By value: the "All Cities" sentinel; the label is translated (GEN-2610-007).
    await page.getByRole("main").getByRole("combobox").selectOption("All Cities");
    await expect(target).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 15_000 });
}

/**
 * Opens an event from the /events listing by its title, the way a visitor
 * does, and waits for the detail page.
 *
 * On mobile the listing opens as carousel rows of a few events each
 * (GEN-2609-012); the full list is behind "See all events". The specs that
 * predate that looked for the card straight away and hung on mobile.
 *
 * Those rows only render when one of them (tonight, this weekend, a type)
 * holds 3+ upcoming events; with fewer, the page shows the plain list and
 * there is no button (BUG-2610-013: QA's seeded events aged out and the
 * helper waited 15 s for a button that was never coming). So: wait for
 * whichever shows first, the button or the plain list, and click the
 * button only if that is what the page offers.
 */
export async function openEventFromListing(page: Page, title: string, isMobile: boolean) {
  await page.goto("/events");
  // The whole card is one role="link" whose accessible name is the full
  // card text. Match on the unique title: every card shares the rest.
  // A carousel card has the same name, so take a visible one.
  const card = page.getByRole("link", { name: new RegExp(escapeRegExp(title), "i") }).filter({ visible: true }).first();
  if (isMobile) {
    const seeAll = page.getByRole("button", { name: /see all events/i });
    await expect(seeAll.or(card).first()).toBeVisible();
    if (await seeAll.isVisible()) await seeAll.click();
  }
  await card.click();
  // Require an id segment after /events/ - a looser pattern matches the
  // listing itself and would pass with no navigation at all.
  await expect(page).toHaveURL(/\/events\/[^/?]+\/?($|\?)/);
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type PickedSeat = { label: string; price: number };

/**
 * Picks a seat the server says is free, on the event's seat page (already
 * open). The seat list comes from GET /api/events/<id>/seats - the same
 * call the picker renders from - and only `status: "available"` seats
 * with a price are candidates, so a CONFIRMED or live PENDING booking on
 * QA (Hitesh's C3/C5/B3/B5, Atul's F5-F8, whatever a run left held) is
 * never chosen. The tile is then found by its exact tooltip and clicked.
 */
export async function pickAvailableSeat(page: Page): Promise<PickedSeat> {
  const id = page.url().match(/\/events\/([^/?]+)\/seats/)?.[1];
  expect(id, `not on a seat page: ${page.url()}`).toBeTruthy();
  const res = await page.request.get(`/api/events/${id}/seats`);
  expect(res.ok()).toBeTruthy();
  const { seats } = (await res.json()) as { seats: SeatApiRow[] };
  const free = seats.filter((s) => s.status === "available" && s.price !== null);
  expect(free.length, "no available seat left on this event").toBeGreaterThan(0);
  for (const s of free) {
    const tile = page.getByTitle(`Row ${s.row}, Seat ${s.number} — ₹${s.price}`, { exact: true });
    // A multi-level venue shows one level at a time; take the first free
    // seat that is on screen.
    if ((await tile.count()) === 1 && (await tile.isVisible())) {
      await tile.click();
      return { label: `${s.row}${s.number}`, price: s.price! };
    }
  }
  throw new Error(`none of the ${free.length} available seats has a visible tile`);
}

export type SeatApiRow = { id: string; row: string; number: number; price: number | null; status: "available" | "taken" | "priceUnset" };
