import type { Locator, Page } from "@playwright/test";
import { test, expect, gotoDashboard, hideFloatingOverlays } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { useRuleViewport } from "./helpers/viewports";
import en from "../src/lib/i18n/dictionaries/en";
import hi from "../src/lib/i18n/dictionaries/hi";
import mr from "../src/lib/i18n/dictionaries/mr";
import de from "../src/lib/i18n/dictionaries/de";

/**
 * GEN-2610-007 (6a) - the shared dashboard chrome and the Artist dashboard
 * follow the UI language. At 390 and 1440, in Hindi, with Marathi and
 * German spot checks: the role bottom bar (390), the More sheet (390, as
 * Omkar: the Artist bar has no More), the desktop sidebar (1440), My
 * Applications and Browse Events show no English UI strings.
 *
 * "No English" is checked two ways on every visible text node, aria-label
 * and placeholder in those regions:
 * - none is an English dashboard string (en.ts dashboardChrome,
 *   artistDashboard, nav) whose translation differs from it;
 * - in Hindi and Marathi, no Latin-script word is left once the data the
 *   page loaded (event titles, venues, cities, names: every string in its
 *   /api JSON) and a few proper nouns are taken out.
 * The expected headings are literals on purpose (as in homepage-hindi):
 * an edit that changes them has to change this spec too.
 *
 * The language is picked on the device (localStorage), never saved to the
 * account; afterEach checks the persona's account language is still none
 * and puts it back if not (docs/testing-rules.md T6). Nothing is written.
 */

const LOCALE_STORAGE_KEY = "afa-locale";
const DICTS = { hi, mr, de } as const;
type Locale = keyof typeof DICTS;

// Read the same in every language. "Buy-in" is AFA's name for the slot
// type: hi.ts and mr.ts keep it in Latin script (as the artist marketing
// copy does); whether it should be is on Hitesh's Hindi/Marathi read.
const PROPER_NOUNS = ["AforAudience", "AFA", "Instagram", "YouTube", "Google", "Buy-in"];

// Expected headings, per language (dictionaries: artistDashboard.applicationsTitle / browseTitle, dashboardChrome.more).
const HEADINGS: Record<Locale, { applications: string; browse: string; more: string }> = {
  hi: { applications: "मेरे आवेदन", browse: "इवेंट्स देखें", more: "और" },
  mr: { applications: "माझे अर्ज", browse: "इव्हेंट्स बघा", more: "अजून" },
  de: { applications: "Meine Bewerbungen", browse: "Events durchsuchen", more: "Mehr" },
};

// The Artist bar's labels in Hindi (dashboardChrome.myEvents / editProfile / inquiries).
const HI_ARTIST_BAR = ["मेरे इवेंट्स", "प्रोफ़ाइल एडिट", "पूछताछ"];

const NAMESPACES = ["dashboardChrome", "artistDashboard", "nav"] as const;

/** English dashboard strings that read differently in `locale`; a {placeholder} value gives its literal parts. */
function englishStrings(locale: Locale): { exact: string[]; parts: string[] } {
  const exact = new Set<string>();
  const parts = new Set<string>();
  for (const ns of NAMESPACES) {
    const enGroup = en[ns] as Record<string, unknown>;
    const other = DICTS[locale][ns] as Record<string, unknown>;
    for (const [key, value] of Object.entries(enGroup)) {
      if (typeof value !== "string" || value === other[key]) continue;
      if (value.includes("{")) {
        for (const part of value.split(/\{[^}]*\}/)) {
          const p = part.trim();
          if (p.length >= 4 && /[A-Za-z]{3}/.test(p)) parts.add(p);
        }
      } else if (/[A-Za-z]/.test(value)) {
        exact.add(value.trim());
      }
    }
  }
  return { exact: [...exact], parts: [...parts] };
}

/** Every string in the JSON the page loads from /api (the data it shows: titles, venues, names). */
function collectApiStrings(page: Page): Set<string> {
  const strings = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "string") {
      if (v.trim()) strings.add(v.trim());
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  page.on("response", async (res) => {
    if (!new URL(res.url()).pathname.startsWith("/api/")) return;
    if (!(res.headers()["content-type"] ?? "").includes("json")) return;
    walk(await res.json().catch(() => null));
  });
  return strings;
}

async function gotoInLocale(page: Page, url: string, locale: Locale) {
  await page.addInitScript(
    ([key, value]) => {
      try {
        localStorage.setItem(key, value);
      } catch {}
    },
    [LOCALE_STORAGE_KEY, locale],
  );
  await gotoDashboard(page, url);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
}

/** The English UI strings (and, for Indic locales, stray Latin words) visible in `region`. */
async function englishLeftIn(region: Locator, locale: Locale, data: Set<string>): Promise<string[]> {
  const { exact, parts } = englishStrings(locale);
  const allowed = [...data, ...PROPER_NOUNS].filter((s) => /[A-Za-z]/.test(s)).sort((a, b) => b.length - a.length);
  const latinCheck = locale === "hi" || locale === "mr";
  const found = await region.evaluateAll(
    (roots, { exact, parts, allowed, latinCheck }) => {
      const texts: string[] = [];
      for (const root of roots) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const el = n.parentElement;
          if (!el || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName)) continue;
          if (!el.checkVisibility({ visibilityProperty: true, opacityProperty: false })) continue;
          if (n.textContent && n.textContent.trim()) texts.push(n.textContent.trim());
        }
        for (const el of [root, ...root.querySelectorAll("[aria-label], [placeholder]")]) {
          if (!(el as HTMLElement).checkVisibility?.({ visibilityProperty: true })) continue;
          for (const attr of ["aria-label", "placeholder"]) {
            const v = el.getAttribute(attr);
            if (v && v.trim()) texts.push(v.trim());
          }
        }
      }
      const exactSet = new Set(exact.map((s) => s.toLowerCase()));
      const bad: string[] = [];
      for (const t of texts) {
        if (exactSet.has(t.toLowerCase()) || parts.some((p) => t.includes(p))) {
          bad.push(`English UI string: "${t}"`);
          continue;
        }
        if (!latinCheck) continue;
        let rest = t;
        for (const a of allowed) if (rest.includes(a)) rest = rest.split(a).join(" ");
        const words = rest.match(/[A-Za-z]{2,}/g);
        if (words) bad.push(`Latin text "${words.join(" ")}" in "${t}"`);
      }
      return [...new Set(bad)];
    },
    { exact, parts, allowed, latinCheck },
  );
  return found;
}

test.beforeEach(async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
});

test.afterEach(async ({ page }) => {
  const res = await page.request.get("/api/users/me/");
  if (res.ok() && ((await res.json()) as { user: { preferredLocale: string | null } }).user.preferredLocale !== null) {
    const put = await page.request.patch("/api/users/me/", { data: { preferredLocale: null } });
    expect(put.ok(), "account language put back to none").toBe(true);
  }
});

test.describe("Hrithik (Artist)", () => {
  test.use({ storageState: authFile("hrithik") });

  for (const locale of ["hi", "mr", "de"] as const) {
    test(`[GEN-2610-007] Artist dashboard in ${locale}: My Applications and the role bar / sidebar show no English UI strings`, async ({ page, isMobile }) => {
      const data = collectApiStrings(page);
      await gotoInLocale(page, "/dashboard/artist/", locale);
      const main = page.getByRole("main");
      await expect(main.getByRole("heading", { name: HEADINGS[locale].applications, exact: true })).toBeVisible();
      // At least one application pill, translated (its hook is the English status).
      await expect(main.locator("[data-afa-status]").first()).toBeVisible();

      const chrome = isMobile ? page.locator('nav[data-afa-tab-bar="artist"]') : page.locator("aside").filter({ visible: true }).first();
      await expect(chrome).toBeVisible();
      if (locale === "hi") {
        if (isMobile) {
          for (const label of HI_ARTIST_BAR) await expect(chrome.getByText(label, { exact: true })).toBeVisible();
        } else {
          await expect(chrome.getByText(HI_ARTIST_BAR[1], { exact: true })).toBeVisible();
        }
      }

      expect(await englishLeftIn(main, locale, data), "English left on the Artist dashboard").toEqual([]);
      expect(await englishLeftIn(chrome, locale, data), `English left in the ${isMobile ? "role bar" : "sidebar"}`).toEqual([]);

      if (locale === "hi") {
        await hideFloatingOverlays(page);
        // At 1440 the sidebar's Artist section only: the whole sidebar is as tall as the page.
        const shot = isMobile ? chrome : chrome.locator('[data-afa-role-section="artist"]');
        await expect(shot).toHaveScreenshot(`artist-${isMobile ? "role-bar" : "sidebar"}-hi-${isMobile ? 390 : 1440}.png`, {
          animations: "disabled",
        });
      }
    });

    test(`[GEN-2610-007] Browse Events in ${locale}: no English UI strings`, async ({ page, isMobile }) => {
      const data = collectApiStrings(page);
      await gotoInLocale(page, "/dashboard/artist/events/", locale);
      const main = page.getByRole("main");
      const title = main.locator("h1[data-afa-page-title]");
      await expect(title).toHaveText(HEADINGS[locale].browse);
      // Every city, so there are event cards to read.
      await main.getByRole("combobox").selectOption("All Cities");
      await expect(main.locator("[data-afa-browse-event]").first()).toBeVisible({ timeout: 20_000 });
      await page.waitForLoadState("networkidle");

      expect(await englishLeftIn(main, locale, data), "English left on Browse Events").toEqual([]);

      if (locale === "hi") {
        await hideFloatingOverlays(page);
        await expect(title).toHaveScreenshot(`artist-browse-title-hi-${isMobile ? 390 : 1440}.png`, { animations: "disabled" });
      }
    });
  }

  test("[GEN-2610-007] English is unchanged: no language picked, the Artist dashboard reads My Applications / Browse Events", async ({ page }) => {
    await gotoDashboard(page, "/dashboard/artist/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("main").getByRole("heading", { name: "My Applications", exact: true })).toBeVisible();
    await gotoDashboard(page, "/dashboard/artist/events/");
    await expect(page.getByRole("main").locator("h1[data-afa-page-title]")).toHaveText("Browse Events");
  });
});

// The Organiser page itself is 6b's; only the shared chrome is read here.
test.describe("Omkar (Organiser + Venue Owner): the shared chrome", () => {
  test.use({ storageState: authFile("omkar") });

  for (const locale of ["hi", "mr", "de"] as const) {
    test(`[GEN-2610-007] the role bar and its More sheet (390) / the sidebar's role sections (1440) in ${locale}: no English UI strings`, async ({ page, isMobile }) => {
      const data = collectApiStrings(page);
      await gotoInLocale(page, "/dashboard/organiser/", locale);
      if (!isMobile) {
        const sidebar = page.locator("aside").filter({ visible: true }).first();
        await expect(sidebar).toBeVisible();
        expect(await englishLeftIn(sidebar, locale, data), "English left in the sidebar").toEqual([]);
        return;
      }
      const bar = page.locator('nav[data-afa-tab-bar="organiser"]');
      await expect(bar).toBeVisible();
      await bar.locator('[data-afa-tab="more"]').click();
      const sheet = page.locator("[data-afa-more-sheet]");
      await expect(sheet).toBeVisible();
      await expect(sheet).toHaveAttribute("aria-label", HEADINGS[locale].more);
      await expect(sheet.locator("[data-afa-more-item]").first()).toBeVisible();

      expect(await englishLeftIn(bar, locale, data), "English left in the Organiser role bar").toEqual([]);
      expect(await englishLeftIn(sheet, locale, data), "English left in the More sheet").toEqual([]);
    });
  }
});
