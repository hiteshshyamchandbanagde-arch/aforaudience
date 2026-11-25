import type { Locator } from "@playwright/test";
import { test, expect, gotoDashboard } from "./helpers/test";
import { ADMIN_AUTH_FILE } from "./helpers/temp-admin";
import { useRuleViewport } from "./helpers/viewports";

/**
 * BUG-2610-016 - admin Revenue at 390: the "Top organisers" header read
 * "ORGANISER | PLATFORMBOOKINGS FEE" (two headers colliding) and did not
 * line up with the row values; the revenue chart's bars were labelled
 * only "09" / "10", rotated 90°, with no value. Now the headers keep a
 * gap and sit over their values, the chart reads "Sep" / "Oct"
 * horizontally (with the year when the range spans years) and each bar
 * carries its ₹ value on top. Checked at 390 and 1440 with the run's temp
 * admin (needs the QA database). Read-only.
 *
 * The baseline is the table's header row only: the values and the chart
 * change whenever anyone books on QA.
 */
test.use({ storageState: ADMIN_AUTH_FILE });

const box = async (l: Locator) => (await l.boundingBox())!;

test("[BUG-2610-016] Top organisers: headers keep apart and line up with their values @needs-db", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  await gotoDashboard(page, "/dashboard/admin/revenue/");
  const section = page.locator("div").filter({ has: page.getByRole("heading", { name: "Top organisers by platform fee generated" }) }).last();
  const list = section.locator("h2 + div");
  const header = list.locator("> div").first();
  const firstRow = list.locator("> div").nth(1);
  await expect(firstRow, "at least one organiser in the default (all time) range").toBeVisible();

  const heads = header.locator("> span").filter({ visible: true });
  const cells = firstRow.locator("> span").filter({ visible: true });
  const n = await heads.count();
  expect(n, isMobile ? "Organiser, Platform fee, Bookings" : "plus Ticket volume").toBe(isMobile ? 3 : 4);
  expect(await cells.count()).toBe(n);

  for (let i = 0; i < n; i++) {
    const h = await box(heads.nth(i));
    const c = await box(cells.nth(i));
    const label = (await heads.nth(i).innerText()).trim();
    if (i + 1 < n) {
      const next = await box(heads.nth(i + 1));
      expect(next.x - (h.x + h.width), `a gap after "${label}"`).toBeGreaterThanOrEqual(8);
    }
    if (i === 0) {
      expect(Math.abs(h.x - c.x), `"${label}" starts where its values start`).toBeLessThan(2);
    } else {
      // Numbers are right-aligned: the header text ends where the value ends.
      // The last line's rect: a wrapped header ("Platform / fee") hangs its
      // line-break space past the edge on the first line.
      const textRight = (l: Locator) =>
        l.evaluate((el) => {
          const r = document.createRange();
          r.selectNodeContents(el);
          const rects = [...r.getClientRects()];
          return rects[rects.length - 1].right;
        });
      const hText = await textRight(heads.nth(i));
      const cText = await textRight(cells.nth(i));
      expect(Math.abs(hText - cText), `"${label}" ends over its value`).toBeLessThan(2);
    }
  }
  await expect(header).toHaveScreenshot(`revenue-top-organisers-header-${isMobile ? 390 : 1440}.png`, { maxDiffPixelRatio: 0.02 });
});

test("[BUG-2610-016] revenue chart: month names read horizontally, a ₹ value on each bar @needs-db", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  await gotoDashboard(page, "/dashboard/admin/revenue/");
  const section = page.locator("div").filter({ has: page.getByRole("heading", { name: "Platform revenue over time" }) }).last();
  const bars = section.locator("h2 + div > div");
  await expect(bars.first(), "the default (all time) range has bookings").toBeVisible();
  const count = await bars.count();
  const years = new Set<string>();
  const labels: string[] = [];

  for (let i = 0; i < count; i++) {
    const bar = bars.nth(i);
    const parts = bar.locator("> *");
    // value, bar, label - top to bottom
    const [value, column, label] = [parts.nth(0), parts.nth(1), parts.nth(2)];
    const text = (await label.innerText()).trim();
    labels.push(text);
    const m = text.match(/^(?:\d{1,2} )?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?: (\d{4}))?$/);
    expect(m, `"${text}" is a month name`).not.toBeNull();
    if (m?.[2]) years.add(m[2]);
    const l = await box(label);
    expect(l.width, `"${text}" reads horizontally`).toBeGreaterThan(l.height);
    expect(await label.evaluate((el) => getComputedStyle(el).writingMode)).toBe("horizontal-tb");

    await expect(value).toHaveText(/^₹[\d,]+$/);
    const v = await box(value);
    const c = await box(column);
    expect(v.y + v.height, "the value sits on top of its bar").toBeLessThanOrEqual(c.y + 1);
  }
  // The year shows on every label or on none.
  expect(years.size === 0 || labels.every((t) => /\d{4}$/.test(t)), labels.join(", ")).toBe(true);
});
