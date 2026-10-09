import { test, expect, gotoDashboard } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { useRuleViewport } from "./helpers/viewports";

/**
 * BUG-2610-020 - Mumbai on QA has an approved venue and no events. /events
 * there read "0 EVENTS HAPPENING NEAR YOU" over an empty state that said
 * "Try adjusting your filters" with no filter applied. Now: no count
 * eyebrow at zero, "No shows in Mumbai yet" with "Show all cities", and
 * "Try adjusting your filters" only once a filter is on. The artist's
 * Browse Events page names the city too ("No published events in Mumbai
 * yet", "Show all cities"), and its city dropdown uses the chip's label
 * ("Mumbai", not "Mumbai (IN)"). At 390 and 1440; nothing is written.
 */

const CITY = "Mumbai";
const ADJUST = "Try adjusting your filters";

test.beforeEach(async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  // Precondition, checked rather than assumed: Mumbai is offered and has no events.
  const { cities } = (await (await page.request.get("/api/venues/cities")).json()) as { cities: { city: string; label: string }[] };
  expect(cities.map((c) => c.city), "QA has a Mumbai venue").toContain(CITY);
  const events = (await (await page.request.get(`/api/events?city=${CITY}`)).json()) as unknown[];
  expect(events, "QA has no events in Mumbai").toHaveLength(0);
});

test.describe("guest", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("[BUG-2610-020] /events in a city with no events: no count eyebrow, 'No shows in Mumbai yet', filters copy only once a filter is on", async ({ page, isMobile }) => {
    await page.route("**/api/user/location**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ city: CITY, country: "India" }) }),
    );
    await page.goto("/events/");

    const empty = page.getByText(`No shows in ${CITY} yet`, { exact: true });
    await expect(empty).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("events-count-eyebrow")).toHaveCount(0);
    await expect(page.getByText(/happening near you/i)).toHaveCount(0);
    await expect(page.getByText(ADJUST)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Show all cities" })).toBeVisible();
    const box = page.locator("div").filter({ has: empty }).filter({ has: page.getByRole("button", { name: "Show all cities" }) }).last();
    await expect(box).toHaveScreenshot(`events-zero-city-${isMobile ? 390 : 1440}.png`, { maxDiffPixelRatio: 0.02 });

    // A filter on: now the filters copy is right.
    if (isMobile) {
      await page.getByRole("banner").getByRole("button", { name: "Open filters" }).click();
      const sheet = page.getByRole("dialog", { name: "Filter events" });
      await sheet.getByRole("button", { name: "Free", exact: true }).click();
      await sheet.getByRole("button", { name: /^Showing 0 events$/ }).click();
      await expect(sheet).toHaveCount(0);
    } else {
      await page.getByRole("button", { name: "Free", exact: true }).click();
    }
    await expect(page.getByText(`No events in ${CITY}`, { exact: true })).toBeVisible();
    await expect(page.getByText(ADJUST)).toBeVisible();
    await expect(page.getByTestId("events-count-eyebrow")).toHaveCount(0);

    if (!isMobile) {
      // The desktop city dropdown: the chip's format, no "(IN)".
      await expect(page.locator("select.afa-events-select").first().locator(`option[value="${CITY}"]`)).toHaveText(CITY);
    }
  });
});

test.describe("artist", () => {
  test.use({ storageState: authFile("hrithik") });

  test("[BUG-2610-020] artist Browse Events in a city with no events names the city and offers Show all cities; no '(IN)' in the dropdown", async ({ page, isMobile }) => {
    await gotoDashboard(page, "/dashboard/artist/events");
    const select = page.getByRole("main").locator("select").first();
    await expect(select.locator(`option[value="${CITY}"]`)).toHaveText(CITY);
    await expect(select.locator("option").filter({ hasText: "(IN)" })).toHaveCount(0);

    await select.selectOption(CITY);
    const empty = page.getByTestId("artist-browse-empty");
    await expect(empty).toContainText(`No published events in ${CITY} yet`, { timeout: 20_000 });
    await expect(empty).not.toContainText("Check back soon");
    await expect(empty).toHaveScreenshot(`artist-browse-zero-city-${isMobile ? 390 : 1440}.png`, { maxDiffPixelRatio: 0.02 });

    await empty.getByRole("button", { name: "Show all cities" }).click();
    await expect(select).toHaveValue("All Cities");
    await expect(page.getByTestId("artist-browse-empty")).toHaveCount(0, { timeout: 20_000 });
  });
});
