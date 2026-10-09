import type { Browser, Page } from "@playwright/test";
import { test, expect, AFTER_WRITE, gotoDashboard } from "./helpers/test";
import { FIXTURE_EVENT_ID, FIXTURE_EVENT_TITLE, resetWaitlistFixture } from "./helpers/roles";
import { authFile, type PersonaKey } from "./helpers/personas";
import { markFirstVisitDone } from "./helpers/first-visit";
import { openArtistEventsAllCities } from "./helpers/events";

/**
 * Real target: the full chain fixed in PR #183 (waitlist fullness / wallet
 * race guards):
 *
 *   Artist A applies (Buy-in) -> Organiser approves -> Artist B applies
 *   (event is now full -> WAITLISTED) -> Artist A cancels (>=24h before
 *   the event) -> B is auto-promoted off the waitlist -> Artist A's
 *   cancelled Buy-in slot defaults to REFUNDED -> Organiser converts it to
 *   WALLET_CREDITED -> Organiser applies that wallet credit to the venue
 *   booking's platform fee.
 *
 * Runs against a fixed, reusable fixture (one Organiser + one BUY_IN,
 * maxPerformers:1 event + one VenueBooking with a real ₹199 platform fee -
 * see helpers/roles.ts), seeded by scripts/qa-seed.ts.
 *
 * A note on why maxPerformers:1 specifically: the isWaitlisted check in
 * POST /api/applications counts *approved Performances*, not pending
 * Applications - so Artist B only gets waitlisted once Artist A's
 * application has actually been Approved (creating a real Performance),
 * not merely submitted. The ordering below (A applies -> A approved -> B
 * applies) is load-bearing, not incidental.
 *
 * 3 Oct 2026 - made repeatable. It used to register two brand-new Artist
 * accounts on every run and never removed them, and it could only pass
 * once per reseed: the ₹199 platform fee only ever goes down, so the last
 * step failed on every run after the first. Now:
 *   - Artist A is Hrithik and Artist B is Shahrukh (QA personas, sessions
 *     saved by global-setup.ts); no accounts are created.
 *   - The fixture is put back to its seeded state before and after the run
 *     (resetWaitlistFixture: applications, slots, the fee, the wallet). The
 *     app has no way to undo those, so that goes to the QA database.
 * Hence the @needs-db tag: playwright.config.ts leaves this spec out, with
 * a warning, on a machine that has no QA database URL (E2E_DATABASE_URL).
 */

async function openAs(browser: Browser, persona: PersonaKey, baseURL: string | undefined): Promise<Page> {
  // Three identities in flight at once - separate browser contexts so one
  // session never clobbers another.
  const context = await browser.newContext({ baseURL, storageState: authFile(persona) });
  await markFirstVisitDone(context);
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(15_000);
  return page;
}

/**
 * The fixture event's card on the artist's "Browse Events" page: the nearest
 * block around the event title that also holds its compensation badge, so
 * the badge, the status and the apply button are all looked for inside the
 * same card and never in a neighbour's.
 */
function fixtureCard(page: Page) {
  return page
    .getByRole("heading", { level: 3, name: FIXTURE_EVENT_TITLE })
    .locator('xpath=ancestor::div[contains(., "Buy-in required")][1]');
}

/** The artist's "Browse Events" page, every city showing, the fixture card loaded. */
function openBrowseEvents(page: Page) {
  return openArtistEventsAllCities(page, fixtureCard(page));
}

test.describe("@needs-db waitlist and wallet credit", () => {
  test.beforeEach(async () => {
    await resetWaitlistFixture();
  });

  test.afterEach(async () => {
    await resetWaitlistFixture();
  });

  test("artist cancellation promotes the waitlist and the freed Buy-in amount becomes usable wallet credit", async ({
    browser,
    baseURL,
  }) => {
    // Three people, twelve page loads and seven writes, on a QA where a
    // server-rendered page takes 3-6 s: honestly longer than the 60 s
    // default. Each single wait still fails in 10-15 s.
    test.setTimeout(240_000);

    const artistAPage = await openAs(browser, "hrithik", baseURL);
    const artistBPage = await openAs(browser, "shahrukh", baseURL);
    const organiserPage = await openAs(browser, "fixtureOrganiser", baseURL);

    try {
      await test.step("Artist A applies to the fixture event", async () => {
        await openBrowseEvents(artistAPage);
        const card = fixtureCard(artistAPage);
        // The compensation badge must be visible BEFORE the Apply click -
        // this is the actual product requirement (Hitesh, 23 Jul): an
        // artist must know what they'd owe/earn before applying, not just
        // after. Fixture event is Buy-in/₹300.
        await expect(card.getByText(/buy-in required: ₹300/i)).toBeVisible();
        await card.getByRole("button", { name: /^apply to perform$/i }).click();
        await expect(card.getByText(/pending/i)).toBeVisible(AFTER_WRITE);
      });

      await test.step("Organiser approves Artist A under the event's declared terms (Buy-in ₹300)", async () => {
        await gotoDashboard(organiserPage, `/dashboard/organiser/events/${FIXTURE_EVENT_ID}`);
        // The organiser no longer picks the terms per approval (that choice,
        // and its Free-by-default trap, is gone): approving locks in the
        // terms the event declared. Check they are the Buy-in the rest of
        // this flow depends on before approving.
        // data-afa-* hooks (the English text is still checked): the organiser page follows the UI language (GEN-2610-007).
        await expect(organiserPage.locator("[data-afa-default-compensation]")).toHaveText("Buy-in — ₹300");
        await organiserPage.locator('[data-afa-review="approve"]').first().click();
        await expect(organiserPage.locator("[data-afa-toast]").filter({ hasText: /application approved/i })).toBeVisible(AFTER_WRITE);
      });

      await test.step("Artist B applies - lineup is now full, so B is waitlisted", async () => {
        await openBrowseEvents(artistBPage);
        const card = fixtureCard(artistBPage);
        // Same badge check as Artist A - B applies while the lineup is
        // already full, so this also confirms the badge (and thus the
        // payment terms) is shown even on a "waitlist only" card.
        await expect(card.getByText(/buy-in required: ₹300/i)).toBeVisible();
        await card.getByRole("button", { name: /^join waitlist$/i }).click();
        await expect(card.getByRole("button", { name: /^join waitlist$/i })).toBeHidden(AFTER_WRITE);
        await expect(card.getByText(/waitlist/i).first()).toBeVisible();
      });

      await test.step("Artist A cancels - B should be auto-promoted off the waitlist", async () => {
        await gotoDashboard(artistAPage, "/dashboard/artist");
        // The upcoming-performance row: a block holding the event title and
        // a Cancel button and no section heading. (The title also appears
        // under "My Applications", and the artist has other slots with
        // their own Cancel buttons - a looser match could cancel a real one.)
        const slot = artistAPage
          .locator("div")
          .filter({ has: artistAPage.getByText(FIXTURE_EVENT_TITLE, { exact: true }) })
          .filter({ has: artistAPage.getByRole("button", { name: /^cancel$/i }) })
          .filter({ hasNot: artistAPage.getByRole("heading") })
          .last();
        await expect(slot.getByRole("button")).toHaveCount(1);
        await slot.getByRole("button", { name: /^cancel$/i }).click();
        // cancelPerformance() asks in the in-app dialog (BUG-2609-086
        // replaced its window.confirm()); nothing cancels until it is
        // confirmed there.
        const confirmCancel = artistAPage.getByRole("dialog", { name: "Cancel this performance?" });
        await confirmCancel.getByRole("button", { name: "Cancel performance" }).click();
        await expect(confirmCancel).toBeHidden();
        // The page refetches after a successful cancel and the slot leaves
        // the upcoming list.
        await expect(slot).toBeHidden(AFTER_WRITE);
      });

      await test.step("Organiser sees the cancelled Buy-in slot as Refunded, converts it to wallet credit", async () => {
        await gotoDashboard(organiserPage, `/dashboard/organiser/events/${FIXTURE_EVENT_ID}`);
        await expect(organiserPage.locator('[data-afa-refund-status="REFUNDED"]')).toContainText(/marked as refunded to the artist/i);
        await organiserPage.locator("[data-afa-keep-wallet-credit]").click();
        await expect(organiserPage.locator("[data-afa-toast]").filter({ hasText: /kept as wallet credit instead of a refund/i })).toBeVisible(AFTER_WRITE);
        await expect(organiserPage.locator('[data-afa-refund-status="WALLET_CREDITED"]')).toHaveText(/kept as wallet credit$/i);
      });

      await test.step("Organiser applies the new wallet balance to the venue booking's platform fee", async () => {
        await expect(organiserPage.locator("[data-afa-platform-fee]")).toHaveText(/platform fee remaining: ₹199/i);
        await organiserPage.locator("[data-afa-apply-wallet]").click();
        // ₹300 credited vs a ₹199 fee - applied is capped at the fee
        // (min(remainingFee, walletBalance) per apply-wallet/route.ts), so
        // the fee line should disappear/zero out, not just shrink.
        await expect(organiserPage.locator("[data-afa-toast]").filter({ hasText: /₹199 wallet credit applied/i })).toBeVisible(AFTER_WRITE);
        await expect(organiserPage.locator("[data-afa-platform-fee]").filter({ hasText: /platform fee remaining: ₹199/i })).toBeHidden();
      });
    } finally {
      await artistAPage.context().close();
      await artistBPage.context().close();
      await organiserPage.context().close();
    }
  });
});
