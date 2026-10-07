import type { Page } from "@playwright/test";
import { test, expect, gotoDashboard, AFTER_WRITE } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { useRuleViewport } from "./helpers/viewports";
import { withQaDb } from "./helpers/qa-db";

/**
 * BUG-2609-073 - the Flexible Requests badge. It counted every PENDING
 * request on the user's single account role, so Omkar (Organiser + Venue
 * Owner) saw the same number on both of his "Flexible Requests" items for
 * a request that was waiting on the venue, not on him; and it was fetched
 * once per page, so Vinayak's badge still said 1 after he declined.
 * It now counts, per held role, only the requests waiting on this user's
 * action, and refetches after an accept, counter or decline.
 *
 * The spec makes its own request (Omkar's organisation -> one of
 * Vinayak's venues, Omkar's offer last, so it waits on Vinayak) through
 * the QA database, Vinayak declines it in the app, and it is deleted
 * afterwards. Hence @needs-db.
 */

const OMKAR = "omkar.organiser@aforaudience.qa";
const VINAYAK = "vinayak.venue@aforaudience.qa";
const ID_PREFIX = "e2eflexbadge";

type Waiting = { ORGANISER: number; VENUE_OWNER: number };

/** What each of a user's "Flexible Requests" items should show, read straight from the database. */
async function waitingFor(email: string): Promise<Waiting> {
  return withQaDb(async (db) => {
    const lastOffer = `(SELECT o."proposedBy"::text FROM "VenueBookingOffer" o WHERE o."requestId" = r.id ORDER BY o."createdAt" DESC LIMIT 1)`;
    const lastAt = `(SELECT MAX(o."createdAt") FROM "VenueBookingOffer" o WHERE o."requestId" = r.id)`;
    const inWindow = `(${lastAt} IS NULL OR ${lastAt} > now() - interval '48 hours')`;
    const { rows } = await db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM "VenueBookingRequest" r JOIN "Organiser" g ON g.id = r."organiserId" JOIN "User" u ON u.id = g."userId"
           WHERE u.email = $1 AND r.status = 'PENDING' AND ${lastOffer} = 'VENUE_OWNER' AND ${inWindow}) AS organiser,
         (SELECT COUNT(*)::int FROM "VenueBookingRequest" r JOIN "Venue" v ON v.id = r."venueId" JOIN "VenueOwner" vo ON vo.id = v."ownerId" JOIN "User" u ON u.id = vo."userId"
           WHERE u.email = $1 AND r.status = 'PENDING' AND COALESCE(${lastOffer}, 'ORGANISER') = 'ORGANISER' AND ${inWindow}) AS venue`,
      [email],
    );
    return { ORGANISER: rows[0].organiser, VENUE_OWNER: rows[0].venue };
  });
}

/** The number on each visible "Flexible Requests" / "Requests" link, in page order (0 = no badge). */
async function flexBadges(page: Page): Promise<number[]> {
  const links = page.locator('a[href^="/dashboard/venue-requests"]').filter({ visible: true });
  const texts = await links.allInnerTexts();
  return texts.map((t) => Number(t.match(/\b(\d+)\b/)?.[1] ?? 0));
}

/**
 * Deletes this run's request, or (with no id) leftovers of runs that died
 * before their own clean-up - only those over an hour old, so a run going
 * on at the same time (another branch's preview) keeps its request.
 */
async function deleteSpecRequests(requestId?: string) {
  await withQaDb(async (db) => {
    const ids = requestId
      ? [requestId]
      : (
          await db.query(`SELECT id FROM "VenueBookingRequest" WHERE id LIKE $1 AND "createdAt" < now() - interval '1 hour'`, [
            `${ID_PREFIX}%`,
          ])
        ).rows.map((r: { id: string }) => r.id);
    if (ids.length === 0) return;
    await db.query(`DELETE FROM "VenueBookingOffer" WHERE "requestId" = ANY($1)`, [ids]);
    await db.query(`DELETE FROM "VenueBookingRequest" WHERE id = ANY($1)`, [ids]);
  });
}

test.describe("@needs-db Flexible Requests badge", () => {
  test.describe.configure({ mode: "serial" });

  const stamp = `${Date.now()}`;
  const requestId = `${ID_PREFIX}${stamp}`;
  const note = `E2E BUG-2609-073 ${stamp}`;

  test.beforeAll(async () => {
    await deleteSpecRequests();
    await withQaDb(async (db) => {
      const { rows } = await db.query(
        `SELECT g.id AS "organiserId", (SELECT v.id FROM "Venue" v JOIN "VenueOwner" vo ON vo.id = v."ownerId" JOIN "User" vu ON vu.id = vo."userId"
                WHERE vu.email = $2 ORDER BY v."createdAt" LIMIT 1) AS "venueId"
           FROM "Organiser" g JOIN "User" u ON u.id = g."userId" WHERE u.email = $1`,
        [OMKAR, VINAYAK],
      );
      expect(rows[0]?.venueId, "Omkar has an organisation and Vinayak a venue on QA").toBeTruthy();
      // A date far ahead, so it can never meet a real booking.
      await db.query(
        `INSERT INTO "VenueBookingRequest" (id, "organiserId", "venueId", "requestedDate", "durationHours", status, "createdAt")
         VALUES ($1, $2, $3, now() + interval '400 days', 2, 'PENDING', now())`,
        [requestId, rows[0].organiserId, rows[0].venueId],
      );
      await db.query(
        `INSERT INTO "VenueBookingOffer" (id, "requestId", "proposedBy", amount, comment, "createdAt") VALUES ($1, $2, 'ORGANISER', 1234, $3, now())`,
        [`${requestId}o1`, requestId, note],
      );
    });
  });

  test.afterAll(async () => {
    await deleteSpecRequests(requestId);
  });

  test("[BUG-2609-073] Omkar's items count only requests waiting on him, per role - not his request that waits on the venue", async ({
    newContext,
    isMobile,
  }) => {
    const context = await newContext({ storageState: authFile("omkar") });
    const page = await context.newPage();
    await useRuleViewport(page, isMobile);
    const expected = await waitingFor(OMKAR);
    await gotoDashboard(page, "/dashboard/venue-requests");
    await expect(page.getByText(note)).toBeVisible();
    // Let the badge fetch answer before reading it.
    await page.waitForLoadState("networkidle");

    const badges = await flexBadges(page);
    expect(badges.length, "a Flexible Requests link is on the page").toBeGreaterThan(0);
    if (isMobile) {
      // One bottom bar; which role's depends on the route. Either way it is that role's own count.
      expect([expected.ORGANISER, expected.VENUE_OWNER]).toContain(badges[0]);
    } else {
      // The sidebar: the Organiser section, then the Venue Owner section.
      expect(badges).toEqual([expected.ORGANISER, expected.VENUE_OWNER]);
    }
  });

  test("[BUG-2609-073] Vinayak declines the request and his badge drops at once, without a reload", async ({ newContext, isMobile }) => {
    const context = await newContext({ storageState: authFile("vinayak") });
    const page = await context.newPage();
    await useRuleViewport(page, isMobile);
    const before = await waitingFor(VINAYAK);
    expect(before.VENUE_OWNER, "the spec's request waits on Vinayak").toBeGreaterThan(0);

    await gotoDashboard(page, "/dashboard/venue-requests");
    await expect.poll(async () => (await flexBadges(page))[0]).toBe(before.VENUE_OWNER);

    const card = page
      .getByRole("main")
      .locator("div")
      .filter({ hasText: note })
      .filter({ has: page.getByRole("button", { name: "Decline" }) })
      .last();
    let reloaded = false;
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) reloaded = true;
    });
    await card.getByRole("button", { name: "Decline" }).click();
    await expect(page.getByText("Request declined.")).toBeVisible(AFTER_WRITE);

    await expect.poll(async () => (await flexBadges(page))[0], AFTER_WRITE).toBe(before.VENUE_OWNER - 1);
    expect(reloaded, "the page did not reload").toBe(false);
  });
});
