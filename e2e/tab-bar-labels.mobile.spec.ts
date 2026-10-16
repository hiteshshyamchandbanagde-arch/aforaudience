import type { Locator } from "@playwright/test";
import { test, expect, gotoDashboard } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { useRuleViewport } from "./helpers/viewports";

/**
 * GEN-2609-120 - the phone tab bar's visitor labels (Discover, Tickets,
 * Saved, Events, WOF) were hard-coded English; they now come from the
 * nav.tab* keys in every locale. Each slot is a fifth of 390 px at 10 px
 * caps with letter-spacing, so a long translation wraps or clips. This
 * checks every locale, logged out, on "/" (Discover bar) and "/events/"
 * (Events bar): every label on one line and inside its slot. Read-only.
 */

// Duplicated on purpose (see language-rollout.spec.ts).
const LOCALE_IDS = ["en", "hi", "mr", "te", "ta", "kn", "ml", "gu", "bn", "de", "fr", "es"];

/** Labels in `bar` that wrap to a second line or overflow their slot. */
function labelsThatDoNotFit(bar: Locator): Promise<string[]> {
  return bar.evaluate((root) => {
    const out: string[] = [];
    for (const link of Array.from(root.querySelectorAll<HTMLElement>("a, button"))) {
      const label = link.querySelector<HTMLElement>("span:last-child");
      if (!label) continue;
      const text = label.innerText.trim();
      const rects = Array.from(label.getClientRects());
      const tops = new Set(rects.map((r) => Math.round(r.top)));
      const range = document.createRange();
      range.selectNodeContents(label);
      const lines = new Set(Array.from(range.getClientRects()).map((r) => Math.round(r.top)));
      if (lines.size > 1 || tops.size > 1) out.push(`${text} (wraps)`);
      const slot = link.getBoundingClientRect();
      const box = range.getBoundingClientRect();
      if (box.left < slot.left - 1 || box.right > slot.right + 1) out.push(`${text} (wider than its slot)`);
    }
    return out;
  });
}

for (const id of LOCALE_IDS) {
  test(`[GEN-2609-120] tab bar labels fit at 390: ${id}`, async ({ page, isMobile }) => {
    await useRuleViewport(page, isMobile);
    await page.addInitScript((locale) => window.localStorage.setItem("afa-locale", locale), id);

    for (const path of ["/", "/events/"]) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("lang", id);
      // The tab bar is the nav with the most links at the bottom of the screen.
      const bar = page.locator("nav").filter({ has: page.locator('a[href^="/profile"], a[href^="/wall-of-fame"]') }).last();
      await expect(bar).toBeVisible();

      const bad = await labelsThatDoNotFit(bar);
      expect(bad, `${id} ${path}`).toEqual([]);
    }
  });
}

/**
 * Run E (Hitesh 13-14 Oct) - the Artist bar gained a first item, Overview,
 * and "My Events" became "Find gigs": 4 items in 390 px. As Hrithik, on
 * /dashboard/artist/ in every locale: all 4 items are there in order, every
 * label on one line and inside its slot. The language is set on the device
 * only (localStorage), never saved to the account. Read-only.
 */
test.describe("Artist bar (Hrithik)", () => {
  test.use({ storageState: authFile("hrithik") });

  for (const id of LOCALE_IDS) {
    test(`[artist-nav-E] Artist bar labels fit at 390: ${id}`, async ({ page, isMobile }) => {
      await useRuleViewport(page, isMobile);
      await page.addInitScript((locale) => window.localStorage.setItem("afa-locale", locale), id);

      await gotoDashboard(page, "/dashboard/artist/");
      await expect(page.locator("html")).toHaveAttribute("lang", id);
      const bar = page.locator('nav[data-afa-tab-bar="artist"]');
      await expect(bar).toBeVisible();
      expect(await bar.locator("a[data-afa-tab]").evaluateAll((els) => els.map((el) => el.getAttribute("data-afa-tab")))).toEqual([
        "overview",
        "find-gigs",
        "edit-profile",
        "inquiries",
      ]);

      expect(await labelsThatDoNotFit(bar), `${id} artist bar`).toEqual([]);
    });
  }
});
