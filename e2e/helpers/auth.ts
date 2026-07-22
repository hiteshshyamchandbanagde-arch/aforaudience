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

  // The OTP input has no name/id in the source (a bare styled <input>) -
  // it's the only text input visible on this stage, so target it directly.
  const otpInput = page.locator("input").first();
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
}
