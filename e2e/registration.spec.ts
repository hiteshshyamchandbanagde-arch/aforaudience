// Deliberately the untouched Playwright `test`, not helpers/test: this is
// the one spec that meets the app as a first-time visitor, with none of the
// first-visit state pre-set (see helpers/first-visit.ts).
import { test, expect } from "@playwright/test";
import { registerTestAudience, loginTestAudience } from "./helpers/auth";
import { JAIPUR_EVENT_TITLE, openEventFromListing } from "./helpers/events";
import { deleteRegisteredTestUsers } from "./helpers/cleanup";

/**
 * A brand-new visitor's whole first run, on a NUMBERED venue event
 * ("Jaipur Mic Gala 100"):
 *
 *   intro splash -> register -> phone OTP -> sign in -> welcome sequence
 *   -> browse -> pick a seat -> checkout.
 *
 * Auth + phone verification use the real on-screen QA dev-OTP mechanism
 * (OTP_PROVIDER=mock) - the actual code the app generated, read off the DOM
 * instead of by eye, not a bypass (see helpers/auth.ts).
 *
 * This is the only spec that registers an account. Every account it creates
 * is deleted in afterAll, by its unique email (helpers/cleanup.ts).
 *
 * STILL OPEN: completing the real Razorpay payment. This event is paid, so
 * a full round trip has to click through Razorpay's hosted checkout, whose
 * iframe selectors can't be guessed blind. The flow stops at the checkout
 * page with the right seat and amount.
 */

const registeredEmails: string[] = [];

test.afterAll(async () => {
  await deleteRegisteredTestUsers(registeredEmails);
});

test("first visit: the intro splash plays once, then gets out of the way", async ({ page }) => {
  await page.goto("/");
  const splash = page.locator("#intro-splash");
  await expect(splash).toBeVisible();
  // ~2.5 s of animation, then display:none - nothing may stay on top of the page.
  await expect(splash).toBeHidden();
  await expect(page.getByRole("link", { name: /find tonight's show/i })).toBeVisible();

  // Same tab, second load: the splash does not play again.
  await page.reload();
  await expect(splash).toBeHidden();
});

test("new audience member registers, verifies, signs in, passes the welcome sequence, picks a seat and reaches checkout", async ({
  page,
  isMobile,
}) => {
  const account = await test.step("Register and verify the phone with the QA dev OTP", async () => {
    const created = await registerTestAudience(page);
    registeredEmails.push(created.email);
    return created;
  });

  await test.step("Sign in", async () => {
    // registerTestAudience ends on /login?registered=true - the account
    // exists and is phone-verified, but this browser is not signed in yet.
    await loginTestAudience(page, account.email, account.password);
  });

  await test.step("Welcome sequence: shown once, every step has a way through", async () => {
    await expect(page.getByRole("heading", { name: /welcome to aforaudience/i })).toBeVisible();
    await page.getByRole("button", { name: /^get started$/i }).click();

    // Step 2: registration already verified the phone, so there is nothing
    // to enter - just an acknowledgment and a way on.
    await expect(page.getByRole("heading", { name: /verify your phone/i })).toBeVisible();
    await page.getByRole("button", { name: /^continue/i }).click();

    // Step 3 (notifications) only shows when the browser can still be
    // asked; it steps itself over otherwise. Either way step 4 follows.
    const allSet = page.getByRole("heading", { name: /you're all set/i });
    const notNow = page.getByRole("button", { name: /^not now$/i });
    await expect(allSet.or(notNow).first()).toBeVisible();
    if (!(await allSet.isVisible())) await notNow.click();
    await expect(allSet).toBeVisible();

    await page.getByRole("button", { name: /start browsing events/i }).click();
    await expect(page).toHaveURL(/\/events\/?($|\?)/);
    await expect(page.getByRole("heading", { name: /welcome to aforaudience/i })).toBeHidden();
  });

  await test.step("The welcome sequence does not come back on the next page", async () => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /find tonight's show/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /welcome to aforaudience/i })).toBeHidden();
  });

  const seat = await test.step("Open the numbered-seat event and pick a seat", async () => {
    await openEventFromListing(page, JAIPUR_EVENT_TITLE, isMobile);

    // The seat map is its own page since Mobile Phase 2 (GEN-2609-004); the
    // detail page links to it. Mobile renders the link twice (in the page
    // and in the sticky bar), both to the same place.
    await page.getByRole("link", { name: /select tickets/i }).first().click();
    await expect(page).toHaveURL(/\/events\/[^/]+\/seats\/?/);

    // SeatPicker has no data-* status attribute - the only real signal is the
    // title tooltip, which reads "Row X, Seat N — ₹price" for available seats
    // and "— taken" / "— not on sale" otherwise. Match on that rather than
    // adding a new attribute to a live money-path component just for testing.
    const firstFree = page.locator('[title*="₹"]').first();
    await expect(firstFree).toBeVisible();
    const title = (await firstFree.getAttribute("title")) ?? "";
    const parsed = title.match(/^Row (\S+), Seat (\d+) — ₹(\d+)$/);
    expect(parsed, `seat tooltip "${title}"`).not.toBeNull();
    await firstFree.click();
    return { label: `${parsed![1]}${parsed![2]}`, price: Number(parsed![3]) };
  });

  await test.step("Continue to checkout: seat and amount carried over", async () => {
    // The button reads "Loading..." (and is disabled) until NextAuth's
    // useSession() resolves past "loading"; a click before that used to be
    // misrouted to the sign-in sheet.
    const continueButton = page.getByRole("button", { name: /continue to checkout/i });
    await expect(continueButton).toBeEnabled({ timeout: 15_000 });
    await continueButton.click();

    await expect(page).toHaveURL(/\/checkout\//,{ timeout: 15_000 });
    // Numbered bookings show the seat label + per-tier amount (PR #157), not
    // just a bare fee + total.
    const main = page.locator("main");
    await expect(main).toContainText(seat.label);
    await expect(main).toContainText(`₹${seat.price}`);
  });
});
