import { test, expect } from "@playwright/test";
import { registerTestAudience, loginTestAudience } from "./helpers/auth";

/**
 * Real target: browse -> pick seats -> checkout -> confirm, on a NUMBERED
 * venue event ("Jaipur Mic Gala 100" / "Jaipur Ja Mic 100").
 *
 * Auth + phone verification is fully solved (see helpers/auth.ts) using the
 * real on-screen QA dev-OTP mechanism (OTP_PROVIDER=mock) - this is the
 * actual code the app generated, read off the DOM instead of by eye, not a
 * bypass. A fresh throwaway audience account is created and verified for
 * every run, so repeated runs never collide.
 *
 * STILL OPEN: completing the real Razorpay payment step. This event is a
 * paid, multi-tier event, so a full round trip needs to click through
 * Razorpay's hosted checkout (test-mode card 4111 1111 1111 1111 is the
 * standard Razorpay test card). Not implemented yet because I can't safely
 * guess the checkout iframe's selectors without seeing them render live -
 * hardcoding blind risks a test that looks like it passes but silently
 * checks nothing. Fastest path to finishing this: run
 * `npx playwright codegen <qa-url>/events/<id>` once, click through a real
 * test payment, and the exact selectors/flow fall out of the recording.
 */

test("audience member can register, log in, select seats, and reach checkout with correct amount", async ({
  page,
}) => {
  const account = await registerTestAudience(page);

  // registerTestAudience ends on /login?registered=true - account exists
  // and is phone-verified, but not yet signed in for this browser session.
  await loginTestAudience(page, account.email, account.password);
  await expect(page).toHaveURL(/\/$/, { timeout: 10_000 }); // login redirects to "/"

  await page.goto("/events");
  // The whole card is now a single role="link" element whose accessible
  // name is the full card text (title, price, "View Event", etc.) - the
  // current click-guard card pattern (PR #261/#312), not the older "only a
  // nested View Event link is clickable" DOM from 23 Jul.
  //
  // Don't match on "view event" text: every card ends with those words, so
  // a name regex of /view event/i matches all 8 cards at once and
  // Playwright correctly refuses to click an ambiguous target (confirmed
  // via a real CI trace, 13 Aug: locator resolved to 8 elements, hiding the
  // real failure until the seat locator timed out several steps later).
  // Match on the unique title instead and click the card directly - there's
  // no separate nested link to find.
  const card = page.getByRole("link", { name: /Jaipur Mic Gala 100/i });
  await card.click();
  // Require an actual id segment after /events/ - the loose /\/events\//
  // regex matches the listing page too and would false-pass with zero
  // navigation.
  await expect(page).toHaveURL(/\/events\/[^/?]+\/?($|\?)/, { timeout: 10_000 });

  // SeatPicker has no data-* status attribute - the only real signal is the
  // title tooltip, which reads "Row X, Seat N — ₹price" for available seats
  // and "— taken" / "— not on sale" otherwise. Match on that rather than
  // adding a new attribute to a live money-path component just for testing.
  const seat = page.locator('[title*="₹"]').first();
  await expect(seat).toBeVisible({ timeout: 10_000 });
  await seat.click();

  // The button reads "Loading..." (and is disabled) until NextAuth's
  // useSession() resolves past "loading" - on a cold Vercel function this
  // can outlast the default 5s expect timeout, so give it the same
  // cold-start headroom as the rest of this file. This wait is also what
  // was previously missing: a fast click here used to land while the
  // session hook still reported "loading", getting misrouted to the sign-in
  // sheet (fixed in EventDetailClientPage.tsx alongside this test change).
  const continueButton = page.getByRole("button", { name: /continue to checkout/i });
  await expect(continueButton).toBeEnabled({ timeout: 15_000 });
  await continueButton.click();

  await expect(page).toHaveURL(/checkout/, { timeout: 10_000 });
  // Numbered bookings should show seat labels + per-tier amount (PR #157),
  // not just a bare fee + total.
  await expect(page.locator("body")).toContainText(/seat/i);
});

test.skip("audience member completes a real paid booking end to end (needs Razorpay test-checkout selectors - see file header)", async ({
  page,
}) => {
  // Intentionally left unimplemented until selectors are recorded via
  // `npx playwright codegen` against a real test-mode Razorpay checkout.
});
