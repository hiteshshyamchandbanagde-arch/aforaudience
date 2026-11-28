import type { Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { useRuleViewport } from "./helpers/viewports";

/**
 * Prod nit (27 Nov): with PlatformSettings.smsOtpEnabled OFF (prod), the
 * "Used to verify your account with a one-time code." hint under Mobile
 * number flashed on /register: the form started with the flag ON and only
 * hid the hint once GET /api/auth/sms-otp answered. The flag now starts
 * unknown (null) and the hint shows only once it is known to be ON.
 *
 * The flag request is stubbed and held back, so the test sees the page
 * both before and after it answers. A MutationObserver installed before
 * the page loads records whether the hint EVER reached the DOM, so a flash
 * shorter than any polling interval still fails the test.
 * Signed out, read-only: nothing is submitted, no setting is written.
 */

const HINT = "Used to verify your account with a one-time code.";
const SMS_OTP = /\/api\/auth\/sms-otp\/?(\?.*)?$/;

/** Holds GET /api/auth/sms-otp until release() is called, then answers `enabled`. */
async function holdSmsOtpFlag(page: Page, enabled: boolean) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route(SMS_OTP, async (route) => {
    await gate;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ enabled }) });
  });
  return release;
}

async function watchForHint(page: Page) {
  await page.addInitScript((hint) => {
    const w = window as unknown as { __otpHintSeen?: boolean };
    w.__otpHintSeen = false;
    const check = () => {
      if (document.body?.textContent?.includes(hint)) w.__otpHintSeen = true;
    };
    new MutationObserver(check).observe(document, { childList: true, subtree: true, characterData: true });
    document.addEventListener("DOMContentLoaded", check);
  }, HINT);
}

const hintEverSeen = (page: Page) =>
  page.evaluate(() => (window as unknown as { __otpHintSeen?: boolean }).__otpHintSeen === true);

async function openRegister(page: Page) {
  await page.goto("/register/");
  await expect(page.locator('input[name="phoneNumber"]')).toBeVisible({ timeout: 20_000 });
}

test("[prod-nit 2711] SMS OTP off: the OTP hint never shows on /register, before or after the flag loads", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  await watchForHint(page);
  const release = await holdSmsOtpFlag(page, false);
  await openRegister(page);

  // Before the flag answers: the form is up, the hint is not.
  await expect(page.getByText(HINT)).toHaveCount(0);
  expect(await hintEverSeen(page), "hint reached the DOM before the flag loaded").toBe(false);

  const answered = page.waitForResponse(SMS_OTP);
  release();
  await answered;
  // Give React a moment to apply the flag, then check again.
  await page.waitForTimeout(500);
  await expect(page.getByText(HINT)).toHaveCount(0);
  expect(await hintEverSeen(page), "hint reached the DOM at any point").toBe(false);
});

test("[prod-nit 2711] SMS OTP on: the OTP hint appears once the flag loads", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  const release = await holdSmsOtpFlag(page, true);
  await openRegister(page);
  await expect(page.getByText(HINT)).toHaveCount(0);

  release();
  await expect(page.getByText(HINT)).toBeVisible();
});
