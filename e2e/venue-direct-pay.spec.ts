import { test, expect, gotoDashboard } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { DIRECT_PAY_FULL_REFUND_MIN_DAYS } from "../src/lib/direct-pay-terms";
import { withQaDb } from "./helpers/qa-db";
import { useRuleViewport } from "./helpers/viewports";

/**
 * D2 (Hitesh, 8 Nov) - Organiser -> Venue owner bookings paid DIRECTLY.
 *
 * Omkar (organiser) requests Vinayak's venue; Vinayak accepts; the booking
 * waits for payment (fee 0, 48 h window) and Omkar's view shows the payee
 * block with Vinayak's UPI ID and the "AforAudience does not collect" note.
 * Omkar taps "I've paid" with a reference, Vinayak taps "Confirm payment
 * received" -> CONFIRMED. A second request is declined. Who-may-act is
 * checked on the API (Vinayak cannot mark paid, Omkar cannot confirm).
 *
 * Switch state: the accept sends paymentMethod 'DIRECT', so the run does
 * not depend on, and never flips, the global QA paid-bookings setting.
 *
 * Regression shape: on origin/qa accept goes straight to CONFIRMED with a
 * ₹199 fee and there is no direct-pay state, so this fails; on the branch
 * it passes.
 *
 * Needs migration 20261109120000_add_venue_direct_pay on QA.
 * Writes data: two events + their venue bookings (deleted in finally), and
 * Vinayak's UPI ID and QR (restored to its previous value in finally, T6).
 */
test.use({ storageState: authFile("omkar") });

const TEST_UPI = "vinayak.e2e@okaxis";
// D2b - optional owner UPI QR (an https image URL from the existing upload).
const TEST_QR = "https://example.com/e2e-d2b-upi-qr.png";

function ymd(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

test("[D2] venue direct pay: request -> accept (UPI shown) -> I've paid -> owner confirms; decline @needs-db", async ({ page, browser, isMobile }) => {
  test.setTimeout(150_000);
  const vp = isMobile ? 390 : 1440;
  const stamp = Date.now();
  const eventIds: string[] = [];

  const { venueId, ownerId, prevUpi, prevQr } = await withQaDb(async (db) => {
    const { rows } = await db.query<{ venueId: string; ownerId: string; upiId: string | null; upiQrUrl: string | null }>(
      `SELECT v.id AS "venueId", vo.id AS "ownerId", vo."upiId", vo."upiQrUrl"
         FROM "Venue" v JOIN "VenueOwner" vo ON vo.id = v."ownerId" JOIN "User" u ON u.id = vo."userId"
        WHERE u.email = 'vinayak.venue@aforaudience.qa' AND v."isApproved" = true AND vo."isApproved" = true
        ORDER BY v."createdAt" ASC LIMIT 1`
    );
    expect(rows.length, "Vinayak needs an approved venue on QA").toBe(1);
    return { venueId: rows[0].venueId, ownerId: rows[0].ownerId, prevUpi: rows[0].upiId, prevQr: rows[0].upiQrUrl };
  });

  // Far-future, per-run dates so no confirmed booking overlaps.
  const dayOffset = 400 + (stamp % 200) + (isMobile ? 0 : 250);
  const day = (n: number) => ymd(new Date(Date.now() + n * 24 * 60 * 60 * 1000));

  const vinCtx = await browser.newContext({ storageState: authFile("vinayak") });
  const vin = await vinCtx.newPage();
  try {
    // --- Vinayak saves a UPI ID (restored in finally) ---
    const upi = await vin.request.patch("/api/venue-owners/me", { data: { upiId: TEST_UPI } });
    expect(upi.status(), await upi.text()).toBe(200);
    const badUpi = await vin.request.patch("/api/venue-owners/me", { data: { upiId: "not a upi" } });
    expect(badUpi.status()).toBe(400);
    // D2b - optional QR: https only, read back from the profile API.
    const qr = await vin.request.patch("/api/venue-owners/me", { data: { upiQrUrl: TEST_QR } });
    expect(qr.status(), await qr.text()).toBe(200);
    expect((await qr.json()).upiQrUrl).toBe(TEST_QR);
    const badQr = await vin.request.patch("/api/venue-owners/me", { data: { upiQrUrl: "javascript:alert(1)" } });
    expect(badQr.status()).toBe(400);

    // --- Omkar: two draft events + two venue requests ---
    const request = async (label: string, offset: number) => {
      const ev = await page.request.post("/api/events", {
        data: {
          title: `E2E D2 ${label} ${vp} ${stamp}`,
          description: "D2 e2e - venue paid directly.",
          type: "OPEN_MIC",
          // Inside the 3-month event-creation window; only the venue
          // booking uses the far-future day.
          date: day(30),
          startTime: "19:00",
          endTime: "21:00",
          isFree: true,
          totalSeats: 20,
        },
      });
      expect(ev.status(), await ev.text()).toBeLessThan(300);
      const evBody = await ev.json();
      const eventId = (evBody.event?.id ?? evBody.id) as string;
      eventIds.push(eventId);
      const vb = await page.request.post("/api/venue-bookings", {
        data: { venueId, eventId, fromDate: day(offset), toDate: day(offset), amount: 4500 },
      });
      expect(vb.status(), await vb.text()).toBe(201);
      return (await vb.json()).id as string;
    };
    const bookingId = await request("Pay", dayOffset);
    const declineId = await request("Decline", dayOffset + 1);

    // --- Vinayak accepts -> awaiting direct payment, fee 0, 48 h ---
    const before = Date.now();
    const accept = await vin.request.patch(`/api/venue-bookings/${bookingId}`, {
      data: { status: "CONFIRMED", paymentMethod: "DIRECT" },
    });
    expect(accept.status(), await accept.text()).toBe(200);
    const accepted = await accept.json();
    expect(accepted.status).toBe("PENDING");
    expect(accepted.directPayStatus).toBe("AWAITING_PAYMENT");
    expect(accepted.paymentMethod).toBe("DIRECT");
    expect(accepted.platformFeeAmount).toBe(0);
    const windowMs = new Date(accepted.expiresAt).getTime() - before;
    expect(windowMs).toBeGreaterThan(47.9 * 60 * 60 * 1000);
    expect(windowMs).toBeLessThan(48.1 * 60 * 60 * 1000);

    // Who may act.
    const vinMarks = await vin.request.post(`/api/venue-bookings/${bookingId}/direct-pay`, { data: { action: "markPaid" } });
    expect(vinMarks.status()).toBe(403);
    const omkarConfirms = await page.request.post(`/api/venue-bookings/${bookingId}/direct-pay`, { data: { action: "confirmReceived" } });
    expect(omkarConfirms.status()).toBe(403);

    // --- Omkar's view: payee block, then "I've paid" ---
    await useRuleViewport(page, isMobile);
    await gotoDashboard(page, "/dashboard/venue-requests");
    const card = page.locator(`[data-afa-direct-pay-booking="${bookingId}"]`);
    await expect(card.locator('[data-afa-direct-pay-chip="awaitingPayment"]')).toBeVisible();
    const payee = card.locator("[data-afa-payee-block]");
    await expect(payee.locator("[data-afa-payee-upi]")).toHaveText(TEST_UPI);
    await expect(payee.locator("[data-afa-payee-amount]")).toHaveText("₹4,500");
    await expect(payee.locator("[data-afa-payee-note]")).toContainText("directly. AforAudience does not collect or hold this payment.");
    // S1b-c1 - direct cash/UPI only: the pay step says AFA never collects.
    await expect(payee.locator("[data-afa-direct-pay-disclosure]")).toHaveText(/^Pay .+ directly by UPI or cash\. AFA doesn't collect this money\.$/);
    // 12 Nov - the direct-pay 15-day standard term sits under the disclosure line.
    await expect(payee.locator("[data-afa-direct-pay-refund-term]")).toHaveText(
      `Cancel ${DIRECT_PAY_FULL_REFUND_MIN_DAYS}+ days before the date: full refund of any advance. Inside ${DIRECT_PAY_FULL_REFUND_MIN_DAYS} days: as you both agree.`,
    );
    await expect(payee.locator("[data-afa-payee-qr]")).toHaveAttribute("src", TEST_QR);
    await payee.scrollIntoViewIfNeeded();
    await payee.screenshot({ path: `test-results/d2-payee-block-${vp}.png` });

    await card.getByRole("textbox", { name: "UPI reference (optional)" }).fill("UTR-E2E-123");
    await card.getByRole("button", { name: "I've paid" }).click();
    await expect(card.locator('[data-afa-direct-pay-chip="paymentMarked"]')).toBeVisible();

    // --- Vinayak confirms receipt ---
    await useRuleViewport(vin, isMobile);
    await gotoDashboard(vin, "/dashboard/venue/bookings");
    const vCard = vin.locator(`[data-afa-direct-pay-booking="${bookingId}"]`);
    await expect(vCard.locator('[data-afa-direct-pay-chip="paymentMarked"]')).toBeVisible();
    await expect(vCard).toContainText("UTR-E2E-123");
    await vCard.locator("[data-afa-payee-block]").screenshot({ path: `test-results/d2-owner-payee-block-${vp}.png` });
    await vCard.getByRole("button", { name: "Confirm payment received" }).click();
    await expect(vCard.locator('[data-afa-direct-pay-chip="confirmed"]')).toBeVisible();

    // --- Decline the second request ---
    const decline = await vin.request.patch(`/api/venue-bookings/${declineId}`, { data: { status: "CANCELLED" } });
    expect(decline.status(), await decline.text()).toBe(200);

    const rows = await withQaDb(async (db) => {
      const { rows } = await db.query<{ id: string; status: string; directPayStatus: string | null; payerReference: string | null; confirmedAt: Date | null }>(
        `SELECT id, status, "directPayStatus", "payerReference", "confirmedAt" FROM "VenueBooking" WHERE id = ANY($1)`,
        [[bookingId, declineId]]
      );
      return rows;
    });
    const paid = rows.find((r) => r.id === bookingId)!;
    expect(paid.status).toBe("CONFIRMED");
    expect(paid.directPayStatus).toBe("CONFIRMED");
    expect(paid.payerReference).toBe("UTR-E2E-123");
    expect(paid.confirmedAt).toBeTruthy();
    const declined = rows.find((r) => r.id === declineId)!;
    expect(declined.status).toBe("CANCELLED");
    expect(declined.directPayStatus).toBeNull();
  } finally {
    await vinCtx.close();
    await withQaDb(async (db) => {
      if (eventIds.length) {
        await db.query(`DELETE FROM "VenueBooking" WHERE "eventId" = ANY($1)`, [eventIds]);
        await db.query(`DELETE FROM "TicketTier" WHERE "eventId" = ANY($1)`, [eventIds]);
        await db.query(`DELETE FROM "Event" WHERE id = ANY($1)`, [eventIds]);
      }
      await db.query(`UPDATE "VenueOwner" SET "upiId" = $2, "upiQrUrl" = $3 WHERE id = $1`, [ownerId, prevUpi, prevQr]);
    });
  }
});

/**
 * 12 Nov (Hitesh) - cancel after CONFIRMED + refund tracking. AFA moves no
 * money: it records who cancelled, when, and whether the advance is due
 * back under the 15-day term (DUE) or left to the parties (AS_AGREED); the
 * organiser (the payer) then confirms receipt.
 *
 * Fixture: a CONFIRMED direct-pay booking (confirmedAt set = the owner
 * confirmed receipt of the advance) on Vinayak's venue for Omkar, inserted
 * straight into QA and deleted in finally (T6). Getting to CONFIRMED
 * through the UI is already covered by the [D2] test above.
 *
 * Regression shape: on origin/qa there is no "Cancel booking" on a
 * confirmed booking, the API refuses cancelConfirmed / refundReceived with
 * 400 "Invalid action", and the refund columns don't exist, so this fails;
 * on the branch it passes.
 *
 * Needs migration 20261112120000_add_direct_pay_refund_tracking on QA.
 */
async function seedConfirmed(daysOut: number, tag: string): Promise<string> {
  return withQaDb(async (db) => {
    const { rows } = await db.query<{ venueId: string; organiserId: string }>(
      `SELECT v.id AS "venueId", o.id AS "organiserId"
         FROM "Venue" v JOIN "VenueOwner" vo ON vo.id = v."ownerId" JOIN "User" vu ON vu.id = vo."userId",
              "Organiser" o JOIN "User" ou ON ou.id = o."userId"
        WHERE vu.email = 'vinayak.venue@aforaudience.qa' AND v."isApproved" = true AND vo."isApproved" = true
          AND ou.email = 'omkar.organiser@aforaudience.qa'
        ORDER BY v."createdAt" ASC LIMIT 1`
    );
    expect(rows.length, "Vinayak's approved venue + Omkar's organiser on QA").toBe(1);
    const id = `e2e-refund-${tag}-${Date.now()}`;
    const from = new Date(Date.now() + daysOut * 24 * 60 * 60 * 1000);
    await db.query(
      `INSERT INTO "VenueBooking" (id, "venueId", "organiserId", "fromDate", "toDate", status, amount,
              "paymentMethod", "directPayStatus", "paidMarkedAt", "confirmedAt", "platformFeeAmount")
       VALUES ($1, $2, $3, $4, $4, 'CONFIRMED', 4500, 'DIRECT', 'CONFIRMED', now(), now(), 0)`,
      [id, rows[0].venueId, rows[0].organiserId, from]
    );
    return id;
  });
}

async function readRefund(id: string) {
  return withQaDb(async (db) => {
    const { rows } = await db.query<{
      status: string; directPayStatus: string; directRefundStatus: string | null;
      cancelledBy: string | null; cancelledAt: Date | null; refundReceivedAt: Date | null;
    }>(
      `SELECT status, "directPayStatus", "directRefundStatus", "cancelledBy", "cancelledAt", "refundReceivedAt"
         FROM "VenueBooking" WHERE id = $1`,
      [id]
    );
    return rows[0];
  });
}

async function dropBookings(ids: string[]) {
  if (!ids.length) return;
  await withQaDb((db) => db.query(`DELETE FROM "VenueBooking" WHERE id = ANY($1)`, [ids]));
}

test("[D2-refund] organiser cancels a CONFIRMED booking 15+ days out -> Refund due -> I've received the refund @needs-db", async ({ page, browser, isMobile }) => {
  test.setTimeout(120_000);
  const vp = isMobile ? 390 : 1440;
  const ids: string[] = [];
  const vinCtx = await browser.newContext({ storageState: authFile("vinayak") });
  const vin = await vinCtx.newPage();
  try {
    // Far enough out that IST calendar days are >= 15 at any time of day.
    const id = await seedConfirmed(DIRECT_PAY_FULL_REFUND_MIN_DAYS + 10, `due-${vp}`);
    ids.push(id);

    await useRuleViewport(page, isMobile);
    await gotoDashboard(page, "/dashboard/venue-requests");
    const card = page.locator(`[data-afa-direct-pay-booking="${id}"]`);
    await expect(card.locator('[data-afa-direct-pay-chip="confirmed"]')).toBeVisible();
    await card.getByRole("button", { name: "Cancel booking" }).click();

    // The dialog states the outcome before anything changes.
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Cancel this confirmed booking?");
    await expect(dialog.locator('[data-afa-cancel-outcome="DUE"]')).toHaveText(
      `You are cancelling ${DIRECT_PAY_FULL_REFUND_MIN_DAYS}+ days before the date, so the ₹4,500 advance is due back in full under the ${DIRECT_PAY_FULL_REFUND_MIN_DAYS}-day term.` +
        "AforAudience does not hold this money. The venue owner refunds the organiser directly."
    );
    await dialog.screenshot({ path: `test-results/d2-refund-dialog-due-${vp}.png` });
    await dialog.getByRole("button", { name: "Cancel booking" }).click();

    await expect(card.locator('[data-afa-direct-pay-chip="cancelled"]')).toBeVisible();
    await expect(card.locator('[data-afa-refund-chip="DUE"]')).toHaveText("Refund due");
    await expect(card.locator('[data-afa-cancelled-by="ORGANISER"]')).toContainText("Cancelled by the organiser on ");
    await card.screenshot({ path: `test-results/d2-refund-chip-due-${vp}.png` });

    let row = await readRefund(id);
    expect(row.status).toBe("CANCELLED");
    expect(row.directPayStatus).toBe("CANCELLED");
    expect(row.directRefundStatus).toBe("DUE");
    expect(row.cancelledBy).toBe("ORGANISER");
    expect(row.cancelledAt).toBeTruthy();

    // The venue owner sees the same chip, and cannot mark the refund received.
    await useRuleViewport(vin, isMobile);
    await gotoDashboard(vin, "/dashboard/venue/bookings");
    const vCard = vin.locator(`[data-afa-direct-pay-booking="${id}"]`);
    await expect(vCard.locator('[data-afa-refund-chip="DUE"]')).toHaveText("Refund due");
    await expect(vCard.getByRole("button", { name: "I've received the refund" })).toHaveCount(0);
    const ownerMarks = await vin.request.post(`/api/venue-bookings/${id}/direct-pay`, { data: { action: "refundReceived" } });
    expect(ownerMarks.status()).toBe(403);

    // A cancelled booking can't be cancelled again.
    const again = await page.request.post(`/api/venue-bookings/${id}/direct-pay`, { data: { action: "cancelConfirmed" } });
    expect(again.status()).toBe(400);

    // The organiser confirms the refund arrived.
    await card.getByRole("button", { name: "I've received the refund" }).click();
    await expect(card.locator('[data-afa-refund-chip="RECEIVED"]')).toContainText("Refund received ✓");
    await expect(card.getByRole("button", { name: "I've received the refund" })).toHaveCount(0);
    await card.screenshot({ path: `test-results/d2-refund-chip-received-${vp}.png` });
    const second = await page.request.post(`/api/venue-bookings/${id}/direct-pay`, { data: { action: "refundReceived" } });
    expect(second.status()).toBe(400);

    row = await readRefund(id);
    expect(row.directRefundStatus).toBe("RECEIVED");
    expect(row.refundReceivedAt).toBeTruthy();
  } finally {
    await vinCtx.close();
    await dropBookings(ids);
  }
});

test("[D2-refund] venue owner cancels a CONFIRMED booking inside 15 days -> Refund as agreed; started booking refused @needs-db", async ({ page, browser, isMobile }) => {
  test.setTimeout(120_000);
  const vp = isMobile ? 390 : 1440;
  const ids: string[] = [];
  const vinCtx = await browser.newContext({ storageState: authFile("vinayak") });
  const vin = await vinCtx.newPage();
  try {
    const id = await seedConfirmed(5, `asagreed-${vp}`);
    const started = await seedConfirmed(-1, `started-${vp}`);
    ids.push(id, started);

    await useRuleViewport(vin, isMobile);
    await gotoDashboard(vin, "/dashboard/venue/bookings");
    const vCard = vin.locator(`[data-afa-direct-pay-booking="${id}"]`);
    await expect(vCard.locator('[data-afa-direct-pay-chip="confirmed"]')).toBeVisible();
    await vCard.getByRole("button", { name: "Cancel booking" }).click();
    const dialog = vin.getByRole("dialog");
    await expect(dialog.locator('[data-afa-cancel-outcome="AS_AGREED"]')).toContainText(
      `You are cancelling inside ${DIRECT_PAY_FULL_REFUND_MIN_DAYS} days of the date, so any refund of the ₹4,500 advance is as you both agree.`
    );
    await dialog.screenshot({ path: `test-results/d2-refund-dialog-asagreed-${vp}.png` });
    await dialog.getByRole("button", { name: "Cancel booking" }).click();
    await expect(vCard.locator('[data-afa-refund-chip="AS_AGREED"]')).toHaveText("Refund as agreed");
    await expect(vCard.locator('[data-afa-cancelled-by="VENUE_OWNER"]')).toContainText("Cancelled by the venue owner on ");

    const row = await readRefund(id);
    expect(row.directRefundStatus).toBe("AS_AGREED");
    expect(row.cancelledBy).toBe("VENUE_OWNER");

    // The organiser sees it too, with the received button.
    await useRuleViewport(page, isMobile);
    await gotoDashboard(page, "/dashboard/venue-requests");
    const card = page.locator(`[data-afa-direct-pay-booking="${id}"]`);
    await expect(card.locator('[data-afa-refund-chip="AS_AGREED"]')).toHaveText("Refund as agreed");
    await expect(card.getByRole("button", { name: "I've received the refund" })).toBeVisible();
    await card.screenshot({ path: `test-results/d2-refund-chip-asagreed-${vp}.png` });

    // A booking that has already started can't be cancelled (no button, API 400).
    const sCard = page.locator(`[data-afa-direct-pay-booking="${started}"]`);
    await expect(sCard.locator('[data-afa-direct-pay-chip="confirmed"]')).toBeVisible();
    await expect(sCard.getByRole("button", { name: "Cancel booking" })).toHaveCount(0);
    const late = await page.request.post(`/api/venue-bookings/${started}/direct-pay`, { data: { action: "cancelConfirmed" } });
    expect(late.status()).toBe(400);
    expect((await readRefund(started)).directPayStatus).toBe("CONFIRMED");
  } finally {
    await vinCtx.close();
    await dropBookings(ids);
  }
});
