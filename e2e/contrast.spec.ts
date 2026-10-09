import { test, expect, gotoDashboard } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { contrastOf } from "./helpers/contrast";
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
  // BUG-2610-025: the hourglass emoji is now the app's clock icon (an SVG, no text).
  ["PENDING", "Pending review"],
] as const;

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
