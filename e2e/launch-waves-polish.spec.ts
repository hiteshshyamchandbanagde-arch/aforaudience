import type { Locator, Page } from "@playwright/test";
import { test, expect, gotoDashboard, hideFloatingOverlays } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { useRuleViewport } from "./helpers/viewports";

/**
 * S1b-c2 (Hitesh's phone check, 10 Nov) - launch waves polish:
 *  - Profile "Create" rows carry an "Opening soon" badge while W2 is closed
 *    (the rows are the phone-only audience menu; still scroll to the card);
 *  - the Artist apply card drops "Goes live immediately, no approval wait."
 *    while W2 is closed;
 *  - W4 closed: the Paid / Buy-in artist-slot options look unavailable
 *    (dimmed, not-allowed, aria-disabled), Free stays normal - create + edit.
 * The admin Save look (item 1) is in launch-waves-ui.spec.ts.
 *
 * Read-only: the wave hint is stubbed with page.route; nothing is saved
 * and the QA PlatformSettings row is never written.
 */

// Literals on purpose (not imported from the dictionaries): a copy change
// has to change this spec too.
const OPENING_SOON = { en: "Opening soon", hi: "जल्द ही खुलेगा", mr: "लवकरच सुरू" };
const ARTIST_BASE = {
  en: "Get discovered, apply to perform at events, and track your growth.",
  hi: "पहचान बनाएं, इवेंट्स में प्रस्तुति के लिए आवेदन करें, और अपनी प्रगति ट्रैक करें।",
  mr: "लोकांच्या नजरेत या, इव्हेंट्समध्ये सादरीकरणासाठी अर्ज करा, आणि तुमची प्रगती बघा.",
};
const ARTIST_INSTANT = "Goes live immediately, no approval wait.";
const CREATE_ROWS = ["List an event", "Register a venue", "Artist profiles"];
const EDIT_EVENT_ID = "qa-demo-event-full-9"; // Omkar's (chat-bubble.mobile.spec.ts)

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

function createRow(page: Page, title: string) {
  return page.getByRole("button").filter({ hasText: title });
}

async function look(el: Locator) {
  return el.evaluate((node) => {
    const cs = getComputedStyle(node);
    return { opacity: Number(cs.opacity), cursor: cs.cursor, borderStyle: cs.borderTopStyle };
  });
}

// ---------------------------------------------------------------------------
// W2 - Profile (Atul: audience, no organiser / venue / artist profile).
test.describe("W2 profile", () => {
  test.use({ storageState: authFile("atul") });

  test("[S1b-c2] W2 closed: the three Create rows show 'Opening soon' (phone) and still scroll to the card; screenshot @390", async ({ page, isMobile }) => {
    await useRuleViewport(page, isMobile);
    await stubHint(page, { W2: false });
    await page.goto("/profile/");
    // The apply card shows its closed state once the hint is in.
    await expect(page.locator('#apply-venue [data-afa-wave-soon="W2"]')).toBeVisible();
    if (!isMobile) {
      // The Create menu is the phone layout (lg:hidden); desktop has the cards.
      for (const title of CREATE_ROWS) await expect(createRow(page, title)).toBeHidden();
      return;
    }
    for (const title of CREATE_ROWS) {
      const badge = createRow(page, title).locator("[data-afa-opening-soon-badge]");
      await expect(badge, title).toHaveText(OPENING_SOON.en);
    }
    const group = createRow(page, "List an event").locator("xpath=..");
    await hideFloatingOverlays(page);
    await expect(group).toHaveScreenshot("wave-w2-create-rows-390.png", { animations: "disabled" });
    // Still a link to the card.
    await createRow(page, "Register a venue").click();
    await expect(page.locator("#apply-venue")).toBeInViewport();
  });

  test("[S1b-c2] W2 open: no 'Opening soon' badge on the Create rows", async ({ page, isMobile }) => {
    await useRuleViewport(page, isMobile);
    await stubHint(page, {});
    await page.goto("/profile/");
    await expect(page.locator("#apply-venue").getByRole("button")).toBeVisible();
    await expect(page.locator("[data-afa-opening-soon-badge]")).toHaveCount(0);
  });

  test("[S1b-c2] W2 closed: Artist card drops 'Goes live immediately'; screenshot @390/@1440", async ({ page, isMobile }) => {
    await useRuleViewport(page, isMobile);
    await stubHint(page, { W2: false });
    await page.goto("/profile/");
    const card = page.locator("#apply-artist");
    await expect(card.locator('[data-afa-wave-soon="W2"]')).toBeVisible();
    await expect(card).toContainText(ARTIST_BASE.en);
    await expect(card).not.toContainText("immediately");
    await card.scrollIntoViewIfNeeded();
    await hideFloatingOverlays(page);
    await expect(card).toHaveScreenshot(`wave-w2-artist-card-${isMobile ? 390 : 1440}.png`, { animations: "disabled" });
  });

  test("[S1b-c2] W2 open: Artist card keeps 'Goes live immediately'", async ({ page, isMobile }) => {
    await useRuleViewport(page, isMobile);
    await stubHint(page, {});
    await page.goto("/profile/");
    const card = page.locator("#apply-artist");
    await expect(card.getByRole("button").last()).toBeVisible();
    await expect(card).toContainText(`${ARTIST_BASE.en} ${ARTIST_INSTANT}`);
  });
});

// ---------------------------------------------------------------------------
// W4 - Paid / Buy-in look unavailable (Omkar). Nothing is submitted.
test.describe("W4 payment options", () => {
  test.use({ storageState: authFile("omkar") });

  async function expectBlocked(option: Locator) {
    await expect(option).toBeDisabled();
    await expect(option).toHaveAttribute("aria-disabled", "true");
    const l = await look(option);
    expect(l.opacity, "blocked option is dimmed").toBeLessThanOrEqual(0.5);
    expect(l.cursor).toBe("not-allowed");
    expect(l.borderStyle).toBe("dashed");
  }
  async function expectAvailable(option: Locator) {
    await expect(option).toBeEnabled();
    await expect(option).not.toHaveAttribute("aria-disabled", "true");
    expect((await look(option)).opacity).toBe(1);
  }

  test("[S1b-c2] W4 closed on create: Paid / Buy-in look unavailable, Free normal; screenshot @390/@1440", async ({ page, isMobile }) => {
    await useRuleViewport(page, isMobile);
    await stubHint(page, { W4: false });
    await gotoDashboard(page, "/dashboard/organiser/events/create/");
    const main = page.getByRole("main");
    await expectBlocked(main.locator('[data-afa-comp-option="PAID"]'));
    await expectBlocked(main.locator('[data-afa-comp-option="BUY_IN"]'));
    await expectAvailable(main.locator('[data-afa-comp-option="FREE"]'));
    const free = main.locator('[data-afa-comp-option="FREE"]');
    const row = free.locator("xpath=..");
    await row.scrollIntoViewIfNeeded();
    await hideFloatingOverlays(page);
    // Free is masked: its selected colour follows the theme's accent (not
    // what this check is about); the baseline is the two blocked options.
    await expect(row).toHaveScreenshot(`wave-w4-comp-options-${isMobile ? 390 : 1440}.png`, { animations: "disabled", mask: [free] });
  });

  test("[S1b-c2] W4 open on create: Paid / Buy-in look normal", async ({ page, isMobile }) => {
    await useRuleViewport(page, isMobile);
    await stubHint(page, {});
    await gotoDashboard(page, "/dashboard/organiser/events/create/");
    const main = page.getByRole("main");
    for (const v of ["FREE", "PAID", "BUY_IN"]) await expectAvailable(main.locator(`[data-afa-comp-option="${v}"]`));
  });

  test("[S1b-c2] W4 closed on edit: a blocked Paid / Buy-in option looks unavailable", async ({ page, isMobile }) => {
    await useRuleViewport(page, isMobile);
    await stubHint(page, { W4: false });
    await gotoDashboard(page, `/dashboard/organiser/events/${EDIT_EVENT_ID}/edit/`);
    const main = page.getByRole("main");
    await expect(main.locator('[data-afa-comp-option="FREE"]')).toBeVisible();
    // An event already saved as Paid / Buy-in keeps that option; the other is blocked.
    let blocked = 0;
    for (const v of ["PAID", "BUY_IN"]) {
      const option = main.locator(`[data-afa-comp-option="${v}"]`);
      if (await option.isDisabled()) {
        await expectBlocked(option);
        blocked++;
      } else {
        await expect(option).not.toHaveAttribute("aria-disabled", "true");
      }
    }
    expect(blocked, "at least one paid option is blocked").toBeGreaterThan(0);
    await expectAvailable(main.locator('[data-afa-comp-option="FREE"]'));
  });
});

// ---------------------------------------------------------------------------
// i18n: Latin-leak check (hi + mr) on the touched profile copy.
for (const locale of ["hi", "mr"] as const) {
  test.describe(`launch waves polish in ${locale}`, () => {
    test.use({ storageState: authFile("atul") });
    test(`[S1b-c2] W2 closed: badge and Artist card have no English left in ${locale}`, async ({ page, isMobile }) => {
      await useRuleViewport(page, isMobile);
      await useLocaleId(page, locale);
      await stubHint(page, { W2: false });
      await page.goto("/profile/");
      const desc = page.locator("#apply-artist p").first();
      await expect(desc).toHaveText(ARTIST_BASE[locale]);
      expect(await latinWords(desc)).toEqual([]);
      if (isMobile) {
        const badges = page.locator("[data-afa-opening-soon-badge]");
        await expect(badges).toHaveCount(3);
        for (const badge of await badges.all()) {
          await expect(badge).toHaveText(OPENING_SOON[locale]);
          expect(await latinWords(badge)).toEqual([]);
        }
      }
    });
  });
}
