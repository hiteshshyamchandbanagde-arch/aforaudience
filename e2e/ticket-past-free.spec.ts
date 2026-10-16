import type { Page, Route } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { useRuleViewport } from "./helpers/viewports";

/**
 * Tickets B (Hitesh phone pass 13-14 Oct; past-ticket decision 14 Oct).
 *
 *   1. A past confirmed ticket has no QR and no "Scan at door", and still
 *      has Download PDF; an upcoming one still has its QR.
 *   2. A ₹0 booking reads "Free" on its card and in its cancel sheet,
 *      never "₹0".
 *   3. With the cancel sheet open, the wheel does not move the page behind
 *      it; Esc, the backdrop, Keep ticket and the confirm each give the
 *      page back at the same scroll position, and it scrolls again.
 *
 * As Atul, at 390 and 1440. Every booking on the page is served by a route
 * mock (fixed dates, so the past card's screenshot stays the same day to
 * day), and so are the refund preview and the cancel itself: nothing is
 * written to the database, no payment, nothing sent.
 */

test.use({ storageState: authFile("atul") });

const PAST = "e2e-tickets-b-past";
const PAID = "e2e-tickets-b-paid";
const FREE = "e2e-tickets-b-free";

function booking(id: string, title: string, date: string, totalAmount: number) {
  return {
    id,
    seats: { General: 1 },
    tierNames: ["General"],
    totalAmount,
    bookingFeeAmount: totalAmount > 0 ? 20 : 0,
    status: "CONFIRMED",
    expiresAt: null,
    createdAt: "2026-09-01T10:00:00.000Z",
    cancelledAt: null,
    refundAmount: null,
    checkedInAt: null,
    ticketCode: `AFA-${id.slice(-4).toUpperCase()}-TEST`,
    companionTags: [],
    event: { id: `${id}-event`, title, date, startTime: "19:00", type: "COMEDY", posterImage: null, venue: { name: "Test Hall", city: "Pune" } },
  };
}

// Upcoming cards first (the page's own order), then a few more so the page
// is tall enough to scroll at 1440 too, then the past card.
const BOOKINGS = [
  booking(PAID, "Tickets B Paid Night", "2030-03-14T00:00:00.000Z", 520),
  booking(FREE, "Tickets B Free Mic", "2030-03-21T00:00:00.000Z", 0),
  ...[1, 2, 3, 4].map((n) => booking(`e2e-tickets-b-more${n}`, `Tickets B Extra ${n}`, `2030-04-0${n}T00:00:00.000Z`, 300)),
  booking(PAST, "Tickets B Past Show", "2026-09-12T00:00:00.000Z", 300),
];

const PREVIEW: Record<string, object> = {
  [PAID]: { tier: "14plus", paid: 520, refund: 500, bookingFee: 20, feeWithheld: true },
  [FREE]: { tier: "free", paid: 0, refund: 0, bookingFee: 0, feeWithheld: false },
};

async function mockTickets(page: Page) {
  const cancelled: string[] = [];
  await page.route(/\/api\/bookings\/my\/?$/, (route) => route.fulfill({ json: BOOKINGS }));
  await page.route(/\/api\/companions\/mine/, (route) => route.fulfill({ json: { tags: [] } }));
  await page.route(/\/api\/bookings\/(e2e-tickets-b-[^/?]+)\/?$/, (route: Route) => {
    const id = route.request().url().match(/\/api\/bookings\/(e2e-tickets-b-[^/?]+)/)![1];
    if (route.request().method() === "PATCH") {
      cancelled.push(id);
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: { booking: { id, refundPreview: PREVIEW[id] } } });
  });
  return cancelled;
}

function card(page: Page, title: string) {
  return page.locator(".afa-tickets-grid > div").filter({ hasText: title });
}

test("[Tickets B] a past ticket has no QR and no Scan at door, keeps Download PDF; upcoming keeps its QR", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  await mockTickets(page);
  await page.goto("/tickets/");

  const past = card(page, "Tickets B Past Show");
  await expect(past, "the past card").toBeVisible({ timeout: 20_000 });
  await expect(past.locator('img[src^="data:image/png"]'), "past: no QR").toHaveCount(0);
  await expect(past.getByText("Scan at door"), "past: no Scan at door").toHaveCount(0);
  await expect(past.locator(`a[href^="/api/bookings/${PAST}/ticket"]`), "past: Download PDF").toHaveText(/Download PDF/);
  await expect(past.getByRole("button", { name: "Cancel ticket" }), "past: no Cancel").toHaveCount(0);

  const upcoming = card(page, "Tickets B Paid Night");
  await expect(upcoming.locator('img[src^="data:image/png"]'), "upcoming: QR").toHaveCount(1);
  await expect(upcoming.getByText("Scan at door"), "upcoming: Scan at door").toBeVisible();
  await expect(upcoming.locator(`a[href^="/api/bookings/${PAID}/ticket"]`)).toHaveText(/Download PDF/);

  await page.evaluate(() => document.fonts.ready);
  await past.scrollIntoViewIfNeeded();
  await expect(past).toHaveScreenshot(`ticket-past-${isMobile ? 390 : 1440}.png`, { maxDiffPixelRatio: 0.02 });
});

test("[Tickets B] a ₹0 booking reads Free on its card and in its cancel sheet, not ₹0", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  await mockTickets(page);
  await page.goto("/tickets/");

  const free = card(page, "Tickets B Free Mic");
  await expect(free, "the free card").toBeVisible({ timeout: 20_000 });
  await expect(free.locator("[data-afa-ticket-paid]"), "card amount").toHaveText("Free");
  await expect(free, "no ₹0 on the card").not.toContainText("₹0");
  await expect(card(page, "Tickets B Paid Night").locator("[data-afa-ticket-paid]"), "a paid card keeps its amount").toHaveText("₹520");

  await free.getByRole("button", { name: "Cancel ticket" }).click();
  const sheet = page.getByRole("dialog", { name: "Cancel this ticket?" });
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('[data-afa-refund-line="paid"]'), "sheet paid line").toContainText("Free");
  await expect(sheet.locator('[data-afa-refund-line="paid"]')).not.toContainText("₹0");
  await sheet.getByRole("button", { name: "Keep ticket" }).click();
  await expect(sheet).toBeHidden();
});

test("[Tickets B] the cancel sheet locks the page behind it and gives back the same scroll position", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  const cancelled = await mockTickets(page);
  await page.goto("/tickets/");
  const paid = card(page, "Tickets B Paid Night");
  await expect(paid).toBeVisible({ timeout: 20_000 });
  await expect(card(page, "Tickets B Past Show")).toBeVisible();

  const scrollY = () => page.evaluate(() => window.scrollY);
  const room = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  expect(room, "the page is tall enough to scroll").toBeGreaterThan(600);

  const cancel = paid.getByRole("button", { name: "Cancel ticket" });
  const sheet = page.getByRole("dialog", { name: "Cancel this ticket?" });
  const vp = page.viewportSize()!;

  // Opens the sheet from a known scroll position, checks the wheel over the
  // backdrop does not move the page, closes it with `close`, then checks
  // the page is back where it was and scrolls again.
  async function check(how: string, close: () => Promise<void>) {
    await cancel.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 120));
    await cancel.click();
    await expect(sheet, `${how}: sheet open`).toBeVisible();
    const before = await scrollY();
    expect(room - before, `${how}: room left to scroll`).toBeGreaterThan(300);
    await page.mouse.move(vp.width / 2, 20);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(400);
    expect(await scrollY(), `${how}: the page behind the open sheet did not scroll`).toBe(before);

    await close();
    await expect(sheet, `${how}: sheet closed`).toBeHidden();
    expect(await scrollY(), `${how}: scroll position restored`).toBe(before);
    await page.mouse.move(vp.width / 2, vp.height / 2);
    await page.mouse.wheel(0, 200);
    await expect.poll(scrollY, { message: `${how}: the page scrolls again` }).toBeGreaterThan(before);
  }

  await check("Esc", () => page.keyboard.press("Escape"));
  await check("backdrop", () => page.locator("[data-afa-confirm-scrim]").click({ position: { x: 10, y: 10 } }));
  await check("Keep ticket", () => sheet.getByRole("button", { name: "Keep ticket" }).click());
  expect(cancelled, "nothing cancelled yet").toEqual([]);
  await check("confirm", () => sheet.getByRole("button", { name: "Cancel ticket" }).click());
  expect(cancelled, "the (mocked) cancel went through").toEqual([PAID]);
});
