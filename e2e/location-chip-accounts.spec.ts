import type { Locator, Page } from "@playwright/test";
import { test, expect, AFTER_WRITE } from "./helpers/test";
import { useRuleViewport } from "./helpers/viewports";
import { PERSONAS, authFile } from "./helpers/personas";
import { PERSONA_CITIES } from "./helpers/persona-cities";
import { expectSignedIn } from "./helpers/auth";

/**
 * BUG-2610-021 - the city chip kept the previous account's city after a
 * sign-out and a sign-in on the same device: the top bar stays mounted
 * through a client-side sign-in and read /api/user/location only on mount,
 * and the last account's manual city cookie (afa_loc, 90 days) outlived
 * the sign-out. At 390 and 1440.
 *
 * Atul picks Mumbai, signs out (the chip no longer says Mumbai), Hrithik
 * signs in through the login form, and the chip shows Hrithik's account
 * city (Ballari) with no reload. Picking a city signed in saves it to Atul's
 * account, so Atul's city is put back afterwards, pass or fail
 * (docs/testing-rules.md T6; helpers/persona-cities.ts has the values).
 */

const ACCOUNT_MENU = 'button[aria-haspopup="menu"]:not([data-nextjs-dev-tools-button])';
const ATUL_CITY = PERSONA_CITIES.find((p) => p.persona === "atul")!;
const HRITHIK_CITY = PERSONA_CITIES.find((p) => p.persona === "hrithik")!;

test.use({ storageState: authFile("atul") });

/** The chip: in the top bar on a phone, in the account menu (opened here) on desktop. */
async function chip(page: Page, isMobile: boolean): Promise<Locator> {
  if (isMobile) return page.getByRole("banner").getByRole("button", { name: /▾/ });
  const menu = page.getByRole("menu");
  // Retried: a click that lands before the header has hydrated does nothing.
  await expect(async () => {
    if (!(await menu.isVisible())) await page.locator(ACCOUNT_MENU).click();
    await expect(menu).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  return menu.getByRole("button", { name: /▾/ });
}

async function closeMenu(page: Page, isMobile: boolean) {
  if (isMobile) return;
  await page.locator(ACCOUNT_MENU).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
}

test.afterEach(async ({ playwright, baseURL }) => {
  const atul = await playwright.request.newContext({ baseURL, storageState: authFile("atul") });
  try {
    const res = await atul.post("/api/user/location/", { data: { city: ATUL_CITY.city, country: ATUL_CITY.country } });
    expect(res.ok(), `Atul's city put back to ${ATUL_CITY.city}`).toBe(true);
  } finally {
    await atul.dispose();
  }
});

test("[BUG-2610-021] after Atul picks Mumbai and signs out, Hrithik signing in sees his own account city on the chip", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  await page.goto("/events");

  // Atul picks Mumbai.
  const picker = await chip(page, isMobile);
  await expect(picker).not.toHaveText(/…/);
  await picker.click();
  const scope = isMobile ? page.getByRole("banner") : page.getByRole("menu");
  const saved = page.waitForResponse((r) => r.url().endsWith("/api/user/location/") && r.request().method() === "POST", AFTER_WRITE);
  await scope.getByRole("button", { name: "Mumbai", exact: true }).click();
  expect((await saved).ok()).toBe(true);
  await expect(await chip(page, isMobile)).toHaveText(/Mumbai/i);

  // Sign out (the app's own control).
  const signOut = (isMobile ? page.getByRole("banner") : page.getByRole("menu")).getByRole("button", { name: "Sign out", exact: true });
  await signOut.click();
  await expect(page).toHaveURL(/:\d+\/$/, AFTER_WRITE);

  // A guest on this device does not start in Atul's city.
  await page.goto("/events");
  const guestChip = await chip(page, isMobile);
  // Signed out for real: the account's Sign out control is gone.
  await expect((isMobile ? page.getByRole("banner") : page.getByRole("menu")).getByRole("button", { name: "Sign out", exact: true })).toHaveCount(0);
  await expect(guestChip).not.toHaveText(/…/);
  await expect(guestChip).not.toHaveText(/Mumbai/i);
  await closeMenu(page, isMobile);

  // Hrithik signs in through the form; the app moves on client-side.
  await page.goto("/login");
  await page.getByPlaceholder(/you@example\.com, phone, username, or AFA code/i).fill(PERSONAS.hrithik.identifier);
  await page.getByPlaceholder(/your password/i).fill(PERSONAS.hrithik.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expectSignedIn(page);

  const hrithikChip = await chip(page, isMobile);
  await expect(hrithikChip).toHaveText(new RegExp(HRITHIK_CITY.city, "i"));
  await expect(hrithikChip).toHaveScreenshot(`chip-after-account-switch-${isMobile ? 390 : 1440}.png`, { maxDiffPixelRatio: 0.02 });
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("[BUG-2610-021] a client-side sign-in re-reads the chip: a guest's Mumbai gives way to Hrithik's account city", async ({ page, isMobile }) => {
    await useRuleViewport(page, isMobile);
    // A guest's pick lives in a cookie only: no persona's saved city changes.
    await page.goto("/events");
    const picker = await chip(page, isMobile);
    await expect(picker).not.toHaveText(/…/);
    await picker.click();
    const scope = isMobile ? page.getByRole("banner") : page.getByRole("menu");
    const saved = page.waitForResponse((r) => r.url().endsWith("/api/user/location/") && r.request().method() === "POST", AFTER_WRITE);
    await scope.getByRole("button", { name: "Mumbai", exact: true }).click();
    expect((await saved).ok()).toBe(true);
    await expect(await chip(page, isMobile)).toHaveText(/Mumbai/i);
    await closeMenu(page, isMobile);

    // The phone's top bar is mounted on /login too and stays mounted while
    // the form signs in and the app routes on, with no reload. (At 1440 the
    // chip lives in the account menu and mounts when it opens.)
    await page.goto("/login");
    if (isMobile) await expect(await chip(page, isMobile)).toHaveText(/Mumbai/i);
    await page.getByPlaceholder(/you@example\.com, phone, username, or AFA code/i).fill(PERSONAS.hrithik.identifier);
    await page.getByPlaceholder(/your password/i).fill(PERSONAS.hrithik.password);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).not.toHaveURL(/\/login/, AFTER_WRITE);

    await expect(await chip(page, isMobile)).toHaveText(new RegExp(HRITHIK_CITY.city, "i"));
  });
});
