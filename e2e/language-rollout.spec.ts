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

// SiteNav renders the language picker twice - once as the desktop
// dropdown's list of buttons, and again inside the mobile drawer's own
// toggle, which shows the CURRENTLY active locale's nativeLabel as plain
// text (a <span>, not a button) summarizing the current selection. That
// second element isn't hidden from the DOM at desktop viewport widths
// (CSS-only responsive hiding), so a plain getByText match on a locale's
// nativeLabel can resolve to both - and specifically collides for "en"
// alone, since every test starts on the default English locale, so the
// mobile summary span reads "English" at the exact moment this tries to
// click the (different) dropdown item also reading "English". Scoping to
// role=button excludes that summary span, which is a <span> with no
// button role, without needing to touch SiteNav.tsx itself for a
// test-only ambiguity.
function langOption(page: import("@playwright/test").Page, nativeLabel: string) {
  return page.getByRole("button", { name: nativeLabel, exact: true });
}

// A translation dictionary with a missing key falls back to rendering the
// raw dot-path key itself (e.g. "nav.events") rather than throwing - so a
// leaked key is a silent content bug, not a crash. This regex is
// deliberately narrow (word.word, no spaces) to avoid false-positiving on
// real sentence fragments that happen to contain a period.
const RAW_KEY_LEAK = /\b[a-z]+\.[a-zA-Z]+\b/;

// Locales that also get the reload-persistence check, which adds a real
// page reload + wait per locale on top of the switch check every locale
// already gets. Trimmed after the first CI run of the full 11-locale
// version (session 70 continuation) hit the job's 20-minute timeout and
// got cancelled before producing a report - couldn't tell from that
// alone whether this spec was the cause or the pre-existing flaky
// competition-show/waitlist-wallet specs were, so cutting this spec's
// own unambiguous cost first rather than guessing blind. One Indic
// script (Tamil), one Latin-script addition (German), one already-
// shipped baseline (Hindi) - representative spread, not exhaustive.
const RELOAD_CHECK_LOCALES = new Set(["hi", "de", "ta"]);

// playwright.config.ts runs every spec on both chromium-desktop and
// mobile-chrome, serially (workers: 1, fullyParallel: false - QA is a
// single shared env/DB). This spec asserts attribute values and text
// presence only, nothing viewport-dependent - real layout/overflow
// checking is explicitly out of scope (see file header), so running it
// twice would double CI time for zero extra signal. Scoped to desktop
// only; this decision is what actually got the full suite back inside
// the job's 20-minute budget after the first attempt (all 11 locales x
// both projects) timed out and got cancelled without producing a report.
test.beforeEach(async ({}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-desktop",
    "Attribute/text checks only, not viewport-dependent - see file header."
  );
});

for (const { id, nativeLabel } of LOCALES) {
  test(`language switcher: ${id} - nav updates and lang attribute is set`, async ({ page }) => {
    await page.goto("/");

    // Fresh page always starts on English (localStorage-backed, no saved
    // preference in a clean Playwright context) - open the picker and
    // switch to this locale.
    await langToggle(page, "en").click();
    await langOption(page, nativeLabel).click();

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

  if (RELOAD_CHECK_LOCALES.has(id)) {
    test(`language switcher: ${id} - persists across reload`, async ({ page }) => {
      await page.goto("/");
      await langToggle(page, "en").click();
      await langOption(page, nativeLabel).click();
      await expect(page.locator("html")).toHaveAttribute("lang", id);

      await page.reload();

      // Per translate.tsx's own documented tradeoff, there's no pre-paint
      // script for this pilot - a saved non-English preference can flash
      // English briefly before the client-side effect reads localStorage
      // and flips it. So this waits for the attribute rather than
      // asserting immediately post-reload, instead of treating that
      // flash as a failure - it isn't one, it's a documented, accepted
      // limitation.
      await expect(page.locator("html")).toHaveAttribute("lang", id, { timeout: 5_000 });
    });
  }
}

test("proper nouns and currency stay in English/INR regardless of active language", async ({ page }) => {
  // Product principle (userMemories i18n section): city/place names and
  // currency figures are never translated, even though nav chrome is.
  await page.goto("/");
  await langToggle(page, "en").click();
  await langOption(page, "Deutsch").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "de");

  await page.goto("/events");
  // Jaipur Mic Gala 100 is a stable QA fixture (also used in
  // smoke.spec.ts) for the proper-noun check - city names are never
  // translated regardless of locale.
  const card = page.getByRole("link", { name: /Jaipur Mic Gala 100/i });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Jaipur");

  // Currency check is intentionally NOT scoped to that same card - it's
  // one of the pre-existing QA fixtures with legacy bad price data
  // (null ticketPrice, predating GEN-2608-040's publish-time validation
  // fix - PR #452 confirmed this exact gap and left existing bad data
  // as-is, only blocking new occurrences), so it renders "-" instead of
  // a price and isn't a reliable source for this assertion. Checking
  // page-wide instead: some event in the full listing will always have
  // a real ticket price, and this is what actually matters - that the
  // ₹ symbol survives translation somewhere on the page, not that one
  // specific fixture happens to carry a price today.
  await expect(page.locator("body")).toContainText("₹");
});
