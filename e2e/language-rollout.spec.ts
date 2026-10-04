import type { Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { JAIPUR_EVENT_TITLE } from "./helpers/events";

/**
 * GEN-2608-XXX (language rollout verification). No-auth tests, run against
 * the public homepage/events pages.
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
 *
 * 3 Oct 2026 - rewritten for where the picker lives now. This spec used to
 * click a nav button whose text was the locale code ("EN"). That button is
 * gone, so every test waited out its full timeout: 15 tests x 60 s was the
 * bulk of the CI runs that were killed at the job limit. Today there are
 * two pickers, and they are different components:
 *   - desktop: inside the account menu (HomeHeader on "/", SiteNav
 *     elsewhere), one button per locale labelled with its code;
 *   - mobile: the top bar's globe button (MobileTopBar), one row per locale
 *     labelled with its native name.
 * So the spec now runs on both projects (it was desktop-only, on the
 * grounds that nothing in it depended on the viewport; the picker now does).
 * What changed in the assertions, and why:
 *   - "the toggle shows the new locale code" is dropped: neither picker
 *     shows the active locale as text any more (the selected option is
 *     marked by colour only).
 *   - added in its place: the choice is saved under the app's own storage
 *     key, which is what the reload test depends on.
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

// src/lib/i18n/translate.tsx STORAGE_KEY.
const LOCALE_STORAGE_KEY = "afa-locale";

/**
 * Picks a locale the way a visitor does. A fresh context always starts in
 * English, so the picker's own (translated) label is still "Language" /
 * the account menu is still found by its role when this runs.
 */
async function switchLocale(page: Page, isMobile: boolean, locale: { id: string; nativeLabel: string }) {
  if (isMobile) {
    await page.getByRole("banner").getByRole("button", { name: "Language", exact: true }).click();
    await page.getByRole("banner").getByRole("button", { name: locale.nativeLabel, exact: true }).click();
  } else {
    // The account-menu trigger: unnamed on the homepage header, "Account
    // menu" in SiteNav; aria-haspopup="menu" on both.
    await page.locator('button[aria-haspopup="menu"]').click();
    await page.getByRole("menu").getByRole("button", { name: locale.id.toUpperCase(), exact: true }).click();
  }
}

// A translation dictionary with a missing key falls back to rendering the
// raw dot-path key itself (e.g. "nav.events") rather than throwing - so a
// leaked key is a silent content bug, not a crash. This regex is
// deliberately narrow (word.word, no spaces) to avoid false-positiving on
// real sentence fragments that happen to contain a period.
const RAW_KEY_LEAK = /\b[a-z]+\.[a-zA-Z]+\b/;

// Locales that also get the reload-persistence check, which adds a real
// page reload per locale on top of the switch check every locale already
// gets. One Indic script (Tamil), one Latin-script addition (German), one
// already-shipped baseline (Hindi) - representative spread, not exhaustive.
const RELOAD_CHECK_LOCALES = new Set(["hi", "de", "ta"]);

// GEN-2608-041 added these four (Telugu, Tamil, Kannada, Malayalam).
const SOUTH_INDIAN_LOCALES = new Set(["te", "ta", "kn", "ml"]);

for (const locale of LOCALES) {
  const { id } = locale;
  const ticket = SOUTH_INDIAN_LOCALES.has(id) ? "[GEN-2608-041] " : "";

  test(`${ticket}language switcher: ${id} - nav updates and lang attribute is set`, async ({ page, isMobile }) => {
    await page.goto("/");

    // Fresh page always starts on English (localStorage-backed, no saved
    // preference in a clean Playwright context).
    await switchLocale(page, isMobile, locale);

    // translate.tsx sets document.documentElement.lang on every locale
    // change - the one structural signal that's identical in shape
    // regardless of which language is active, so check it first.
    await expect(page.locator("html")).toHaveAttribute("lang", id);

    // The choice is saved for the next visit.
    expect(await page.evaluate((key) => window.localStorage.getItem(key), LOCALE_STORAGE_KEY)).toBe(id);

    // No raw key fallback visible anywhere on the page.
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(RAW_KEY_LEAK);
  });

  if (RELOAD_CHECK_LOCALES.has(id)) {
    test(`${ticket}language switcher: ${id} - persists across reload`, async ({ page, isMobile }) => {
      await page.goto("/");
      await switchLocale(page, isMobile, locale);
      await expect(page.locator("html")).toHaveAttribute("lang", id);

      await page.reload();

      // Per translate.tsx's own documented tradeoff, there's no pre-paint
      // script for this pilot - a saved non-English preference can flash
      // English briefly before the client-side effect reads localStorage
      // and flips it. So this waits for the attribute rather than
      // asserting immediately post-reload, instead of treating that
      // flash as a failure - it isn't one, it's a documented, accepted
      // limitation.
      await expect(page.locator("html")).toHaveAttribute("lang", id);
    });
  }
}

test("proper nouns and currency stay in English/INR regardless of active language", async ({ page, isMobile }) => {
  // Product principle (userMemories i18n section): city/place names and
  // currency figures are never translated, even though nav chrome is.
  await page.goto("/");
  await switchLocale(page, isMobile, { id: "de", nativeLabel: "Deutsch" });
  await expect(page.locator("html")).toHaveAttribute("lang", "de");

  // Search for the event so the same list shows on both viewports (mobile
  // otherwise opens on carousels of a few events each). A ?search= is not
  // narrowed by the detected city (BUG-2610-004).
  await page.goto(`/events?search=${encodeURIComponent(JAIPUR_EVENT_TITLE)}`);
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  // Jaipur Mic Gala 100 is a stable QA fixture (also used in
  // smoke.spec.ts) for the proper-noun check - city names are never
  // translated regardless of locale.
  const card = page.getByRole("link", { name: /Jaipur Mic Gala 100/i });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Jaipur");

  // Currency: the ₹ symbol survives translation. Checked on the homepage,
  // which lists priced events ("from ₹511"); the Jaipur card itself shows
  // no price (tiered seating), and a search result page holds only it.
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.locator("main")).toContainText("₹");
});
