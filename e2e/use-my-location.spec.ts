import type { BrowserContext, Locator, Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { useRuleViewport } from "./helpers/viewports";

/**
 * GEN-2610-005 - "Use my location" in the LocationChip picker, at 390
 * (phone project, the top-bar chip) and 1440 (desktop, the chip in the
 * account menu).
 *
 * The browser's position is stubbed (context.setGeolocation plus the
 * geolocation permission, or no permission for the denied case). The
 * nearest city comes from src/lib/nearest-city.ts; its distances are
 * unit-tested in scripts/nearest-city.test.ts.
 *
 *   Pune centre   -> Pune selected
 *   Bandra        -> Mumbai selected (QA's Bandra Basement Stage)
 *   Lonavala      -> "No shows near you yet. Nearest: Pune, 54 km", city kept
 *   denied        -> a short message, city kept
 *   saved Jaipur, GPS in Pune -> "You seem to be in Pune. Switch?" once;
 *                    after Not now it stays away and Jaipur stays
 *
 * Signed out on purpose: a guest's city lives in a cookie of this test's
 * own browser context, so no persona's saved city is touched
 * (docs/testing-rules.md T6).
 */

const PUNE = { latitude: 18.5204, longitude: 73.8567 };
const BANDRA = { latitude: 19.0596, longitude: 72.8295 };
const LONAVALA = { latitude: 18.7546, longitude: 73.4062 };

const USE_MY_LOCATION = "Use my location";
const DENIED_MESSAGE = "Couldn't get your location. Your city is unchanged.";

// The account-menu trigger; `next dev` adds its own aria-haspopup button.
const ACCOUNT_MENU = 'button[aria-haspopup="menu"]:not([data-nextjs-dev-tools-button])';

/** Where the chip lives: the top bar on a phone, the account menu on desktop. */
function chipScope(page: Page, isMobile: boolean): Locator {
  return isMobile ? page.getByRole("banner") : page.getByRole("menu");
}

/** The chip's own button ("Pune ▾"). */
function chip(page: Page, isMobile: boolean): Locator {
  return chipScope(page, isMobile).getByRole("button", { name: /▾/ });
}

/** Opens the picker and returns its "Use my location" row. Retried: a click before hydration does nothing. */
async function openPicker(page: Page, isMobile: boolean): Promise<Locator> {
  const scope = chipScope(page, isMobile);
  if (!isMobile) {
    await expect(async () => {
      if (!(await scope.isVisible())) await page.locator(ACCOUNT_MENU).click();
      await expect(scope).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 15_000 });
  }
  const useRow = scope.getByRole("button", { name: USE_MY_LOCATION });
  await expect(async () => {
    if (!(await useRow.isVisible())) await chip(page, isMobile).click();
    await expect(useRow).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  return useRow;
}

/** The chip's text once the first location request has answered (not the "…" placeholder). */
async function settledChipText(page: Page, isMobile: boolean): Promise<string> {
  if (!isMobile) {
    await expect(async () => {
      if (!(await chipScope(page, isMobile).isVisible())) await page.locator(ACCOUNT_MENU).click();
      await expect(chipScope(page, isMobile)).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 15_000 });
  }
  await expect(chip(page, isMobile)).not.toHaveText(/^…/);
  return ((await chip(page, isMobile).textContent()) ?? "").trim();
}

/** The chip's text for a chosen city: "Pune ▾" (desktop adds a 📍 in front). */
function chipReads(city: string): RegExp {
  return new RegExp(`^(📍)?\\s*${city}\\s*▾$`);
}

async function at(context: BrowserContext, where: { latitude: number; longitude: number }) {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation(where);
}

test.beforeEach(async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
});

test("[GEN-2610-005] in Pune: Use my location selects Pune and /venues relists", async ({ page, context, isMobile }) => {
  await at(context, PUNE);
  await page.goto("/venues");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toBeVisible();

  await (await openPicker(page, isMobile)).click();
  await expect(chip(page, isMobile)).toHaveText(chipReads("Pune"));
  await expect(main.getByText(/^\d+ spaces? in Pune/i)).toBeVisible();

  // A pick, not a guess: it survives a reload (manual cookie).
  await page.reload();
  await expect(main.getByText(/^\d+ spaces? in Pune/i)).toBeVisible();
});

test("[GEN-2610-005] in Bandra: Use my location selects Mumbai, not Pune", async ({ page, context, isMobile }) => {
  await at(context, BANDRA);
  await page.goto("/venues");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toBeVisible();

  await (await openPicker(page, isMobile)).click();
  await expect(chip(page, isMobile)).toHaveText(chipReads("Mumbai"));
  await expect(main.getByText(/^\d+ spaces? in Mumbai/i)).toBeVisible();
  await expect(main.getByText("Bandra Basement Stage").first()).toBeVisible();
});

test("[GEN-2610-005] in Lonavala: no city within 50 km, names Pune at 54 km and keeps the city until Switch", async ({
  page,
  context,
  isMobile,
}) => {
  await at(context, LONAVALA);
  await page.goto("/");
  const before = await settledChipText(page, isMobile);

  await (await openPicker(page, isMobile)).click();
  const status = chipScope(page, isMobile).getByRole("status");
  await expect(status).toContainText("No shows near you yet. Nearest: Pune, 54 km");
  await expect(chip(page, isMobile)).toHaveText(before);

  // Baseline of the open picker with the message (the city list below it
  // is masked: it changes whenever QA gains or loses a venue city).
  const panel = status.locator("..");
  await expect(panel).toHaveScreenshot(`use-my-location-far-${isMobile ? 390 : 1440}.png`, {
    mask: [panel.locator("input + div")],
  });

  await status.getByRole("button", { name: "Switch to Pune" }).click();
  await expect(chip(page, isMobile)).toHaveText(chipReads("Pune"));
});

test("[GEN-2610-005] permission denied: a short message, and the city stays", async ({ page, context, isMobile }) => {
  await context.clearPermissions();
  await context.setGeolocation(PUNE);
  await page.goto("/");
  const before = await settledChipText(page, isMobile);

  await (await openPicker(page, isMobile)).click();
  await expect(chipScope(page, isMobile).getByRole("status")).toHaveText(DENIED_MESSAGE);
  await expect(chip(page, isMobile)).toHaveText(before);
});

test("[GEN-2610-005] saved Jaipur, GPS in Pune: the travel prompt shows once, Not now keeps Jaipur and it stays away", async ({
  page,
  context,
  isMobile,
}) => {
  await at(context, PUNE);
  await page.goto("/");
  await settledChipText(page, isMobile);

  // Save Jaipur the way a person does: pick it from the list.
  await openPicker(page, isMobile);
  await chipScope(page, isMobile).getByRole("button", { name: "Jaipur", exact: true }).click();
  await expect(chip(page, isMobile)).toHaveText(chipReads("Jaipur"));

  // GPS says Pune: ask, never switch on its own.
  await (await openPicker(page, isMobile)).click();
  const status = chipScope(page, isMobile).getByRole("status");
  await expect(status).toContainText("You seem to be in Pune. Switch?");
  await expect(chip(page, isMobile)).toHaveText(chipReads("Jaipur"));
  await expect(status).toHaveScreenshot(`use-my-location-prompt-${isMobile ? 390 : 1440}.png`);
  await status.getByRole("button", { name: "Not now" }).click();
  await expect(chip(page, isMobile)).toHaveText(chipReads("Jaipur"));

  // Tapping again, and again after a reload: no prompt for Pune, Jaipur kept.
  for (const reload of [false, true]) {
    if (reload) await page.reload();
    await (await openPicker(page, isMobile)).click();
    await expect(chipScope(page, isMobile).getByText("You seem to be in Pune. Switch?")).toHaveCount(0);
    await expect(chip(page, isMobile)).toHaveText(chipReads("Jaipur"));
  }
});

test("[GEN-2610-005] saved Jaipur, GPS in Pune: Switch on the travel prompt picks Pune", async ({ page, context, isMobile }) => {
  await at(context, PUNE);
  await page.goto("/");
  await settledChipText(page, isMobile);

  await openPicker(page, isMobile);
  await chipScope(page, isMobile).getByRole("button", { name: "Jaipur", exact: true }).click();
  await expect(chip(page, isMobile)).toHaveText(chipReads("Jaipur"));

  await (await openPicker(page, isMobile)).click();
  const status = chipScope(page, isMobile).getByRole("status");
  await expect(status).toContainText("You seem to be in Pune. Switch?");
  await status.getByRole("button", { name: "Switch", exact: true }).click();
  await expect(chip(page, isMobile)).toHaveText(chipReads("Pune"));
});
