import type { Route } from "@playwright/test";
import { test, expect, gotoDashboard } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { useRuleViewport } from "./helpers/viewports";

/**
 * BUG-2610-002 - the artist's Browse Events page had the two faults
 * /events had before #717: the "All Cities" load and the auto-applied
 * city's load raced (whichever answered last won, so the list could show
 * every city under a one-city filter), and a failed load fell through to
 * "No published events yet" with the error only in a toast.
 *
 * The slow and failed loads are made here by holding or failing the
 * browser's /api/events request. As Hrithik; nothing is written.
 */

test.use({ storageState: authFile("hrithik") });

const NONE_PUBLISHED = "No published events yet";
const STALE_TITLE = "E2E stale All Cities load";

/** The events list call itself, not /api/events/<id> or /api/events/saved. */
function isEventsList(url: URL) {
  return /^\/api\/events\/?$/.test(url.pathname);
}

test.beforeEach(async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
});

test("[BUG-2610-002] a failed load shows an error with Retry, never 'No published events yet'; Retry loads the events", async ({ page }) => {
  await page.route(isEventsList, (route) => route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"test"}' }));
  await gotoDashboard(page, "/dashboard/artist/events");

  const alert = page.getByRole("alert").filter({ hasText: "Couldn't load events" });
  await expect(alert).toBeVisible();
  await expect(page.getByText(NONE_PUBLISHED)).toHaveCount(0);

  await page.unroute(isEventsList);
  await alert.getByRole("button", { name: "Retry" }).click();
  await expect(alert).toHaveCount(0, { timeout: 30_000 });
  // The page title by its hook: "Browse Events" follows the UI language (GEN-2610-007).
  await expect(page.getByRole("main").locator("h1[data-afa-page-title]")).toBeVisible();
});

test("[BUG-2610-002] an All Cities load that answers after the city's load never replaces the city's list", async ({ page }) => {
  const citiesRes = await page.request.get("/api/venues/cities");
  const { cities } = (await citiesRes.json()) as { cities: { city: string }[] };
  expect(cities.length, "QA has at least one city with an approved venue").toBeGreaterThan(0);
  const city = cities[0].city;

  // Hold the All Cities load; let the city's own load through.
  const held: Route[] = [];
  let allCitiesAsked: () => void = () => {};
  const allCitiesAskedOnce = new Promise<void>((resolve) => (allCitiesAsked = resolve));
  await page.route(isEventsList, (route) => {
    if (new URL(route.request().url()).searchParams.has("city")) return route.continue();
    held.push(route);
    allCitiesAsked();
  });
  // The artist's location resolves to a real city, so the page narrows to
  // it - answered only once the All Cities load is out, so the two loads
  // always overlap (as they do on a real visit) instead of the city
  // sometimes being known before the first load starts.
  await page.route("**/api/user/location**", async (route) => {
    await allCitiesAskedOnce;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ city }) });
  });

  await page.goto("/dashboard/artist/events");
  await expect.poll(() => held.length, { message: "the page asked for the All Cities list" }).toBeGreaterThan(0);
  await expect(page.getByRole("main").getByRole("combobox")).toHaveValue(city, { timeout: 30_000 });

  // Now the superseded All Cities load answers, last, with an event of its own.
  const stale = [
    {
      id: "e2e-stale-load",
      title: STALE_TITLE,
      description: "",
      type: "COMEDY",
      date: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      startTime: "19:00",
      isFree: true,
      ticketPrice: null,
      ticketTiers: [],
      defaultCompensationType: "FREE",
      defaultFeeAmount: null,
      defaultBuyInAmount: null,
      maxPerformers: null,
      lineup: [],
      venue: { name: "Nowhere", city: "Elsewhere" },
    },
  ];
  await Promise.all(
    held.map((route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(stale) }).catch(() => {})
    )
  );
  // Nothing to wait for on the fixed page (that request was aborted), so
  // give a late response the time it would need to render.
  await page.waitForTimeout(1_500);
  await expect(page.getByText(STALE_TITLE)).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("combobox")).toHaveValue(city);
});
