import { test, expect, gotoDashboard } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { withQaDb } from "./helpers/qa-db";
import { useRuleViewport } from "./helpers/viewports";
import type { Page } from "@playwright/test";

/**
 * D1b (Hitesh, 8 Nov) - the organiser's payment-mode picker on Create
 * Event: Free / Pay at entry / Online payment.
 *
 * The paid-bookings switch is injected per page by answering
 * /api/platform-settings/paid-bookings in the browser (page.route), so
 * the global QA setting is never flipped under parallel runs.
 *
 * Regression shape: on origin/qa the form only has Free/Paid radios, no
 * picker, no "Coming soon" and no paymentMode sent, so these fail; on the
 * branch they pass.
 *
 * Writes data: one draft event created through the form, deleted in
 * finally (T6). Persona state (city, profile, roles) is never touched.
 */
test.use({ storageState: authFile("omkar") });

function ymd(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function injectPaidSwitch(page: Page, enabled: boolean) {
  await page.route("**/api/platform-settings/paid-bookings", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ paidBookingsEnabled: enabled }) })
  );
}

test("[D1b] switch OFF: Online payment is disabled with Coming soon; Pay at entry shows its no-collect help", async ({ page, isMobile }) => {
  const vp = isMobile ? 390 : 1440;
  await useRuleViewport(page, isMobile);
  await injectPaidSwitch(page, false);
  await gotoDashboard(page, "/dashboard/organiser/events/create");

  const picker = page.getByTestId("payment-mode-picker");
  await expect(picker).toBeVisible();
  await expect(picker.locator('input[value="FREE"]')).toBeChecked();
  await expect(picker.locator('input[value="ONLINE"]')).toBeDisabled();
  await expect(picker.getByTestId("payment-mode-online-coming-soon")).toHaveText("Coming soon");

  await picker.locator('input[value="PAY_AT_ENTRY"]').check();
  await expect(picker.getByTestId("payment-mode-pay-at-entry-help")).toHaveText(
    "Audience reserves on AforAudience and pays you directly at the venue — cash or UPI. AforAudience does not collect this payment."
  );
  await picker.scrollIntoViewIfNeeded();
  await picker.screenshot({ path: `test-results/d1b-picker-off-${vp}.png` });
});

test("[D1b] switch ON: Online payment is selectable and Coming soon is gone", async ({ page, isMobile }) => {
  const vp = isMobile ? 390 : 1440;
  await useRuleViewport(page, isMobile);
  await injectPaidSwitch(page, true);
  await gotoDashboard(page, "/dashboard/organiser/events/create");

  const picker = page.getByTestId("payment-mode-picker");
  await expect(picker.locator('input[value="ONLINE"]')).toBeEnabled();
  await expect(picker.getByTestId("payment-mode-online-coming-soon")).toHaveCount(0);
  await picker.locator('input[value="ONLINE"]').check();
  await expect(picker.locator('input[value="ONLINE"]')).toBeChecked();
  await expect(picker.getByTestId("payment-mode-pay-at-entry-help")).toHaveCount(0);
  await picker.scrollIntoViewIfNeeded();
  await picker.screenshot({ path: `test-results/d1b-picker-on-${vp}.png` });
  // Nothing was submitted: leaving the page creates no event.
});

test("[D1b] create a Pay at entry event through the form -> event page says pay at entry + Reserve @needs-db", async ({ page, browser, isMobile }) => {
  test.setTimeout(120_000);
  const vp = isMobile ? 390 : 1440;
  const title = `E2E D1b picker ${vp} ${Date.now()}`;
  let eventId: string | null = null;

  try {
    await useRuleViewport(page, isMobile);
    await injectPaidSwitch(page, false);
    await gotoDashboard(page, "/dashboard/organiser/events/create");

    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await page.locator('input[name="title"]').fill(title);
    await page.locator('textarea[name="description"]').fill("D1b e2e - created through the picker, pay at the venue.");
    await page.locator('input[name="date"]').fill(ymd(future));
    await page.locator('input[name="startTime"]').fill("19:00");
    await page.locator('input[name="endTime"]').fill("21:00");

    const picker = page.getByTestId("payment-mode-picker");
    await picker.locator('input[value="PAY_AT_ENTRY"]').check();
    await page.locator('input[name="totalSeats"]').fill("20");
    await page.getByPlaceholder("e.g., 199").fill("300");

    await page.getByRole("button", { name: "Save as Draft" }).click();
    await page.waitForURL(/\/dashboard\/organiser\/events\/[^/]+$/, { timeout: 30_000 });
    eventId = new URL(page.url()).pathname.split("/").pop() ?? null;
    expect(eventId).toBeTruthy();

    const orgName = await withQaDb(async (db) => {
      const { rows } = await db.query<{ paymentMode: string; ticketPrice: number; isFree: boolean; orgName: string }>(
        `SELECT e."paymentMode", e."ticketPrice", e."isFree", o."orgName" FROM "Event" e JOIN "Organiser" o ON o.id = e."organiserId" WHERE e.id = $1`,
        [eventId]
      );
      expect(rows[0].paymentMode).toBe("PAY_AT_ENTRY");
      expect(Number(rows[0].ticketPrice)).toBe(300);
      expect(rows[0].isFree).toBe(false);
      await db.query(`UPDATE "Event" SET status = 'APPROVED' WHERE id = $1`, [eventId]);
      return rows[0].orgName;
    });

    const atulCtx = await browser.newContext({ storageState: authFile("atul") });
    const atul = await atulCtx.newPage();
    try {
      await useRuleViewport(atul, isMobile);
      await atul.goto(`/events/${eventId}`);
      await expect(atul.getByText(`₹300 · pay ${orgName} at entry (cash/UPI)`).first()).toBeVisible();
      await expect(atul.getByRole("link", { name: "Reserve", exact: true }).first()).toBeVisible();
      await atul.screenshot({ path: `test-results/d1b-event-page-${vp}.png`, fullPage: false });
    } finally {
      await atulCtx.close();
    }
  } finally {
    if (eventId) {
      await withQaDb(async (db) => {
        await db.query(`DELETE FROM "Notification" WHERE link LIKE $1`, [`%${eventId}%`]).catch(() => undefined);
        await db.query(`DELETE FROM "Booking" WHERE "eventId" = $1`, [eventId]);
        await db.query(`DELETE FROM "TicketTier" WHERE "eventId" = $1`, [eventId]);
        await db.query(`DELETE FROM "Event" WHERE id = $1`, [eventId]);
      });
    }
  }
});
