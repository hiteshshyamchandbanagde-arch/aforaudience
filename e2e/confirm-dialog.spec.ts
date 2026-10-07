import type { Page } from "@playwright/test";
import { test, expect, gotoDashboard } from "./helpers/test";
import { useRuleViewport } from "./helpers/viewports";
import { authFile } from "./helpers/personas";
import { withQaDb } from "./helpers/qa-db";

/**
 * BUG-2609-086 - every native window.confirm()/alert()/prompt() in src/
 * became the one in-app dialog (src/components/ConfirmDialog.tsx).
 *
 * My Tickets -> Cancel ticket (the money flow) shows Paid / Refund (with
 * its rule) / "Booking fee ₹20, not refundable" as separate lines, from
 * the server's own refund numbers. Esc, the backdrop and "Keep ticket"
 * all close it without cancelling anything. The booking is a fixture
 * this spec writes on Atul's account and deletes again (T6): Hitesh's
 * 7 Oct case, ₹1,020 paid with a ₹20 booking fee, on Jaipur Mic Gala 100
 * (kept 45+ days ahead by global-setup, so always the 14+ day tier).
 *
 * Seat Map Builder: a stale (10-day-old) local draft is dropped without
 * asking; a fresh one is offered in the in-app dialog with its age in
 * words; a frozen map never offers one; Unfreeze asks in the dialog. On
 * Ganesh Open Mic (Vinayak's frozen 44-seat map) at 412 the frozen
 * banner's text wraps as one block above the Unfreeze button. Nothing is
 * saved: every dialog is cancelled.
 *
 * Every test fails if the browser shows a native dialog.
 */

const BOOKING_ID = "e2e-bug-2609-086-cancel-sheet";
const JAIPUR_EVENT_ID = "qa-jaipur-event-0001";
const GA_VENUE = "qa-demo-venue-full-2"; // FC Road Comedy Hall (Vinayak, not frozen)
const FROZEN_VENUE = "cmu0n63k6000004l40wkymgkk"; // Ganesh Open Mic (Vinayak, frozen)

function failOnNativeDialog(page: Page) {
  const seen: string[] = [];
  page.on("dialog", (d) => {
    seen.push(`${d.type()}: ${d.message()}`);
    void d.dismiss();
  });
  return seen;
}

test.describe("My Tickets cancel sheet @needs-db", () => {
  test.use({ storageState: authFile("atul") });

  test.beforeAll(async () => {
    await withQaDb(async (db) => {
      await db.query(`DELETE FROM "Booking" WHERE id = $1`, [BOOKING_ID]);
      await db.query(
        `INSERT INTO "Booking" (id, "userId", "eventId", seats, "totalAmount", "subtotalAmount", "bookingFeeAmount", status, "createdAt")
         SELECT $1, u.id, $2, '{"General":1}'::jsonb, 1020, 1000, 20, 'CONFIRMED', now()
           FROM "User" u WHERE u.email = 'atul.audience@aforaudience.qa'`,
        [BOOKING_ID, JAIPUR_EVENT_ID],
      );
    });
  });

  test.afterAll(async () => {
    await withQaDb((db) => db.query(`DELETE FROM "Booking" WHERE id = $1`, [BOOKING_ID]));
  });

  test("[BUG-2609-086] Cancel ticket opens the in-app sheet with paid, refund and the non-refundable fee", async ({ page, isMobile }) => {
    await useRuleViewport(page, isMobile);
    const native = failOnNativeDialog(page);
    await page.goto("/tickets/");
    const actions = page.locator(`div:has(> a[href^="/api/bookings/${BOOKING_ID}/ticket"])`);
    const cancel = actions.getByRole("button", { name: "Cancel ticket" });
    await expect(cancel, "the fixture ticket's Cancel button").toBeVisible();

    const sheet = page.getByRole("dialog", { name: "Cancel this ticket?" });
    await cancel.click();
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('[data-afa-refund-line="paid"]')).toContainText("₹1,020");
    await expect(sheet.locator('[data-afa-refund-line="refund"]')).toContainText("₹1,000");
    await expect(sheet.locator('[data-afa-refund-line="refund"]')).toContainText("14+ days before the show");
    await expect(sheet.locator('[data-afa-refund-line="fee"]')).toHaveText("Booking fee ₹20, not refundable");
    await expect(sheet.getByRole("button", { name: "Cancel ticket" }), "destructive confirm").toBeVisible();

    // 390 is a bottom sheet (touches the bottom edge), 1440 a centred card.
    const box = (await sheet.boundingBox())!;
    const vp = page.viewportSize()!;
    if (isMobile) {
      expect(Math.round(box.y + box.height)).toBe(vp.height);
      expect(Math.round(box.width)).toBe(vp.width);
    } else {
      expect(Math.abs(box.x + box.width / 2 - vp.width / 2)).toBeLessThan(2);
      expect(box.y + box.height).toBeLessThan(vp.height - 40);
    }
    await expect(sheet).toHaveScreenshot(`cancel-sheet-${isMobile ? 390 : 1440}.png`, { maxDiffPixelRatio: 0.02 });

    // Focus stays in the sheet.
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(sheet, "Esc cancels").toBeHidden();

    await cancel.click();
    await expect(sheet).toBeVisible();
    await page.locator("[data-afa-confirm-scrim]").click({ position: { x: 10, y: 10 } });
    await expect(sheet, "the backdrop cancels").toBeHidden();

    await cancel.click();
    await sheet.getByRole("button", { name: "Keep ticket" }).click();
    await expect(sheet, "Keep ticket cancels").toBeHidden();

    expect(native, "no native browser dialog").toEqual([]);
    const { rows } = await withQaDb((db) => db.query(`SELECT status FROM "Booking" WHERE id = $1`, [BOOKING_ID]));
    expect(rows[0].status, "nothing was cancelled").toBe("CONFIRMED");
  });
});

type Draft = { savedAt: number; marker: string };

/** Puts a one-seat local draft for `venueId` in place before the builder loads. */
async function plantDraft(page: Page, venueId: string, ageMs: number) {
  const marker = `e2e-planted-${Date.now()}`;
  await page.addInitScript(
    ({ key, ageMs, marker }) => {
      if (sessionStorage.getItem("e2e-draft-planted")) return;
      sessionStorage.setItem("e2e-draft-planted", "1");
      localStorage.setItem(
        key,
        JSON.stringify({
          savedAt: Date.now() - ageMs,
          seatingMode: "NUMBERED",
          levels: [""],
          activeLevel: "",
          seatsByLevel: { "": [{ clientId: marker, tierLabel: "General", row: "A", number: "1", x: 120, y: 200 }] },
          gridConfigByLevel: {},
          zonePricesByLevel: {},
          builderPathByLevel: {},
          markersByLevel: {},
        }),
      );
    },
    { key: `afa-seatmap-draft:${venueId}`, ageMs, marker },
  );
  return marker;
}

async function storedDraft(page: Page, venueId: string): Promise<string> {
  return page.evaluate((key) => localStorage.getItem(key) ?? "", `afa-seatmap-draft:${venueId}`);
}

test.describe("Seat Map Builder dialogs", () => {
  test.use({ storageState: authFile("vinayak") });

  test("[BUG-2609-086] a 10-day-old draft is discarded without asking", async ({ page }) => {
    const native = failOnNativeDialog(page);
    const marker = await plantDraft(page, GA_VENUE, 14998 * 60_000);
    await gotoDashboard(page, `/dashboard/venue/${GA_VENUE}/seat-map/`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // The decision is made on load; give a dialog the chance to appear.
    await page.waitForTimeout(1_000);
    await expect(page.locator("[data-afa-confirm-dialog]")).toHaveCount(0);
    await expect.poll(() => storedDraft(page, GA_VENUE)).not.toContain(marker);
    expect(native).toEqual([]);
  });

  test("[BUG-2609-086] a fresh draft is offered in the in-app dialog with its age in words", async ({ page, isMobile }) => {
    await useRuleViewport(page, isMobile);
    const native = failOnNativeDialog(page);
    const marker = await plantDraft(page, GA_VENUE, 5 * 60_000);
    await gotoDashboard(page, `/dashboard/venue/${GA_VENUE}/seat-map/`);
    const dialog = page.getByRole("dialog", { name: "Restore your unsaved draft?" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("5 minutes ago");
    await expect(dialog).toContainText("1 seat across 1 level");
    await expect(dialog).toHaveScreenshot(`seatmap-draft-${isMobile ? 390 : 1440}.png`, { maxDiffPixelRatio: 0.02 });
    await dialog.getByRole("button", { name: "Discard" }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => storedDraft(page, GA_VENUE)).not.toContain(marker);
    expect(native).toEqual([]);
  });

  test("[BUG-2609-086] a frozen map never offers a draft; Unfreeze asks in the in-app dialog", async ({ page }) => {
    const native = failOnNativeDialog(page);
    const marker = await plantDraft(page, FROZEN_VENUE, 2 * 60_000);
    await gotoDashboard(page, `/dashboard/venue/${FROZEN_VENUE}/seat-map/`);
    const unfreeze = page.getByRole("button", { name: "Unfreeze" });
    await expect(unfreeze).toBeVisible();
    await page.waitForTimeout(1_000);
    await expect(page.locator("[data-afa-confirm-dialog]"), "no restore offer on a frozen map").toHaveCount(0);
    await expect.poll(() => storedDraft(page, FROZEN_VENUE)).not.toContain(marker);

    await unfreeze.click();
    const dialog = page.getByRole("dialog", { name: "Unfreeze this seat map?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Seat map frozen")).toBeVisible();
    expect(native).toEqual([]);
  });

  test("[BUG-2609-086] at 412 the frozen banner stacks: text in one block above Unfreeze", async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await gotoDashboard(page, `/dashboard/venue/${FROZEN_VENUE}/seat-map/`);
    const title = page.getByText("Seat map frozen", { exact: true });
    const rest = page.getByText(/finalized and read-only/);
    const unfreeze = page.getByRole("button", { name: "Unfreeze" });
    await expect(unfreeze).toBeVisible();
    const t = (await title.boundingBox())!;
    const r = (await rest.boundingBox())!;
    const u = (await unfreeze.boundingBox())!;
    const lineHeight = await title.evaluate((el) => parseFloat(getComputedStyle(el).fontSize) * 1.6);
    // The cramped layout squeezed "Seat map frozen" into its own narrow
    // column, wrapping it onto two lines beside the rest of the sentence.
    expect(t.height, '"Seat map frozen" stays on one line').toBeLessThan(lineHeight);
    expect(r.width, "the sentence spans the banner, not a narrow column").toBeGreaterThan(250);
    expect(u.y, "Unfreeze sits below the text").toBeGreaterThanOrEqual(r.y + r.height - 1);
    const banner = page.locator("div:has(> [data-afa-frozen-banner-text])");
    await expect(banner).toHaveScreenshot("seatmap-frozen-banner-412.png", { maxDiffPixelRatio: 0.02 });
  });
});
