import { test, expect } from "./helpers/test";

/**
 * BUG-2609-065 - sheets did not keep keyboard focus inside themselves: on
 * /events with the filter sheet open, Tab walked the page behind it first
 * (focus stayed on the trigger and only reached the sheet after 9 presses).
 * Fixed by the shared hook src/lib/use-modal-sheet.ts (#722).
 *
 * The filter sheet only exists at phone width (hence *.mobile.spec.ts,
 * which the desktop project leaves out - see playwright.config.ts).
 */

test("events filter sheet: focus moves in, Tab and Shift+Tab stay in, Esc closes and returns focus", async ({
  page,
}) => {
  await page.goto("/events");
  const trigger = page.getByRole("banner").getByRole("button", { name: "Open filters" });
  await trigger.click();

  const sheet = page.getByRole("dialog", { name: "Filter events" });
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAttribute("aria-modal", "true");

  const focusIsInsideSheet = () =>
    page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return !!dialog && dialog.contains(document.activeElement) && document.activeElement !== document.body;
    });

  // Focus is inside as soon as the sheet opens, not left on the trigger.
  await expect.poll(focusIsInsideSheet).toBe(true);

  // More presses than the sheet has controls, so the wrap-around at both
  // ends is crossed in each direction.
  const controls = await sheet.getByRole("button").count();
  expect(controls).toBeGreaterThan(5);
  for (let i = 0; i < controls + 3; i++) {
    await page.keyboard.press("Tab");
    expect(await focusIsInsideSheet(), `Tab press ${i + 1} left the sheet`).toBe(true);
  }
  for (let i = 0; i < controls + 3; i++) {
    await page.keyboard.press("Shift+Tab");
    expect(await focusIsInsideSheet(), `Shift+Tab press ${i + 1} left the sheet`).toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("events search box: typing in it does not open the filter sheet", async ({ page }) => {
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
