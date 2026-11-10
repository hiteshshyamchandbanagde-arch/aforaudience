import { test, expect, gotoDashboard } from "./helpers/test";
import { authFile } from "./helpers/personas";
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
