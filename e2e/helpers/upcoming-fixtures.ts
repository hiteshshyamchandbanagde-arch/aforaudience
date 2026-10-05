import type { ClientBase } from "pg";

/**
 * The seeded events the suite needs to stay UPCOMING (BUG-2610-013).
 *
 * scripts/qa-seed.ts dates its events relative to the day it runs, then
 * nobody reruns it: the clock walks past them and specs that need "an
 * upcoming show" go red with no code change (5 Oct 2026: Hrithik's last
 * upcoming show, "Full House Open Mic", went past on 4 Oct).
 *
 * Instead of bumping dates by hand (which rots again), global-setup.ts
 * moves each of these forward at the start of every run that has the QA
 * database, whenever it has come closer than MIN_DAYS_AHEAD. The same
 * rule is in the seed (keepFixturesUpcoming is imported there too).
 * seed-health.spec.ts then checks, before any other spec, that each one
 * really is far enough ahead.
 *
 * MIN_DAYS_AHEAD is 45, not 1: the clock-forward checks
 * (clock-forward.spec.ts) move the browser 30 days on and still need
 * these upcoming.
 */
export const MIN_DAYS_AHEAD = 45;
/** Where a fixture is moved to when it comes closer than MIN_DAYS_AHEAD. */
export const REDATE_DAYS_AHEAD = 60;
/** The browser-clock jump the clock-forward checks use; under MIN_DAYS_AHEAD. */
export const CLOCK_FORWARD_DAYS = 30;

export type UpcomingFixture = { id: string; title: string; usedBy: string };

export const UPCOMING_FIXTURES: UpcomingFixture[] = [
  { id: "qa-jaipur-event-0001", title: "Jaipur Mic Gala 100", usedBy: "smoke, seat-availability, seat-legend, seat-total, ticket-tier, registration, fonts, chat-bubble" },
  { id: "qa-demo-event-full-5", title: "Mixed Bag Comedy Lineup", usedBy: "colour-rules (Hrithik's upcoming show: he has an APPROVED performance on it)" },
  { id: "qa-demo-event-full-9", title: "Improv Theatre Jam", usedBy: "contrast, organiser-tab-bar, chat-bubble (Omkar's event)" },
  { id: "e2efixtureevt00001", title: "E2E Fixture: Waitlist/Wallet Flow", usedBy: "waitlist-wallet-credit" },
];

/** The artist whose upcoming show colour-rules.spec.ts checks, and the fixture event that is it. */
export const HRITHIK_ARTIST_ID = "qa-demo-artist-full-role";
export const HRITHIK_UPCOMING_EVENT_ID = "qa-demo-event-full-5";

export type MovedFixture = { id: string; title: string; from: Date; to: Date };

/**
 * Moves every fixture dated less than MIN_DAYS_AHEAD from now to about
 * REDATE_DAYS_AHEAD from now, in whole days so the time of day (and the
 * event's startTime) stays as it was. A venue booking tied to a moved
 * event (the waitlist fixture has one) moves by the same days, so the two
 * still agree. Anything already far enough ahead is left alone, so this
 * is safe to run on every run. Returns what moved.
 */
export async function keepFixturesUpcoming(client: ClientBase): Promise<MovedFixture[]> {
  const { rows: due } = await client.query<{ id: string; title: string; from: Date; days: number }>(
    `SELECT id, title, date AS "from",
            CEIL(EXTRACT(EPOCH FROM (now() + make_interval(days => $3::int) - date)) / 86400)::int AS days
       FROM "Event"
      WHERE id = ANY($1::text[])
        AND date < now() + make_interval(days => $2::int)`,
    [UPCOMING_FIXTURES.map((f) => f.id), MIN_DAYS_AHEAD, REDATE_DAYS_AHEAD]
  );
  const moved: MovedFixture[] = [];
  for (const f of due) {
    const { rows } = await client.query<{ to: Date }>(
      `UPDATE "Event" SET date = date + make_interval(days => $2::int) WHERE id = $1 RETURNING date AS "to"`,
      [f.id, f.days]
    );
    await client.query(
      `UPDATE "VenueBooking"
          SET "fromDate" = "fromDate" + make_interval(days => $2::int),
              "toDate" = "toDate" + make_interval(days => $2::int)
        WHERE "eventId" = $1`,
      [f.id, f.days]
    );
    moved.push({ id: f.id, title: f.title, from: f.from, to: rows[0].to });
  }
  return moved;
}
