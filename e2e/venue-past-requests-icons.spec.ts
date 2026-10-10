import { test, expect, gotoDashboard, hideFloatingOverlays } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { useRuleViewport } from "./helpers/viewports";

/**
 * BUG-2610-025 - venue Bookings, "Past Requests" (Hitesh's phone, 8 Oct):
 * the date sat after the calendar emoji, which Android draws as a calendar
 * reading "July 17" next to "1 Oct 2026"; "Message Organiser" led with the
 * speech-bubble emoji; and the amount read ₹37417 while the cards above
 * read ₹37,417. Now: the app's own calendar and message icons (SVG, same
 * on every phone) and the shared formatINR.
 *
 * As Vinayak. The browser's copy of /api/venues/my-bookings gets one
 * CONFIRMED past booking of ₹37,417 (built from his real one), so the row
 * and its Message Organiser button exist whatever QA's bookings are.
 * Read-only. At 390 and 1440, with a screenshot baseline of the row.
 */

test.use({ storageState: authFile("vinayak") });

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{231A}-\u{23FF}]/u;

test.beforeEach(async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  await page.route("**/api/venues/my-bookings**", async (route) => {
    let res: Awaited<ReturnType<typeof route.fetch>>;
    let bookings: Record<string, unknown>[];
    try {
      res = await route.fetch();
      bookings = (await res.json()) as Record<string, unknown>[];
    } catch {
      return;
    }
    const template = bookings[0];
    expect(template, "Vinayak has a venue booking on QA to copy").toBeTruthy();
    await route.fulfill({
      response: res,
      json: [
        ...bookings,
        {
          ...template,
          id: "e2e-past-icons",
          status: "CONFIRMED",
          amount: 37417,
          event: { ...(template.event as object), title: "E2E past icons" },
          fromDate: "2026-10-01T00:00:00.000Z",
          toDate: "2026-10-01T00:00:00.000Z",
        },
      ],
    });
  });
});

test("[BUG-2610-025] Past Requests: calendar and message icons are the app's SVG icons, not emoji, and the amount reads ₹37,417", async ({ page, isMobile }) => {
  await gotoDashboard(page, "/dashboard/venue/bookings");
  await hideFloatingOverlays(page);
  // data-afa-* hooks, not the English text: venue Bookings follows the UI language (GEN-2610-007).
  await expect(page.locator('h2[data-afa-section="past"]')).toHaveText("Past Requests");

  const row = page.getByRole("main").locator("div").filter({ hasText: "E2E past icons" }).filter({ has: page.locator('[data-afa-message-button="VENUE_BOOKING"]') }).last();
  await expect(row).toBeVisible();

  // Money: the shared formatter, the same as the summary cards above.
  await expect(row).toContainText("₹37,417");
  await expect(row).not.toContainText("₹37417");

  // Date line: the calendar icon, then the date; no emoji anywhere in the row.
  const dateLine = row.locator("p").filter({ hasText: "1 Oct 2026" });
  await expect(dateLine.locator('svg[data-afa-icon="calendar"]')).toHaveCount(1);
  const button = row.locator('[data-afa-message-button="VENUE_BOOKING"]');
  await expect(button).toContainText("Message Organiser");
  await expect(button.locator('svg[data-afa-icon="message"]')).toHaveCount(1);
  const text = (await row.innerText()).trim();
  expect(EMOJI.test(text), `no emoji in the row: ${JSON.stringify(text)}`).toBe(false);

  // The icon is centred on its line of text, not sitting on the baseline.
  const [iconBox, lineBox] = await Promise.all([
    dateLine.locator("svg").boundingBox(),
    dateLine.boundingBox(),
  ]);
  expect(iconBox && lineBox).toBeTruthy();
  const iconMid = iconBox!.y + iconBox!.height / 2;
  expect(Math.abs(iconMid - (lineBox!.y + lineBox!.height / 2)), "calendar icon centred on the date line").toBeLessThan(4);

  await row.scrollIntoViewIfNeeded();
  await expect(row).toHaveScreenshot(`past-request-row-${isMobile ? 390 : 1440}.png`, { animations: "disabled" });
});
