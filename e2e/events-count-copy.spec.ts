import type { Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { useRuleViewport } from "./helpers/viewports";

/**
 * Events copy A (Hitesh phone pass 13-14 Oct). /events showed two counts
 * at once ("N events happening near you" in the hero and "Showing N
 * events" over the grid); the second one still read "Showing 0 events" at
 * zero (the BUG-2610-020 fix only hid the hero one); "near you" stayed
 * after "Show all cities"; and the Past tab in an empty city said "No
 * events in {city}" next to Upcoming's "No shows in {city} yet".
 *
 * Now: one count line (the hero eyebrow), the "near you" form only while a
 * city is picked, none at zero, and Past reads "No past shows in {city}".
 *
 * The browser's /api/events answers are cut down or emptied here, and the
 * visitor's location is set, so nothing depends on how many events QA has.
 * Guest; nothing is written. At 390 and 1440.
 */

const COUNT_LINE = /(happening near you|^Showing \d+ events?$|^\d+ past events?$)/i;

type ApiEvent = { date: string; startTime: string; venue?: { city?: string | null } | null };

/** A day after the event's date: upcoming by the page's own rule whatever the zone. */
function clearlyUpcoming(e: ApiEvent) {
  return new Date(e.date).getTime() > Date.now() + 24 * 60 * 60 * 1000;
}

/** The first city QA offers, set as the visitor's location. */
async function useFirstCity(page: Page) {
  const { cities } = (await (await page.request.get("/api/venues/cities")).json()) as { cities: { city: string }[] };
  expect(cities.length, "QA has a city with an approved venue").toBeGreaterThan(0);
  const city = cities[0].city;
  await page.route("**/api/user/location**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ city }) }),
  );
  return city;
}

/**
 * Every-city /api/events: the real answer cut to 2 upcoming events.
 * City /api/events: empty, or (cityEvents) those 2 events placed in it.
 */
async function serveEvents(page: Page, city: string, cityEvents: boolean) {
  await page.route(
    (url) => /^\/api\/events\/?$/.test(url.pathname),
    async (route) => {
      const url = new URL(route.request().url());
      const res = await route.fetch({ url: `${url.origin}${url.pathname}` });
      const two = ((await res.json()) as ApiEvent[]).filter(clearlyUpcoming).slice(0, 2);
      expect(two.length, "QA has 2 upcoming events").toBe(2);
      if (!url.searchParams.has("city")) return route.fulfill({ response: res, json: two });
      const inCity = cityEvents ? two.map((e) => ({ ...e, venue: { ...(e.venue ?? {}), city } })) : [];
      return route.fulfill({ response: res, json: inCity });
    },
  );
}

test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
});

test("[events-copy-A] 0 results: no 'Showing 0 events' line and no count eyebrow; the empty state carries the message", async ({ page, isMobile }) => {
  const city = await useFirstCity(page);
  await serveEvents(page, city, false);
  await page.goto("/events/");

  await expect(page.getByText(`No shows in ${city} yet`, { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("main").getByText(/Showing 0 events?/i)).toHaveCount(0);
  await expect(page.getByRole("main").getByText(COUNT_LINE)).toHaveCount(0);
  await expect(page.getByTestId("events-count-eyebrow")).toHaveCount(0);
  await expect(page.locator("main header").filter({ has: page.locator("h1") })).toHaveScreenshot(`events-header-zero-${isMobile ? 390 : 1440}.png`, { maxDiffPixelRatio: 0.02 });
});

test("[events-copy-A] with a city picked: exactly one count line, in the 'near you' form", async ({ page }) => {
  const city = await useFirstCity(page);
  await serveEvents(page, city, true);
  await page.goto("/events/");

  const eyebrow = page.getByTestId("events-count-eyebrow");
  await expect(eyebrow).toHaveText("2 events happening near you", { timeout: 20_000 });
  await expect(page.getByRole("main").getByText(COUNT_LINE)).toHaveCount(1);
  await expect(page.getByRole("main").getByText(/^Showing \d+ events?$/i)).toHaveCount(0);
});

test("[events-copy-A] after 'Show all cities': one count line, 'Showing N events', never 'near you'", async ({ page, isMobile }) => {
  const city = await useFirstCity(page);
  await serveEvents(page, city, false);
  await page.goto("/events/");

  await expect(page.getByText(`No shows in ${city} yet`, { exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Show all cities" }).click();

  const eyebrow = page.getByTestId("events-count-eyebrow");
  await expect(eyebrow).toHaveText("Showing 2 events", { timeout: 20_000 });
  await expect(page.getByRole("main").getByText(/near you/i)).toHaveCount(0);
  await expect(page.getByRole("main").getByText(COUNT_LINE)).toHaveCount(1);
  await expect(page.locator("main header").filter({ has: page.locator("h1") })).toHaveScreenshot(`events-header-all-cities-${isMobile ? 390 : 1440}.png`, { maxDiffPixelRatio: 0.02 });
});

test("[events-copy-A] Past tab in a city with nothing: 'No past shows in {city}', no count line", async ({ page, isMobile }) => {
  const city = await useFirstCity(page);
  await serveEvents(page, city, false);
  await page.goto("/events/");

  await expect(page.getByText(`No shows in ${city} yet`, { exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Past", exact: true }).click();

  const empty = page.getByText(`No past shows in ${city}`, { exact: true });
  await expect(empty).toBeVisible();
  await expect(page.getByText(`No events in ${city}`, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("main").getByText(COUNT_LINE)).toHaveCount(0);
  const box = page.locator("div").filter({ has: empty }).filter({ has: page.getByRole("button", { name: "Show all cities" }) }).last();
  await expect(box).toHaveScreenshot(`events-past-empty-${isMobile ? 390 : 1440}.png`, { maxDiffPixelRatio: 0.02 });
});
