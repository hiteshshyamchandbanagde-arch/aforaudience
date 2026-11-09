import type { Locator, Page } from "@playwright/test";
import { test, expect, gotoDashboard, hideFloatingOverlays } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { openEventFromListing, pickAvailableSeat, JAIPUR_EVENT_TITLE } from "./helpers/events";
import { useRuleViewport } from "./helpers/viewports";

/**
 * S1b-b2 (Hitesh, 9 Nov) - launch waves UI part 2: the W2 / W3 / W4
 * "opening soon" states and the 403 WAVE_CLOSED -> friendly line mapping.
 *
 * Read-only on purpose: the wave switches are global and specs run in
 * parallel, so nothing here writes the QA PlatformSettings row. Every
 * closed state is driven with page.route stubs:
 *  - the public hint GET /api/platform-settings/launch-waves (client
 *    components read it through useLaunchWaves());
 *  - the action endpoints, answering 403 {code:"WAVE_CLOSED", wave}, so a
 *    stale page (hint said open, server says closed) is covered too.
 * Server-rendered states (event detail "Tickets open soon", the seats-page
 * redirect) can't be intercepted; their decision is self-tested in
 * scripts/launch-waves-ui.test.ts (bookingSoonState, wavesForViewer).
 */

// Literals on purpose (not imported from the dictionaries): a copy change
// has to change this spec too.
const APPLICATIONS_SOON = { en: "Applications open soon", hi: "आवेदन जल्द ही खुलेंगे", mr: "अर्ज लवकरच सुरू होतील" };
const PAID_SLOTS_SOON = { en: "Paid artist slots open soon", hi: "सशुल्क कलाकार स्लॉट जल्द ही खुलेंगे", mr: "सशुल्क कलाकार स्लॉट लवकरच सुरू होतील" };
const PAID_VENUE_SOON = {
  en: "Paid venue bookings open soon — zero-amount venue bookings are allowed.",
  hi: "सशुल्क वेन्यू बुकिंग जल्द ही खुलेगी — शून्य राशि वाली वेन्यू बुकिंग की अनुमति है।",
  mr: "सशुल्क स्थळ बुकिंग लवकरच सुरू होईल — शून्य रकमेच्या स्थळ बुकिंगला परवानगी आहे.",
};
const CLOSED_W2 = "Applications to join as an organiser, venue owner or artist open soon.";
const CLOSED_W3 = "Tickets open soon — reservations aren't open yet.";
// The raw server strings (src/lib/launch-waves.ts) must never reach the page.
const RAW_W2 = "Applications to join as an organiser, venue or artist are not open yet.";
const RAW_W3 = "Ticket reservations are not open yet.";

const LOCALE_STORAGE_KEY = "afa-locale";
const LATIN_ALLOWED = new Set(["AforAudience", "AFA", "OTP", "UPI"]);
async function latinWords(el: Locator): Promise<string[]> {
  const text = await el.innerText();
  return (text.match(/[A-Za-z]{2,}/g) ?? []).filter((w) => !LATIN_ALLOWED.has(w));
}
async function useLocaleId(page: Page, id: string) {
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [LOCALE_STORAGE_KEY, id]);
}

type Hint = { W1: boolean; W2: boolean; W3: boolean; W4: boolean };
const ALL_OPEN: Hint = { W1: true, W2: true, W3: true, W4: true };

async function stubHint(page: Page, hint: Partial<Hint>) {
  await page.route("**/api/platform-settings/launch-waves**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...ALL_OPEN, ...hint }) })
  );
}

/** Answers POSTs to `pattern` with the server's 403 WAVE_CLOSED body; counts them. */
async function stubWaveClosed(page: Page, pattern: string, wave: "W2" | "W3" | "W4", raw: string) {
  const seen = { posts: 0 };
  await page.route(pattern, (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    seen.posts++;
    return route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: raw, code: "WAVE_CLOSED", wave }) });
  });
  return seen;
}

// ---------------------------------------------------------------------------
// W2 - applications (Profile apply cards). Atul is an audience member with
// no organiser / venue / artist profile, so every apply card is showing.
test.describe("W2 applications", () => {
  test.use({ storageState: authFile("atul") });

  test("[S1b-b2] W2 closed: apply cards show 'Applications open soon' instead of the form; screenshot @390/@1440", async ({ page, isMobile }) => {
    await useRuleViewport(page, isMobile);
    await stubHint(page, { W2: false });
    await page.goto("/profile/");
    const venueCard = page.locator("#apply-venue");
    const note = venueCard.locator('[data-afa-wave-soon="W2"]');
    await expect(note).toHaveText(APPLICATIONS_SOON.en);
    await expect(venueCard.getByRole("button")).toHaveCount(0);
    await expect(page.locator('#apply-organiser [data-afa-wave-soon="W2"]')).toHaveText(APPLICATIONS_SOON.en);
    await expect(page.locator('#apply-artist [data-afa-wave-soon="W2"]')).toHaveText(APPLICATIONS_SOON.en);
    await note.scrollIntoViewIfNeeded();
    await hideFloatingOverlays(page);
    await expect(note).toHaveScreenshot(`wave-w2-applications-soon-${isMobile ? 390 : 1440}.png`, { animations: "disabled" });
  });

  test("[S1b-b2] W2 open but the server says closed (stale page): the apply error is the friendly line", async ({ page, isMobile }) => {
    await useRuleViewport(page, isMobile);
    await stubHint(page, {});
    const seen = await stubWaveClosed(page, "**/api/venue-owners/apply**", "W2", RAW_W2);
    await page.goto("/profile/");
    const apply = page.locator("#apply-venue").getByRole("button");
    await apply.scrollIntoViewIfNeeded();
    await apply.click();
    await expect(page.getByText(CLOSED_W2, { exact: true })).toBeVisible();
    await expect(page.getByText(RAW_W2)).toHaveCount(0);
    expect(seen.posts).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// W3 - tickets. The event page's "Tickets open soon" is server-rendered
// (self-tested); here the reserve error path of a page opened while W3 was
// still open.
test.describe("W3 tickets", () => {
  test.use({ storageState: authFile("atul") });

  test("[S1b-b2] W3 closed after the seats page loaded: reserve shows the friendly line, not the raw 403", async ({ page, isMobile }) => {
    await useRuleViewport(page, isMobile);
    const seen = await stubWaveClosed(page, "**/api/bookings", "W3", RAW_W3);
    await openEventFromListing(page, JAIPUR_EVENT_TITLE, isMobile);
    await page.getByRole("link", { name: /select tickets/i }).first().click();
    await expect(page).toHaveURL(/\/events\/[^/]+\/seats\/?/);
    await pickAvailableSeat(page);
    const continueButton = page.getByRole("button", { name: /continue to checkout/i });
    await expect(continueButton).toBeEnabled({ timeout: 15_000 });
    await continueButton.click();
    await expect(page.getByText(CLOSED_W3, { exact: true })).toBeVisible();
    await expect(page.getByText(RAW_W3)).toHaveCount(0);
    await expect(page).toHaveURL(/\/seats\/?/);
    expect(seen.posts).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// W4 - paid B2B on the organiser create page (Omkar). Nothing is submitted.
test.describe("W4 paid bookings", () => {
  test.use({ storageState: authFile("omkar") });

  async function openCreate(page: Page) {
    await gotoDashboard(page, "/dashboard/organiser/events/create/");
    return page.getByRole("main");
  }

  test("[S1b-b2] W4 closed: PAID / BUY_IN artist slots disabled, FREE selectable; note shows; screenshot @390/@1440", async ({ page, isMobile }) => {
    await useRuleViewport(page, isMobile);
    await stubHint(page, { W4: false });
    const main = await openCreate(page);
    await expect(main.locator('[data-afa-comp-option="PAID"]')).toBeDisabled();
    await expect(main.locator('[data-afa-comp-option="BUY_IN"]')).toBeDisabled();
    await expect(main.locator('[data-afa-comp-option="FREE"]')).toBeEnabled();
    const note = main.locator('[data-afa-wave-soon="W4"]', { hasText: PAID_SLOTS_SOON.en });
    await expect(note).toHaveText(PAID_SLOTS_SOON.en);
    await note.scrollIntoViewIfNeeded();
    await hideFloatingOverlays(page);
    await expect(note).toHaveScreenshot(`wave-w4-paid-slots-soon-${isMobile ? 390 : 1440}.png`, { animations: "disabled" });
  });

  test("[S1b-b2] W4 open: PAID / BUY_IN stay selectable and no W4 note shows", async ({ page, isMobile }) => {
    await useRuleViewport(page, isMobile);
    await stubHint(page, {});
    const main = await openCreate(page);
    await expect(main.locator('[data-afa-comp-option="PAID"]')).toBeEnabled();
    await expect(main.locator('[data-afa-comp-option="BUY_IN"]')).toBeEnabled();
    await expect(main.locator('[data-afa-wave-soon="W4"]')).toHaveCount(0);
  });

  test("[S1b-b2] W4 closed: a venue booking amount > 0 shows the paid-venue note; 0 clears it; screenshot @390/@1440", async ({ page, isMobile }) => {
    await useRuleViewport(page, isMobile);
    await stubHint(page, { W4: false });
    const main = await openCreate(page);
    const venueSelect = main.locator("select[data-afa-venue-select]");
    const venueOption = venueSelect.locator("option", { hasText: "Koregaon Park Lounge" });
    await expect(venueOption).toHaveCount(1);
    await venueSelect.selectOption({ label: (await venueOption.innerText()).trim() });
    const amount = main.locator("input[data-afa-venue-amount]");
    await amount.fill("500");
    const note = main.locator('[data-afa-wave-soon="W4"]', { hasText: PAID_VENUE_SOON.en });
    await expect(note).toHaveText(PAID_VENUE_SOON.en);
    await note.scrollIntoViewIfNeeded();
    await hideFloatingOverlays(page);
    await expect(note).toHaveScreenshot(`wave-w4-paid-venue-soon-${isMobile ? 390 : 1440}.png`, { animations: "disabled" });
    await amount.fill("0");
    await expect(note).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// i18n: Latin-leak check (hi + mr) on the new states.
for (const locale of ["hi", "mr"] as const) {
  test.describe(`launch wave states in ${locale}`, () => {
    test.describe("profile", () => {
      test.use({ storageState: authFile("atul") });
      test(`[S1b-b2] W2 'Applications open soon' has no English left in ${locale}`, async ({ page, isMobile }) => {
        await useRuleViewport(page, isMobile);
        await useLocaleId(page, locale);
        await stubHint(page, { W2: false });
        await page.goto("/profile/");
        const note = page.locator('#apply-venue [data-afa-wave-soon="W2"]');
        await expect(note).toHaveText(APPLICATIONS_SOON[locale]);
        expect(await latinWords(note)).toEqual([]);
      });
    });
    test.describe("create", () => {
      test.use({ storageState: authFile("omkar") });
      test(`[S1b-b2] W4 notes have no English left in ${locale}`, async ({ page, isMobile }) => {
        await useRuleViewport(page, isMobile);
        await useLocaleId(page, locale);
        await stubHint(page, { W4: false });
        await gotoDashboard(page, "/dashboard/organiser/events/create/");
        const main = page.getByRole("main");
        const slots = main.locator('[data-afa-wave-soon="W4"]', { hasText: PAID_SLOTS_SOON[locale] });
        await expect(slots).toHaveText(PAID_SLOTS_SOON[locale]);
        expect(await latinWords(slots)).toEqual([]);
        const venueSelect = main.locator("select[data-afa-venue-select]");
        const venueOption = venueSelect.locator("option", { hasText: "Koregaon Park Lounge" });
        await venueSelect.selectOption({ label: (await venueOption.innerText()).trim() });
        await main.locator("input[data-afa-venue-amount]").fill("500");
        const venue = main.locator('[data-afa-wave-soon="W4"]', { hasText: PAID_VENUE_SOON[locale] });
        await expect(venue).toHaveText(PAID_VENUE_SOON[locale]);
        expect(await latinWords(venue)).toEqual([]);
      });
    });
  });
}
