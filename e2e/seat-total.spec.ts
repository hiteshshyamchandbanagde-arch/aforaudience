import type { Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { useRuleViewport } from "./helpers/viewports";

/**
 * Seat page price summary with no seats chosen (4 Oct visual check,
 * dispatch C item 6): a paid event said "0 seats ... Free". It now shows
 * no amount ("—") until a seat is chosen; "Free" stays for free events
 * only. At 390 and 1440, signed out, nothing chosen or written.
 */

// scripts/qa-seed.ts jaipurEventId: paid, numbered seats.
const JAIPUR = "qa-jaipur-event-0001";

/** The summary row under the seat choice: "<n> seats" and its amount. */
function summaryRow(page: Page) {
  return page
    .locator("div")
    .filter({ has: page.locator("> span", { hasText: /^0 seats$/ }) })
    .filter({ visible: true })
    .last();
}

test.beforeEach(async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
});

test("seat page (dispatch C item 6): paid event, no seats chosen: the total shows '—', not 'Free'", async ({ page }) => {
  await page.goto(`/events/${JAIPUR}/seats/`);
  const row = summaryRow(page);
  await expect(row).toBeVisible({ timeout: 20_000 });
  await expect(row.locator("> span").last()).toHaveText("—");
  await expect(row.getByText("Free", { exact: true })).toHaveCount(0);
});

test("seat page (dispatch C item 6): free event, no seats chosen: the total still says 'Free'", async ({ page }) => {
  const res = await page.request.get("/api/events");
  expect(res.ok()).toBeTruthy();
  const events = (await res.json()) as { id: string; isFree: boolean; date: string; venue: { seatingMode?: string } | null }[];
  const free = events.find((e) => e.isFree && new Date(e.date) > new Date() && e.venue?.seatingMode !== "NUMBERED");
  expect(free, "QA has an upcoming free event").toBeTruthy();
  await page.goto(`/events/${free!.id}/seats/`);
  const row = summaryRow(page);
  await expect(row).toBeVisible({ timeout: 20_000 });
  await expect(row.locator("> span").last()).toHaveText("Free");
});
