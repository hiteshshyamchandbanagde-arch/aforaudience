import type { Locator, Page } from "@playwright/test";
import { test, expect, gotoDashboard, hideFloatingOverlays } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { useRuleViewport } from "./helpers/viewports";
import en from "../src/lib/i18n/dictionaries/en";
import hi from "../src/lib/i18n/dictionaries/hi";
import mr from "../src/lib/i18n/dictionaries/mr";
import de from "../src/lib/i18n/dictionaries/de";

/**
 * GEN-2610-007 (6c-1) - the Venue Owner dashboard follows the UI language.
 * As Vinayak, at 390 and 1440, in Hindi, with Marathi and German spot
 * checks.
 *
 * My Venues, a venue's page, Edit Venue and (6c-2) Bookings, Revenue
 * Overview and Venue Booking Requests: no English UI strings are left
 * in the page's main region, by the method of dashboard-i18n-organiser.spec.ts
 * on the venueDashboard namespace (an English dashboard string whose
 * translation differs, or, in hi/mr, a Latin-script word that is not the
 * page's own /api data or a proper noun).
 *
 * Seat Map Builder: the restore-draft dialog (its age and
 * counts in words), the level labels a restored two-level draft shows,
 * the freeze banner and its Freeze / Unfreeze buttons, and the Unfreeze
 * dialog. The canvas, Guided Setup and the toolbars are still English
 * (left for a later pass), so this checks those pieces by their
 * data-afa-* hooks rather than sweeping the whole page.
 * The expected strings are literals on purpose: an edit that changes them
 * has to change this spec too.
 *
 * Read-only: no seat map is saved, frozen or unfrozen (every dialog that
 * would change one is cancelled), and the planted draft only lives in this
 * test's own browser storage. The language is picked on the device
 * (localStorage), never saved to the account; afterEach checks Vinayak's
 * account language is still none and puts it back if not (T6).
 */

const LOCALE_STORAGE_KEY = "afa-locale";
type Locale = "hi" | "mr" | "de";

const GA_VENUE = "qa-demo-venue-full-2"; // FC Road Comedy Hall (Vinayak, not frozen)
const FROZEN_VENUE = "cmu0n63k6000004l40wkymgkk"; // Ganesh Open Mic (Vinayak, frozen)
const PLANTED_LEVEL = "Balcony";

// venueDashboard.seatMap, per language. The draft below is 5 minutes old
// with one seat on each of two levels.
const SEAT_MAP: Record<Locale, {
  restoreTitle: string; age: string; seats: string; levels: string; restore: string; discard: string;
  levelHeading: string; mainLevel: string; addLevel: string; freezeHint: string; freeze: string;
  frozenTitle: string; unfreeze: string; unfreezeTitle: string; cancel: string;
}> = {
  hi: {
    restoreTitle: "अपना बिना सेव किया ड्राफ़्ट वापस लाएँ?", age: "5 मिनट पहले", seats: "2 सीटें", levels: "2 लेवल",
    restore: "ड्राफ़्ट वापस लाएँ", discard: "हटाएँ",
    levelHeading: "लेवल", mainLevel: "मुख्य", addLevel: "+ लेवल जोड़ें",
    freezeHint: "यह लेआउट पूरा हो जाने पर इसे फ़्रीज़ करें, ताकि गलती से कोई बदलाव न हो।", freeze: "यह सीट मैप फ़्रीज़ करें",
    frozenTitle: "सीट मैप फ़्रीज़ है", unfreeze: "अनफ़्रीज़ करें", unfreezeTitle: "इस सीट मैप को अनफ़्रीज़ करें?", cancel: "रद्द करें",
  },
  mr: {
    restoreTitle: "सेव्ह न केलेला ड्राफ्ट परत आणायचा?", age: "5 मिनिटांपूर्वी", seats: "2 सीट्स", levels: "2 लेव्हल्स",
    restore: "ड्राफ्ट परत आणा", discard: "काढून टाका",
    levelHeading: "लेव्हल", mainLevel: "मुख्य", addLevel: "+ लेव्हल जोडा",
    freezeHint: "हा लेआउट पूर्ण झाल्यावर तो फ्रीझ करा, म्हणजे चुकून बदल होणार नाहीत.", freeze: "हा सीट मॅप फ्रीझ करा",
    frozenTitle: "सीट मॅप फ्रीझ आहे", unfreeze: "अनफ्रीझ करा", unfreezeTitle: "हा सीट मॅप अनफ्रीझ करायचा?", cancel: "रद्द करा",
  },
  de: {
    restoreTitle: "Nicht gespeicherten Entwurf wiederherstellen?", age: "vor 5 Minuten", seats: "2 Plätze", levels: "2 Ebenen",
    restore: "Entwurf wiederherstellen", discard: "Verwerfen",
    levelHeading: "Ebene", mainLevel: "Hauptebene", addLevel: "+ Ebene hinzufügen",
    freezeHint: "Wenn dieses Layout fertig ist, friere es ein, damit es nicht versehentlich geändert wird.", freeze: "Diesen Sitzplan einfrieren",
    frozenTitle: "Sitzplan eingefroren", unfreeze: "Freigeben", unfreezeTitle: "Diesen Sitzplan wieder freigeben?", cancel: "Abbrechen",
  },
};

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

const DICTS = { hi, mr, de } as const;

// venueDashboard.venueEdit.daily: the Rate Type segment Register Venue's test picks.
const DAILY_SEGMENT: Record<Locale, string> = { hi: "प्रति दिन", mr: "दिवसाला", de: "Täglich" };
// The Maps-link example is a URL, not a word. "VIP" is how every
// language's section examples write it (venueForm.noSections, venueCreate.gaIntro).
const PROPER_NOUNS = ["AforAudience", "AFA", "Google", "Google Maps", "Instagram", "YouTube", "https://maps.app.goo.gl/...", "VIP"];

// FacilitiesPicker's preset chips are the stored facility values (saved on
// the venue and shown as is on its public page), not dictionary strings.
// Giving them display labels per language is a TODO of its own (6c-1b
// status file); until then they count as the page's data.
const PRESET_FACILITIES = [
  "Parking", "WiFi", "Air Conditioning", "Sound System", "Stage Lighting", "Green Room",
  "Bar / Refreshments", "Wheelchair Accessible", "Restrooms", "Power Backup", "Projector / Screen",
];

// venueDashboard.myVenues.title, venueView.editVenue, venueEdit.title;
// 6c-2: bookings.title and bookings.pending, sales.title and sales.byVenue,
// organiserDashboard.venueRequests.title (the page both roles share) and
// venueCreate.title.
const HEADINGS: Record<Locale, {
  venues: string; editLink: string; edit: string; bookings: string; pending: string; sales: string; byVenue: string; requests: string; create: string;
}> = {
  hi: {
    venues: "आपके स्थल", editLink: "स्थल बदलें", edit: "स्थल बदलें", bookings: "बुकिंग अनुरोध", pending: "लंबित",
    sales: "कमाई का सारांश", byVenue: "स्थल के अनुसार", requests: "वेन्यू बुकिंग अनुरोध", create: "स्थल रजिस्टर करें",
  },
  mr: {
    venues: "तुमची स्थळे", editLink: "स्थळ बदला", edit: "स्थळ बदला", bookings: "बुकिंग विनंत्या", pending: "प्रलंबित",
    sales: "कमाईचा आढावा", byVenue: "स्थळानुसार", requests: "व्हेन्यू बुकिंग विनंत्या", create: "स्थळ नोंदवा",
  },
  de: {
    venues: "Deine Veranstaltungsorte", editLink: "Veranstaltungsort bearbeiten", edit: "Veranstaltungsort bearbeiten", bookings: "Buchungsanfragen", pending: "Offen",
    sales: "Einnahmenübersicht", byVenue: "Nach Veranstaltungsort", requests: "Buchungsanfragen für Locations", create: "Veranstaltungsort registrieren",
  },
};

// organiserDashboard: /dashboard/venue-requests is the Organiser's
// venueRequests page, shared with the Venue Owner.
const NAMESPACES = ["venueDashboard", "dashboardChrome", "nav", "organiserDashboard"] as const;

type Tree = { [key: string]: string | Tree };
function flatten(obj: Tree, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") out[`${prefix}${k}`] = v;
    else flatten(v, `${prefix}${k}.`, out);
  }
  return out;
}

/** English dashboard strings that read differently in `locale`; a {placeholder} value gives its literal parts. */
function englishStrings(locale: Locale): { exact: string[]; parts: string[] } {
  const exact = new Set<string>();
  const parts = new Set<string>();
  for (const ns of NAMESPACES) {
    const enFlat = flatten(en[ns] as unknown as Tree);
    const otherFlat = flatten(DICTS[locale][ns] as unknown as Tree);
    for (const [key, value] of Object.entries(enFlat)) {
      if (value === otherFlat[key]) continue;
      if (value.includes("{")) {
        for (const part of value.split(/\{[^}]*\}/)) {
          const p = part.trim();
          if (p.length >= 4 && /[A-Za-z]{3}/.test(p) && !PROPER_NOUNS.includes(p)) parts.add(p);
        }
      } else if (/[A-Za-z]/.test(value)) {
        exact.add(value.trim());
      }
    }
  }
  return { exact: [...exact], parts: [...parts] };
}

/** Every string in the JSON the page loads from /api (the data it shows). */
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

/** The English UI strings (and, for Indic locales, stray Latin words) visible in `region`. */
async function englishLeftIn(region: Locator, locale: Locale, data: Set<string>): Promise<string[]> {
  const { exact, parts } = englishStrings(locale);
  const allowed = [...data, ...PROPER_NOUNS].filter((s) => /[A-Za-z]/.test(s)).sort((a, b) => b.length - a.length);
  const latinCheck = locale === "hi" || locale === "mr";
  return region.evaluateAll(
    (roots, { exact, parts, allowed, latinCheck }) => {
      const texts: string[] = [];
      for (const root of roots) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const el = n.parentElement;
          if (!el || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName)) continue;
          // Chart y-axis ticks: venue names on Revenue Overview's By venue
          // bars (the page's data, which Recharts splits across lines, so
          // they no longer match the /api strings whole), ₹ amounts on the
          // other chart. Neither has anything to translate.
          if (el.closest(".recharts-yAxis-tick-labels")) continue;
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
        let rest = t;
        for (const a of allowed) if (rest.includes(a)) rest = rest.split(a).join(" ");
        if (exactSet.has(t.toLowerCase()) || parts.some((p) => rest.includes(p))) {
          bad.push(`English UI string: "${t}"`);
          continue;
        }
        if (!latinCheck) continue;
        const words = rest.match(/[A-Za-z]{2,}/g);
        if (words) bad.push(`Latin text "${words.join(" ")}" in "${t}"`);
      }
      return [...new Set(bad)];
    },
    { exact, parts, allowed, latinCheck },
  );
}

async function shotTitle(page: Page, name: string, isMobile: boolean) {
  await hideFloatingOverlays(page);
  await expect(page.locator("h1[data-afa-page-title]")).toHaveScreenshot(`${name}-hi-${isMobile ? 390 : 1440}.png`, { animations: "disabled" });
}

/** Puts a 5-minute-old local draft for `venueId` in place before the builder loads: one seat on the main level, one on PLANTED_LEVEL. */
async function plantTwoLevelDraft(page: Page, venueId: string) {
  await page.addInitScript(
    ({ key, level }) => {
      if (sessionStorage.getItem("e2e-draft-planted")) return;
      sessionStorage.setItem("e2e-draft-planted", "1");
      const seat = (clientId: string, x: number) => ({ clientId, tierLabel: "General", row: "A", number: "1", x, y: 200 });
      localStorage.setItem(
        key,
        JSON.stringify({
          savedAt: Date.now() - 5 * 60_000,
          seatingMode: "NUMBERED",
          levels: ["", level],
          activeLevel: "",
          seatsByLevel: { "": [seat("e2e-i18n-main", 120)], [level]: [seat("e2e-i18n-balcony", 160)] },
          gridConfigByLevel: {},
          zonePricesByLevel: {},
          builderPathByLevel: {},
          markersByLevel: {},
        }),
      );
    },
    { key: `afa-seatmap-draft:${venueId}`, level: PLANTED_LEVEL },
  );
}

test.use({ storageState: authFile("vinayak") });

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

for (const locale of ["hi", "mr", "de"] as const) {
  test.describe(`Vinayak (Venue Owner) in ${locale}`, () => {
    test(`[GEN-2610-007] My Venues in ${locale}: no English UI strings`, async ({ page, isMobile }) => {
      const data = collectApiStrings(page);
      await gotoInLocale(page, "/dashboard/venue/", locale);
      const main = page.getByRole("main");
      await expect(main.locator("h1[data-afa-page-title]")).toHaveText(HEADINGS[locale].venues);
      await expect(main.locator(`a[href*="${GA_VENUE}"]`).first()).toBeVisible();
      await page.waitForLoadState("networkidle");

      expect(await englishLeftIn(main, locale, data), "English left on My Venues").toEqual([]);
      if (locale === "hi") await shotTitle(page, "venue-my-venues-title", isMobile);
    });

    test(`[GEN-2610-007] a venue's page in ${locale}: no English UI strings`, async ({ page }) => {
      const data = collectApiStrings(page);
      await gotoInLocale(page, `/dashboard/venue/${GA_VENUE}/`, locale);
      const main = page.getByRole("main");
      await expect(main.locator(`a[href*="/dashboard/venue/${GA_VENUE}/edit"]`).first()).toHaveText(HEADINGS[locale].editLink);
      await page.waitForLoadState("networkidle");

      expect(await englishLeftIn(main, locale, data), "English left on the venue page").toEqual([]);
    });

    test(`[GEN-2610-007] Edit Venue in ${locale}: no English UI strings`, async ({ page, isMobile }) => {
      const data = collectApiStrings(page);
      await gotoInLocale(page, `/dashboard/venue/${GA_VENUE}/edit/`, locale);
      const main = page.getByRole("main");
      await expect(main.locator("h1[data-afa-page-title]")).toHaveText(HEADINGS[locale].edit);
      await page.waitForLoadState("networkidle");

      for (const f of PRESET_FACILITIES) data.add(f);
      expect(await englishLeftIn(main, locale, data), "English left on Edit Venue").toEqual([]);
      if (locale === "hi") await shotTitle(page, "venue-edit-venue-title", isMobile);
      // Nothing was submitted: leaving the page changes nothing.
    });

    test(`[GEN-2610-007] Bookings in ${locale}: no English UI strings (revenue cards, calendar, Pending, Past Requests)`, async ({ page, isMobile }) => {
      const data = collectApiStrings(page);
      await gotoInLocale(page, "/dashboard/venue/bookings/", locale);
      const main = page.getByRole("main");
      await expect(main.locator("h1[data-afa-page-title]")).toHaveText(HEADINGS[locale].bookings);
      await expect(main.locator('h2[data-afa-section="pending"]')).toContainText(HEADINGS[locale].pending);
      // Vinayak has confirmed bookings in the QA seed, so Past Requests and its Message Organiser buttons are there too.
      await expect(main.locator('h2[data-afa-section="past"]')).toBeVisible();
      await page.waitForLoadState("networkidle");

      expect(await englishLeftIn(main, locale, data), "English left on Bookings").toEqual([]);
      if (locale === "hi") await shotTitle(page, "venue-bookings-title", isMobile);
    });

    test(`[GEN-2610-007] Revenue Overview in ${locale}: no English UI strings`, async ({ page, isMobile }) => {
      const data = collectApiStrings(page);
      await gotoInLocale(page, "/dashboard/venue/sales/", locale);
      const main = page.getByRole("main");
      await expect(main.locator("h1[data-afa-page-title]")).toHaveText(HEADINGS[locale].sales);
      await expect(main.locator('[data-afa-section="by-venue"] [data-afa-section-title]')).toHaveText(HEADINGS[locale].byVenue);
      await expect(main.locator('[data-afa-section="by-organiser"]')).toBeVisible();
      await page.waitForLoadState("networkidle");

      expect(await englishLeftIn(main, locale, data), "English left on Revenue Overview").toEqual([]);
      if (locale === "hi") await shotTitle(page, "venue-sales-title", isMobile);
    });

    test(`[GEN-2610-007] Venue Booking Requests in ${locale}: no English UI strings`, async ({ page }) => {
      const data = collectApiStrings(page);
      await gotoInLocale(page, "/dashboard/venue-requests/", locale);
      const main = page.getByRole("main");
      await expect(main.locator("h1[data-afa-page-title]")).toHaveText(HEADINGS[locale].requests);
      await page.waitForLoadState("networkidle");

      expect(await englishLeftIn(main, locale, data), "English left on Venue Booking Requests").toEqual([]);
      // Read-only: nothing is accepted, countered or declined.
    });

    test(`[GEN-2610-007] Register Venue in ${locale}: no English UI strings, on both seating paths`, async ({ page, isMobile }) => {
      await gotoInLocale(page, "/dashboard/venue/create/", locale);
      const main = page.getByRole("main");
      await expect(main.locator("h1[data-afa-page-title]")).toHaveText(HEADINGS[locale].create);
      await page.waitForLoadState("networkidle");
      const data = new Set(PRESET_FACILITIES);

      // General Admission (the default), then Numbered Seats with a fixed rate,
      // so the second path's text and the day-by-day rates are swept too.
      expect(await englishLeftIn(main, locale, data), "English left on Register Venue (General Admission)").toEqual([]);
      await main.locator("button.afa-path-card").nth(1).click();
      await main.locator('button[type="button"]').filter({ hasText: DAILY_SEGMENT[locale] }).click();
      await main.locator('input[type="checkbox"]').check();
      expect(await englishLeftIn(main, locale, data), "English left on Register Venue (Numbered, daily rate)").toEqual([]);
      if (locale === "hi") await shotTitle(page, "venue-create-title", isMobile);
      // Nothing was submitted, and the draft only lives in this test's own sessionStorage.
    });

    test(`[GEN-2610-007] Seat Map Builder in ${locale}: restore-draft dialog, level labels and freeze banner`, async ({ page, isMobile }) => {
      const s = SEAT_MAP[locale];
      await plantTwoLevelDraft(page, GA_VENUE);
      await gotoInLocale(page, `/dashboard/venue/${GA_VENUE}/seat-map/`, locale);

      const dialog = page.locator("[data-afa-confirm-dialog]").getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("heading", { level: 2 })).toHaveText(s.restoreTitle);
      await expect(dialog).toContainText(s.age);
      await expect(dialog).toContainText(s.seats);
      await expect(dialog).toContainText(s.levels);
      await expect(dialog.locator("[data-afa-confirm-cancel]")).toHaveText(s.discard);
      if (locale === "hi") {
        await hideFloatingOverlays(page);
        await expect(dialog).toHaveScreenshot(`venue-seatmap-draft-hi-${isMobile ? 390 : 1440}.png`, { maxDiffPixelRatio: 0.02 });
      }

      // Restoring only changes this page's local state; nothing is saved.
      await dialog.getByRole("button", { name: s.restore }).click();
      await expect(dialog).toBeHidden();
      const main = page.getByRole("main");
      await expect(main.getByText(s.levelHeading, { exact: true })).toBeVisible();
      await expect(main.getByRole("button", { name: s.mainLevel, exact: true })).toBeVisible();
      await expect(main.getByRole("button", { name: PLANTED_LEVEL, exact: true })).toBeVisible();
      await expect(main.getByRole("button", { name: s.addLevel, exact: true })).toBeVisible();
      await expect(main.locator("[data-afa-frozen-banner-text]")).toHaveText(s.freezeHint);
      await expect(main.locator('[data-afa-freeze-toggle="freeze"]')).toHaveText(s.freeze);
    });

    test(`[GEN-2610-007] frozen Seat Map Builder in ${locale}: banner, Unfreeze and its dialog`, async ({ page }) => {
      const s = SEAT_MAP[locale];
      await gotoInLocale(page, `/dashboard/venue/${FROZEN_VENUE}/seat-map/`, locale);
      const main = page.getByRole("main");
      await expect(main.locator("[data-afa-frozen-title]")).toHaveText(s.frozenTitle);
      const unfreeze = main.locator('[data-afa-freeze-toggle="unfreeze"]');
      await expect(unfreeze).toHaveText(s.unfreeze);
      // The whole sentence in Hindi; mr and de are spot checks.
      if (locale === "hi") await expect(main.locator("[data-afa-frozen-message]")).toHaveText(`${s.frozenTitle} — तैयार है और सिर्फ़ पढ़ने के लिए। बदलाव करने के लिए अनफ़्रीज़ करें।`);

      await unfreeze.click();
      const dialog = page.locator("[data-afa-confirm-dialog]").getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("heading", { level: 2 })).toHaveText(s.unfreezeTitle);
      const cancel = dialog.locator("[data-afa-confirm-cancel]");
      await expect(cancel).toHaveText(s.cancel);
      await cancel.click();
      await expect(dialog).toBeHidden();
      await expect(main.locator("[data-afa-frozen-title]"), "still frozen").toHaveText(s.frozenTitle);
    });
  });
}
