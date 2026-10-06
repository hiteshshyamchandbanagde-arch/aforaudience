import type { Locator, Page } from "@playwright/test";
import { test, expect, gotoDashboard } from "./helpers/test";
import { authFile, type PersonaKey } from "./helpers/personas";
import { PHONE } from "./helpers/viewports";

/**
 * BUG-2609-068 / BUG-2609-081 - the floating support-chat button sat on
 * top of page controls on a phone (venue edit's Save & Unpublish, the seat
 * page's Reserve, ...). Since #719 a page marks its bottom action row with
 * data-afa-action-row; the button lifts above a marked row in view and
 * every page leaves room after its last content.
 *
 * At 390 x 844, on six pages with bottom actions, every control in a
 * marked row is checked where a tap would land (its centre, and near
 * both ends: the button sits at the right edge) with the control scrolled
 * to three places: the button's resting height (the worst case), the
 * middle of the screen, and the page scrolled to the end.
 *
 * Admin Settings is checked by design-system-goal.spec.ts (it needs the
 * run's temp admin). Checkout needs a real booking, so the seat page
 * stands for it. Nothing is saved: the pages are only opened and scrolled.
 */

type Target = { name: string; url: string; persona: PersonaKey; dashboard: boolean };

const PAGES: Target[] = [
  { name: "organiser event create", url: "/dashboard/organiser/events/create/", persona: "omkar", dashboard: true },
  // Omkar's seeded "full" organiser event (scripts/qa-seed.ts).
  { name: "organiser event edit", url: "/dashboard/organiser/events/qa-demo-event-full-9/edit/", persona: "omkar", dashboard: true },
  // Jaipur Mic Gala 100's seat page (scripts/qa-seed.ts jaipurEventId).
  { name: "seat selection", url: "/events/qa-jaipur-event-0001/seats/", persona: "atul", dashboard: false },
  { name: "profile", url: "/profile/", persona: "atul", dashboard: true },
  // Vinayak's seeded Koregaon Park Lounge: where 068 was first seen.
  { name: "venue edit", url: "/dashboard/venue/qa-demo-venue-full-1/edit/", persona: "vinayak", dashboard: true },
  { name: "venue create", url: "/dashboard/venue/create/", persona: "vinayak", dashboard: true },
];

const CONTROLS =
  "[data-afa-action-row] :is(button, a[href], input, select, textarea), :is(button, a[href])[data-afa-action-row]";

/** The chat button's resting spot: SupportWidget's hidden probe, which never lifts. */
async function restingCentreY(page: Page) {
  return page.locator('.afa-support-chat-btn[aria-hidden="true"]').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.top + r.height / 2;
  });
}

/**
 * Points a tap may land on that something else covers: centre, and 8 px in from each end.
 *
 * A point under the sticky top bar (MobileTopBar's <header>) is scrolled
 * out of view, like one above the screen, not covered: with the page
 * scrolled to the end a control can sit there, and scrolling up reaches
 * it. On #738's faster preview the profile finished loading before the
 * scroll and left "Become an Artist" at y = 17, under the search box,
 * which was counted as covering it; the chat button covered nothing.
 */
async function coveredPoints(control: Locator) {
  return control.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const y = r.top + r.height / 2;
    const xs = [r.left + r.width / 2, r.left + Math.min(8, r.width / 2), r.right - Math.min(8, r.width / 2)];
    const topBarBottom = Math.max(
      0,
      ...[...document.querySelectorAll("header")]
        .filter((h) => ["sticky", "fixed"].includes(getComputedStyle(h).position) && h.getBoundingClientRect().height > 0)
        .map((h) => h.getBoundingClientRect().bottom),
    );
    const covered: string[] = [];
    for (const x of xs) {
      if (y < topBarBottom || y > window.innerHeight || x < 0 || x > window.innerWidth) continue;
      const hit = document.elementFromPoint(x, y);
      if (hit && hit !== el && !el.contains(hit)) {
        const by = hit.closest("[data-afa-floating]") ? "the chat button" : `<${hit.tagName.toLowerCase()} class="${hit.getAttribute("class") ?? ""}">`;
        covered.push(`(${Math.round(x)}, ${Math.round(y)}) by ${by}`);
      }
    }
    return covered;
  });
}

async function describeControl(control: Locator) {
  return control.evaluate((el) => (el.getAttribute("aria-label") || (el as HTMLElement).innerText || el.tagName).trim().slice(0, 40));
}

for (const target of PAGES) {
  test.describe(target.name, () => {
    test.use({ storageState: authFile(target.persona), viewport: PHONE });

    test(`[BUG-2609-068] [BUG-2609-081] ${target.name}: the chat button covers no bottom action at 390`, async ({ page }) => {
      if (target.dashboard) await gotoDashboard(page, target.url);
      else await page.goto(target.url);

      await expect(page.getByRole("button", { name: "Open support chat" }), "the chat button is on the page").toBeAttached();
      const controls = page.locator(CONTROLS).filter({ visible: true });
      await expect(controls.first(), `a marked action row on ${target.name}`).toBeVisible();
      const count = await controls.count();
      const restY = await restingCentreY(page);

      for (let i = 0; i < count; i++) {
        const control = controls.nth(i);
        const label = await describeControl(control);
        for (const where of ["at the chat button's resting height", "mid-screen"] as const) {
          await control.evaluate((el, y) => {
            const r = el.getBoundingClientRect();
            const target = y ?? window.innerHeight / 2;
            window.scrollBy(0, r.top + r.height / 2 - target);
          }, where === "mid-screen" ? null : restY);
          // The button follows scroll on the next frames; poll until it settles.
          await expect
            .poll(() => coveredPoints(control), { message: `"${label}" on ${target.name}, ${where}`, timeout: 3_000 })
            .toEqual([]);
        }
      }

      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      for (let i = 0; i < count; i++) {
        const control = controls.nth(i);
        const label = await describeControl(control);
        await expect
          .poll(() => coveredPoints(control), { message: `"${label}" on ${target.name}, page scrolled to the end`, timeout: 3_000 })
          .toEqual([]);
      }
    });
  });
}
