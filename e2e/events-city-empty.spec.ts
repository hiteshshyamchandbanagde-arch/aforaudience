import { test, expect } from "./helpers/test";
import { useRuleViewport } from "./helpers/viewports";

/**
 * BUG-2609-066 - /events with a city chosen and no events there said "No
 * events published yet", the copy for an empty platform. Fixed with
 * BUG-2610-004 (#722): a city with no matches says "No events in {city}"
 * with a "Show all cities" action, and "none yet" is left for no filter.
 * This pins it (it passes on origin/qa too). BUG-2610-020 then changed
 * that copy, for a city with no filter applied, to "No shows in {city}
 * yet" (the ticket's decision), so the expected title follows it.
 *
 * The empty city is made by answering the browser's city-filtered
 * /api/events with no events; the visitor's location is that city. Guest,
 * nothing is written. At 390 and 1440.
 */

test.beforeEach(async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
});

test("[BUG-2609-066] a city with no events says 'No shows in {city} yet' with Show all cities, never 'No events published yet'", async ({ page }) => {
  const citiesRes = await page.request.get("/api/venues/cities");
  const { cities } = (await citiesRes.json()) as { cities: { city: string }[] };
  expect(cities.length, "QA has a city with an approved venue").toBeGreaterThan(0);
  const city = cities[0].city;

  await page.route("**/api/user/location**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ city }) }),
  );
  await page.route(
    (url) => /^\/api\/events\/?$/.test(url.pathname) && url.searchParams.has("city"),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.goto("/events/");

  await expect(page.getByText(`No shows in ${city} yet`)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("No events published yet")).toHaveCount(0);

  await page.getByRole("button", { name: "Show all cities" }).click();
  await expect(page.getByText(`No shows in ${city} yet`)).toHaveCount(0);
  await expect(page.getByText("No events published yet")).toHaveCount(0);
  await expect(page.getByRole("link").filter({ has: page.getByRole("heading", { level: 3 }) }).first()).toBeVisible();
});
