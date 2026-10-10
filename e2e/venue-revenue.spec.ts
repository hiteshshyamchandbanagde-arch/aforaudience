import type { Page } from "@playwright/test";
import { test, expect, gotoDashboard } from "./helpers/test";
import { authFile } from "./helpers/personas";

/**
 * BUG-2609-087 - a venue owner's two revenue pages disagreed for the same
 * month: Bookings counted a booking by its event date, Sales by the day it
 * was created (Bookings ₹37,417 against Sales ₹0 when it was reported).
 * Both now count by event date over the India-time calendar month (#722).
 *
 * As Vinayak. Read-only.
 */

test.use({ storageState: authFile("vinayak") });

/**
 * The figure shown under a stat's label. Found by its data-afa-stat hook,
 * not the English text (the venue pages follow the UI language,
 * GEN-2610-007); the label must still read `label`.
 */
function statValue(page: Page, stat: string, label: string) {
  return page
    .getByRole("main")
    .locator(`[data-afa-stat="${stat}"] [data-afa-stat-label]`)
    .getByText(label, { exact: true })
    .locator("xpath=following-sibling::p[1]");
}

test("[BUG-2609-087] venue Bookings 'This month' and Sales 'Month' show the same revenue, both by event date", async ({ page }) => {
  await gotoDashboard(page, "/dashboard/venue/bookings");
  const thisMonth = statValue(page, "this-month", "This month");
  await expect(thisMonth).toHaveText(/^₹[\d,]+$/);
  const bookingsFigure = (await thisMonth.innerText()).trim();
  await expect(thisMonth.locator("xpath=following-sibling::p[1]")).toHaveText("by event date");

  await gotoDashboard(page, "/dashboard/venue/sales");
  const month = page.getByRole("main").locator('[data-afa-range="month"]');
  await expect(month).toHaveText("Month");
  await month.click();
  const totalRevenue = statValue(page, "total-revenue", "Total Revenue");
  await expect(totalRevenue).toHaveText(bookingsFigure);
  await expect(totalRevenue.locator("xpath=following-sibling::p[1]")).toHaveText("by event date");

  test.info().annotations.push({ type: "month revenue", description: bookingsFigure });
});
