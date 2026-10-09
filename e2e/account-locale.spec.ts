import type { Page } from "@playwright/test";
import { test, expect, AFTER_WRITE } from "./helpers/test";
import { useRuleViewport, PHONE, DESKTOP } from "./helpers/viewports";
import { PERSONAS, authFile } from "./helpers/personas";
import { loginTestAudience } from "./helpers/auth";

/**
 * GEN-2610-006 - the language is saved to the account (User.preferredLocale),
 * not just the device. At 390 and 1440.
 *
 * Atul picks मराठी while signed in; a brand-new browser (nothing in its
 * localStorage) signs in as Atul through the login form and renders Marathi
 * without being told. Atul's account language is put back to "none" at the
 * end, pass or fail (docs/testing-rules.md T6): every other Atul spec expects
 * English.
 *
 * Labels are literals on purpose (see marathi-locale.spec.ts).
 */

const LOCALE_STORAGE_KEY = "afa-locale";
const ACCOUNT_MENU = 'button[aria-haspopup="menu"]:not([data-nextjs-dev-tools-button])';
// mr.ts nav.events (desktop header) / nav.tabDiscover (phone tab bar).
const MARATHI_NAV_LABEL = { desktop: "इव्हेंट्स", phone: "शोधा" };

test.use({ storageState: authFile("atul") });

async function pickMarathi(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole("banner").getByRole("button", { name: "Language", exact: true }).click();
    await page.getByRole("banner").getByRole("button", { name: "मराठी", exact: true }).click();
  } else {
    await page.locator(ACCOUNT_MENU).click();
    await page.getByRole("menu").getByRole("button", { name: "MR", exact: true }).click();
  }
}

async function accountLocale(page: Page): Promise<string | null> {
  const res = await page.request.get("/api/users/me/");
  expect(res.ok()).toBe(true);
  return ((await res.json()) as { user: { preferredLocale: string | null } }).user.preferredLocale;
}

test.afterEach(async ({ page }) => {
  const res = await page.request.patch("/api/users/me/", { data: { preferredLocale: null } });
  expect(res.ok(), "Atul's account language put back").toBe(true);
});

test("[GEN-2610-006] a language picked while signed in follows the account to a new browser", async ({ page, isMobile, newContext }) => {
  await useRuleViewport(page, isMobile);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  const saved = page.waitForResponse((r) => r.url().endsWith("/api/users/me/") && r.request().method() === "PATCH", AFTER_WRITE);
  await pickMarathi(page, isMobile);
  expect((await saved).ok(), "the pick is saved to the account").toBe(true);
  expect(await accountLocale(page)).toBe("mr");

  // A new device: no session, nothing in localStorage.
  const { userAgent, deviceScaleFactor, hasTouch } = test.info().project.use;
  const fresh = await newContext({ storageState: { cookies: [], origins: [] }, viewport: isMobile ? PHONE : DESKTOP, userAgent, deviceScaleFactor, isMobile, hasTouch });
  const other = await fresh.newPage();
  await other.goto("/");
  await expect(other.locator("html")).toHaveAttribute("lang", "en");

  await loginTestAudience(other, PERSONAS.atul.identifier, PERSONAS.atul.password);
  await expect(other.locator("html")).toHaveAttribute("lang", "mr");
  const label = isMobile ? MARATHI_NAV_LABEL.phone : MARATHI_NAV_LABEL.desktop;
  await expect(other.locator("nav:visible").getByText(label, { exact: true }).first()).toBeVisible();
  // Mirrored to the device, so it holds before the session loads next time.
  expect(await other.evaluate((key) => window.localStorage.getItem(key), LOCALE_STORAGE_KEY)).toBe("mr");
});

test("[GEN-2610-006] the account value wins over the device on session load; a null account keeps the device's choice", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);

  // Null account value: the device's Hindi stands, nothing is written.
  expect(await accountLocale(page)).toBeNull();
  await page.addInitScript((key) => {
    if (!sessionStorage.getItem("afa-test-seeded")) {
      localStorage.setItem(key, "hi");
      sessionStorage.setItem("afa-test-seeded", "1");
    }
  }, LOCALE_STORAGE_KEY);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  expect(await accountLocale(page)).toBeNull();

  // Account says Marathi, device says Hindi: the account wins on load.
  const res = await page.request.patch("/api/users/me/", { data: { preferredLocale: "mr" } });
  expect(res.ok()).toBe(true);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "mr");
  expect(await page.evaluate((key) => window.localStorage.getItem(key), LOCALE_STORAGE_KEY)).toBe("mr");
});

test("[GEN-2610-006] the server only accepts an offered language", async ({ page }) => {
  for (const bad of ["xx", "MR", 7, ""]) {
    const res = await page.request.patch("/api/users/me/", { data: { preferredLocale: bad } });
    expect(res.status(), `preferredLocale ${JSON.stringify(bad)} is refused`).toBe(400);
  }
  expect(await accountLocale(page)).toBeNull();
});
