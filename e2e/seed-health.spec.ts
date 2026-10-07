import { test, expect } from "./helpers/test";
import { CLOCK_FORWARD_DAYS, HRITHIK_ARTIST_ID, HRITHIK_UPCOMING_EVENT_ID, UPCOMING_FIXTURES } from "./helpers/upcoming-fixtures";
import { PERSONA_CITIES } from "./helpers/persona-cities";
import { authFile } from "./helpers/personas";

/**
 * BUG-2610-013 - the QA seed's date assumptions, checked before anything
 * else runs (playwright.config.ts: the "seed-health" project, which both
 * browser projects depend on).
 *
 * On 5 Oct 2026 the seeded events aged past "today" and the suite went red
 * as five unrelated-looking timeouts. global-setup.ts now moves the
 * fixtures forward on every run that has the QA database; this check says,
 * in one message, if any of them still isn't far enough ahead (no database
 * URL, a reseed that dropped one, an event cancelled by hand).
 *
 * "Far enough": still upcoming with the browser clock CLOCK_FORWARD_DAYS
 * on, which is what clock-forward.spec.ts does. Read-only, through the
 * same public listing API the /events page uses.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

type ApiEvent = { id: string; title: string; status: string; date: string; startTime: string; lineup?: { artist: { id: string } }[] };

/** The event's start instant, the way the listing page computes it (date + startTime, browser-local). */
function startOf(e: ApiEvent) {
  const [h, m] = e.startTime.split(":").map(Number);
  const start = new Date(e.date);
  start.setHours(h, m, 0, 0);
  return start;
}

test("[BUG-2610-013] seed health: every event the suite needs upcoming is upcoming, with 30 days to spare", async ({ request }) => {
  const res = await request.get("/api/events/");
  expect(res.ok(), `GET /api/events/ answered HTTP ${res.status()}`).toBeTruthy();
  const events = (await res.json()) as ApiEvent[];
  const byId = new Map(events.map((e) => [e.id, e]));
  const horizon = Date.now() + (CLOCK_FORWARD_DAYS + 1) * DAY_MS;

  const problems: string[] = [];
  for (const f of UPCOMING_FIXTURES) {
    const e = byId.get(f.id);
    if (!e) {
      problems.push(`"${f.title}" (${f.id}) is not in the public listing (missing, or not APPROVED/COMPLETED)`);
      continue;
    }
    if (e.status !== "APPROVED") problems.push(`"${f.title}" is ${e.status}, not APPROVED`);
    if (startOf(e).getTime() < horizon) {
      const when = startOf(e).getTime() < Date.now() ? "already past" : `under ${CLOCK_FORWARD_DAYS + 1} days ahead`;
      problems.push(`"${f.title}" starts ${startOf(e).toISOString()}, ${when}`);
    }
  }
  const hrithikShow = byId.get(HRITHIK_UPCOMING_EVENT_ID);
  if (hrithikShow && !hrithikShow.lineup?.some((p) => p.artist.id === HRITHIK_ARTIST_ID)) {
    problems.push(`Hrithik (${HRITHIK_ARTIST_ID}) is not on the lineup of "${hrithikShow.title}"`);
  }

  expect(
    problems,
    "The QA seed's upcoming-event assumptions do not hold, so specs that need an upcoming event will fail. " +
      "global-setup.ts moves these forward when E2E_DATABASE_URL is set; otherwise rerun `npm run db:seed:qa`. Problems"
  ).toEqual([]);
});

test("[GEN-2609-007] seed health: each persona's saved city is the one the suite expects", async ({ playwright, baseURL }) => {
  const problems: string[] = [];
  for (const p of PERSONA_CITIES) {
    const ctx = await playwright.request.newContext({ baseURL, storageState: authFile(p.persona) });
    try {
      const res = await ctx.get("/api/user/location/");
      expect(res.ok(), `GET /api/user/location/ as ${p.label} answered HTTP ${res.status()}`).toBeTruthy();
      const loc = (await res.json()) as { city: string | null; source: string };
      if (loc.source !== "profile" || loc.city !== p.city) {
        problems.push(`${p.label}'s saved city is ${loc.source === "profile" ? loc.city : "unset"}, not ${p.city} (used by ${p.usedBy})`);
      }
    } finally {
      await ctx.dispose();
    }
  }
  expect(
    problems,
    "A persona's saved city was changed on QA outside the suite. global-setup.ts puts it back when E2E_DATABASE_URL is set " +
      "(helpers/persona-cities.ts); otherwise set it back in the app, signed in as that persona. Problems"
  ).toEqual([]);
});
