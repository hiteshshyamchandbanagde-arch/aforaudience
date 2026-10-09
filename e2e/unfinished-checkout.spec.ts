import { test, expect } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { useRuleViewport } from "./helpers/viewports";
import { withQaDb } from "./helpers/qa-db";

/**
 * BUG-2610-018: an unpaid PENDING hold whose payment window has run out is
 * not a ticket. On My Tickets it never gets a ticket card; at most one
 * compact "Unfinished checkout · Book again" row per event, only within
 * 24 h of the hold's expiry and only if there is no CONFIRMED booking for
 * that event (src/lib/unfinished-checkout.ts, unit-tested in
 * scripts/unfinished-checkout.test.ts).
 *
 * As Atul, at 390 and 1440. Two holds are seeded, both expired an hour ago:
 *   - on Jaipur Mic Gala 100, where Atul already has CONFIRMED tickets
 *     (Hitesh's 7 Oct case): nothing shows for it beyond the confirmed cards;
 *   - on Improv Theatre Jam, where Atul has no booking: one compact row.
 * Atul's own older expired holds in QA (30 Sep, 2 Oct, 15 Sep) are past
 * the 24 h window: no card and no row. The seeded rows are deleted after
 * the test (and before it, in case a crashed run left them), T6.
 */

const JAIPUR = { id: "qa-jaipur-event-0001", title: "Jaipur Mic Gala 100" };
const IMPROV = { id: "qa-demo-event-full-9", title: "Improv Theatre Jam" };
const HOLD_CONFIRMED_EVENT = "e2e-bug-2610-018-hold-jaipur";
const HOLD_RECENT = "e2e-bug-2610-018-hold-improv";
const SEEDED = [HOLD_CONFIRMED_EVENT, HOLD_RECENT];

test.use({ storageState: authFile("atul") });

async function removeSeeded() {
  await withQaDb((db) => db.query(`DELETE FROM "Booking" WHERE id = ANY($1::text[])`, [SEEDED]));
}

test.beforeEach(async () => {
  await removeSeeded();
  await withQaDb(async (db) => {
    const { rows } = await db.query<{ id: string }>(`SELECT id FROM "User" WHERE email = 'atul.audience@aforaudience.qa'`);
    expect(rows, "Atul is in QA").toHaveLength(1);
    for (const [id, eventId] of [[HOLD_CONFIRMED_EVENT, JAIPUR.id], [HOLD_RECENT, IMPROV.id]]) {
      await db.query(
        `INSERT INTO "Booking" (id, "userId", "eventId", seats, "totalAmount", "subtotalAmount", status, "createdAt", "expiresAt")
         VALUES ($1, $2, $3, '{"General": 1}'::jsonb, 510, 500, 'PENDING', now() - interval '75 minutes', now() - interval '1 hour')`,
        [id, rows[0].id, eventId]
      );
    }
  });
});

test.afterEach(async () => {
  await removeSeeded();
});

test("[BUG-2610-018] My Tickets: an expired unpaid hold is never a ticket card; one compact Unfinished checkout row within 24 h @needs-db", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  let bookings: { id: string; status: string; event: { id: string } }[] = [];
  await page.route(/\/api\/bookings\/my\/?$/, async (route) => {
    const res = await route.fetch();
    bookings = await res.json();
    await route.fulfill({ response: res, json: bookings });
  });
  await page.goto("/tickets/");
  const main = page.locator("main");
  await expect(main.getByText("Confirmed", { exact: true }).first(), "Atul's tickets loaded").toBeVisible({ timeout: 20_000 });
  expect(bookings.map((b) => b.id), "the API still returns the seeded holds (no data change)").toEqual(expect.arrayContaining(SEEDED));

  // No expired hold renders as a ticket card, old or new.
  await expect(main.getByText("Expired — book again", { exact: true }), "no Expired ticket cards").toHaveCount(0);

  // Jaipur Mic Gala 100: only the confirmed cards, no row.
  const jaipurConfirmed = bookings.filter((b) => b.event.id === JAIPUR.id && b.status === "CONFIRMED").length;
  expect(jaipurConfirmed, "Atul holds confirmed Jaipur tickets in QA").toBeGreaterThan(0);
  await expect(main.locator("h3", { hasText: JAIPUR.title }), "Jaipur: only the confirmed cards").toHaveCount(jaipurConfirmed);
  await expect(page.locator(`[data-afa-unfinished-checkout="${HOLD_CONFIRMED_EVENT}"]`), "no row next to a confirmed booking").toHaveCount(0);

  // Improv Theatre Jam: one compact row, not a card.
  const rows = page.locator("[data-afa-unfinished-checkout]");
  await expect(rows, "exactly one Unfinished checkout row (the older holds are past 24 h)").toHaveCount(1);
  const row = page.locator(`[data-afa-unfinished-checkout="${HOLD_RECENT}"]`);
  await expect(row).toBeVisible();
  await expect(row).toContainText("Unfinished checkout");
  await expect(row).toContainText(IMPROV.title);
  await expect(row.getByRole("link", { name: "Book again" })).toHaveAttribute("href", new RegExp(`/events/${IMPROV.id}/?$`));
  await expect(main.locator("h3", { hasText: IMPROV.title }), "no Improv ticket card").toHaveCount(0);
  const box = (await row.boundingBox())!;
  expect(box.height, "the row is compact, not a ticket card").toBeLessThan(80);

  await expect(page.locator("[data-afa-unfinished-checkouts]")).toHaveScreenshot(`unfinished-checkout-${isMobile ? 390 : 1440}.png`, {
    animations: "disabled",
    // The fixture event is re-dated forward as the clock walks on.
    mask: [page.locator("[data-afa-unfinished-date]")],
  });
});
