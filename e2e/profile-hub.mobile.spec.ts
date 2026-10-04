import { test, expect } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { expectFocusTrapped } from "./helpers/focus";
import { PHONE } from "./helpers/viewports";

/**
 * GEN-2609-008 (Mobile Redesign Phase 4c): on a phone, an Audience
 * member's /profile/ opens as a hub: a "Create" group (List an event,
 * Register a venue, Artist profiles) and a "Money & account" group (Fee
 * breakdown, Settings, Log out). The Fee breakdown row opens the fee
 * sheet, which keeps keyboard focus inside itself like every modal sheet
 * (BUG-2609-065's check, helpers/focus.ts) and closes on Esc.
 *
 * As Atul (Audience only) at 390 x 844; the hub exists below `lg` only,
 * hence *.mobile.spec.ts. Read-only: Log out and the Create rows are
 * never pressed. HUMAN: the hub's look.
 */

test.use({ storageState: authFile("atul"), viewport: PHONE });

const GROUPS = {
  Create: ["List an event", "Register a venue", "Artist profiles"],
  "Money & account": ["Fee breakdown", "Settings", "Log out"],
} as const;

test("[GEN-2609-008] profile hub at 390: Create and Money & account rows; Fee breakdown opens the fee sheet", async ({ page }) => {
  await page.goto("/profile/");
  for (const [group, rows] of Object.entries(GROUPS)) {
    const label = page.getByText(group, { exact: true }).filter({ visible: true });
    await expect(label, `"${group}" group`).toBeVisible({ timeout: 20_000 });
    // The group's rows are the buttons in the card right under its label.
    const card = label.locator("xpath=following-sibling::div[1]");
    const titles = await card.getByRole("button").evaluateAll((els) => els.map((el) => el.querySelector("span > span")?.textContent?.trim() ?? ""));
    expect(titles, `rows under "${group}"`).toEqual([...rows]);
  }

  const feeRow = page.getByRole("button", { name: /^Fee breakdown/ }).filter({ visible: true });
  await feeRow.click();
  const sheet = page.getByRole("dialog", { name: "Fee breakdown" });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("Platform commission");
  await expectFocusTrapped(page, sheet);

  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/\/profile\/?$/);
});
