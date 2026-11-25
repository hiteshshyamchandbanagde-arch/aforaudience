import type { Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { useRuleViewport } from "./helpers/viewports";

/**
 * BUG-2610-019 - opening the city picker put focus in "Search city...",
 * which on a phone pops the keyboard over half the screen. Now: no
 * autofocus on a touch screen or one narrower than 768 px; desktop keeps
 * it. At 390 (Pixel 7, touch) and 1440, plus a narrow desktop window.
 *
 * Signed out: nothing is picked, no persona state is touched.
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
  return search;
}

test("[BUG-2610-019] the city picker's search box takes focus on desktop only, never on a phone", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  await page.goto("/events");
  const search = await openPicker(page, isMobile);

  if (isMobile) {
    await expect(search).not.toBeFocused();
    // Nothing else grabbed focus into a text field either (no keyboard).
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("INPUT");
  } else {
    await expect(search).toBeFocused();
  }
  await expect(search).toHaveScreenshot(`city-search-${isMobile ? 390 : 1440}.png`, { maxDiffPixelRatio: 0.02 });
});

test("[BUG-2610-019] a narrow desktop window (< 768 px) does not focus the search either", async ({ page, isMobile }) => {
  // The phone project is always narrow and touch: the first test covers it.
  await page.setViewportSize({ width: isMobile ? 390 : 700, height: 900 });
  await page.goto("/events");
  // Below the desktop breakpoint the chip is in the top bar.
  const search = await openPicker(page, true);
  await expect(search).not.toBeFocused();
});
