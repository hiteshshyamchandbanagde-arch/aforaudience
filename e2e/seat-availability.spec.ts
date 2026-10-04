import { test, expect } from "./helpers/test";
import { JAIPUR_EVENT_TITLE, openEventFromListing, pickAvailableSeat, type SeatApiRow } from "./helpers/events";
import { useRuleViewport } from "./helpers/viewports";

/**
 * GEN-2610-001 item 3 - "the Jaipur Mic Gala 100 smoke fails on mobile".
 * The smoke itself never picks a seat; registration.spec.ts does, and the
 * worry was that it could land on a seat someone holds on QA (Hitesh's
 * C3/C5/B3/B5, Atul's F5-F8). This checks, at 390 and 1440, signed out
 * and with nothing booked, that every seat the server holds shows as
 * taken on the map and can't be selected, and that pickAvailableSeat
 * selects a free one.
 */

test.beforeEach(async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
});

test("[GEN-2610-001] Jaipur seat map: held seats show as taken and can't be chosen; the picker selects a free seat", async ({ page, isMobile }) => {
  await openEventFromListing(page, JAIPUR_EVENT_TITLE, isMobile);
  await page.getByRole("link", { name: /select tickets/i }).first().click();
  await expect(page).toHaveURL(/\/events\/[^/]+\/seats\/?/);
  const id = page.url().match(/\/events\/([^/?]+)\/seats/)![1];

  const res = await page.request.get(`/api/events/${id}/seats`);
  expect(res.ok()).toBeTruthy();
  const { seats } = (await res.json()) as { seats: SeatApiRow[] };
  const taken = seats.filter((s) => s.status === "taken");
  const takenLabels = new Set(taken.map((s) => `${s.row}${s.number}`));

  // Every held seat is drawn as taken: its tooltip says so, never a price.
  await expect(page.locator('[title*="₹"]').first()).toBeVisible({ timeout: 20_000 });
  for (const s of taken) {
    await expect(page.getByTitle(`Row ${s.row}, Seat ${s.number} — taken`, { exact: true })).toHaveCount(1);
    await expect(page.locator(`[title^="Row ${s.row}, Seat ${s.number} — ₹"]`)).toHaveCount(0);
  }

  // Tapping a held seat selects nothing: the summary stays at 0 seats.
  const zero = page.getByText(/^0 seats$/).filter({ visible: true }).first();
  await expect(zero).toBeVisible();
  if (taken.length > 0) {
    await page.getByTitle(`Row ${taken[0].row}, Seat ${taken[0].number} — taken`, { exact: true }).click();
    await expect(zero).toBeVisible();
  }

  const picked = await pickAvailableSeat(page);
  expect(takenLabels.has(picked.label), `picked a held seat ${picked.label}`).toBe(false);
  await expect(page.getByText(/^1 seats?$/).filter({ visible: true }).first()).toBeVisible();
  await page.screenshot({ path: test.info().outputPath(`jaipur-seat-picked-${isMobile ? 390 : 1440}.png`) });
});
