import { test, expect } from "@playwright/test";

/**
 * GEN-2608-XXX (language rollout verification). No-auth tests, run against
 * the public homepage/events pages where SiteNav's language picker lives.
 *
 * Scope is deliberately mechanical, not linguistic - this catches "the
 * picker is wired correctly and nothing visibly breaks" across all 11
 * locales cheaply and repeatably. It does NOT judge whether a translation
 * reads naturally or whether long German/French strings visually overflow
 * a tight button - those need a human eye on a handful of locales, per the
 * session-70 decision to pair this spec with a manual pass on 2-3
 * languages (German for text-length stress, Tamil/Kannada for non-Latin
 * script rendering, Hindi as the most-used).
 *
 * Locale list intentionally NOT imported from src/lib/i18n/locales.ts -
 * duplicating it here means a future language addition has to update this
 * spec deliberately too, rather than silently inheriting untested coverage.
 */

const LOCALES: { id: string; nativeLabel: string }[] = [
  { id: "en", nativeLabel: "English" },
  { id: "hi", nativeLabel: "हिन्दी" },
  { id: "te", nativeLabel: "తెలుగు" },
  { id: "ta", nativeLabel: "தமிழ்" },
  { id: "kn", nativeLabel: "ಕನ್ನಡ" },
  { id: "ml", nativeLabel: "മലയാളം" },
  { id: "gu", nativeLabel: "ગુજરાતી" },
  { id: "bn", nativeLabel: "বাংলা" },
  { id: "de", nativeLabel: "Deutsch" },
  { id: "fr", nativeLabel: "Français" },
  { id: "es", nativeLabel: "Español" },
];

// The picker toggle button's accessible name is t.languagePicker.label,
// which is itself translated per-locale - so it can't be used as a
// stable cross-locale selector. Its visible text content is always the
// current locale's 2-letter uppercase code (EN, HI, DE...) regardless of
// language though, so match on that instead of role+name.
function langToggle(page: import("@playwright/test").Page, currentLocaleId: string) {
  return page.getByText(currentLocaleId.toUpperCase(), { exact: true });
}

// A translation dictionary with a missing key falls back to rendering the
// raw dot-path key itself (e.g. "nav.events") rather than throwing - so a
// leaked key is a silent content bug, not a crash. This regex is
// deliberately narrow (word.word, no spaces) to avoid false-positiving on
// real sentence fragments that happen to contain a period.
const RAW_KEY_LEAK = /\b[a-z]+\.[a-zA-Z]+\b/;

for (const { id, nativeLabel } of LOCALES) {
  test(`language switcher: ${id} - nav updates and lang attribute is set`, async ({ page }) => {
    await page.goto("/");

    // Fresh page always starts on English (localStorage-backed, no saved
    // preference in a clean Playwright context) - open the picker and
    // switch to this locale.
    await langToggle(page, "en").click();
    await page.getByText(nativeLabel, { exact: true }).click();

    // translate.tsx sets document.documentElement.lang on every locale
    // change - the one structural signal that's identical in shape
    // regardless of which language is active, so check it first.
    await expect(page.locator("html")).toHaveAttribute("lang", id);

    // Toggle button's own visible text should now show the new code.
    await expect(langToggle(page, id)).toBeVisible();

    // No raw key fallback visible anywhere in the nav chrome.
    const navText = await page.locator("body").innerText();
    expect(navText).not.toMatch(RAW_KEY_LEAK);
  });

  test(`language switcher: ${id} - persists across reload`, async ({ page }) => {
    await page.goto("/");
    await langToggle(page, "en").click();
    await page.getByText(nativeLabel, { exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", id);

    await page.reload();

    // Per translate.tsx's own documented tradeoff, there's no pre-paint
    // script for this pilot - a saved non-English preference can flash
    // English briefly before the client-side effect reads localStorage
    // and flips it. So this waits for the attribute rather than asserting
    // immediately post-reload, instead of treating that flash as a
    // failure - it isn't one, it's a documented, accepted limitation.
    await expect(page.locator("html")).toHaveAttribute("lang", id, { timeout: 5_000 });
  });
}

test("proper nouns and currency stay in English/INR regardless of active language", async ({ page }) => {
  // Product principle (userMemories i18n section): city/place names and
  // currency figures are never translated, even though nav chrome is.
  // Jaipur Mic Gala 100 is a stable QA fixture event (also used in
  // smoke.spec.ts) with a real venue city and a real ticket price - a
  // good single page to check this on rather than every locale x every
  // page, which would be redundant with the per-locale nav check above.
  await page.goto("/");
  await langToggle(page, "en").click();
  await page.getByText("Deutsch", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "de");

  await page.goto("/events");
  const card = page.getByRole("link", { name: /Jaipur Mic Gala 100/i });
  await expect(card).toBeVisible();
  // City name and ₹ currency symbol must survive translation untouched -
  // this is the one thing that should NOT change when switching locale.
  await expect(card).toContainText("Jaipur");
  await expect(card).toContainText("₹");
});
