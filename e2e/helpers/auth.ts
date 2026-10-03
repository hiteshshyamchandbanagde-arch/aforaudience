import { Page, expect } from "@playwright/test";

/**
 * Registers a brand-new AUDIENCE account and completes phone verification
 * inline, using the real QA dev-OTP mechanism (OTP_PROVIDER=mock) - the same
 * "QA Mode — dev OTP: <code>" box a human tester sees, just read
 * programmatically instead of by eye. Not a bypass: this is the actual
 * verification code the app itself generated and would accept from anyone.
 *
 * Ends on /login?registered=true, matching real user behavior.
 *
 * Every call generates a unique phone/email/username so repeated test runs
 * never collide with each other or leave stale duplicate-detection errors.
 */
export async function registerTestAudience(page: Page) {
  const stamp = Date.now().toString().slice(-9); // fits the 10-digit phone slot below
  const phoneDigits = `9${stamp}`.slice(0, 10);
  const username = `e2e_${stamp}`;
  const email = `e2e.${stamp}@example.com`;
  const password = "TestPass123!";
  const fullName = "E2E Test Audience";

  await page.goto("/register");

  await page.locator('input[name="fullName"]').fill(fullName);
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="phoneNumber"]').fill(phoneDigits);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="confirm"]').fill(password);

  await page.getByRole("button", { name: /create account/i }).click();

  // Registration moves to an inline OTP stage on the same page (not a
  // redirect) and renders the dev code directly - read it off the DOM.
  // Generous timeout: the first request of a whole test run can hit a cold
  // Vercel function + Supabase pool wake-up (confirmed via a real run, 22
  // Jul - only the very first request across the whole suite was slow,
  // everything after was fast) - this isn't flakiness to paper over, it's
  // a real property of this environment.
  const devOtpBox = page.getByText(/QA Mode — dev OTP:/i);
  await expect(devOtpBox).toBeVisible({ timeout: 25_000 });
  const devOtpText = await devOtpBox.locator("strong").innerText();
  const code = devOtpText.trim();
  expect(code).toMatch(/^\d{6}$/);

  // The OTP input has no name/id in the source. It used to be matched as
  // "the first input on the page"; since the mobile top bar (Mobile Nav v3)
  // that is the top bar's search box - hidden on desktop, so the fill hung
  // for the whole test timeout, and visible on mobile, so the code was typed
  // into the search (3 Oct 2026 diagnosis). autocomplete="one-time-code" is
  // on this input alone.
  const otpInput = page.locator('input[autocomplete="one-time-code"]');
  await otpInput.fill(code);
  await page.getByRole("button", { name: /verify/i }).click();

  // Next.js appends a trailing slash before the query string here
  // ("/login/?registered=true", confirmed via a real QA run) - allow it.
  await expect(page).toHaveURL(/\/login\/?\?registered=true/, { timeout: 15_000 });

  return { username, email, phone: `+91${phoneDigits}`, password, fullName };
}

/**
 * Logs in via the password path (identifier can be email, phone, username,
 * or AFA code - all resolve the same way server-side).
 */
export async function loginTestAudience(
  page: Page,
  identifier: string,
  password: string
) {
  await page.goto("/login");
  await page.getByPlaceholder(/you@example\.com, phone, username, or AFA code/i).fill(identifier);
  await page.getByPlaceholder(/your password/i).fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expectSignedIn(page);
}

/**
 * Passes once the browser really holds a session. The suite used to check
 * the URL after sign-in with a pattern that also matched /login/ itself
 * (any URL ending in a slash), so it passed before the sign-in had finished
 * and the next page load raced it back to the login page.
 */
export async function expectSignedIn(page: Page) {
  await expect(page).not.toHaveURL(/\/login/,{ timeout: 15_000 });
  await expect
    .poll(async () => {
      const res = await page.request.get("/api/auth/session/");
      const session = (await res.json()) as { user?: unknown };
      return Boolean(session?.user);
    })
    .toBe(true);
}
