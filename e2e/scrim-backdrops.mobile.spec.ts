import type { Locator } from "@playwright/test";
import { test, expect, gotoDashboard } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { tokenColour } from "./helpers/contrast";

/**
 * GEN-2609-114 (colour follow-ups to GEN-2609-113, part of the
 * central-control goal): the dim layer behind every dialog and sheet is
 * the --afa-scrim token, not a cream wash or a literal, so an admin
 * edit to the token in Design System reaches every backdrop.
 *
 * Checked on the two sheets a phone user meets most: the /events filter
 * sheet (a visitor) and the dashboard tab bar's More sheet (Omkar, an
 * Organiser: his bar overflows into More). The backdrop is the layer
 * painted right under the sheet; its computed background must equal the
 * token's computed value on the same page. Both sheets exist only at
 * phone width, hence *.mobile.spec.ts. Read-only.
 */

/** The computed background of the backdrop: the sheet's preceding sibling, which fills the screen behind it. */
async function backdropOf(sheet: Locator) {
  return sheet.evaluate((el) => {
    const backdrop = el.previousElementSibling as HTMLElement | null;
    if (!backdrop) return null;
    const r = backdrop.getBoundingClientRect();
    return { background: getComputedStyle(backdrop).backgroundColor, width: r.width, height: r.height };
  });
}

test("[GEN-2609-114] events filter sheet: the backdrop is --afa-scrim", async ({ page }) => {
  await page.goto("/events");
  await page.getByRole("banner").getByRole("button", { name: "Open filters" }).click();
  const sheet = page.getByRole("dialog", { name: "Filter events" });
  await expect(sheet).toBeVisible();

  const scrim = await tokenColour(page, "--afa-scrim");
  const backdrop = await backdropOf(sheet);
  expect(backdrop, "a backdrop layer behind the filter sheet").not.toBeNull();
  expect(backdrop!.background, `backdrop ${backdrop!.background}; --afa-scrim ${scrim}`).toBe(scrim);
  // It covers the screen, not just a strip.
  expect(backdrop!.width).toBeGreaterThanOrEqual(page.viewportSize()!.width - 1);
  expect(backdrop!.height).toBeGreaterThanOrEqual(page.viewportSize()!.height - 1);
});

test.describe("signed in as Omkar", () => {
  test.use({ storageState: authFile("omkar") });

  test("[GEN-2609-114] dashboard tab bar More sheet: the backdrop is --afa-scrim", async ({ page }) => {
    await gotoDashboard(page, "/dashboard/organiser/");
    // data-afa-* hooks, not the English "More": the bar follows the UI language (GEN-2610-007).
    await page.locator('[data-afa-tab="more"]').filter({ visible: true }).click();
    const sheet = page.locator("[data-afa-more-sheet]");
    await expect(sheet).toHaveAttribute("role", "dialog");
    await expect(sheet).toBeVisible();

    const scrim = await tokenColour(page, "--afa-scrim");
    const backdrop = await backdropOf(sheet);
    expect(backdrop, "a backdrop layer behind the More sheet").not.toBeNull();
    expect(backdrop!.background, `backdrop ${backdrop!.background}; --afa-scrim ${scrim}`).toBe(scrim);
    expect(backdrop!.width).toBeGreaterThanOrEqual(page.viewportSize()!.width - 1);
    expect(backdrop!.height).toBeGreaterThanOrEqual(page.viewportSize()!.height - 1);
  });
});
