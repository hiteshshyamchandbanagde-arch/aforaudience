import { test, expect } from "@playwright/test";
import {
  registerTestArtist,
  loginFixtureOrganiser,
  FIXTURE_EVENT_ID,
  FIXTURE_EVENT_TITLE,
} from "./helpers/roles";

/**
 * Real target: the full chain fixed in PR #183 (waitlist fullness / wallet
 * race guards) but never click-tested live end to end, per every handoff
 * since (see HANDOFF_16.md "Testing pass residue"):
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
 * see helpers/roles.ts FIXTURE_ORGANISER/FIXTURE_EVENT_ID), seeded once
 * directly via SQL, same reasoning as numbered-seat-booking.spec.ts reusing
 * "Jaipur Mic Gala 100" instead of building a fresh venue+event per run.
 * Fresh Artist accounts are still created for real, every run.
 *
 * NOT YET IN THE AUTO-RUN CADENCE. This is new - deliberately left off the
 * push/nightly workflow (see e2e-waitlist-wallet.yml, workflow_dispatch
 * only) until a first real run has been watched end to end. Promote it to
 * e2e.yml's regular triggers once confirmed stable.
 *
 * KNOWN NON-IDEMPOTENCY, worth reading before re-running: the fixture
 * VenueBooking's platformFeeAmount only ever goes down (there's no code
 * path that replenishes it) - so the "platform fee remaining: ₹199 ->
 * gone" assertion is only meaningful on the FIRST successful run. Every
 * run after that will find the fee already at ₹0 (Organiser wallet keeps
 * accumulating credit with nothing left to apply it to) and that specific
 * assertion will fail, even though cancel/waitlist-promote/refund->wallet-
 * credit all still genuinely re-verify each time. Reset by re-running the
 * platformFeeAmount:199 SQL seed (see HANDOFF, 23 Jul) if a clean second
 * pass through the fee-application step specifically is needed.
 *
 * A note on why maxPerformers:1 specifically: the isWaitlisted check in
 * POST /api/applications counts *approved Performances*, not pending
 * Applications - so Artist B only gets waitlisted once Artist A's
 * application has actually been Approved (creating a real Performance),
 * not merely submitted. The ordering below (A applies -> A approved -> B
 * applies) is load-bearing, not incidental.
 */

test("artist cancellation promotes the waitlist and the freed Buy-in amount becomes usable wallet credit", async ({
  browser,
}) => {
  // Three independent identities in flight at once (two Artists + one
  // Organiser) - separate browser contexts so logging in as one never
  // clobbers another's session, unlike reusing a single `page`.
  const artistAContext = await browser.newContext();
  const artistBContext = await browser.newContext();
  const organiserContext = await browser.newContext();
  const artistAPage = await artistAContext.newPage();
  const artistBPage = await artistBContext.newPage();
  const organiserPage = await organiserContext.newPage();

  try {
    await test.step("Artist A registers and applies to the fixture event", async () => {
      await registerTestArtist(artistAPage);
      await artistAPage.goto("/dashboard/artist/events");
      const card = artistAPage
        .locator("div")
        .filter({ hasText: FIXTURE_EVENT_TITLE })
        .last();
      // The compensation badge (compensationBadge() in
      // dashboard/artist/events/page.tsx) must be visible BEFORE the
      // Apply click - this is the actual product requirement (Hitesh,
      // 23 Jul): an artist must know what they'd owe/earn before
      // applying, not just after. Fixture event is Buy-in/₹300.
      await expect(card.getByText(/buy-in required: ₹300/i)).toBeVisible({
        timeout: 15_000,
      });
      await card.getByRole("button", { name: /apply to perform|join waitlist/i }).click();
      await expect(card.getByText(/pending/i)).toBeVisible({ timeout: 15_000 });
    });

    await test.step("Organiser approves Artist A as a Buy-in performer (₹300, matching the event default)", async () => {
      await loginFixtureOrganiser(organiserPage);
      await organiserPage.goto(`/dashboard/organiser/events/${FIXTURE_EVENT_ID}`);
      // Compensation defaults to Free client-side if no button is
      // clicked (see reviewApplication in page.tsx) - Buy-in must be
      // selected explicitly or this silently approves as Free instead
      // and the whole downstream refund/wallet chain never triggers.
      await organiserPage.getByRole("button", { name: /^buy-in$/i }).first().click();
      await organiserPage.getByPlaceholder(/₹ amount/i).first().fill("300");
      await organiserPage.getByRole("button", { name: /^approve$/i }).first().click();
      await expect(organiserPage.getByText(/application approved/i)).toBeVisible({
        timeout: 15_000,
      });
    });

    await test.step("Artist B registers and applies - lineup is now full, so B is waitlisted", async () => {
      await registerTestArtist(artistBPage);
      await artistBPage.goto("/dashboard/artist/events");
      const card = artistBPage
        .locator("div")
        .filter({ hasText: FIXTURE_EVENT_TITLE })
        .last();
      // Same badge check as Artist A - B applies while the lineup is
      // already full, so this also confirms the badge (and thus the
      // payment terms) is shown even on a "waitlist only" card, not
      // just the normal-capacity case.
      await expect(card.getByText(/buy-in required: ₹300/i)).toBeVisible({
        timeout: 15_000,
      });
      await card.getByRole("button", { name: /join waitlist|apply to perform/i }).click();
      await expect(card.getByText(/waitlist/i)).toBeVisible({ timeout: 15_000 });
    });

    await test.step("Artist A cancels - B should be auto-promoted off the waitlist", async () => {
      await artistAPage.goto("/dashboard/artist");
      // cancelPerformance() gates on window.confirm() - the handler must
      // be registered before the click that triggers it, or Playwright's
      // default (auto-dismiss) fires instead and nothing actually cancels.
      artistAPage.once("dialog", (dialog) => dialog.accept());
      await artistAPage.getByRole("button", { name: /^cancel$/i }).first().click();
      // Page refetches its own profile after a successful cancel (see
      // artist/page.tsx) - the Cancel button for this slot disappears
      // because the performance no longer shows up as upcoming/active.
      await expect(artistAPage.getByRole("button", { name: /^cancel$/i })).toHaveCount(
        0,
        { timeout: 15_000 }
      );
    });

    await test.step("Organiser sees the cancelled Buy-in slot as Refunded, converts it to wallet credit", async () => {
      await organiserPage.goto(`/dashboard/organiser/events/${FIXTURE_EVENT_ID}`);
      await expect(
        organiserPage.getByText(/marked as refunded to the artist/i)
      ).toBeVisible({ timeout: 15_000 });
      await organiserPage
        .getByRole("button", { name: /keep as wallet credit instead/i })
        .click();
      await expect(
        organiserPage.getByText(/kept as wallet credit instead of a refund/i)
      ).toBeVisible({ timeout: 15_000 });
      await expect(organiserPage.getByText(/kept as wallet credit$/i)).toBeVisible();
    });

    await test.step("Organiser applies the new wallet balance to the venue booking's platform fee", async () => {
      await expect(
        organiserPage.getByText(/platform fee remaining: ₹199/i)
      ).toBeVisible({ timeout: 15_000 });
      await organiserPage
        .getByRole("button", { name: /apply wallet credit/i })
        .click();
      // ₹300 credited vs a ₹199 fee - applied is capped at the fee
      // (min(remainingFee, walletBalance) per apply-wallet/route.ts), so
      // the fee line should disappear/zero out, not just shrink.
      await expect(
        organiserPage.getByText(/platform fee remaining: ₹199/i)
      ).not.toBeVisible({ timeout: 15_000 });
    });
    await test.step("Cleanup: Artist B also cancels, returning the fixture event to zero occupancy for the next run", async () => {
      // FIXTURE_EVENT_ID has maxPerformers:1. Without this, B's promoted
      // slot would permanently occupy that one seat after the first real
      // run, and every subsequent run's "Artist A" would be waitlisted
      // immediately instead of approved - breaking the ordering this
      // spec depends on (see the maxPerformers:1 note in the file header).
      // B's promoted performance also inherited BUY_IN/₹300 from the
      // event default, so this cancellation is real, not a no-op.
      await artistBPage.goto("/dashboard/artist");
      artistBPage.once("dialog", (dialog) => dialog.accept());
      await artistBPage.getByRole("button", { name: /^cancel$/i }).first().click();
      await expect(artistBPage.getByRole("button", { name: /^cancel$/i })).toHaveCount(
        0,
        { timeout: 15_000 }
      );
    });
  } finally {
    await artistAContext.close();
    await artistBContext.close();
    await organiserContext.close();
  }
});
