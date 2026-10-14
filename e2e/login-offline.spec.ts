import { test, expect } from "./helpers/test";
import { useRuleViewport } from "./helpers/viewports";

/**
 * BUG-2610-001 follow-up (Hitesh's phone, 14 Oct) - signing in with no
 * signal said "Could not send code.", which reads like the server's fault.
 * With the device offline, Send code and Sign in now say so and what to
 * do (src/lib/network-error.ts; verify-phone and the welcome sequence
 * share the same message through useOtpVerification).
 *
 * Signed out, no account touched: the page is loaded online, then the
 * network goes, so no request (and no SMS or email) ever leaves. The
 * identifier is a made-up address and the password a dummy. 390 and 1440.
 */

const OFFLINE_CODE = "You're offline. Connect to the internet to get your code.";
const OFFLINE_SIGN_IN = "You're offline. Connect to the internet to sign in.";

test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  await page.goto("/login/");
  await expect(page.locator('input[name="username"]')).toBeVisible();
});

test.afterEach(async ({ context }) => {
  await context.setOffline(false);
});

test("[BUG-2610-001] offline, Send code says you're offline, not Could not send code", async ({ page, context }) => {
  await page.getByRole("button", { name: "Use OTP instead" }).click();
  await page.locator('input[name="username"]').fill("offline-check@example.com");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByText(OFFLINE_CODE, { exact: true })).toBeVisible();
  await expect(page.getByText("Could not send code.")).toHaveCount(0);
});

test("[BUG-2610-001] offline, password Sign in says you're offline, not a generic error", async ({ page, context }) => {
  await page.locator('input[name="username"]').fill("offline-check@example.com");
  await page.locator('input[name="password"]').fill("not-a-real-password");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.getByText(OFFLINE_SIGN_IN, { exact: true })).toBeVisible();
  await expect(page.getByText(/Something went wrong|Failed to sign in/)).toHaveCount(0);
});
