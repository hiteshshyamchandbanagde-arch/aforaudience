import type { Locator } from "@playwright/test";
import { test, expect, gotoDashboard } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { useRuleViewport } from "./helpers/viewports";

/**
 * BUG-2609-050 - the special-notes status badge on the organiser event
 * edit page drew its text in the old --afa-sage / --afa-error tokens on
 * its tint, below WCAG AA on the dark card. It now takes STATUS_TONE's
 * -bright text colours.
 *
 * No QA event has special notes under review, so the badge is shown by
 * giving the page's own GET /api/events/<id>/owner answer each status in
 * the browser. Nothing is saved. The contrast is worked out from the
 * computed colours: the badge's text over its background, with every
 * see-through layer below it composited in. At 390 and 1440, as Omkar.
 */

test.use({ storageState: authFile("omkar") });

// Omkar's seeded "full" organiser event (scripts/qa-seed.ts).
const EVENT_ID = "qa-demo-event-full-9";

const STATUSES = [
  ["APPROVED", "✓ Approved — visible on your event page"],
  ["REJECTED", "✕ Rejected"],
  ["PENDING", "⏳ Pending review"],
] as const;

/** WCAG contrast of the element's text against what is painted behind it. */
async function contrastOf(el: Locator) {
  return el.evaluate((node) => {
    const parse = (c: string) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = "1"] = m[1].split(/[ ,/]+/).filter(Boolean);
      return [Number(r), Number(g), Number(b), Number(a)];
    };
    const over = (top: number[], bottom: number[]) => {
      const a = top[3];
      return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat(1);
    };
    // Backgrounds from the element up to the page; then paint them bottom-up.
    const layers: number[][] = [];
    for (let el: Element | null = node; el; el = el.parentElement) {
      const bg = parse(getComputedStyle(el).backgroundColor);
      if (bg && bg[3] > 0) layers.push(bg);
      if (bg && bg[3] === 1) break;
    }
    let base = [255, 255, 255, 1];
    for (const layer of layers.reverse()) base = over(layer, base);
    const text = over(parse(getComputedStyle(node).color)!, base);
    const lum = (c: number[]) => {
      const [r, g, b] = c.slice(0, 3).map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const [hi, lo] = [lum(text), lum(base)].sort((x, y) => y - x);
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  });
}

for (const [status, label] of STATUSES) {
  test(`[BUG-2609-050] event edit: the ${status} special-notes badge has text contrast of at least 4.5:1`, async ({ page, isMobile }) => {
    await useRuleViewport(page, isMobile);
    await page.route(`**/api/events/${EVENT_ID}/owner`, async (route) => {
      const res = await route.fetch();
      const event = await res.json();
      await route.fulfill({
        response: res,
        json: { ...event, specialNotes: event.specialNotes || "Test notes", specialNotesStatus: status, specialNotesRejectionReason: null },
      });
    });
    await gotoDashboard(page, `/dashboard/organiser/events/${EVENT_ID}/edit/`);
    const badge = page.getByText(label, { exact: true });
    await expect(badge).toBeVisible();
    const ratio = await contrastOf(badge);
    test.info().annotations.push({ type: "contrast", description: `${status}: ${ratio}:1` });
    expect(ratio, `${status} badge text contrast`).toBeGreaterThanOrEqual(4.5);
  });
}
