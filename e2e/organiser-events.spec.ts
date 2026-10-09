import { test, expect, gotoDashboard } from "./helpers/test";
import { authFile } from "./helpers/personas";

/**
 * Two organiser-side fixes from #722, as Omkar. Read-only: nothing is saved.
 */

test.use({ storageState: authFile("omkar") });

test.describe("[BUG-2609-071] dates do not follow the browser", () => {
  // A visitor whose browser is set to US English in New York. Before the
  // fix the dashboard printed "10/24/2026" for an event on 25 Oct: US
  // month-first order, and a day early (no time zone was pinned anywhere).
  // src/lib/format-date.ts now formats every date in India time.
  test.use({ locale: "en-US", timezoneId: "America/New_York" });

  test("[BUG-2609-071] organiser dashboard dates are day-first, in India time, whatever the browser's locale and zone", async ({
    page,
  }) => {
    await gotoDashboard(page, "/dashboard/organiser");
    // The page-title hook, not the English name: the dashboard follows the UI language (GEN-2610-007).
    await expect(page.locator("h1[data-afa-page-title]")).toHaveText("Your Events");

    // Every event card's first line is "<date> · <venue>".
    const dateLines = page.getByRole("main").locator("p").filter({ hasText: /\d{4} · / });
    await expect(dateLines.first()).toBeVisible();
    const lines = await dateLines.allInnerTexts();
    expect(lines.length).toBeGreaterThan(3);
    for (const line of lines) {
      expect(line, "day month year, not US order").toMatch(/^\d{1,2} \p{L}+\.? \d{4} · /u);
    }
    expect(await page.getByRole("main").innerText(), "no slash dates anywhere").not.toMatch(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/);

    // The day itself: each seeded event's stored instant, read in India
    // time, is the day on its card. (The seed stamps them in the early
    // hours UTC, so New York is still on the previous day.)
    // The same endpoint the dashboard itself reads.
    const res = await page.request.get("/api/events/my-events/");
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as unknown;
    const list = (Array.isArray(body) ? body : ((body as { events?: unknown[] }).events ?? [])) as {
      title: string;
      date: string;
    }[];
    const events = list.filter((e) => e.title && e.date);
    let checked = 0;
    for (const event of events) {
      const card = page
        .getByRole("heading", { level: 3, name: event.title, exact: true })
        .locator("xpath=following-sibling::p[1]");
      if ((await card.count()) !== 1) continue;
      const india = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", year: "numeric" });
      const parts = Object.fromEntries(india.formatToParts(new Date(event.date)).map((p) => [p.type, p.value]));
      await expect(card).toHaveText(new RegExp(`^${parts.day} \\S+ ${parts.year} · `));
      checked++;
    }
    expect(checked, "events compared against their stored date").toBeGreaterThan(3);
  });
});

test.describe("[BUG-2609-083] venue hours are billed in half-hours and a very long event is questioned", () => {
  test("[BUG-2609-083] create page: an overnight 14 h 58 m event is billed as 15 hr and warned about; 2 h 5 m is 2.5 hr with no warning", async ({
    page,
  }) => {
    await gotoDashboard(page, "/dashboard/organiser/events/create");
    const main = page.getByRole("main");

    // Any venue with an hourly rate will do; this one is Omkar's own seed venue.
    // data-afa-* hooks, not the English text: the create page follows the UI language (GEN-2610-007).
    const venueSelect = main.locator("select[data-afa-venue-select]");
    const venueOption = venueSelect.locator("option", { hasText: "Koregaon Park Lounge" });
    await expect(venueOption).toHaveCount(1);

    await page.locator('input[name="startTime"]').fill("23:55");
    await page.locator('input[name="endTime"]').fill("14:53");
    await venueSelect.selectOption({ label: (await venueOption.innerText()).trim() });

    // Before: "× 14.966666666666667 hr" and no warning.
    const rateNote = main.locator("[data-afa-rate-note]");
    const warning = main.locator("[data-afa-time-warning]");
    await expect(rateNote).toContainText(/₹[\d,]+\/hr × 15 hr \(14 h 58 m, billed as 15 hr\)/);
    await expect(warning).toHaveText("This event runs 14 h 58 m and ends the next day. Check AM/PM.");
    await expect(main).not.toContainText(/\d\.\d{3,} hr/);

    await page.locator('input[name="startTime"]').fill("19:00");
    await page.locator('input[name="endTime"]').fill("21:05");
    await expect(rateNote).toContainText(/₹[\d,]+\/hr × 2\.5 hr \(2 h 5 m, billed as 2\.5 hr\)/);
    await expect(warning).toHaveCount(0);

    // Nothing was submitted: leaving the page creates no event.
  });
});
