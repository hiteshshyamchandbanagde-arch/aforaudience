import { test, expect, gotoDashboard } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { useRuleViewport } from "./helpers/viewports";

/**
 * BUG-2608-091 - venue Bookings, "Past Requests": each row showed only
 * venue · organiser · amount, so two past bookings of the same venue by
 * the same organiser for the same amount looked identical. Each row now
 * shows the booking date, plus the end date when it runs over several
 * days, in the shared date format the Pending cards use.
 *
 * As Vinayak. The browser's copy of /api/venues/my-bookings gets two past
 * rows with known dates (one day; three days) built from his real one,
 * so the check does not depend on QA's bookings. Read-only. At 390 and 1440.
 */

test.use({ storageState: authFile("vinayak") });

test.beforeEach(async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
});

test("[BUG-2608-091] Past Requests rows show the booking date, and the end date when multi-day", async ({ page }) => {
  await page.route("**/api/venues/my-bookings**", async (route) => {
    // A request the page gave up on (it can ask twice while settling)
    // is disposed mid-fetch; let that one go, the next is answered here.
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
    const past = (id: string, fromDate: string, toDate: string) => ({
      ...template,
      id,
      status: "CANCELLED",
      amount: 4321,
      event: { ...(template.event as object), title: `E2E past ${id}` },
      fromDate,
      toDate,
    });
    await route.fulfill({
      response: res,
      json: [
        ...bookings,
        past("e2e-past-1", "2026-03-15T00:00:00.000Z", "2026-03-15T00:00:00.000Z"),
        past("e2e-past-2", "2026-04-10T00:00:00.000Z", "2026-04-12T00:00:00.000Z"),
      ],
    });
  });
  await gotoDashboard(page, "/dashboard/venue/bookings");

  // data-afa-* hooks, not the English text: venue Bookings follows the UI language (GEN-2610-007).
  await expect(page.locator('h2[data-afa-section="past"]')).toHaveText("Past Requests");
  const oneDay = page.getByRole("main").locator("div").filter({ hasText: "E2E past e2e-past-1" }).filter({ hasText: "₹4,321" }).last();
  const multiDay = page.getByRole("main").locator("div").filter({ hasText: "E2E past e2e-past-2" }).filter({ hasText: "₹4,321" }).last();
  await expect(oneDay).toContainText("15 Mar 2026");
  await expect(oneDay).not.toContainText("–");
  await expect(multiDay).toContainText("10 Apr 2026 – 12 Apr 2026");
});
