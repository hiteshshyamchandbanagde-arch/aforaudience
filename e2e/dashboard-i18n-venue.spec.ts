import type { Page } from "@playwright/test";
import { test, expect, gotoDashboard, hideFloatingOverlays } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { useRuleViewport } from "./helpers/viewports";

/**
 * GEN-2610-007 (6c-1) - the Venue Owner dashboard follows the UI language.
 * As Vinayak, at 390 and 1440, in Hindi, with Marathi and German spot
 * checks.
 *
 * Seat Map Builder (this part): the restore-draft dialog (its age and
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
