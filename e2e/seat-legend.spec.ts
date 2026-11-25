import { test, expect } from "./helpers/test";
import { useRuleViewport } from "./helpers/viewports";

/**
 * GEN-2609-010 - the seat map gets a price-tier legend (Figma v2
 * reconciliation): one entry per pricing zone with its price, in the
 * colour that zone's available seats are drawn in.
 *
 * On Jaipur Mic Gala 100 (the seeded NUMBERED event): the zones and
 * prices are read from the same /api/events/<id>/seats answer the seat
 * map draws from, and the legend must list exactly those, each with a
 * dot of its own colour. At 390 and 1440, signed out. Read-only.
 */

// scripts/qa-seed.ts jaipurEventId.
const EVENT_ID = "qa-jaipur-event-0001";

type Seat = { tierLabel: string; level: string | null; price: number | null };

test("[GEN-2609-010] Jaipur Mic Gala 100 seat map shows a price-tier legend matching its tiers", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  const res = await page.request.get(`/api/events/${EVENT_ID}/seats/`);
  expect(res.ok(), `GET /api/events/${EVENT_ID}/seats: HTTP ${res.status()}`).toBeTruthy();
  const { seats } = (await res.json()) as { seats: Seat[] };
  // The map opens on the first seat's level; the legend is for that level.
  const level = seats[0]?.level || "";
  const tiers = new Map<string, number | null>();
  for (const s of seats) if ((s.level || "") === level && !tiers.has(s.tierLabel)) tiers.set(s.tierLabel, s.price ?? null);
  expect(tiers.size, "the fixture has pricing zones").toBeGreaterThan(0);
  const expected = [...tiers].map(([zone, price]) => `${zone} — ${price ? `₹${price}` : "not on sale"}`);

  await page.goto(`/events/${EVENT_ID}/seats/`);
  const entries = page.getByText(/^.+ — (₹\d+|not on sale)$/).filter({ visible: true });
  await expect(entries.first()).toBeVisible();
  expect(await entries.allInnerTexts(), "legend entries, in zone order").toEqual(expected);

  // Each entry's dot is a colour of its own.
  const dots = await entries.evaluateAll((els) => els.map((el) => getComputedStyle(el.firstElementChild as Element).backgroundColor));
  expect(dots.every((c) => c && c !== "rgba(0, 0, 0, 0)"), `every entry has a coloured dot: ${dots.join(", ")}`).toBe(true);
  expect(new Set(dots).size, "one colour per zone").toBe(dots.length);
});
