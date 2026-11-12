import { test, expect } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { useRuleViewport } from "./helpers/viewports";
import { CLOCK_FORWARD_DAYS, HRITHIK_UPCOMING_EVENT_ID } from "./helpers/upcoming-fixtures";
import type { Page } from "@playwright/test";

/**
 * My Tickets, the actions under PAID on a confirmed ticket (Download PDF,
 * Message Organiser, Cancel ticket).
 *
 * BUG-2610-012 (Hitesh, real phone, 4 Oct, Atul's AFA-DGHJ-PFFM): the three
 * sat in one row beside the QR, about 70px each, so every label wrapped to
 * two lines and spilled past its border. Dispatch C item 7's earlier check
 * allowed 2 lines and required one row, which is what let it through.
 *
 * Now, on every upcoming confirmed card: each label is on one line, sits
 * inside its button's box and does not overflow it (scrollWidth <=
 * clientWidth), and each button is a tap target at least 44px tall. The
 * actions take the card's full width under the QR. Plus a screenshot
 * baseline of the first card's ticket area (QR masked: it is the booking id).
 *
 * Atul, at 390 and 1440. Read-only: nothing is pressed, nothing cancelled
 * or sent.
 *
 * Date drift (e2e hardening, 12 Nov): the page shows whatever Atul holds, so
 * the first card (the baseline) changed with the clock and with rows other
 * specs left behind (e.g. 8 "E2E D1 Pay at entry" tickets dated 8 Nov). The
 * browser's /api/bookings/my is cut to Atul's two seeded bookings on events
 * global-setup keeps 45+ days ahead (helpers/upcoming-fixtures.ts), so the
 * cards are the same every night. A second run moves the browser clock
 * CLOCK_FORWARD_DAYS on and must match the same baseline.
 */

/** Atul's seeded confirmed tickets on the kept-upcoming fixtures (qa-seed.ts). */
const FIXTURE_EVENTS = ["qa-jaipur-event-0001", HRITHIK_UPCOMING_EVENT_ID];

async function onlyFixtureTickets(page: Page) {
  await page.route(/\/api\/bookings\/my\/?$/, async (route) => {
    const res = await route.fetch();
    const all = (await res.json()) as { status: string; event: { id: string } }[];
    const kept = all.filter((b) => b.status === "CONFIRMED" && FIXTURE_EVENTS.includes(b.event.id));
    expect(kept.length, "Atul holds a confirmed ticket on Jaipur Mic Gala 100 and Mixed Bag Comedy Lineup").toBeGreaterThanOrEqual(2);
    await route.fulfill({ response: res, json: kept });
  });
}

test.use({ storageState: authFile("atul") });

test.beforeEach(async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
});

test("[BUG-2610-012] My Tickets: every ticket action label fits inside its button on one line, tap targets 44px", async ({ page, isMobile }) => {
  await checkTicketActions(page, isMobile);
});

test(`[BUG-2610-012] ${CLOCK_FORWARD_DAYS} days on: My Tickets actions and baseline unchanged`, async ({ page, isMobile }) => {
  await page.clock.setFixedTime(new Date(Date.now() + CLOCK_FORWARD_DAYS * 24 * 60 * 60 * 1000));
  await checkTicketActions(page, isMobile);
});

async function checkTicketActions(page: Page, isMobile: boolean) {
  await onlyFixtureTickets(page);
  await page.goto("/tickets/");
  const downloads = page.locator('a[href^="/api/bookings/"][href*="/ticket"]').filter({ visible: true });
  await expect(downloads.first(), "Atul has an upcoming confirmed ticket").toBeVisible({ timeout: 20_000 });
  await expect(downloads.first()).toHaveText(/^\s*Download PDF\s*$/);
  // Fonts settle the label widths; measure after they load.
  await page.evaluate(() => document.fonts.ready);

  const count = await downloads.count();
  let cancels = 0;
  for (let i = 0; i < count; i++) {
    // The download button's parent holds the card's actions.
    const actions = downloads.nth(i).locator("xpath=..").locator("> a, > button");
    const n = await actions.count();
    expect(n, `card ${i}: Download + Message (+ Cancel while upcoming)`).toBeGreaterThanOrEqual(2);
    const measured = await actions.evaluateAll((els) =>
      els.map((el) => {
        const box = el.getBoundingClientRect();
        // The label: the button's own content (icon + text).
        const range = document.createRange();
        range.selectNodeContents(el);
        const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
        const label = range.getBoundingClientRect();
        // Text line boxes only (an icon's box is not a line of text).
        const lines = new Set<number>();
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let t = walker.nextNode(); t; t = walker.nextNode()) {
          if (!t.textContent?.trim()) continue;
          const r = document.createRange();
          r.selectNodeContents(t);
          for (const rect of Array.from(r.getClientRects())) if (rect.width > 0) lines.add(Math.round(rect.top));
        }
        const h = el as HTMLElement;
        return {
          label: (el.textContent || "").trim(),
          lines: lines.size,
          inside:
            rects.length > 0 &&
            label.left >= box.left - 0.5 &&
            label.right <= box.right + 0.5 &&
            label.top >= box.top - 0.5 &&
            label.bottom <= box.bottom + 0.5,
          scrollWidth: h.scrollWidth,
          clientWidth: h.clientWidth,
          height: box.height,
          box: { l: Math.round(box.left), r: Math.round(box.right) },
          labelBox: { l: Math.round(label.left), r: Math.round(label.right) },
        };
      }),
    );
    for (const m of measured) {
      const where = `card ${i} "${m.label}" ${JSON.stringify(m)}`;
      expect(m.lines, `${where}: label on one line`).toBe(1);
      expect(m.inside, `${where}: label inside the button`).toBe(true);
      expect(m.scrollWidth, `${where}: no overflow`).toBeLessThanOrEqual(m.clientWidth);
      expect(m.height, `${where}: tap target`).toBeGreaterThanOrEqual(44);
      if (/^Cancel ticket$/.test(m.label)) cancels++;
    }
  }
  expect(cancels, "at least one upcoming card shows Cancel ticket").toBeGreaterThan(0);

  // Baseline: the first card's ticket area (QR, PAID, actions). The QR is
  // masked; the rest is the layout this fix changed.
  const area = downloads.first().locator("xpath=ancestor::div[.//img][1]");
  await expect(area).toHaveScreenshot(`ticket-actions-${isMobile ? 390 : 1440}.png`, {
    mask: [area.locator("img")],
    maxDiffPixelRatio: 0.02,
  });
}
