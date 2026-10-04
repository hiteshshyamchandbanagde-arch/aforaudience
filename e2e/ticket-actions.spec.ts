import { test, expect } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { useRuleViewport } from "./helpers/viewports";

/**
 * My Tickets (4 Oct visual check, dispatch C item 7): on a confirmed
 * ticket, "Download ticket (PDF)" wrapped to 3 lines at 390. The label is
 * now "Download PDF" (all 11 locales) and the three actions (Download,
 * Message Organiser, Cancel) share one row, each label on at most 2 lines.
 * Atul, at 390 and 1440. Read-only: nothing is pressed.
 */

test.use({ storageState: authFile("atul") });

test("My Tickets (dispatch C item 7): the three ticket actions share one row, each label at most 2 lines", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  await page.goto("/tickets/");
  const download = page.locator('a[href^="/api/bookings/"][href*="/ticket"]').filter({ visible: true }).first();
  await expect(download, "Atul has an upcoming confirmed ticket").toBeVisible({ timeout: 20_000 });

  // The download button's row: its parent holds the three actions.
  const row = download.locator("xpath=..");
  const actions = row.locator("> a, > button");
  await expect(actions).toHaveCount(3);

  const measured = await actions.evaluateAll((els) =>
    els.map((el) => {
      // Lines = distinct line boxes of the label's own text.
      const range = document.createRange();
      range.selectNodeContents(el);
      const tops = new Set(Array.from(range.getClientRects()).filter((r) => r.width > 0).map((r) => Math.round(r.top)));
      const r = el.getBoundingClientRect();
      return { label: (el.textContent || "").trim(), lines: tops.size, top: Math.round(r.top) };
    }),
  );
  for (const m of measured) expect(m.lines, `"${m.label}" wraps to ${m.lines} lines`).toBeLessThanOrEqual(2);
  expect(new Set(measured.map((m) => m.top)).size, `one row: ${JSON.stringify(measured)}`).toBe(1);
  await expect(download).toHaveText(/^\s*Download PDF\s*$/);
});
