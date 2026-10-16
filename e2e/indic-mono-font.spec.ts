import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { useRuleViewport } from "./helpers/viewports";

/**
 * Run D (Hitesh phone pass 13-14 Oct). No-auth, read-only, at 390 and 1440.
 *
 * 1. Mono labels in Indic locales: the mono font has no Devanagari, so on
 *    Hitesh's Marathi phone the fallback was set on the mono grid and labels
 *    read with double-width gaps. In an Indic locale globals.css turns the
 *    mono variable into the sans stack; English keeps the mono font.
 * 2. Marathi and Hindi four-room names (Hitesh decision, 14 Oct).
 *
 * Expected strings are literals on purpose, not imported from the
 * dictionaries: an edit that changes them has to change this spec too.
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

const firstFamily = (list: string) => list.split(",")[0].trim().replace(/^["']|["']$/g, "");

/** First family of the element's computed font-family, and of the page's sans and mono fonts. */
async function families(el: Locator) {
  return el.evaluate((node) => {
    const first = (list: string) => list.split(",")[0].trim().replace(/^["']|["']$/g, "");
    // The families next/font gives the page, read from a probe that sets them directly.
    const probe = (font: string) => {
      const span = document.createElement("span");
      span.style.fontFamily = font;
      document.body.appendChild(span);
      const family = first(getComputedStyle(span).fontFamily);
      span.remove();
      return family;
    };
    return {
      el: first(getComputedStyle(node).fontFamily),
      sans: probe("var(--font-sans)"),
      // --font-phys-jetbrains-mono is the mono face itself, never remapped.
      mono: probe("var(--font-phys-jetbrains-mono)"),
    };
  });
}

/**
 * Adds a label using the inline var, the way every mono label in src/ does.
 * No component uses the Tailwind font-mono class, so Tailwind leaves the
 * utility out of the built CSS and there is nothing to probe; globals.css
 * remaps its variable (--font-geist-mono) too, for when one does.
 */
async function addProbeLabels(page: Page) {
  await page.evaluate(() => {
    const inline = document.createElement("span");
    inline.style.fontFamily = "var(--font-mono)";
    inline.dataset.testid = "probe-inline-mono";
    inline.textContent = "चार";
    document.querySelector("main")?.append(inline);
  });
}

// homePage.fourRoomsEyebrow - a mono label (FourRooms.tsx).
const EYEBROW: Record<string, string> = {
  hi: "चार कमरे, एक घर",
  mr: "चार खोल्या, एक घर",
  en: "Four rooms, one house",
};

for (const locale of ["mr", "hi"]) {
  test(`[run D] ${locale}: mono labels render in the sans font`, async ({ page }) => {
    await gotoInLocale(page, "/", locale);
    const eyebrow = page.getByText(EYEBROW[locale], { exact: true });
    await eyebrow.scrollIntoViewIfNeeded();
    const f = await families(eyebrow);
    expect(f.sans).not.toBe(f.mono);
    expect(f.el, "four-rooms eyebrow").toBe(f.sans);
    // The hero's live tag is a mono label too.
    expect((await families(page.getByTestId("hero-live-tag").locator("span").last())).el, "hero tag").toBe(f.sans);

    await addProbeLabels(page);
    expect((await families(page.getByTestId("probe-inline-mono"))).el, "inline var(--font-mono)").toBe(f.sans);
  });
}

test("[run D] en: mono labels keep the mono font", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const eyebrow = page.getByText(EYEBROW.en, { exact: true });
  await eyebrow.scrollIntoViewIfNeeded();
  const f = await families(eyebrow);
  expect(f.el).toBe(f.mono);
  expect(firstFamily(f.mono)).toMatch(/JetBrains/i);
  await addProbeLabels(page);
  expect((await families(page.getByTestId("probe-inline-mono"))).el).toBe(f.mono);
});

// homePage.fourRooms{House,Stage,Booth,Venue}Name.
const ROOM_NAMES: Record<string, string[]> = {
  mr: ["प्रेक्षागृह", "रंगमंच", "सूत्रधार कक्ष", "दालन"],
  hi: ["प्रेक्षागृह", "रंगमंच", "सूत्रधार कक्ष", "कक्ष"],
};
const OLD_NAMES = ["द हाऊस", "द हाउस", "द स्टेज", "द बूथ", "द रूम"];

for (const locale of ["mr", "hi"]) {
  test(`[run D] ${locale}: the four rooms carry their translated names`, async ({ page, isMobile }) => {
    await gotoInLocale(page, "/", locale);
    const section = page.locator("section").filter({ hasText: EYEBROW[locale] });
    await section.scrollIntoViewIfNeeded();
    await expect(section.getByRole("heading", { level: 3 })).toHaveText(ROOM_NAMES[locale]);
    const text = await section.innerText();
    expect(OLD_NAMES.filter((s) => text.includes(s))).toEqual([]);

    if (locale === "mr") {
      await page.evaluate(() => document.fonts.ready);
      const w = isMobile ? 390 : 1440;
      // A mono label area (the eyebrow) and the first room row.
      await expect(section.getByText(EYEBROW.mr, { exact: true })).toHaveScreenshot(`mr-mono-eyebrow-${w}.png`, { animations: "disabled" });
      const firstRow = section.locator(".four-rooms-row").first();
      await expect(firstRow.locator(".four-rooms-copy")).toHaveScreenshot(`mr-four-rooms-house-${w}.png`, { animations: "disabled" });
    }
  });
}
