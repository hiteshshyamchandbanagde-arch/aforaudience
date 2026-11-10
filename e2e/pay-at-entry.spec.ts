import { test, expect, gotoDashboard } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { withQaDb } from "./helpers/qa-db";
import { useRuleViewport } from "./helpers/viewports";

/**
 * D1 (Hitesh, 8 Nov) - "Pay at entry" + attendance tracking.
 *
 * Omkar (organiser) creates a priced PAY_AT_ENTRY event; Atul (audience)
 * reserves 2 seats and then 1 more (a second booking). The event page
 * shows "pay <organiser> at entry", the no-collect line and a Reserve
 * button (no Pay/checkout); My Tickets shows the "Pay at entry" badge.
 * Omkar checks the first booking in from the guest list (Attended) and
 * marks the second one No-show.
 *
 * Regression shape: on origin/qa there is no paymentMode, a priced event
 * is refused while the paid switch is off and nothing renders the
 * pay-at-entry line, so this fails; on the branch it passes.
 *
 * Needs migration 20261108180000_add_pay_at_entry_attendance on QA.
 * Writes data: one event + its bookings, all deleted in finally (T6).
 * Persona state (city, profile, roles) is never touched.
 */
test.use({ storageState: authFile("omkar") });

function ymd(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

test("[D1] pay-at-entry: reserve 2 seats, ticket says pay at entry, check-in = Attended, second booking No-show @needs-db", async ({ page, browser, isMobile }) => {
  test.setTimeout(120_000);
  const vp = isMobile ? 390 : 1440;
  const title = `E2E D1 Pay at entry ${vp} ${Date.now()}`;
  let eventId: string | null = null;

  try {
    // --- Omkar creates a priced PAY_AT_ENTRY event (draft), approved via DB ---
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const create = await page.request.post("/api/events", {
      data: {
        title,
        description: "D1 e2e - pay the organiser at the venue.",
        type: "OPEN_MIC",
        date: ymd(future),
        startTime: "19:00",
        endTime: "21:00",
        isFree: false,
        ticketPrice: 300,
        totalSeats: 20,
        paymentMode: "PAY_AT_ENTRY",
      },
    });
    expect(create.status(), await create.text()).toBeLessThan(300);
    const created = await create.json();
    eventId = (created.event?.id ?? created.id) as string;
    expect(eventId).toBeTruthy();

    const orgName = await withQaDb(async (db) => {
      await db.query(`UPDATE "Event" SET status = 'APPROVED' WHERE id = $1`, [eventId]);
      const { rows } = await db.query<{ paymentMode: string; orgName: string }>(
        `SELECT e."paymentMode", o."orgName" FROM "Event" e JOIN "Organiser" o ON o.id = e."organiserId" WHERE e.id = $1`,
        [eventId]
      );
      expect(rows[0].paymentMode).toBe("PAY_AT_ENTRY");
      return rows[0].orgName;
    });

    // --- Atul: event page CTA, then reserve 2 seats + 1 seat ---
    const atulCtx = await browser.newContext({ storageState: authFile("atul") });
    const atul = await atulCtx.newPage();
    try {
      await useRuleViewport(atul, isMobile);
      await atul.goto(`/events/${eventId}`);
      await expect(atul.getByText(`₹300 · pay ${orgName} at entry (cash/UPI)`).first()).toBeVisible();
      await expect(atul.getByText("AforAudience does not collect this payment.").first()).toBeVisible();
      await expect(atul.getByRole("link", { name: "Reserve", exact: true }).first()).toBeVisible();
      await expect(atul.getByText("Booking opens soon")).toHaveCount(0);
      await expect(atul.getByText(/Secure payment by Razorpay/)).toHaveCount(0);
      await atul.screenshot({ path: `test-results/d1-event-cta-${vp}.png`, fullPage: false });

      const five = await atul.request.post("/api/bookings", { data: { eventId, seats: { General: 5 } } });
      expect(five.status(), "pay-at-entry is capped at 4 seats").toBe(400);

      const first = await atul.request.post("/api/bookings", { data: { eventId, seats: { General: 2 } } });
      expect(first.status(), await first.text()).toBe(201);
      const firstBody = await first.json();
      expect(firstBody.payment).toBeUndefined();
      expect(firstBody.booking.status).toBe("CONFIRMED");
      expect(firstBody.booking.paymentMethod).toBe("AT_ENTRY");
      expect(firstBody.booking.bookingFeeAmount).toBe(0);
      expect(firstBody.booking.totalAmount).toBe(600);

      const second = await atul.request.post("/api/bookings", { data: { eventId, seats: { General: 1 } } });
      expect(second.status(), await second.text()).toBe(201);

      // My Tickets: badge, no Pay button.
      await gotoDashboard(atul, "/tickets");
      await expect(atul.locator("[data-afa-pay-at-entry-badge]").filter({ hasText: "Pay at entry · ₹600" }).first()).toBeVisible();
      // S1b-c1 - the pay-at-entry ticket notice says AFA never collects.
      await expect(atul.locator("[data-afa-direct-pay-disclosure]").filter({ hasText: "Pay the organiser at the venue. AFA doesn't collect this money." }).first()).toBeVisible();
      await expect(atul.getByRole("button", { name: /^Pay/ })).toHaveCount(0);
    } finally {
      await atulCtx.close();
    }

    // --- Event has started: Omkar's guest list (check in, mark no-show) ---
    await withQaDb(async (db) => {
      const start = new Date(Date.now() - 60 * 60 * 1000);
      const hh = String(start.getHours()).padStart(2, "0");
      const mm = String(start.getMinutes()).padStart(2, "0");
      const day = new Date(start);
      day.setHours(0, 0, 0, 0);
      await db.query(
        `UPDATE "Event" SET date = $2, "startTime" = $3, "endTime" = '23:59' WHERE id = $1`,
        [eventId, day, `${hh}:${mm}`]
      );
    });

    await useRuleViewport(page, isMobile);
    await gotoDashboard(page, `/dashboard/organiser/events/${eventId}/checkin`);
    await page.getByRole("button", { name: /Attendee list/i }).click();
    await expect(page.locator("[data-afa-due-at-entry]").filter({ hasText: "Due at entry: ₹600" })).toBeVisible();
    await expect(page.locator("[data-afa-attendance-counts]")).toContainText("Reserved 2");

    await page.locator("[data-afa-row-checkin]").first().click();
    await expect(page.locator("[data-afa-attendance-counts]")).toContainText("Attended 1");
    await page.locator("[data-afa-row-no-show]").first().click();
    await expect(page.locator("[data-afa-attendance-counts]")).toContainText("No-show 1");
    await expect(page.locator("[data-afa-attendance-counts]")).toContainText("Reserved 0");
    await page.screenshot({ path: `test-results/d1-guest-list-${vp}.png`, fullPage: false });

    const states = await withQaDb(async (db) => {
      const { rows } = await db.query<{ attendance: string; checkedInAt: Date | null; totalAmount: number }>(
        `SELECT attendance, "checkedInAt", "totalAmount" FROM "Booking" WHERE "eventId" = $1 ORDER BY "totalAmount" DESC`,
        [eventId]
      );
      return rows;
    });
    expect(states.map((r) => r.attendance).sort()).toEqual(["ATTENDED", "NO_SHOW"]);
    expect(states.find((r) => r.attendance === "ATTENDED")?.checkedInAt).toBeTruthy();
  } finally {
    if (eventId) {
      await withQaDb(async (db) => {
        // No Notification table on QA: a failing DELETE there would abort this
        // transaction and roll the whole cleanup back.
        await db.query(`DELETE FROM "Booking" WHERE "eventId" = $1`, [eventId]);
        await db.query(`DELETE FROM "TicketTier" WHERE "eventId" = $1`, [eventId]);
        await db.query(`DELETE FROM "Event" WHERE id = $1`, [eventId]);
      });
    }
  }
});
