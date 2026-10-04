import type { Locator, Page } from "@playwright/test";
import { expect } from "./test";

/**
 * A modal sheet keeps keyboard focus inside itself (BUG-2609-065, the
 * shared hook src/lib/use-modal-sheet.ts): focus is inside as soon as it
 * opens, and Tab / Shift+Tab never leave it. Presses more times than the
 * sheet has controls, so the wrap-around at both ends is crossed in each
 * direction. First used by filter-sheet-focus.mobile.spec.ts.
 */
export async function expectFocusTrapped(page: Page, sheet: Locator, minControls = 1) {
  await expect(sheet).toHaveAttribute("aria-modal", "true");
  const focusIsInsideSheet = () =>
    sheet.evaluate((dialog) => dialog.contains(document.activeElement) && document.activeElement !== document.body);

  // Focus is inside as soon as the sheet opens, not left on the trigger.
  await expect.poll(focusIsInsideSheet).toBe(true);

  const controls = await sheet.getByRole("button").count();
  expect(controls).toBeGreaterThanOrEqual(minControls);
  for (let i = 0; i < controls + 3; i++) {
    await page.keyboard.press("Tab");
    expect(await focusIsInsideSheet(), `Tab press ${i + 1} left the sheet`).toBe(true);
  }
  for (let i = 0; i < controls + 3; i++) {
    await page.keyboard.press("Shift+Tab");
    expect(await focusIsInsideSheet(), `Shift+Tab press ${i + 1} left the sheet`).toBe(true);
  }
}
