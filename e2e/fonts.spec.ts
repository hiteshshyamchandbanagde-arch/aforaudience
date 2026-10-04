import type { Page } from "@playwright/test";
import { test, expect, gotoDashboard } from "./helpers/test";
import { authFile, type PersonaKey } from "./helpers/personas";
import { useRuleViewport } from "./helpers/viewports";

/**
 * BUG-2609-055 - text with no font of its own fell back to the browser's
 * default serif: html's font-family named next/font variables that were
 * declared on <body>, so at <html> the value was invalid. Most visible on
 * the Seat Map Builder, the support chat panel, and the SiteNav and
 * dashboard sidebar labels. The font variables now sit on <html>.
 *
 * On each page every visible text node's element is read: the first
 * family in its computed font-family must be one of the app's own (a
 * family the page declares with @font-face), never a bare generic family or
 * the browser default. At 390 and 1440. Read-only.
 */

type Target = { name: string; url: string; persona?: PersonaKey; dashboard?: boolean; openChat?: boolean };

const PAGES: Target[] = [
  // Vinayak's seeded Koregaon Park Lounge (scripts/qa-seed.ts).
  { name: "Seat Map Builder", url: "/dashboard/venue/qa-demo-venue-full-1/seat-map/", persona: "vinayak", dashboard: true },
  { name: "venue dashboard (sidebar labels)", url: "/dashboard/venue/", persona: "vinayak", dashboard: true },
  { name: "events listing (SiteNav)", url: "/events/" },
  { name: "support chat panel", url: "/venues/", openChat: true },
  { name: "about", url: "/about/" },
  { name: "organiser tours", url: "/dashboard/organiser/tours/", persona: "omkar", dashboard: true },
  { name: "event detail", url: "/events/qa-jaipur-event-0001/" },
];

/** Elements whose visible text renders in a family that is not the app's. */
async function strayFonts(page: Page) {
  return page.evaluate(() => {
    const unquote = (f: string) => f.trim().replace(/^["']|["']$/g, "").toLowerCase();
    const firstFamily = (list: string) => unquote(list.split(",")[0] ?? "");
    // The app's families: every @font-face the page declares (the
    // self-hosted next/font files and their metric fallbacks in
    // src/fonts/fallbacks.css). The browser's default serif is never one.
    const allowed = new Set<string>();
    document.fonts.forEach((face) => allowed.add(unquote(face.family)));
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSFontFaceRule) allowed.add(unquote(rule.style.getPropertyValue("font-family")));
      }
    }
    for (const generic of ["serif", "sans-serif", "monospace", "system-ui", "cursive", "fantasy", "times new roman", "times", "georgia"]) {
      allowed.delete(generic);
    }

    const stray = new Map<string, string>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue;
      const el = node.parentElement;
      if (!el || el.closest("script, style, noscript, svg, [aria-hidden='true']")) continue;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || cs.visibility === "hidden" || el.checkVisibility?.({ opacityProperty: true }) === false) continue;
      const family = firstFamily(cs.fontFamily);
      if (allowed.has(family)) continue;
      const key = `${family} <${el.tagName.toLowerCase()}> "${node.textContent.trim().slice(0, 30)}"`;
      stray.set(key, cs.fontFamily);
    }
    return { allowed: [...allowed], stray: [...stray.keys()].slice(0, 20) };
  });
}

for (const target of PAGES) {
  test.describe(target.name, () => {
    if (target.persona) test.use({ storageState: authFile(target.persona) });

    test(`[BUG-2609-055] ${target.name}: no text in a browser-default or bare generic font`, async ({ page, isMobile }) => {
      await useRuleViewport(page, isMobile);
      if (target.dashboard) await gotoDashboard(page, target.url);
      else await page.goto(target.url);
      await expect(page.locator("main").first()).toBeVisible();
      if (target.openChat) {
        await page.getByRole("button", { name: "Open support chat" }).click();
        await expect(page.getByRole("dialog", { name: "Support" })).toBeVisible();
      }
      await page.evaluate(() => document.fonts.ready);

      const { allowed, stray } = await strayFonts(page);
      expect(allowed.length, "the --font-* variables name the app's families").toBeGreaterThan(2);
      expect(stray, `text not in the app's fonts (${allowed.join(", ")})`).toEqual([]);
    });
  });
}
