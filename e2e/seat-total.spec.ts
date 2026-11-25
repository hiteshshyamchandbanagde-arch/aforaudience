import type { Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { useRuleViewport } from "./helpers/viewports";
import { withQaDb } from "./helpers/qa-db";

/**
 * Seat page price summary with no seats chosen (4 Oct visual check,
 * dispatch C item 6): a paid event said "0 seats ... Free". It now shows
 * no amount ("—") until a seat is chosen; "Free" stays for free events
 * only. At 390 and 1440, signed out, nothing chosen or written.
 */

// scripts/qa-seed.ts jaipurEventId: paid, numbered seats.
const JAIPUR = "qa-jaipur-event-0001";

/** The summary row under the seat choice: "<n> seats" and its amount. */
function summaryRow(page: Page) {
  return page
    .locator("div")
    .filter({ has: page.locator("> span", { hasText: /^0 seats$/ }) })
    .filter({ visible: true })
    .last();
}

test.beforeEach(async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
});

test("seat page (dispatch C item 6): paid event, no seats chosen: the total shows '—', not 'Free'", async ({ page }) => {
  await page.goto(`/events/${JAIPUR}/seats/`);
  const row = summaryRow(page);
  await expect(row).toBeVisible({ timeout: 20_000 });
  await expect(row.locator("> span").last()).toHaveText("—");
  await expect(row.getByText("Free", { exact: true })).toHaveCount(0);
});

/**
 * The free event is this spec's own row, dated 60 days from now, so it
 * never ages out. The spec used to pick "any upcoming free event" from
 * /api/events; the seed's last one (qa-general-event-05) went past on
 * 25 Oct and the nightly went red. Owned by the e2e fixture organiser, at a
 * general-admission QA venue; deleted before (a crashed run) and after (T6).
 */
const FREE_EVENT = "e2e-seat-total-free-event";

async function removeFreeEvent() {
  await withQaDb((db) => db.query(`DELETE FROM "Event" WHERE id = $1`, [FREE_EVENT]));
}

test.describe("free event", () => {
  test.beforeEach(async () => {
    await removeFreeEvent();
    await withQaDb(async (db) => {
      const { rows } = await db.query<{ seatingMode: string }>(`SELECT "seatingMode" FROM "Venue" WHERE id = 'qa-venue-08'`);
      expect(rows[0]?.seatingMode, "qa-venue-08 is general admission").toBe("GENERAL_ADMISSION");
      await db.query(
        `INSERT INTO "Event" (id, "organiserId", "venueId", title, description, type, status, date, "startTime", "endTime", "isFree", "totalSeats", "availableSeats", "updatedAt")
         VALUES ($1, 'e2efixtureorg0001org', 'qa-venue-08', 'E2E Fixture: Free Seat Total', 'A free show the seat-total spec creates and deletes.', 'OPEN_MIC', 'APPROVED',
                 date_trunc('day', now()) + interval '60 days', '19:00', '21:00', true, 50, 50, now())`,
        [FREE_EVENT]
      );
    });
  });

  test.afterEach(async () => {
    await removeFreeEvent();
  });

  test("seat page (dispatch C item 6): free event, no seats chosen: the total still says 'Free' @needs-db", async ({ page }) => {
    await page.goto(`/events/${FREE_EVENT}/seats/`);
    const row = summaryRow(page);
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row.locator("> span").last()).toHaveText("Free");
  });
});
