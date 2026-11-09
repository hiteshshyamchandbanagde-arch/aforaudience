import type { Locator, Page } from "@playwright/test";
import { test, expect, gotoDashboard, hideFloatingOverlays } from "./helpers/test";
import { ADMIN_AUTH_FILE } from "./helpers/temp-admin";
import { withQaDb } from "./helpers/qa-db";
import { useRuleViewport } from "./helpers/viewports";

/**
 * S1b-b1 (Hitesh, 9 Nov) - launch waves UI part 1: the admin Settings
 * "Launch waves" card, the W1 holding page and the sign-up states.
 *
 * Read-only on purpose: the wave switches are global and specs run in
 * parallel, so nothing here writes the PlatformSettings row (W1 off would
 * hold every public page for every other spec). Instead:
 *  - the admin card is checked against the row (read, never saved);
 *  - the W1-closed screens are checked on the dev-only preview route
 *    /dev/launch-holding/ (404 on production), which renders the same
 *    components the gate renders;
 *  - the closed login/register behaviour is driven with page.route stubs
 *    of the public hint and of the register API.
 * Which routes are held, the admin bypass and the layout wiring are
 * self-tested in scripts/launch-waves-holding.test.ts.
 */

const SIGNED_OUT = { storageState: { cookies: [], origins: [] } };
const LOCALE_STORAGE_KEY = "afa-locale";

// Literals on purpose (not imported from the dictionaries): a copy change
// has to change this spec too.
const NEW_ACCOUNTS_SOON = {
  en: "New accounts open soon — existing members can sign in.",
  hi: "नए अकाउंट जल्द ही खुलेंगे — मौजूदा सदस्य साइन इन कर सकते हैं।",
  mr: "नवीन खाती लवकरच सुरू होतील — सध्याचे सदस्य साइन इन करू शकतात.",
};
const HOLDING_TITLE = {
  en: "AforAudience is opening soon",
  hi: "AforAudience जल्द ही खुल रहा है",
  mr: "AforAudience लवकरच सुरू होत आहे",
};
const SIGNUPS_SOON = {
  en: "New sign-ups open soon",
  hi: "नए साइन-अप जल्द ही खुलेंगे",
  mr: "नवीन साइन-अप लवकरच सुरू होतील",
};

// Brand terms that stay in Latin script in every language (as marathi-locale.spec.ts).
const LATIN_ALLOWED = new Set(["AforAudience", "AFA", "OTP", "UPI"]);
async function latinWords(el: Locator): Promise<string[]> {
  const text = await el.innerText();
  return (text.match(/[A-Za-z]{2,}/g) ?? []).filter((w) => !LATIN_ALLOWED.has(w));
}

async function useLocaleId(page: Page, id: string) {
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [LOCALE_STORAGE_KEY, id]);
}

async function stubW1(page: Page, open: boolean) {
  await page.route("**/api/platform-settings/launch-waves**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ W1: open, W2: true, W3: true, W4: true }) })
  );
}

async function realW1(page: Page): Promise<boolean> {
  const res = await page.request.get("/api/platform-settings/launch-waves/");
  expect(res.status()).toBe(200);
  return (await res.json()).W1 === true;
}

// ---------------------------------------------------------------------------
// (a) Admin Settings - Launch waves card
test.describe("admin", () => {
  test.use({ storageState: ADMIN_AUTH_FILE });

  test("[S1b-b1] admin Settings shows the four wave toggles matching the QA row; nothing saved @needs-db", async ({ page, isMobile }) => {
    const row = await withQaDb(async (db) => {
      const { rows } = await db.query<Record<string, boolean>>(
        `SELECT "waveDiscoveryOpen", "waveOnboardingOpen", "waveTicketsOpen", "waveDirectBookingsOpen"
           FROM "PlatformSettings" WHERE id = 'singleton'`
      );
      expect(rows.length, "the platform settings row exists on QA").toBe(1);
      return rows[0];
    });
    const stored = { W1: row.waveDiscoveryOpen, W2: row.waveOnboardingOpen, W3: row.waveTicketsOpen, W4: row.waveDirectBookingsOpen };

    await useRuleViewport(page, isMobile);
    await gotoDashboard(page, "/dashboard/admin/settings/");

    const card = page.locator("[data-afa-launch-waves-card]");
    await expect(card.getByRole("heading", { name: "Launch waves" })).toBeVisible();
    await expect(card.locator("[data-afa-launch-waves-note]")).toHaveText(
      "Admins are never blocked. Bookings already in progress are never affected."
    );
    for (const [wave, label] of [
      ["W1", "Discovery + sign-up"],
      ["W2", "Onboarding"],
      ["W3", "Tickets"],
      ["W4", "Direct bookings"],
    ] as const) {
      await expect(card.locator("label").filter({ has: page.locator(`[data-afa-wave-toggle="${wave}"]`) })).toContainText(label);
    }

    // The card sits directly above Paid bookings.
    const next = card.locator("xpath=following-sibling::div[1]");
    await expect(next).toHaveAttribute("data-afa-paid-bookings-card", "");

    const save = card.getByRole("button", { name: "Save", exact: true });
    await expect(save).toBeDisabled();
    for (const wave of ["W1", "W2", "W3", "W4"] as const) {
      const toggle = card.locator(`[data-afa-wave-toggle="${wave}"]`);
      if (stored[wave]) await expect(toggle, `${wave} reflects the row`).toBeChecked();
      else await expect(toggle, `${wave} reflects the row`).not.toBeChecked();
      // Flipping it is a change (Save offered); flipping back is no change. Never saved.
      await toggle.click();
      await expect(save).toBeEnabled();
      await toggle.click();
      await expect(save).toBeDisabled();
    }
  });

  // Same reason as the Paid bookings card (S1a amend): a fractional height
  // would move every card below it by a sub-pixel and break their baselines.
  test("[S1b-b1] Launch waves card has a whole-pixel height @needs-db", async ({ page, isMobile }) => {
    await useRuleViewport(page, isMobile);
    await gotoDashboard(page, "/dashboard/admin/settings/");
    const card = page.locator("[data-afa-launch-waves-card]");
    await expect(card.getByRole("heading", { name: "Launch waves" })).toBeVisible();
    const height = await card.evaluate((el) => el.getBoundingClientRect().height);
    expect(height % 1, `card height ${height}px is a whole number of pixels`).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// (b) With W1 open (QA's row), discovery pages and /register are normal.
test.describe("signed out", () => {
  test.use(SIGNED_OUT);

  test("[S1b-b1] W1 open: /, /events and /register render normally (no holding text)", async ({ page, isMobile }) => {
    await useRuleViewport(page, isMobile);
    // QA runs all-open. If chat has W1 off for a human check, the pages
    // must show the holding state instead - checked, not skipped.
    const w1 = await realW1(page);

    for (const url of ["/", "/events/"]) {
      await page.goto(url);
      if (w1) {
        await expect(page.locator("[data-afa-launch-holding]"), url).toHaveCount(0);
        await expect(page.getByText(HOLDING_TITLE.en), url).toHaveCount(0);
        await expect(page.locator("footer").first(), `${url} rendered its real page`).toBeAttached();
      } else {
        await expect(page.getByRole("heading", { name: HOLDING_TITLE.en }), url).toBeVisible();
      }
    }

    await page.goto("/register/");
    if (w1) {
      await expect(page.getByRole("button", { name: "Create Account", exact: true })).toBeVisible();
      await expect(page.locator("[data-afa-signups-soon]")).toHaveCount(0);
    } else {
      await expect(page.getByRole("heading", { name: SIGNUPS_SOON.en })).toBeVisible();
    }
  });

  test("[S1b-b1] always-reachable pages never show the holding page", async ({ page }) => {
    for (const url of ["/login/", "/about/", "/contact/", "/terms/", "/privacy/", "/refund-policy/", "/forgot-password/"]) {
      const res = await page.goto(url);
      expect(res?.status(), url).toBeLessThan(400);
      await expect(page.locator("[data-afa-launch-holding]"), url).toHaveCount(0);
    }
  });

  // -------------------------------------------------------------------------
  // (c) Register error mapping: a 403 WAVE_CLOSED shows the localized
  // "open soon" message, not a generic error. The API is stubbed, so no
  // account is ever created.
  for (const locale of ["en", "hi"] as const) {
    test(`[S1b-b1] register maps 403 WAVE_CLOSED to the "open soon" message (${locale})`, async ({ page, isMobile }) => {
      await useRuleViewport(page, isMobile);
      if (locale !== "en") await useLocaleId(page, locale);
      // QA runs W1 open. If chat has it off for a human check there is no
      // form to submit: /register must show the closed state instead.
      if (!(await realW1(page))) {
        await page.goto("/register/");
        await expect(page.locator("[data-afa-signups-soon]")).toBeVisible();
        return;
      }
      let posted = 0;
      await page.route("**/api/auth/register**", (route) => {
        if (route.request().method() !== "POST") return route.continue();
        posted++;
        return route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ error: "AforAudience is not open for new sign-ups yet. Please check back soon.", code: "WAVE_CLOSED", wave: "W1" }),
        });
      });

      await page.goto("/register/");
      const suffix = `${Date.now()}`.slice(-8);
      await page.locator('input[name="fullName"]').fill("Wave Test");
      await page.locator('input[name="username"]').fill(`e2ewave${suffix}`);
      await page.locator('input[name="email"]').fill(`e2e-wave-${suffix}@example.com`);
      await page.locator('input[name="phoneNumber"]').fill(`9${suffix}0`.slice(0, 10));
      await page.locator('input[name="password"]').fill("WaveTest123!");
      await page.locator('input[name="confirm"]').fill("WaveTest123!");
      const submit = page.getByRole("button", { name: locale === "hi" ? "खाता बनाएं" : "Create Account", exact: true });
      await expect(submit).toBeEnabled();
      await submit.click();

      await expect(page.getByText(NEW_ACCOUNTS_SOON[locale], { exact: true })).toBeVisible();
      expect(posted).toBe(1);
      await expect(page.getByText("AforAudience is not open for new sign-ups yet.", { exact: false })).toHaveCount(0);
    });
  }

  test("[S1b-b1] login while W1 is closed: no Create account, the 'open soon' note shows; OAuthCreateAccount maps to it", async ({ page, isMobile }) => {
    await useRuleViewport(page, isMobile);
    await stubW1(page, false);
    await page.goto("/login/?error=OAuthCreateAccount");
    await expect(page.locator("[data-afa-new-accounts-soon]")).toHaveText(NEW_ACCOUNTS_SOON.en);
    await expect(page.locator("[data-afa-oauth-create-error]")).toHaveText(NEW_ACCOUNTS_SOON.en);
    await expect(page.getByRole("link", { name: "Create one free" })).toHaveCount(0);
  });

  test("[S1b-b1] login while W1 is open keeps Create account and shows no note", async ({ page, isMobile }) => {
    await useRuleViewport(page, isMobile);
    await stubW1(page, true);
    await page.goto("/login/");
    await expect(page.getByRole("link", { name: "Create one free" })).toBeVisible();
    await expect(page.locator("[data-afa-new-accounts-soon]")).toHaveCount(0);
  });

  // -------------------------------------------------------------------------
  // W1-closed screens through the dev-only preview route (never flips QA).
  test("[S1b-b1] holding page: wordmark, one line, About + Contact links; screenshot @390/@1440", async ({ page, isMobile }) => {
    await useRuleViewport(page, isMobile);
    await page.goto("/dev/launch-holding/");
    const holding = page.locator("[data-afa-launch-holding]");
    await expect(holding.getByRole("heading", { name: HOLDING_TITLE.en })).toBeVisible();
    await expect(holding).toContainText("AforAudience");
    await expect(holding.getByRole("link", { name: "About us" })).toHaveAttribute("href", "/about");
    await expect(holding.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/contact");
    await hideFloatingOverlays(page);
    await expect(holding).toHaveScreenshot(`launch-holding-${isMobile ? 390 : 1440}.png`, { animations: "disabled" });
  });

  test("[S1b-b1] register 'sign-ups open soon' state: sign-in link stays; screenshot @390/@1440", async ({ page, isMobile }) => {
    await useRuleViewport(page, isMobile);
    await page.goto("/dev/launch-holding/?view=signups");
    const box = page.locator("[data-afa-signups-soon]");
    await expect(box.getByRole("heading", { name: SIGNUPS_SOON.en })).toBeVisible();
    await expect(box.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    await hideFloatingOverlays(page);
    await expect(box).toHaveScreenshot(`signups-soon-${isMobile ? 390 : 1440}.png`, { animations: "disabled" });
  });

  // i18n: Latin-leak check (hi + mr) on the new screens.
  for (const locale of ["hi", "mr"] as const) {
    test(`[S1b-b1] W1-closed screens have no English left in ${locale}`, async ({ page, isMobile }) => {
      await useRuleViewport(page, isMobile);
      await useLocaleId(page, locale);

      await page.goto("/dev/launch-holding/");
      const holding = page.locator("[data-afa-launch-holding]");
      await expect(holding.getByRole("heading", { name: HOLDING_TITLE[locale] })).toBeVisible();
      expect(await latinWords(holding)).toEqual([]);

      await page.goto("/dev/launch-holding/?view=signups");
      const box = page.locator("[data-afa-signups-soon]");
      await expect(box.getByRole("heading", { name: SIGNUPS_SOON[locale] })).toBeVisible();
      expect(await latinWords(box)).toEqual([]);

      await stubW1(page, false);
      await page.goto("/login/");
      const note = page.locator("[data-afa-new-accounts-soon]");
      await expect(note).toHaveText(NEW_ACCOUNTS_SOON[locale]);
      expect(await latinWords(note)).toEqual([]);
    });
  }
});
