import type { Locator } from "@playwright/test";
import QRCode from "qrcode";
import { test, expect } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { useRuleViewport } from "./helpers/viewports";

/**
 * GEN-2609-006 (Mobile Redesign Phase 4a): My Tickets cards. A confirmed
 * ticket shows a real, scannable QR that encodes its raw bookingId (the
 * same value as the ticket PDF's QR; src/app/tickets/page.tsx TicketQr),
 * and each status keeps its own actions:
 *   CONFIRMED  QR, Download PDF, Message Organiser; Cancel ticket while
 *              the event is still ahead
 *   PENDING    Pay now (to its checkout), Cancel; no QR
 *   EXPIRED    no QR, no actions (an expired PENDING)
 *   CANCELLED  no QR, no actions, the card does not open the event
 *
 * The QR is an <img> data URL with no data attribute, so it is read the
 * honest way: its pixels are sampled module by module and the grid must
 * be exactly the QR symbol for that card's bookingId (and not another
 * booking's). The card's bookingId comes from its own PDF / checkout
 * link. Every card is matched to Atul's bookings from /api/bookings/my.
 *
 * As Atul, at 390 and 1440. Atul's pending bookings have all expired, so
 * one is served unexpired to this page (in the browser only) to show the
 * PENDING actions. Nothing is pressed. HUMAN: the poster-card look.
 */

test.use({ storageState: authFile("atul") });

type Booking = { id: string; status: string; expiresAt: string | null; event: { title: string; date: string } };

const LABEL: Record<string, string> = {
  CONFIRMED: "Confirmed",
  PENDING: "Reserved — pay to confirm",
  EXPIRED: "Expired — book again",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

/** The QR symbol for `value` as the page draws it (qrcode's defaults), as rows of 0/1. */
function symbolFor(value: string): string[] {
  const { modules } = QRCode.create(value, {});
  const rows: string[] = [];
  for (let r = 0; r < modules.size; r++) {
    let row = "";
    for (let c = 0; c < modules.size; c++) row += modules.get(r, c) ? "1" : "0";
    rows.push(row);
  }
  return rows;
}

/** Reads the QR image's pixels: dark (1) or light (0) at the centre of each of size x size modules. */
async function readQr(img: Locator, size: number): Promise<string[]> {
  await expect(img).toHaveJSProperty("complete", true);
  return img.evaluate((el, n) => {
    const image = el as HTMLImageElement;
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    const step = canvas.width / n;
    const rows: string[] = [];
    for (let r = 0; r < n; r++) {
      let row = "";
      for (let c = 0; c < n; c++) {
        const [red, green, blue] = ctx.getImageData(Math.floor((c + 0.5) * step), Math.floor((r + 0.5) * step), 1, 1).data;
        row += red + green + blue < 384 ? "1" : "0";
      }
      rows.push(row);
    }
    return rows;
  }, size);
}

test("[GEN-2609-006] My Tickets: each confirmed card's QR encodes its bookingId; each status keeps its actions", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  let livePendingId = "";
  let bookings: Booking[] = [];
  await page.route(/\/api\/bookings\/my\/?$/, async (route) => {
    const res = await route.fetch();
    bookings = await res.json();
    const pending = bookings.find((b) => b.status === "PENDING");
    if (pending) {
      pending.expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
      livePendingId = pending.id;
    }
    await route.fulfill({ response: res, json: bookings });
  });
  await page.goto("/tickets/");
  const main = page.locator("main");
  await expect(main.getByText(LABEL.CONFIRMED, { exact: true }).first(), "Atul has confirmed tickets in QA").toBeVisible({ timeout: 20_000 });

  const effective = (b: Booking) => (b.status === "PENDING" && b.expiresAt && new Date(b.expiresAt) < new Date() ? "EXPIRED" : b.status);
  const expected = new Map<string, number>();
  for (const b of bookings) expected.set(effective(b), (expected.get(effective(b)) ?? 0) + 1);
  test.info().annotations.push({ type: "statuses", description: JSON.stringify(Object.fromEntries(expected)) });
  expect(expected.get("CONFIRMED"), "confirmed bookings").toBeGreaterThan(0);
  expect(livePendingId, "a pending booking to show as live").not.toBe("");

  const byId = new Map(bookings.map((b) => [b.id, b]));
  const ids = bookings.map((b) => b.id);
  const seenConfirmed = new Set<string>();
  let cancelTicketShown = 0;

  for (const [status, count] of expected) {
    // A card is the parent of its poster hero, the block holding the status badge and the title.
    const badges = main.getByText(LABEL[status], { exact: true });
    await expect(badges, `${status} cards`).toHaveCount(count);
    for (let i = 0; i < count; i++) {
      const card = badges.nth(i).locator("xpath=ancestor::div[.//h3][1]/..");
      const qr = card.locator('img[src^="data:image/png"]');
      const where = `${status} card #${i + 1}`;

      if (status === "CONFIRMED") {
        const pdf = card.locator('a[href^="/api/bookings/"]');
        await expect(pdf, `${where}: Download PDF`).toHaveText(/Download PDF/);
        const id = (await pdf.getAttribute("href"))!.match(/\/api\/bookings\/([^/]+)\/ticket/)![1];
        expect(byId.get(id)?.status, `${where}: ${id} is a confirmed booking of Atul's`).toBe("CONFIRMED");
        seenConfirmed.add(id);

        await expect(qr, `${where}: one QR`).toHaveCount(1);
        const symbol = symbolFor(id);
        const read = await readQr(qr, symbol.length);
        expect(read.join("\n"), `${where}: the QR is the symbol for bookingId ${id}`).toBe(symbol.join("\n"));
        const other = ids.find((x) => x !== id && symbolFor(x).length === symbol.length);
        if (other) expect(read.join("\n"), `${where}: and not for ${other}`).not.toBe(symbolFor(other).join("\n"));

        await expect(card.getByRole("button", { name: "Message Organiser" }), `${where}: Message Organiser`).toBeVisible();
        const cancel = card.getByRole("button", { name: "Cancel ticket" });
        const eventAt = new Date(byId.get(id)!.event.date).getTime();
        // Cancel goes once the event has started; a day either side keeps the start time out of it.
        if (eventAt > Date.now() + 86_400_000) await expect(cancel, `${where}: upcoming, Cancel ticket`).toBeVisible();
        if (eventAt < Date.now() - 86_400_000) await expect(cancel, `${where}: past, no Cancel ticket`).toHaveCount(0);
        cancelTicketShown += await cancel.count();
      } else if (status === "PENDING") {
        const pay = card.getByRole("link", { name: "Pay now →" });
        await expect(pay, `${where}: Pay now`).toHaveAttribute("href", new RegExp(`/checkout/${livePendingId}/?$`));
        await expect(card.getByRole("button", { name: "Cancel", exact: true }), `${where}: Cancel`).toBeVisible();
        await expect(qr, `${where}: no QR`).toHaveCount(0);
      } else {
        // EXPIRED, CANCELLED, REFUNDED: nothing to scan, nothing to press.
        await expect(qr, `${where}: no QR`).toHaveCount(0);
        await expect(card.locator("a, button"), `${where}: no actions`).toHaveCount(0);
        if (status !== "EXPIRED") await expect(card, `${where}: does not open the event`).not.toHaveAttribute("role", "link");
      }
    }
  }
  expect(seenConfirmed.size, "every confirmed booking has its own card").toBe(expected.get("CONFIRMED"));
  expect(cancelTicketShown, "at least one upcoming ticket offers Cancel ticket").toBeGreaterThan(0);
});
