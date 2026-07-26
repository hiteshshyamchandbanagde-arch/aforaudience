import { Page, expect } from "@playwright/test";
import { registerTestAudience } from "./auth";

/**
 * Fixture Organiser, seeded once directly via SQL (not through this test
 * suite - see HANDOFF notes, 23 Jul) specifically so this spec always has
 * a real approved Organiser + a BUY_IN, capacity-capped event + a venue
 * booking with a real platform fee to exercise the cancel -> waitlist ->
 * wallet-credit -> apply-credit chain against. Reused across every run,
 * never recreated per-test - do not delete this Organiser/Event/VenueBooking
 * in QA (`E2E Fixture: Waitlist/Wallet Flow`, ids prefixed `e2efixture`).
 */
export const FIXTURE_ORGANISER = {
  identifier: "e2e.fixture.organiser@example.com",
  password: "E2eFixture!2026",
};
export const FIXTURE_EVENT_ID = "e2efixtureevt00001";
export const FIXTURE_EVENT_TITLE = "E2E Fixture: Waitlist/Wallet Flow";

/**
 * Registers a brand-new throwaway AUDIENCE account (same real flow as
 * registerTestAudience) and immediately upgrades it to Artist via
 * POST /api/artists/apply through the real Profile page UI. Artist has no
 * Admin-approval gate and this is the account's first role, so it flips
 * to ARTIST immediately (see /api/artists/apply route comment) - no
 * separate switch-role step needed.
 */
export async function registerTestArtist(page: Page) {
  const account = await registerTestAudience(page);

  // registerTestAudience ends on /login?registered=true (logged out) -
  // log in for real before hitting the profile upgrade.
  await page.goto("/login");
  await page
    .getByPlaceholder(/you@example\.com, phone, username, or AFA code/i)
    .fill(account.email);
  await page.getByPlaceholder(/your password/i).fill(account.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/(dashboard)?\/?($|\?)/, { timeout: 15_000 });

  await page.goto("/profile");
  await page.getByRole("button", { name: /become an artist/i }).click();
  // No confirmation dialog/redirect - stays on /profile, upgrade
  // reflected in a success message plus session update.
  await expect(page.getByText(/your artist profile is live/i)).toBeVisible({
    timeout: 15_000,
  });

  return account;
}

/**
 * Fixture Venue Owner + approved Numbered venue, seeded once directly via
 * SQL (session 35, 26 Jul - same reasoning as FIXTURE_ORGANISER: building
 * this through the UI would mean either creating/logging into an account
 * with a real password entered in a live browser, or waiting on Admin
 * approval, neither of which this suite can do). Venue starts with 2 real
 * seats (row A, seats 1-2, zone "General") so the seat-map builder loads
 * straight into the canvas view (`effectivePath` resolves to 'canvas'
 * once `seats.length > 0`) instead of the Guided-Setup-vs-Draw-It-Myself
 * choice screen. Reused across every run, never recreated per-test - do
 * not delete (`E2E Fixture: Numbered Venue`, ids prefixed `e2efixturevo`).
 * Every test in this suite interacts with the canvas client-side only and
 * never clicks Save, so nothing here is ever mutated server-side.
 */
export const FIXTURE_VENUE_OWNER = {
  identifier: "e2e.fixture.venueowner@example.com",
  password: "E2eFixtureVO!2026",
};
export const FIXTURE_NUMBERED_VENUE_ID = "e2efixturevo0001ven";

/** Logs in the shared fixture Venue Owner account (see FIXTURE_VENUE_OWNER above). */
export async function loginFixtureVenueOwner(page: Page) {
  await page.goto("/login");
  await page
    .getByPlaceholder(/you@example\.com, phone, username, or AFA code/i)
    .fill(FIXTURE_VENUE_OWNER.identifier);
  await page.getByPlaceholder(/your password/i).fill(FIXTURE_VENUE_OWNER.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  // 25s not 15s - matches registerTestAudience's dev-OTP wait elsewhere in
  // this file: the first request of a whole run can hit a cold Vercel
  // function + Supabase pool wake-up (documented there as a real property
  // of this environment, not flakiness to paper over). Session 35: this
  // exact login, as the first request of several fresh diagnostic runs,
  // failed consistently at 15s and succeeded once warm - cold start, not
  // a real credentials bug.
  await expect(page).toHaveURL(/\/(dashboard)?\/?($|\?)/, { timeout: 25_000 });
}
