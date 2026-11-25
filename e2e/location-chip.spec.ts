import type { Page } from "@playwright/test";
import { test, expect } from "./helpers/test";

/**
 * BUG-2609-078 - changing the city on the location chip did not reach the
 * page: /venues kept listing the old city until a reload. And on a phone
 * the chip sat inside the logo link, so tapping it went to the homepage.
 * Fixed in #722 (LocationChip announces the change; /venues and /events
 * listen; the chip moved out of the link).
 *
 * Signed out on purpose: a guest's choice is kept in a cookie, so no
 * persona's saved city is changed (docs/testing-rules.md T6).
 */

/** Where the chip lives: the top bar on a phone, the account menu on desktop. */
async function chooseCity(page: Page, isMobile: boolean, city: string) {
  const scope = isMobile ? page.getByRole("banner") : page.getByRole("menu");
  if (!isMobile) {
    // Open the account menu (it stays open after a city is picked). Retried:
    // a click that lands before the header has hydrated does nothing.
    await expect(async () => {
      if (!(await scope.isVisible())) await page.locator('button[aria-haspopup="menu"]').click();
      await expect(scope).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 15_000 });
  }
  // "Jaipur" exactly: the chip itself reads "Jaipur ▾" once chosen. (Was
  // "Jaipur (IN)" until GEN-2610-005 dropped "(IN)" from Indian cities in
  // the chip and its picker: one label format for detected and picked.)
  const cityOption = scope.getByRole("button", { name: city, exact: true });
  await expect(async () => {
    if (!(await cityOption.isVisible())) await scope.getByRole("button", { name: /▾/ }).click();
    await expect(cityOption).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  await cityOption.click();
}

test("[BUG-2609-078] changing the location chip on /venues relists the venues at once, without leaving the page", async ({
  page,
  isMobile,
}) => {
  await page.goto("/venues");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toBeVisible();
  // Starts on every city: the count line names no city.
  await expect(main.getByText(/^\d+ spaces?$/i).first()).toBeVisible();

  await chooseCity(page, isMobile, "Jaipur");
  await expect(main.getByText(/^\d+ spaces? in Jaipur/i)).toBeVisible();
  await expect(main.getByText("Jaipur Convention Grounds").first()).toBeVisible();
  await expect(page).toHaveURL(/\/venues\/?$/);

  await chooseCity(page, isMobile, "Pune");
  await expect(main.getByText(/^\d+ spaces? in Pune/i)).toBeVisible();
  await expect(main.getByText("Jaipur Convention Grounds")).toHaveCount(0);
  await expect(page).toHaveURL(/\/venues\/?$/);
});
