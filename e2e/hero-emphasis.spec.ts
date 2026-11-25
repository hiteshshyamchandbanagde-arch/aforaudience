import type { Page } from "@playwright/test";
import { test, expect, hideFloatingOverlays } from "./helpers/test";
import { useRuleViewport } from "./helpers/viewports";

/**
 * BUG-2610-031 - /venues in Hindi (Hitesh's phone, 8 Oct): "जहाँ शो होता है",
 * and the gold italic "शो" had no visible space after it; its slant ran into
 * "होता". The display face has no italic, so the browser slants it and the
 * top of the word leans into the space. Every hero highlight now renders
 * through HeroEmphasis, which pads its trailing edge (the italic
 * correction); scripts/hero-emphasis.test.ts checks every locale's strings.
 *
 * The measure: from the end of the highlighted word's text to the start of
 * the next word. A plain space is about 0.25em, which the slant eats; with
 * the correction it is about 0.37em. No-auth, read-only, at 390 and 1440.
 */

const LOCALE_STORAGE_KEY = "afa-locale";

async function gotoInLocale(page: Page, path: string, locale: string) {
  await page.addInitScript(
    ([key, value]) => {
      try {
        localStorage.setItem(key, value);
      } catch {}
    },
    [LOCALE_STORAGE_KEY, locale],
  );
  await page.goto(path);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
}

test.beforeEach(async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
});

type Measure = {
  word: string;
  before: string | null;
  after: string | null;
  padEm: number;
  /** End of the highlighted text to the next word's first letter, in em; null when the next word is on another line or there is none. */
  gapEm: number | null;
};

/** Every hero highlight on the page, measured. */
async function measureHighlights(page: Page): Promise<Measure[]> {
  const highlights = page.locator("[data-afa-hero-emphasis]");
  await expect(highlights.first()).toBeVisible();
  return highlights.evaluateAll((els) =>
    els
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => {
        const fs = parseFloat(getComputedStyle(el).fontSize);
        const text = document.createRange();
        text.selectNodeContents(el);
        // The last line of the highlight (it may wrap): its text, and its box with padding.
        const textRects = text.getClientRects();
        const textBox = textRects[textRects.length - 1];
        const boxRects = el.getClientRects();
        const box = boxRects[boxRects.length - 1];
        const prev = el.previousSibling?.nodeType === Node.TEXT_NODE ? el.previousSibling.textContent : null;
        const next = el.nextSibling?.nodeType === Node.TEXT_NODE ? el.nextSibling : null;
        let gapEm: number | null = null;
        if (next?.textContent) {
          const i = next.textContent.search(/[\p{L}\p{N}]/u);
          if (i >= 0 && /^\s/u.test(next.textContent)) {
            const r = document.createRange();
            r.setStart(next, i);
            r.setEnd(next, i + 1);
            const nextBox = r.getBoundingClientRect();
            if (Math.abs(nextBox.top - textBox.top) < fs / 2) gapEm = (nextBox.left - textBox.right) / fs;
          }
        }
        return { word: el.textContent ?? "", before: prev, after: next?.textContent ?? null, padEm: (box.right - textBox.right) / fs, gapEm };
      }),
  );
}

function expectRoomAfter(m: Measure, where: string) {
  expect(m.padEm, `${where}: "${m.word}" has the italic correction after it`).toBeGreaterThanOrEqual(0.1);
  if (m.after) expect(m.after, `${where}: a space (or punctuation) after "${m.word}", outside the highlight`).toMatch(/^(\s|[.,!?;:।…])/u);
  if (m.before) expect(m.before, `${where}: a space before "${m.word}", outside the highlight`).toMatch(/\s$/u);
  if (m.gapEm !== null) expect(m.gapEm, `${where}: room between "${m.word}" and the next word`).toBeGreaterThanOrEqual(0.33);
}

test("[BUG-2610-031] /venues in Hindi: the gold italic शो has its space and does not run into होता", async ({ page, isMobile }) => {
  await gotoInLocale(page, "/venues", "hi");
  await hideFloatingOverlays(page);
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toHaveText("जहाँ शो होता है।");
  const [m] = await measureHighlights(page);
  expect(m.word).toBe("शो");
  test.info().annotations.push({ type: "gap", description: `${m.gapEm?.toFixed(3)}em after शो, padding ${m.padEm.toFixed(3)}em` });
  expect(m.gapEm, "शो and होता on one line").not.toBeNull();
  expectRoomAfter(m, "/venues hi");
  await expect(h1).toHaveScreenshot(`venues-hero-hi-${isMobile ? 390 : 1440}.png`, { animations: "disabled" });
});

// Every page with a highlighted hero word, in a Devanagari locale and in English.
const PAGES = ["/", "/events", "/venues", "/organisers", "/venue-owners", "/wall-of-fame"];

for (const locale of ["hi", "en"]) {
  test(`[BUG-2610-031] every hero highlight (${PAGES.length} pages) has its spaces outside it and room after it (${locale})`, async ({ page }) => {
    await gotoInLocale(page, "/", locale);
    for (const path of PAGES) {
      await page.goto(path);
      for (const m of await measureHighlights(page)) expectRoomAfter(m, `${path} ${locale}`);
    }
  });
}

test("[BUG-2610-031] homepage in Hindi: the hero's last line has a space before the highlighted words", async ({ page }) => {
  await gotoInLocale(page, "/", "hi");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("पाती है अपनी भीड़");
});
