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

/** Logs in the shared fixture Organiser account (see FIXTURE_ORGANISER above). */
export async function loginFixtureOrganiser(page: Page) {
  await page.goto("/login");
  await page
    .getByPlaceholder(/you@example\.com, phone, username, or AFA code/i)
    .fill(FIXTURE_ORGANISER.identifier);
  await page.getByPlaceholder(/your password/i).fill(FIXTURE_ORGANISER.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/(dashboard)?\/?($|\?)/, { timeout: 15_000 });
}
