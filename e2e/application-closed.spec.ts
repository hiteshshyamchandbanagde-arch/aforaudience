import { test, expect, gotoDashboard, hideFloatingOverlays } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { useRuleViewport } from "./helpers/viewports";
import { withQaDb } from "./helpers/qa-db";

/**
 * BUG-2610-022: an application for an event that has already happened can
 * no longer be decided. Its stored status stays PENDING (no migration);
 * every screen derives "Closed" from the event's date
 * (src/lib/application-status.ts, unit-tested in
 * scripts/application-status.test.ts):
 *   - Omkar's nav badge (/api/notifications/pending-count) and his per-event
 *     "N pending applications" leave it out; his event page shows it Closed
 *     with no Approve/Reject (Hitesh's 8 Oct phone check: the badge read 1
 *     for Hrithik's PENDING application on One-Act Play Festival, 20 Sep);
 *   - Hrithik's My Applications shows it Closed (neutral pill), upcoming
 *     first (soonest first), then a Past divider, then past (most recent first);
 *   - Hrithik's Reviews header draws his 4.5 average as 4.5 stars, not 5.
 *
 * Positive control: a PENDING application by Hrithik on Omkar's upcoming
 * Improv Theatre Jam is seeded, so the badge has something it must count.
 * It is deleted after each test (and before, in case a crashed run left it), T6.
 */

const PAST_APP = { id: "qa-demo-app-full-hrithik-4", eventId: "qa-demo-event-full-4", title: "One-Act Play Festival" };
const OPEN_APP = { id: "e2e-bug-2610-022-open-app", eventId: "qa-demo-event-full-9", title: "Improv Theatre Jam" };
const HRITHIK_ARTIST = "qa-demo-artist-full-role";
const OMKAR_USER = "qa-demo-org-full";

async function removeSeeded() {
  await withQaDb((db) => db.query(`DELETE FROM "Application" WHERE id = $1`, [OPEN_APP.id]));
}

test.beforeEach(async () => {
  await removeSeeded();
  await withQaDb(async (db) => {
    const { rows } = await db.query(`SELECT status FROM "Application" WHERE id = $1`, [PAST_APP.id]);
    expect(rows[0]?.status, "Hrithik's One-Act Play Festival application is still PENDING in QA").toBe("PENDING");
    await db.query(
      `INSERT INTO "Application" (id, "eventId", "artistId", message, status) VALUES ($1, $2, $3, 'e2e BUG-2610-022 control', 'PENDING')`,
      [OPEN_APP.id, OPEN_APP.eventId, HRITHIK_ARTIST]
    );
  });
});

test.afterEach(async () => {
  await removeSeeded();
});

test.describe("Omkar", () => {
  test.use({ storageState: authFile("omkar") });

  test("[BUG-2610-022] organiser badge and per-event count leave out a past-event PENDING application; it shows Closed @needs-db", async ({ page, isMobile }) => {
    await useRuleViewport(page, isMobile);
    // What the badge must be: Omkar's PENDING flexible requests + PENDING
    // applications whose event is still ahead (the seeded control).
    const expected = await withQaDb(async (db) => {
      const flex = await db.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM "VenueBookingRequest" r JOIN "Organiser" o ON o.id = r."organiserId" WHERE o."userId" = $1 AND r.status = 'PENDING'`,
        [OMKAR_USER]
      );
      const apps = await db.query<{ id: string }>(
        `SELECT a.id FROM "Application" a JOIN "Event" e ON e.id = a."eventId" JOIN "Organiser" o ON o.id = e."organiserId"
          WHERE o."userId" = $1 AND a.status = 'PENDING' AND e.date > now() + interval '1 day'`,
        [OMKAR_USER]
      );
      return { count: flex.rows[0].n + apps.rows.length, upcomingIds: apps.rows.map((r) => r.id) };
    });
    expect(expected.upcomingIds, "the seeded control counts").toContain(OPEN_APP.id);
    expect(expected.upcomingIds, "the past-event application is not upcoming").not.toContain(PAST_APP.id);

    const res = await page.request.get("/api/notifications/pending-count");
    expect(res.ok()).toBe(true);
    expect((await res.json()).count, "badge = flexible requests + upcoming PENDING applications, without One-Act Play Festival").toBe(expected.count);

    // Dashboard cards: the past event has no "pending application" line; the upcoming one does.
    await gotoDashboard(page, "/dashboard/organiser/");
    const card = (eventId: string) => page.locator(`[data-afa-event-card="${eventId}"]`);
    await expect(card(OPEN_APP.eventId).getByText(/\d+ pending applications?/), "upcoming event counts its pending application").toBeVisible();
    await expect(card(PAST_APP.eventId), "One-Act Play Festival is on Omkar's dashboard").toBeVisible();
    await expect(card(PAST_APP.eventId).getByText(/pending application/), "past event: no pending count").toHaveCount(0);

    // Event page: Closed, nothing to decide.
    await gotoDashboard(page, `/dashboard/organiser/events/${PAST_APP.eventId}/`);
    const row = page.locator(`[data-afa-application="${PAST_APP.id}"]`);
    await expect(row).toBeVisible();
    await expect(row).toContainText(/closed/i);
    await expect(row).not.toContainText(/pending/i);
    await expect(row.getByRole("button", { name: /Approve|Reject/ }), "no Approve/Reject on a closed application").toHaveCount(0);
    await hideFloatingOverlays(page);
    await expect(row).toHaveScreenshot(`application-closed-organiser-${isMobile ? 390 : 1440}.png`, { animations: "disabled" });

    // The upcoming one keeps its actions.
    await gotoDashboard(page, `/dashboard/organiser/events/${OPEN_APP.eventId}/`);
    const open = page.locator(`[data-afa-application="${OPEN_APP.id}"]`);
    await expect(open).toContainText(/pending/i);
    await expect(open.getByRole("button", { name: "Approve" })).toBeVisible();
  });
});

test.describe("Hrithik", () => {
  test.use({ storageState: authFile("hrithik") });

  test("[BUG-2610-022] artist My Applications: past PENDING shows Closed, upcoming first then Past; 4.5 rating is 4.5 stars @needs-db", async ({ page, isMobile }) => {
    await useRuleViewport(page, isMobile);
    // Expected order from the database, by the event's start as Hitesh sees
    // it: its India-time day at startTime (the raw Event.date timestamp is
    // not a start time; two QA events on 5 Dec 19:00 differ in it by 81 ms).
    // Upcoming soonest first, then past most recent first; the same start:
    // event title, then application id.
    const order = await withQaDb(async (db) => {
      const { rows } = await db.query<{ id: string; title: string; at: Date }>(
        `SELECT a.id, e.title,
                (((e.date AT TIME ZONE 'Asia/Kolkata')::date + COALESCE(NULLIF(e."startTime", ''), '23:59')::time) AT TIME ZONE 'Asia/Kolkata') AS at
           FROM "Application" a JOIN "Event" e ON e.id = a."eventId" WHERE a."artistId" = $1`,
        [HRITHIK_ARTIST]
      );
      const t = (r: { at: Date }) => new Date(r.at).getTime();
      const text = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0);
      const tie = (a: { id: string; title: string }, b: { id: string; title: string }) => text(a.title, b.title) || text(a.id, b.id);
      const now = Date.now();
      const upcoming = rows.filter((r) => t(r) > now).sort((a, b) => t(a) - t(b) || tie(a, b)).map((r) => r.id);
      const past = rows.filter((r) => t(r) <= now).sort((a, b) => t(b) - t(a) || tie(a, b)).map((r) => r.id);
      return { upcoming, past };
    });
    expect(order.upcoming.length, "Hrithik has upcoming applications").toBeGreaterThan(0);
    expect(order.past, "One-Act Play Festival is past").toContain(PAST_APP.id);

    await gotoDashboard(page, "/dashboard/artist/");
    const apps = page.locator("[data-afa-application]");
    await expect(apps.first()).toBeVisible({ timeout: 20_000 });
    const shown = await apps.evaluateAll((els) => els.map((el) => el.getAttribute("data-afa-application")));
    expect(shown, "upcoming (soonest first), then past (most recent first)").toEqual([...order.upcoming, ...order.past]);

    // The Past divider sits right before the first past application.
    const divider = page.locator("[data-afa-applications-past-divider]");
    await expect(divider).toHaveText("Past");
    const next = await divider.evaluate((el) => el.nextElementSibling?.getAttribute("data-afa-application"));
    expect(next, "first item after the divider").toBe(order.past[0]);

    const closed = page.locator(`[data-afa-application="${PAST_APP.id}"]`);
    await expect(closed).toContainText(PAST_APP.title);
    await expect(closed).toContainText(/closed/i);
    await expect(closed).not.toContainText(/pending/i);
    // Neutral pill, not the gold PENDING one.
    const pill = closed.locator('[data-afa-status="CLOSED"]');
    const bg = await pill.evaluate((el) => getComputedStyle(el).backgroundColor);
    const gold = await page.locator(`[data-afa-application="${OPEN_APP.id}"] [data-afa-status="PENDING"]`).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg, "Closed pill is not the gold pending tint").not.toBe(gold);
    await hideFloatingOverlays(page);
    await expect(closed).toHaveScreenshot(`application-closed-artist-${isMobile ? 390 : 1440}.png`, { animations: "disabled" });

    // Reviews header: 4.5 average = 4 whole stars + a half star, labelled 4.5.
    const summary = page.locator("[data-afa-reviews-summary]");
    const stars = summary.locator("[data-afa-rating-stars]");
    await expect(stars).toHaveAttribute("aria-label", "4.5 out of 5");
    await expect(stars.locator("[data-afa-half-star]")).toHaveCount(1);
    // BUG-2610-025: each star is the app's star icon (an SVG), no longer the ⭐ emoji.
    await expect(stars.locator(':scope > svg[data-afa-icon="star"]'), "four whole stars").toHaveCount(4);
    await expect(stars.locator('[data-afa-half-star] > svg[data-afa-icon="star"]')).toHaveCount(1);
    await expect(summary).toContainText("4.5");
    await expect(summary).toHaveScreenshot(`reviews-summary-${isMobile ? 390 : 1440}.png`, { animations: "disabled" });
  });
});
