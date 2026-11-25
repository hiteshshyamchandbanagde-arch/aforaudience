import type { Locator, Page } from "@playwright/test";

/**
 * The two widths the testing rule names (docs/testing-rules.md T1): a
 * phone at 390 x 844 and a desktop at 1440 x 900. Specs run once per
 * project, so the phone project (Pixel 7, touch and a mobile user agent)
 * checks 390 and the desktop project checks 1440.
 */
export const PHONE = { width: 390, height: 844 };
export const DESKTOP = { width: 1440, height: 900 };

/** Sets the project's rule width before the first navigation. */
export async function useRuleViewport(page: Page, isMobile: boolean) {
  await page.setViewportSize(isMobile ? PHONE : DESKTOP);
}

/** True when the element (or its own content) is what a tap at its centre would hit. */
export async function isTopmostAtCentre(locator: Locator) {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit !== null && (hit === el || el.contains(hit));
  });
}
