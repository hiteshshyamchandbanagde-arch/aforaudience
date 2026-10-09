import type { Locator, Page } from "@playwright/test";
import { test, expect, gotoDashboard, hideFloatingOverlays } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { useRuleViewport } from "./helpers/viewports";
import en from "../src/lib/i18n/dictionaries/en";
import hi from "../src/lib/i18n/dictionaries/hi";
import mr from "../src/lib/i18n/dictionaries/mr";
import de from "../src/lib/i18n/dictionaries/de";

/**
 * GEN-2610-007 (6b-1) - the Organiser dashboard follows the UI language:
 * Your Events, an event's detail page (Artist Applications, the declared
 * compensation terms), Create Event and Edit Event. 6b-2 adds Sales
 * Overview, an event's sales, the Lineup builder, door check-in, Tours,
 * Direct Payouts, Edit Profile and Venue Booking Requests. As Omkar, at 390 and
 * 1440, in Hindi, with Marathi and German spot checks, no English UI
 * strings are left in the page's main region. Same method as
 * dashboard-i18n-artist.spec.ts (6a), on the nested organiserDashboard
 * namespace:
 * - no text node, aria-label or placeholder is an English dashboard string
 *   (en.ts organiserDashboard, dashboardChrome, eventTermsChecklist,
 *   eventTypes, nav) whose translation differs from it;
 * - in Hindi and Marathi, no Latin-script word is left once the data the
 *   page loaded (titles, venues, cities, names, descriptions: every string
 *   in its /api JSON) and a few proper nouns are taken out.
 * The expected headings are literals on purpose: an edit that changes them
 * has to change this spec too.
 *
 * Read-only: nothing is submitted. The language is picked on the device
 * (localStorage), never saved to the account; afterEach checks Omkar's
 * account language is still none and puts it back if not (T6).
 */

const LOCALE_STORAGE_KEY = "afa-locale";
const DICTS = { hi, mr, de } as const;
type Locale = keyof typeof DICTS;

// Read the same in every language. "Buy-in" is AFA's slot-type name, kept
// in Latin script in hi/mr (as in 6a); whether it should be is on
// Hitesh's Hindi/Marathi read.
// Payouts keeps Razorpay's own menu path, ID format and "KYC" as on
// Razorpay; check-in's ticket-ref example is a code, not a word.
const PROPER_NOUNS = [
  "AforAudience", "AFA", "Instagram", "YouTube", "Google", "Buy-in",
  "Razorpay", "Route → Accounts → Add Account", "acc_XXXXXXXXXXXXXX", "acc_", "KYC", "ID", "AFA-7K3M-Q9TX",
];

// Expected headings per language (organiserDashboard.yourEvents.title,
// eventDetail.editEvent / artistApplications, createEvent.title, editEvent.title).
const HEADINGS: Record<Locale, { events: string; editLink: string; applications: string; create: string; edit: string }> = {
  hi: { events: "आपके इवेंट", editLink: "इवेंट बदलें", applications: "कलाकारों के आवेदन", create: "इवेंट बनाएँ", edit: "इवेंट बदलें" },
  mr: { events: "तुमचे इव्हेंट", editLink: "इव्हेंट बदला", applications: "कलाकारांचे अर्ज", create: "इव्हेंट तयार करा", edit: "इव्हेंट बदला" },
  de: { events: "Deine Events", editLink: "Event bearbeiten", applications: "Künstler-Bewerbungen", create: "Event erstellen", edit: "Event bearbeiten" },
};

// 6b-2 page headings (organiserDashboard.sales.title, sales.eventTitle's
// suffix, lineup.title's suffix, checkin.title, tours.title,
// tours.createTitle, payouts.title, editProfile.title, venueRequests.title).
const HEADINGS_2: Record<Locale, { sales: string; eventSales: string; lineup: string; checkin: string; tours: string; createTour: string; payouts: string; editProfile: string; venueRequests: string }> = {
  hi: { sales: "बिक्री का सारांश", eventSales: "— बिक्री", lineup: "— लाइनअप", checkin: "चेक-इन", tours: "टूर", createTour: "टूर बनाएं", payouts: "डायरेक्ट पेआउट", editProfile: "अपनी प्रोफ़ाइल एडिट करें", venueRequests: "वेन्यू बुकिंग अनुरोध" },
  mr: { sales: "विक्रीचा आढावा", eventSales: "— विक्री", lineup: "— लाइनअप", checkin: "चेक-इन", tours: "टूर्स", createTour: "टूर तयार करा", payouts: "डायरेक्ट पेआउट", editProfile: "तुमची प्रोफाइल एडिट करा", venueRequests: "व्हेन्यू बुकिंग विनंत्या" },
  de: { sales: "Verkaufsübersicht", eventSales: "— Verkäufe", lineup: "— Line-up", checkin: "Einlass", tours: "Touren", createTour: "Tour erstellen", payouts: "Direkte Auszahlungen", editProfile: "Profil bearbeiten", venueRequests: "Buchungsanfragen für Locations" },
};

const NAMESPACES = ["organiserDashboard", "dashboardChrome", "eventTermsChecklist", "eventTypes", "nav"] as const;

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
  return region.evaluateAll(
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
        // The page's own data (an event description in English, a venue
        // name) is not UI text: take it out before looking for English.
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

type MyEvent = { id: string; title: string; venue: unknown; applications: { status: string }[] };

/** One of Omkar's events, preferring one with a venue and artist applications so the detail page has both. */
async function pickEvent(page: Page): Promise<MyEvent> {
  const res = await page.request.get("/api/events/my-events/");
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as unknown;
  const list = (Array.isArray(body) ? body : ((body as { events?: unknown[] }).events ?? [])) as MyEvent[];
  expect(list.length, "Omkar has events in QA").toBeGreaterThan(0);
  return list.find((e) => e.venue && e.applications?.length > 0) ?? list.find((e) => e.applications?.length > 0) ?? list[0];
}

test.use({ storageState: authFile("omkar") });

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

async function shotTitle(page: Page, name: string, isMobile: boolean) {
  await hideFloatingOverlays(page);
  await expect(page.locator("h1[data-afa-page-title]")).toHaveScreenshot(`${name}-hi-${isMobile ? 390 : 1440}.png`, { animations: "disabled" });
}

for (const locale of ["hi", "mr", "de"] as const) {
  test.describe(`Omkar (Organiser) in ${locale}`, () => {
    test(`[GEN-2610-007] Your Events in ${locale}: no English UI strings`, async ({ page, isMobile }) => {
      const data = collectApiStrings(page);
      await gotoInLocale(page, "/dashboard/organiser/", locale);
      const main = page.getByRole("main");
      await expect(main.locator("h1[data-afa-page-title]")).toHaveText(HEADINGS[locale].events);
      // Status badges translate; their hook stays the English status.
      await expect(main.locator("[data-afa-event-card]").first()).toBeVisible();
      await expect(main.locator("[data-afa-event-card] [data-afa-status]").first()).toBeVisible();
      await page.waitForLoadState("networkidle");

      expect(await englishLeftIn(main, locale, data), "English left on Your Events").toEqual([]);
      if (locale === "hi") await shotTitle(page, "organiser-your-events-title", isMobile);
    });

    test(`[GEN-2610-007] an event's detail page (Artist Applications, compensation terms) in ${locale}: no English UI strings`, async ({ page }) => {
      const data = collectApiStrings(page);
      const event = await pickEvent(page);
      await gotoInLocale(page, `/dashboard/organiser/events/${event.id}/`, locale);
      const main = page.getByRole("main");
      await expect(main.locator("[data-afa-edit-event]")).toHaveText(HEADINGS[locale].editLink);
      await expect(main.getByRole("heading", { level: 2, name: new RegExp(`^${HEADINGS[locale].applications}`) })).toBeVisible();
      if (event.applications.length > 0) {
        await expect(main.locator("[data-afa-default-compensation]")).toBeVisible();
        await expect(main.locator("[data-afa-application] [data-afa-status]").first()).toBeVisible();
      }
      await page.waitForLoadState("networkidle");

      expect(await englishLeftIn(main, locale, data), "English left on the event detail page").toEqual([]);
    });

    test(`[GEN-2610-007] Create Event in ${locale}: no English UI strings`, async ({ page, isMobile }) => {
      const data = collectApiStrings(page);
      await gotoInLocale(page, "/dashboard/organiser/events/create/", locale);
      const main = page.getByRole("main");
      await expect(main.locator("h1[data-afa-page-title]")).toHaveText(HEADINGS[locale].create);
      // The competition block too, so its labels are read. A DOM click: on a
      // phone the fixed header or role bar can sit over the checkbox
      // wherever the longer German text leaves it after scrolling.
      const toggle = main.locator("input[data-afa-competition-toggle]");
      await toggle.evaluate((el: HTMLInputElement) => el.click());
      await expect(toggle).toBeChecked();
      await expect(main.locator('input[data-afa-prize="1"]')).toBeVisible();
      await page.waitForLoadState("networkidle");

      expect(await englishLeftIn(main, locale, data), "English left on Create Event").toEqual([]);
      if (locale === "hi") await shotTitle(page, "organiser-create-event-title", isMobile);
      // Nothing was submitted: leaving the page creates no event.
    });

    test(`[GEN-2610-007] Edit Event in ${locale}: no English UI strings`, async ({ page, isMobile }) => {
      const data = collectApiStrings(page);
      const event = await pickEvent(page);
      await gotoInLocale(page, `/dashboard/organiser/events/${event.id}/edit/`, locale);
      const main = page.getByRole("main");
      await expect(main.locator("h1[data-afa-page-title]")).toHaveText(HEADINGS[locale].edit);
      await expect(main.locator("[data-afa-save-event]")).toBeVisible();
      await page.waitForLoadState("networkidle");

      expect(await englishLeftIn(main, locale, data), "English left on Edit Event").toEqual([]);
      if (locale === "hi") await shotTitle(page, "organiser-edit-event-title", isMobile);
      // Nothing was saved.
    });

    test(`[GEN-2610-007] Sales Overview in ${locale}: no English UI strings, range picker included`, async ({ page, isMobile }) => {
      const data = collectApiStrings(page);
      await gotoInLocale(page, "/dashboard/organiser/sales/", locale);
      const main = page.getByRole("main");
      await expect(main.locator("h1[data-afa-page-title]")).toHaveText(HEADINGS_2[locale].sales);
      // The range picker's segments and the "Updated … ago" line are read too.
      await expect(main.getByRole("button", { name: DICTS[locale].dashboardChrome.rangeAll })).toBeVisible();
      await expect(main.getByText(DICTS[locale].organiserDashboard.sales.byEvent)).toBeVisible();
      await page.waitForLoadState("networkidle");

      expect(await englishLeftIn(main, locale, data), "English left on Sales Overview").toEqual([]);
      if (locale === "hi") await shotTitle(page, "organiser-sales-title", isMobile);
    });

    test(`[GEN-2610-007] an event's sales page in ${locale}: no English UI strings`, async ({ page }) => {
      const data = collectApiStrings(page);
      const event = await pickEvent(page);
      await gotoInLocale(page, `/dashboard/organiser/events/${event.id}/sales/`, locale);
      const main = page.getByRole("main");
      await expect(main.locator("h1[data-afa-page-title]")).toContainText(HEADINGS_2[locale].eventSales);
      await expect(main.getByText(DICTS[locale].organiserDashboard.sales.byTicketTier)).toBeVisible();
      await page.waitForLoadState("networkidle");

      expect(await englishLeftIn(main, locale, data), "English left on the event's sales page").toEqual([]);
    });

    test(`[GEN-2610-007] the Lineup builder in ${locale}: no English UI strings`, async ({ page }) => {
      const data = collectApiStrings(page);
      const event = await pickEvent(page);
      await gotoInLocale(page, `/dashboard/organiser/events/${event.id}/lineup/`, locale);
      const main = page.getByRole("main");
      await expect(main.locator("h1[data-afa-page-title]")).toContainText(HEADINGS_2[locale].lineup);
      await page.waitForLoadState("networkidle");

      expect(await englishLeftIn(main, locale, data), "English left on the Lineup builder").toEqual([]);
      // Nothing was saved or sent.
    });

    test(`[GEN-2610-007] door check-in in ${locale}: no English UI strings, attendee list open`, async ({ page }) => {
      const data = collectApiStrings(page);
      const event = await pickEvent(page);
      await gotoInLocale(page, `/dashboard/organiser/events/${event.id}/checkin/`, locale);
      const main = page.getByRole("main");
      await expect(main.locator("h1[data-afa-page-title]")).toHaveText(HEADINGS_2[locale].checkin);
      // Open the attendee list so its filters and rows are read too.
      const c = DICTS[locale].organiserDashboard.checkin;
      await main.getByRole("button", { name: c.attendeeList }).click();
      await expect(main.getByRole("button", { name: c.filterCheckedIn })).toBeVisible();
      await expect(main.getByText(DICTS[locale].dashboardChrome.loading)).toHaveCount(0);
      await page.waitForLoadState("networkidle");

      expect(await englishLeftIn(main, locale, data), "English left on door check-in").toEqual([]);
      // Nobody was checked in: the camera never starts and no code is sent.
    });
  });
}

test("[GEN-2610-007] English is unchanged: no language picked, the Organiser pages read Your Events / Edit Event / Create an Event", async ({ page }) => {
  const event = await pickEvent(page);
  await gotoDashboard(page, "/dashboard/organiser/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const main = page.getByRole("main");
  await expect(main.locator("h1[data-afa-page-title]")).toHaveText("Your Events");
  await gotoDashboard(page, `/dashboard/organiser/events/${event.id}/`);
  await expect(main.locator("[data-afa-edit-event]")).toHaveText("Edit Event");
  await expect(main.getByRole("heading", { level: 2, name: /^Artist Applications/ })).toBeVisible();
  await gotoDashboard(page, "/dashboard/organiser/events/create/");
  await expect(main.locator("h1[data-afa-page-title]")).toHaveText("Create an Event");
  await gotoDashboard(page, `/dashboard/organiser/events/${event.id}/edit/`);
  await expect(main.locator("h1[data-afa-page-title]")).toHaveText("Edit Event");
});
