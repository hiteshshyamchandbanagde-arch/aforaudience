import type { Locator } from "@playwright/test";
import { test, expect, gotoDashboard, hideFloatingOverlays } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { contrastOf } from "./helpers/contrast";
import { withQaDb } from "./helpers/qa-db";
import { useRuleViewport } from "./helpers/viewports";

/**
 * BUG-2609-085 - on the organiser's event page at 390, "Check approval
 * status" (the publish button while the event is PENDING_APPROVAL) was
 * nearly invisible. Checked: its text has at least 4.5:1 contrast, it
 * sits in the page's data-afa-action-row, and at 390 the support-chat
 * button does not cover it.
 *
 * As Omkar. Omkar has no PENDING_APPROVAL event in the QA seed, so his
 * seeded "Improv Theatre Jam" is set to PENDING_APPROVAL for the test and
 * put back to the status it had afterwards. Nothing is clicked.
 */

const EVENT_ID = "qa-demo-event-full-9";
let originalStatus: string | null = null;

test.use({ storageState: authFile("omkar") });

test.beforeEach(async () => {
  await withQaDb(async (db) => {
    const { rows } = await db.query<{ status: string }>(`SELECT status FROM "Event" WHERE id = $1`, [EVENT_ID]);
    expect(rows.length, `${EVENT_ID} is in the QA seed`).toBe(1);
    originalStatus = rows[0].status;
    await db.query(`UPDATE "Event" SET status = 'PENDING_APPROVAL' WHERE id = $1`, [EVENT_ID]);
  });
});

test.afterEach(async () => {
  if (!originalStatus) return;
  const status = originalStatus;
  originalStatus = null;
  await withQaDb((db) => db.query(`UPDATE "Event" SET status = $2 WHERE id = $1`, [EVENT_ID, status]));
});

/** Points of a tap (centre, 8 px in from each end) that something else covers. */
async function coveredPoints(control: Locator) {
  return control.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const y = r.top + r.height / 2;
    const xs = [r.left + r.width / 2, r.left + Math.min(8, r.width / 2), r.right - Math.min(8, r.width / 2)];
    return xs
      .filter((x) => y >= 0 && y <= window.innerHeight && x >= 0 && x <= window.innerWidth)
      .filter((x) => {
        const hit = document.elementFromPoint(x, y);
        return hit !== null && hit !== el && !el.contains(hit);
      })
      .map((x) => `(${Math.round(x)}, ${Math.round(y)})`);
  });
}

test("[BUG-2609-085] organiser event page: 'Check approval status' is readable (>= 4.5:1) and clear of the chat button @needs-db", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  await gotoDashboard(page, `/dashboard/organiser/events/${EVENT_ID}`);

  const row = page.getByRole("main").locator("[data-afa-action-row]");
  const button = row.getByRole("button", { name: "Check approval status", exact: true });
  await expect(button).toBeVisible();

  const ratio = await contrastOf(button);
  test.info().annotations.push({ type: "contrast", description: `Check approval status: ${ratio}:1 at ${isMobile ? 390 : 1440}` });
  expect(ratio, "'Check approval status' text contrast").toBeGreaterThanOrEqual(4.5);

  // Scrolled to the bottom of the page and to mid-screen, nothing (the chat button included) is over it.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => coveredPoints(button), { message: "page scrolled to the end", timeout: 3_000 }).toEqual([]);
  await button.evaluate((el) => {
    const r = el.getBoundingClientRect();
    window.scrollBy(0, r.top + r.height / 2 - window.innerHeight / 2);
  });
  await expect.poll(() => coveredPoints(button), { message: "mid-screen", timeout: 3_000 }).toEqual([]);

  await hideFloatingOverlays(page);
  await expect(button).toHaveScreenshot(`check-approval-${isMobile ? 390 : 1440}.png`, { animations: "disabled" });
});
