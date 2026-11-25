import type { Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { PHONE } from "./helpers/viewports";

/**
 * GEN-2610-005 (top-bar squeeze, seen on Hitesh's phone 7 Oct) - with
 * "MUMBAI (IN)" in the chip, the 390-wide top bar shrank the search box
 * to "Sea". The chip label is now capped with an ellipsis, and Indian
 * cities drop "(IN)" (one label format for detected and picked cities).
 *
 * Uses the longest city label QA has today (read from /api/venues/cities
 * at run time, so a new longer city is covered automatically), picks it
 * as a guest (cookie of this context only, no persona touched) and checks
 * the search box is no narrower than with "Pune" and the chip no wider
 * than the logo.
 */

// Signed out, the right side of the bar (language, Sign in, Sign up)
// already leaves the search box about 90px at 390 whatever the city; that
// is the floor. The bug was the city making it narrower still.
const MIN_SEARCH_WIDTH = 80;

async function pickCity(page: Page, city: string) {
  const banner = page.getByRole("banner");
  const chip = banner.getByRole("button", { name: /▾/ });
  await expect(chip).not.toHaveText(/^…/);
  const option = banner.getByRole("button", { name: city, exact: true });
  await expect(async () => {
    if (!(await option.isVisible())) await chip.click();
    await expect(option).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  await option.click();
  await expect(chip).toContainText(city);
}

test("[GEN-2610-005] 390: the longest city label does not squeeze the top-bar search box", async ({ page }) => {
  await page.setViewportSize(PHONE);
  const res = await page.request.get("/api/venues/cities/");
  expect(res.ok()).toBe(true);
  const { cities } = (await res.json()) as { cities: { city: string }[] };
  const longest = cities.map((c) => c.city).sort((a, b) => b.length - a.length)[0];
  expect(longest).toBeTruthy();

  await page.goto("/");
  const banner = page.getByRole("banner");
  const chip = banner.getByRole("button", { name: /▾/ });
  const search = banner.getByRole("searchbox");

  // A short city first: the width the search box should keep.
  await pickCity(page, "Pune");
  const short = (await search.boundingBox())!.width;

  await pickCity(page, longest);
  const long = (await search.boundingBox())!.width;
  expect(long, `search box width with "${longest}" vs "Pune"`).toBeGreaterThanOrEqual(short - 1);
  expect(long).toBeGreaterThanOrEqual(MIN_SEARCH_WIDTH);

  // The chip's label never runs wider than the logo above it.
  const logoBox = await banner.getByRole("link").first().boundingBox();
  const chipBox = await chip.boundingBox();
  expect(chipBox!.width).toBeLessThanOrEqual(logoBox!.width + 1);

  await expect(banner).toHaveScreenshot("top-bar-longest-city-390.png");
});
