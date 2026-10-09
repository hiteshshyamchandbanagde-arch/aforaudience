import type { Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { useRuleViewport } from "./helpers/viewports";

/**
 * Hitesh's Hindi phone check of the homepage, 8 Oct. No-auth, read-only,
 * at 390 and 1440.
 *
 * BUG-2610-029 - the homepage's main button (ctaFindTonightsShow) read
 * "Find tonight's show" in 10 of the 11 non-English languages, and so did
 * most of the homepage below the hero. scripts/i18n-untranslated.test.ts
 * checks every dictionary; this checks what a Hindi visitor sees.
 *
 * Expected strings are literals on purpose, not imported from the
 * dictionaries: an edit that changes them has to change this spec too.
 */

const LOCALE_STORAGE_KEY = "afa-locale";

/** Opens the page with the language already picked (the way a returning visitor has it). */
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

// The homepage's primary button in each language (dictionaries, homePage.ctaFindTonightsShow).
const CTA: Record<string, string> = {
  hi: "आज रात का शो खोजें",
  mr: "आज रात्रीचा शो शोधा",
  te: "ఈ రాత్రి షోను కనుగొనండి",
  ta: "இன்றிரவு நிகழ்ச்சியைக் கண்டறியுங்கள்",
  kn: "ಇಂದು ರಾತ್ರಿಯ ಶೋ ಹುಡುಕಿ",
  ml: "ഇന്ന് രാത്രിയിലെ ഷോ കണ്ടെത്തൂ",
  gu: "આજ રાતનો શો શોધો",
  bn: "আজ রাতের শো খুঁজুন",
  de: "Finde die Show für heute Abend",
  fr: "Trouvez le spectacle de ce soir",
  es: "Encuentra el show de esta noche",
};

test("[BUG-2610-029] the homepage's main button is translated in every language", async ({ page, isMobile }) => {
  for (const [locale, label] of Object.entries(CTA)) {
    await gotoInLocale(page, "/", locale);
    const cta = page.getByRole("main").getByRole("link", { name: label });
    await expect(cta, `${locale} button`).toBeVisible();
    await expect(cta).toHaveAttribute("href", /^\/events\/?$/);
    await expect(page.getByRole("link", { name: "Find tonight's show" })).toHaveCount(0);
  }
  // Hindi, as reported.
  await gotoInLocale(page, "/", "hi");
  const cta = page.getByRole("main").getByRole("link", { name: CTA.hi });
  await expect(cta).toHaveScreenshot(`hi-cta-${isMobile ? 390 : 1440}.png`, { animations: "disabled" });
});

// English homepage copy that was left in hi.ts before the fix (homePage.*).
const ENGLISH_LEFT_BEFORE = [
  "Find tonight's show",
  "Happening soon",
  "Never tax the scene",
  "AFA takes 0% commission",
  "Four rooms, one house",
  "A live venue is never",
  "The House",
  "Take the stage",
  "List your space",
];

test("[BUG-2610-029] no English homepage copy is left on the Hindi homepage", async ({ page }) => {
  await gotoInLocale(page, "/", "hi");
  // The four-rooms block sits near the bottom; scroll through so lazy sections render.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 50));
    }
  });
  await expect(page.getByText("चार कमरे, एक घर")).toBeAttached();
  const text = await page.locator("body").innerText();
  const left = ENGLISH_LEFT_BEFORE.filter((s) => text.includes(s));
  expect(left).toEqual([]);
});

/**
 * BUG-2610-030 - tracked labels split Devanagari: letter-spacing pulled
 * every conjunct and vowel sign apart ("जीवंत कला" read "जी वं त  क ला").
 * In an Indic locale, one rule in globals.css drops letter-spacing and
 * text-transform on every tracked label; English keeps both.
 */
async function tracking(el: import("@playwright/test").Locator) {
  return el.evaluate((node) => {
    const s = getComputedStyle(node);
    return { letterSpacing: s.letterSpacing, textTransform: s.textTransform };
  });
}

const UNTRACKED = { letterSpacing: "normal", textTransform: "none" };

test("[BUG-2610-030] Hindi: the homepage eyebrow has no letter-spacing", async ({ page, isMobile }) => {
  await gotoInLocale(page, "/", "hi");
  const eyebrow = page.getByRole("main").getByText("जीवंत कला, असली पल", { exact: true });
  await expect(eyebrow).toBeVisible();
  expect(await tracking(eyebrow)).toEqual(UNTRACKED);
  await expect(eyebrow).toHaveScreenshot(`hi-eyebrow-${isMobile ? 390 : 1440}.png`, { animations: "disabled" });
});

test("[BUG-2610-030] Hindi: the /events count labels have no letter-spacing", async ({ page }) => {
  await gotoInLocale(page, "/events", "hi");
  const showing = page.getByRole("main").getByText(/^\d+ इवेंट्?स? दिखा रहे हैं$/);
  await expect(showing).toBeVisible();
  expect(await tracking(showing)).toEqual(UNTRACKED);
  const near = page.getByTestId("events-count-eyebrow");
  await expect(near).toHaveText(/आपके आसपास \d+ इवेंट/);
  expect(await tracking(near)).toEqual(UNTRACKED);
});

test("[BUG-2610-030] English keeps its tracked, uppercase labels", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const eyebrow = page.getByRole("main").getByText("Live, right now — six cities and counting", { exact: true });
  await expect(eyebrow).toBeVisible();
  const home = await tracking(eyebrow);
  expect(home.letterSpacing).not.toBe("normal");
  expect(home.textTransform).toBe("uppercase");

  await page.goto("/events");
  const showing = page.getByRole("main").getByText(/^Showing \d+ events?$/i);
  await expect(showing).toBeVisible();
  const events = await tracking(showing);
  expect(events.letterSpacing).not.toBe("normal");
  expect(events.textTransform).toBe("uppercase");
});
