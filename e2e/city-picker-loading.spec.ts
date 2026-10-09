import type { Page, Route } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { useRuleViewport } from "./helpers/viewports";

/**
 * BUG-2610-032 - the city picker said "No matching cities" (hi: "कोई
 * मिलता-जुलता शहर नहीं") with the search still empty, before its city list
 * had arrived. Now it says "Loading cities…" until /api/venues/cities
 * answers, and "no match" only for a search that found nothing.
 *
 * The city list response is held back by the test, so the loading state
 * is there for as long as the test needs it. Signed out: nothing is
 * picked, no persona state is touched. At 390 (top-bar chip) and 1440
 * (chip in the account menu).
 */

const ACCOUNT_MENU = 'button[aria-haspopup="menu"]:not([data-nextjs-dev-tools-button])';

/** Opens the picker: the top-bar chip on a phone, the chip in the account menu at desktop width. */
async function openPicker(page: Page, inTopBar: boolean) {
  const scope = inTopBar ? page.getByRole("banner") : page.getByRole("menu");
  if (!inTopBar) {
    await expect(async () => {
      if (!(await scope.isVisible())) await page.locator(ACCOUNT_MENU).click();
      await expect(scope).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 15_000 });
  }
  const search = scope.getByPlaceholder("Search city...");
  await expect(async () => {
    if (!(await search.isVisible())) await scope.getByRole("button", { name: /▾/ }).click();
    await expect(search).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  return { scope, search };
}

/** Holds every /api/venues/cities request until release() is called. */
async function holdCities(page: Page) {
  const held: Route[] = [];
  let released = false;
  await page.route("**/api/venues/cities**", async (route) => {
    if (released) return route.continue();
    held.push(route);
  });
  return {
    requested: () => held.length,
    release: async () => {
      released = true;
      for (const route of held.splice(0)) await route.continue();
    },
  };
}

test.beforeEach(async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
});

test("[BUG-2610-032] the city picker shows a loading state, not \"no match\", until its city list arrives", async ({ page, isMobile }) => {
  const cities = await holdCities(page);
  await page.goto("/events");
  const { scope, search } = await openPicker(page, isMobile);

  await expect.poll(cities.requested).toBeGreaterThan(0);
  const loading = scope.getByText("Loading cities…", { exact: true });
  await expect(loading).toBeVisible();
  await expect(scope.getByText("No matching cities")).toHaveCount(0);
  await expect(loading).toHaveScreenshot(`city-picker-loading-${isMobile ? 390 : 1440}.png`, { animations: "disabled" });

  await cities.release();
  await expect(loading).toHaveCount(0);
  await expect(scope.getByRole("button", { name: "Mumbai", exact: true })).toBeVisible();
  await expect(scope.getByText("No matching cities")).toHaveCount(0);

  // "No match" is for a search that found nothing.
  await search.fill("zzzzqx");
  await expect(scope.getByText("No matching cities")).toBeVisible();
  await search.fill("");
  await expect(scope.getByText("No matching cities")).toHaveCount(0);
  await expect(scope.getByRole("button", { name: "Mumbai", exact: true })).toBeVisible();
});

test("[BUG-2610-032] a failed city list is not shown as \"no match\"", async ({ page, isMobile }) => {
  await page.route("**/api/venues/cities**", (route) => route.fulfill({ status: 500, body: "{}" }));
  await page.goto("/events");
  const { scope } = await openPicker(page, isMobile);
  await expect(scope.getByText("Loading cities…", { exact: true })).toBeVisible();
  await expect(scope.getByText("No matching cities")).toHaveCount(0);
});
