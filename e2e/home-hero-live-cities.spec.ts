import { test, expect } from "./helpers/test";
import { withQaDb } from "./helpers/qa-db";
import { useRuleViewport } from "./helpers/viewports";
import { heroLiveTag, liveCityNames } from "../src/lib/live-cities";

/**
 * Events copy A (Hitesh decision, 14 Oct) - the home hero's tag said
 * "Live, right now — six cities and counting" whatever the data. It now
 * counts the cities with an upcoming APPROVED show at an approved venue:
 * 2+ "Live, right now — {n} cities and counting" (digits), 1 "Live, right
 * now in {city}", 0 no tag. The rule itself is unit-tested in
 * scripts/live-cities.test.ts; this checks the page against QA's own data,
 * read the same way (the server caches it for 5 minutes). Read-only.
 * At 390 and 1440.
 */

test.use({ storageState: { cookies: [], origins: [] } });

test("[events-copy-A] home hero tag counts the cities with an upcoming approved show @needs-db", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  const cities = await withQaDb(async (db) => {
    const { rows } = await db.query<{ date: Date; startTime: string; city: string | null }>(
      `SELECT e."date", e."startTime", v."city"
         FROM "Event" e JOIN "Venue" v ON v.id = e."venueId"
        WHERE e."status" = 'APPROVED' AND v."isApproved" = true AND e."date" >= now() - interval '1 day'`,
    );
    return liveCityNames(rows.map((r) => ({ date: r.date, startTime: r.startTime, venue: { city: r.city } })), new Date());
  });
  const expected = heroLiveTag(cities, { many: "Live, right now — {n} cities and counting", one: "Live, right now in {city}" });

  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("main").getByText(/six cities/i)).toHaveCount(0);
  const tag = page.getByTestId("hero-live-tag");
  if (expected === null) {
    await expect(tag).toHaveCount(0);
  } else {
    await expect(tag).toHaveText(expected);
  }
  await page.screenshot({ path: test.info().outputPath(`home-hero-${isMobile ? 390 : 1440}.png`) });
});
