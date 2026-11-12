import { test, expect, gotoDashboard } from "./helpers/test";
import type { Page } from "@playwright/test";
import { authFile } from "./helpers/personas";
import { DIRECT_PAY_FULL_REFUND_MIN_DAYS } from "../src/lib/direct-pay-terms";
import { withQaDb } from "./helpers/qa-db";
// Aliased: not a React hook, the lint rule only goes by the "use" prefix.
import { useRuleViewport as setRuleViewport } from "./helpers/viewports";

/**
 * D3 (Hitesh, 8 Nov) - Organiser <-> Artist performance fees paid DIRECTLY.
 *
 * PAID gig: Omkar (organiser) approves Hrithik (artist) at a ₹1,500 fee ->
 * the slot waits 48 h on payment; Omkar's lineup shows the payee block with
 * Hrithik's UPI ID + the "AforAudience does not collect" note; Omkar taps
 * "I've paid", Hrithik confirms on his dashboard -> CONFIRMED.
 * BUY_IN spot: the other way round - Hrithik pays Omkar ₹200, Omkar confirms.
 * Who-may-act is checked on the API in both directions.
 *
 * Switch state: approve sends paymentMethod 'DIRECT', so the run never
 * depends on, or flips, the global QA paid-bookings setting.
 *
 * Regression shape: on origin/qa an approved PAID/BUY_IN slot only records
 * the amount (no direct-pay state, no step endpoint), so this fails; on the
 * branch it passes.
 *
 * Needs migration 20261110120000_add_performance_direct_pay on QA.
 * Writes data: two events (published in setup so Hrithik can apply) with
 * their applications/performances (deleted in finally), and Hrithik's and
 * Omkar's UPI IDs (restored in finally, T6).
 */
test.use({ storageState: authFile("omkar") });

const ARTIST_UPI = "hrithik.e2e@okaxis";
const ORG_UPI = "omkar.e2e@okicici";

function ymd(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

test("[D3] performance direct pay: PAID (Omkar pays Hrithik) and BUY_IN (Hrithik pays Omkar) to confirmed @needs-db", async ({ page, browser, isMobile }) => {
  test.setTimeout(180_000);
  const vp = isMobile ? 390 : 1440;
  const stamp = Date.now();
  const eventIds: string[] = [];

  const prev = await withQaDb(async (db) => {
    const a = await db.query<{ id: string; upiId: string | null; upiQrUrl: string | null }>(
      `SELECT a.id, a."upiId", a."upiQrUrl" FROM "Artist" a JOIN "User" u ON u.id = a."userId" WHERE u.email = 'hrithik.artist@aforaudience.qa'`
    );
    const o = await db.query<{ id: string; upiId: string | null; upiQrUrl: string | null }>(
      `SELECT o.id, o."upiId", o."upiQrUrl" FROM "Organiser" o JOIN "User" u ON u.id = o."userId" WHERE u.email = 'omkar.organiser@aforaudience.qa'`
    );
    expect(a.rows.length, "Hrithik needs an artist profile on QA").toBe(1);
    expect(o.rows.length, "Omkar needs an organiser profile on QA").toBe(1);
    return { artist: a.rows[0], organiser: o.rows[0] };
  });

  const hriCtx = await browser.newContext({ storageState: authFile("hrithik") });
  const hri = await hriCtx.newPage();
  try {
    // --- Both save a UPI ID (validated; restored in finally) ---
    const aUpi = await hri.request.patch("/api/artists/me", { data: { upiId: ARTIST_UPI } });
    expect(aUpi.status(), await aUpi.text()).toBe(200);
    expect((await hri.request.patch("/api/artists/me", { data: { upiId: "not a upi" } })).status()).toBe(400);
    expect((await hri.request.patch("/api/artists/me", { data: { upiQrUrl: "javascript:alert(1)" } })).status()).toBe(400);
    const oUpi = await page.request.patch("/api/organisers/me", { data: { upiId: ORG_UPI } });
    expect(oUpi.status(), await oUpi.text()).toBe(200);
    expect((await oUpi.json()).upiId).toBe(ORG_UPI);
    expect((await page.request.patch("/api/organisers/me", { data: { upiId: "nope" } })).status()).toBe(400);
    // Public artist read never exposes the UPI.
    const pub = await page.request.get(`/api/artists/${prev.artist.id}`);
    expect(pub.status()).toBe(200);
    expect(JSON.stringify(await pub.json())).not.toContain(ARTIST_UPI);

    // --- Omkar: an event Hrithik applies to, approved with given terms ---
    const slot = async (label: string, terms: Record<string, unknown>) => {
      const ev = await page.request.post("/api/events", {
        data: {
          title: `E2E D3 ${label} ${vp} ${stamp}`,
          description: "D3 e2e - performance fee paid directly.",
          type: "OPEN_MIC",
          date: ymd(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
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
      // Setup only: open it for applications (manual review) without a venue.
      await withQaDb((db) => db.query(`UPDATE "Event" SET status = 'APPROVED', "applicationApprovalMode" = 'MANUAL' WHERE id = $1`, [eventId]));
      const app = await hri.request.post("/api/applications", { data: { eventId, message: "D3 e2e" } });
      expect(app.status(), await app.text()).toBeLessThan(300);
      const appId = (await app.json()).id as string;
      const before = Date.now();
      const ok = await page.request.patch(`/api/applications/${appId}`, {
        data: { status: "APPROVED", paymentMethod: "DIRECT", ...terms },
      });
      expect(ok.status(), await ok.text()).toBe(200);
      const perf = await withQaDb(async (db) => {
        const { rows } = await db.query<{ id: string; paymentMethod: string; directPayStatus: string | null; expiresAt: Date | null }>(
          `SELECT id, "paymentMethod", "directPayStatus", "expiresAt" FROM "Performance" WHERE "eventId" = $1`,
          [eventId]
        );
        return rows[0];
      });
      expect(perf.paymentMethod).toBe("DIRECT");
      expect(perf.directPayStatus).toBe("AWAITING_PAYMENT");
      const windowMs = new Date(perf.expiresAt!).getTime() - before;
      expect(windowMs).toBeGreaterThan(47.9 * 60 * 60 * 1000);
      expect(windowMs).toBeLessThan(48.1 * 60 * 60 * 1000);
      return { eventId, perfId: perf.id };
    };

    // Pays on one page, confirms on the other; the payer's view shows the payee block.
    const run = async (opts: {
      eventId: string; perfId: string; payer: Page; payee: Page; payerUrl: string; payeeUrl: string;
      upi: string; amount: string; shot: string;
    }) => {
      const { perfId, payer, payee } = opts;
      // Who may act: the payee cannot mark paid, the payer cannot confirm.
      expect((await payee.request.post(`/api/performances/${perfId}/direct-pay`, { data: { action: "markPaid" } })).status()).toBe(403);
      expect((await payer.request.post(`/api/performances/${perfId}/direct-pay`, { data: { action: "confirmReceived" } })).status()).toBe(403);

      await setRuleViewport(payer, isMobile);
      await gotoDashboard(payer, opts.payerUrl);
      const card = payer.locator(`[data-afa-direct-pay-performance="${perfId}"]`);
      await expect(card).toHaveAttribute("data-afa-direct-pay-role", "payer");
      await expect(card.locator('[data-afa-direct-pay-chip="awaitingPayment"]')).toBeVisible();
      const block = card.locator("[data-afa-payee-block]");
      await expect(block.locator("[data-afa-payee-upi]")).toHaveText(opts.upi);
      await expect(block.locator("[data-afa-payee-amount]")).toHaveText(opts.amount);
      await expect(block.locator("[data-afa-payee-note]")).toContainText("directly. AforAudience does not collect or hold this payment.");
      // S1b-c1 - direct cash/UPI only: the pay step says AFA never collects.
      await expect(block.locator("[data-afa-direct-pay-disclosure]")).toHaveText(/^Pay .+ directly by UPI or cash\. AFA doesn't collect this money\.$/);
      // 12 Nov - the direct-pay 15-day standard term sits under the disclosure line.
      await expect(block.locator("[data-afa-direct-pay-refund-term]")).toHaveText(
        `Cancel ${DIRECT_PAY_FULL_REFUND_MIN_DAYS}+ days before the date: full refund of any advance. Inside ${DIRECT_PAY_FULL_REFUND_MIN_DAYS} days: as you both agree.`,
      );
      await block.scrollIntoViewIfNeeded();
      await block.screenshot({ path: `test-results/d3-${opts.shot}-payee-block-${vp}.png` });
      await card.getByRole("textbox", { name: "UPI reference (optional)" }).fill(`UTR-D3-${opts.shot}`);
      await card.getByRole("button", { name: "I've paid" }).click();
      await expect(card.locator('[data-afa-direct-pay-chip="paymentMarked"]')).toBeVisible();

      await setRuleViewport(payee, isMobile);
      await gotoDashboard(payee, opts.payeeUrl);
      const pCard = payee.locator(`[data-afa-direct-pay-performance="${perfId}"]`);
      await expect(pCard).toHaveAttribute("data-afa-direct-pay-role", "payee");
      await expect(pCard.locator('[data-afa-direct-pay-chip="paymentMarked"]')).toBeVisible();
      await expect(pCard).toContainText(`UTR-D3-${opts.shot}`);
      await pCard.getByRole("button", { name: "Confirm payment received" }).click();
      await expect(pCard.locator('[data-afa-direct-pay-chip="confirmed"]')).toBeVisible();

      const row = await withQaDb(async (db) => {
        const { rows } = await db.query<{ directPayStatus: string; payerReference: string | null; confirmedAt: Date | null; cancelledAt: Date | null }>(
          `SELECT "directPayStatus", "payerReference", "confirmedAt", "cancelledAt" FROM "Performance" WHERE id = $1`,
          [perfId]
        );
        return rows[0];
      });
      expect(row.directPayStatus).toBe("CONFIRMED");
      expect(row.payerReference).toBe(`UTR-D3-${opts.shot}`);
      expect(row.confirmedAt).toBeTruthy();
      expect(row.cancelledAt).toBeNull();
    };

    // PAID: Omkar pays Hrithik.
    const paid = await slot("Paid", { compensationType: "PAID", feeAmount: 1500 });
    await run({
      ...paid, payer: page, payee: hri,
      payerUrl: `/dashboard/organiser/events/${paid.eventId}/lineup`, payeeUrl: "/dashboard/artist",
      upi: ARTIST_UPI, amount: "₹1,500", shot: "paid",
    });

    // BUY_IN: Hrithik pays Omkar.
    const buyIn = await slot("BuyIn", { compensationType: "BUY_IN", buyInAmount: 200 });
    await run({
      ...buyIn, payer: hri, payee: page,
      payerUrl: "/dashboard/artist", payeeUrl: `/dashboard/organiser/events/${buyIn.eventId}/lineup`,
      upi: ORG_UPI, amount: "₹200", shot: "buyin",
    });
  } finally {
    await hriCtx.close();
    await withQaDb(async (db) => {
      if (eventIds.length) {
        await db.query(`DELETE FROM "Performance" WHERE "eventId" = ANY($1)`, [eventIds]);
        await db.query(`DELETE FROM "Application" WHERE "eventId" = ANY($1)`, [eventIds]);
        await db.query(`DELETE FROM "TicketTier" WHERE "eventId" = ANY($1)`, [eventIds]);
        await db.query(`DELETE FROM "Event" WHERE id = ANY($1)`, [eventIds]);
      }
      await db.query(`UPDATE "Artist" SET "upiId" = $2, "upiQrUrl" = $3 WHERE id = $1`, [prev.artist.id, prev.artist.upiId, prev.artist.upiQrUrl]);
      await db.query(`UPDATE "Organiser" SET "upiId" = $2, "upiQrUrl" = $3 WHERE id = $1`, [prev.organiser.id, prev.organiser.upiId, prev.organiser.upiQrUrl]);
    });
  }
});

/**
 * 12 Nov (Hitesh) - cancel a CONFIRMED direct-pay performance + refund
 * tracking (artist half of #780). AFA moves no money: it records who
 * cancelled, when, and whether the amount paid is due back under the
 * 15-day term (DUE, counted against the event date) or left to the
 * parties (AS_AGREED). The PAYER confirms receipt: PAID -> the organiser,
 * BUY_IN -> the artist.
 *
 * Fixture: an event Omkar creates (30 days out) with a CONFIRMED direct-pay
 * Performance for Hrithik inserted straight into QA (confirmedAt set = the
 * payee confirmed receipt). Reaching CONFIRMED through the UI is covered by
 * the [D3] test above. Everything is deleted in finally (T6).
 *
 * Regression shape: on origin/qa a confirmed slot has no "Cancel slot" in
 * the direct-pay panel, the API refuses cancelConfirmed / refundReceived
 * with 400 "Invalid action", and the artist's own /cancel of a confirmed
 * direct BUY_IN sets buyInRefundStatus REFUNDED (a refund AFA can't make)
 * and leaves directPayStatus CONFIRMED. So both tests fail there and pass
 * on the branch.
 *
 * Needs migration 20261112130000_add_performance_direct_refund_tracking on QA.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

async function seedConfirmedPerformance(
  page: Page,
  label: string,
  terms: { compensationType: "PAID" | "BUY_IN"; feeAmount: number | null; buyInAmount: number | null }
): Promise<{ eventId: string; perfId: string; title: string }> {
  const title = `E2E D3-refund ${label} ${Date.now()}`;
  const ev = await page.request.post("/api/events", {
    data: {
      title,
      description: "D3 refund e2e - confirmed slot cancelled.",
      type: "OPEN_MIC",
      // Far enough out that IST calendar days are >= 15 at any time of day.
      date: ymd(new Date(Date.now() + (DIRECT_PAY_FULL_REFUND_MIN_DAYS + 15) * DAY_MS)),
      startTime: "19:00",
      endTime: "21:00",
      isFree: true,
      totalSeats: 20,
    },
  });
  expect(ev.status(), await ev.text()).toBeLessThan(300);
  const evBody = await ev.json();
  const eventId = (evBody.event?.id ?? evBody.id) as string;
  const perfId = `e2e-perf-refund-${label}-${Date.now()}`;
  await withQaDb(async (db) => {
    await db.query(`UPDATE "Event" SET status = 'APPROVED' WHERE id = $1`, [eventId]);
    const a = await db.query<{ id: string }>(
      `SELECT a.id FROM "Artist" a JOIN "User" u ON u.id = a."userId" WHERE u.email = 'hrithik.artist@aforaudience.qa'`
    );
    expect(a.rows.length, "Hrithik needs an artist profile on QA").toBe(1);
    await db.query(
      `INSERT INTO "Performance" (id, "eventId", "artistId", slot, duration, "compensationType", "feeAmount", "buyInAmount",
              "paymentMethod", "directPayStatus", "paidMarkedAt", "confirmedAt")
       VALUES ($1, $2, $3, 1, 10, $4::"CompensationType", $5, $6, 'DIRECT', 'CONFIRMED', now(), now())`,
      [perfId, eventId, a.rows[0].id, terms.compensationType, terms.feeAmount, terms.buyInAmount]
    );
  });
  return { eventId, perfId, title };
}

async function readPerfRefund(id: string) {
  return withQaDb(async (db) => {
    const { rows } = await db.query<{
      directPayStatus: string; directRefundStatus: string | null; cancelledBy: string | null;
      cancelledAt: Date | null; refundReceivedAt: Date | null; buyInRefundStatus: string | null;
    }>(
      `SELECT "directPayStatus", "directRefundStatus", "cancelledBy", "cancelledAt", "refundReceivedAt", "buyInRefundStatus"
         FROM "Performance" WHERE id = $1`,
      [id]
    );
    return rows[0];
  });
}

async function dropEvents(eventIds: string[]) {
  if (!eventIds.length) return;
  await withQaDb(async (db) => {
    await db.query(`DELETE FROM "Performance" WHERE "eventId" = ANY($1)`, [eventIds]);
    await db.query(`DELETE FROM "Application" WHERE "eventId" = ANY($1)`, [eventIds]);
    await db.query(`DELETE FROM "TicketTier" WHERE "eventId" = ANY($1)`, [eventIds]);
    await db.query(`DELETE FROM "Event" WHERE id = ANY($1)`, [eventIds]);
  });
}

test("[D3-refund] PAID: organiser cancels a CONFIRMED slot 15+ days out -> Refund due -> organiser marks it received @needs-db", async ({ page, browser, isMobile }) => {
  test.setTimeout(150_000);
  const vp = isMobile ? 390 : 1440;
  const eventIds: string[] = [];
  const hriCtx = await browser.newContext({ storageState: authFile("hrithik") });
  const hri = await hriCtx.newPage();
  try {
    const { eventId, perfId } = await seedConfirmedPerformance(page, `paid-${vp}`, {
      compensationType: "PAID", feeAmount: 1500, buyInAmount: null,
    });
    eventIds.push(eventId);

    // Nothing to confirm before a cancel.
    expect((await page.request.post(`/api/performances/${perfId}/direct-pay`, { data: { action: "refundReceived" } })).status()).toBe(400);

    await setRuleViewport(page, isMobile);
    await gotoDashboard(page, `/dashboard/organiser/events/${eventId}/lineup`);
    const card = page.locator(`[data-afa-direct-pay-performance="${perfId}"]`);
    await expect(card.locator('[data-afa-direct-pay-chip="confirmed"]')).toBeVisible();
    await card.locator("[data-afa-cancel-confirmed-btn]").click();

    // The dialog states the outcome before anything changes.
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Cancel this confirmed slot?");
    const outcome = dialog.locator('[data-afa-cancel-outcome="DUE"]');
    await expect(outcome).toContainText(
      `You are cancelling ${DIRECT_PAY_FULL_REFUND_MIN_DAYS}+ days before the date, so the ₹1,500 advance is due back in full under the ${DIRECT_PAY_FULL_REFUND_MIN_DAYS}-day term.`
    );
    await expect(outcome).toContainText(/AforAudience does not hold this money\. .+ refunds .+ directly\./);
    await dialog.screenshot({ path: `test-results/d3-refund-dialog-due-${vp}.png` });
    await dialog.getByRole("button", { name: "Cancel slot" }).click();

    await expect(card.locator('[data-afa-direct-pay-chip="cancelled"]')).toBeVisible();
    await expect(card.locator('[data-afa-refund-chip="DUE"]')).toHaveText("Refund due");
    await expect(card.locator('[data-afa-cancelled-by="ORGANISER"]')).toContainText("Cancelled by the organiser on ");
    await card.screenshot({ path: `test-results/d3-refund-chip-due-${vp}.png` });

    let row = await readPerfRefund(perfId);
    expect(row.directPayStatus).toBe("CANCELLED");
    expect(row.directRefundStatus).toBe("DUE");
    expect(row.cancelledBy).toBe("ORGANISER");
    expect(row.cancelledAt).toBeTruthy();
    expect(row.buyInRefundStatus).toBeNull();

    // The artist (payee) sees the chip but cannot mark the refund received.
    await setRuleViewport(hri, isMobile);
    await gotoDashboard(hri, "/dashboard/artist");
    const aCard = hri.locator(`[data-afa-direct-pay-performance="${perfId}"]`);
    await expect(aCard.locator('[data-afa-refund-chip="DUE"]')).toHaveText("Refund due");
    await expect(aCard.locator("[data-afa-refund-received-btn]")).toHaveCount(0);
    expect((await hri.request.post(`/api/performances/${perfId}/direct-pay`, { data: { action: "refundReceived" } })).status()).toBe(403);

    // A cancelled slot can't be cancelled again.
    expect((await page.request.post(`/api/performances/${perfId}/direct-pay`, { data: { action: "cancelConfirmed" } })).status()).toBe(400);

    // The organiser (payer) confirms the refund arrived.
    await card.locator("[data-afa-refund-received-btn]").click();
    await expect(card.locator('[data-afa-refund-chip="RECEIVED"]')).toContainText("Refund received ✓");
    await expect(card.locator("[data-afa-refund-received-btn]")).toHaveCount(0);
    await card.screenshot({ path: `test-results/d3-refund-chip-received-${vp}.png` });
    expect((await page.request.post(`/api/performances/${perfId}/direct-pay`, { data: { action: "refundReceived" } })).status()).toBe(400);

    row = await readPerfRefund(perfId);
    expect(row.directRefundStatus).toBe("RECEIVED");
    expect(row.refundReceivedAt).toBeTruthy();
  } finally {
    await hriCtx.close();
    await dropEvents(eventIds);
  }
});
