import { test, expect } from "./helpers/test";
import { expectFocusTrapped } from "./helpers/focus";

/**
 * BUG-2609-065 - sheets did not keep keyboard focus inside themselves: on
 * /events with the filter sheet open, Tab walked the page behind it first
 * (focus stayed on the trigger and only reached the sheet after 9 presses).
 * Fixed by the shared hook src/lib/use-modal-sheet.ts (#722).
 *
 * The filter sheet only exists at phone width (hence *.mobile.spec.ts,
 * which the desktop project leaves out - see playwright.config.ts).
 */

test("[BUG-2609-065] events filter sheet: focus moves in, Tab and Shift+Tab stay in, Esc closes and returns focus", async ({
  page,
}) => {
  await page.goto("/events");
  const trigger = page.getByRole("banner").getByRole("button", { name: "Open filters" });
  await trigger.click();

  const sheet = page.getByRole("dialog", { name: "Filter events" });
  await expect(sheet).toBeVisible();
  // More than 5 controls (expectFocusTrapped presses past all of them).
  await expectFocusTrapped(page, sheet, 6);

  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("[BUG-2609-065] events search box: typing in it does not open the filter sheet", async ({ page }) => {
  // Before #722 focusing the top-bar search opened the sheet; with the sheet
  // now taking focus, that would make the box impossible to type in. Only
  // the filter icon opens it.
  await page.goto("/events");
  const search = page.getByRole("banner").getByRole("searchbox");
  await search.click();
  await search.pressSequentially("mic");
  await expect(search).toHaveValue("mic");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
