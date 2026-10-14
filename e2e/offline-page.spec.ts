import type { Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { useRuleViewport } from "./helpers/viewports";

/**
 * BUG-2610-024 - the offline fallback page (Hitesh's phone, 8 Oct) was
 * light cream with a system font; the rest of the app is dark with the AFA
 * fonts, so it read like another product. public/offline.html is now built
 * from a template with the app's tokens and fonts inlined
 * (scripts/build-offline-page.js; scripts/offline-page.test.ts checks the
 * file). This checks what a person sees: the page itself, and the page the
 * service worker actually serves when a navigation fails with no signal.
 *
 * No-auth, read-only. At 390 and 1440, with a screenshot baseline.
 */

test.beforeEach(async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
});

/** Background, text colour and fonts, as rendered. */
async function looks(page: Page) {
  return page.evaluate(async () => {
    await document.fonts.ready;
    const body = getComputedStyle(document.body);
    const h1 = document.querySelector("h1")!;
    return {
      background: body.backgroundColor,
      color: body.color,
      bodyFont: body.fontFamily,
      titleFont: getComputedStyle(h1).fontFamily,
      displayLoaded: document.fonts.check('700 28px "AFA Display"'),
      sansLoaded: document.fonts.check('16px "AFA Sans"'),
    };
  });
}

async function expectOfflinePage(page: Page) {
  await expect(page.getByRole("heading", { level: 1, name: "You're offline" })).toBeVisible();
  await expect(page.getByText("No signal right now — but any tickets you've already opened are still saved for the door.")).toBeVisible();
  // BUG-2610-001 follow-up (14 Oct): a way back to the saved tickets.
  await expect(page.getByRole("link", { name: "Show my saved tickets" })).toHaveAttribute("href", "/tickets/");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByText(/Tip: open your tickets from the "My Tickets" screen/)).toBeVisible();
  const l = await looks(page);
  test.info().annotations.push({ type: "looks", description: JSON.stringify(l) });
  // --afa-surface-page and --afa-text-primary.
  expect(l.background, "dark page surface, not cream").toBe("rgb(20, 20, 20)");
  expect(l.color, "light text").toBe("rgb(245, 245, 240)");
  expect(l.titleFont).toMatch(/^"AFA Display"/);
  expect(l.bodyFont).toMatch(/^"AFA Sans"/);
  expect(l.displayLoaded && l.sansLoaded, "both AFA fonts loaded from the page itself").toBe(true);
}

test("[BUG-2610-024] the offline page uses the dark surface, the AFA fonts, and keeps its copy, Show my saved tickets, Try again and the tip", async ({ page, isMobile }) => {
  await page.goto("/offline.html");
  await expectOfflinePage(page);
  await expect(page).toHaveScreenshot(`offline-page-${isMobile ? 390 : 1440}.png`, { animations: "disabled", fullPage: true });
});

test("[BUG-2610-024] with no signal, a new page shows the restyled offline page from the service worker", async ({ page, context }) => {
  await page.goto("/");
  // The layout registers /sw.js on load; wait until it is active.
  await page.waitForFunction(() => navigator.serviceWorker?.ready.then((r) => !!r.active), undefined, { timeout: 30_000 });
  await context.setOffline(true);
  try {
    await page.goto(`/e2e-offline-probe-${Date.now()}/`);
    await expectOfflinePage(page);
  } finally {
    await context.setOffline(false);
  }
});

// BUG-2610-001 follow-up (14 Oct) - the top banner said "You're offline -
// showing saved content" on every page, true only on My Tickets, and in
// English whatever the language. It is now plain "You're offline" from the
// dictionaries (My Tickets' saved view has its own "showing your saved
// tickets" notice; offline-tickets.spec.ts checks the banner there).
test("[BUG-2610-001] losing signal on the home page: the banner says only You're offline, then Back online", async ({ page, context, isMobile }) => {
  await page.goto("/");
  const banner = page.locator("[data-afa-network-banner]");
  await context.setOffline(true);
  try {
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(banner).toHaveText("You're offline");
    await page.evaluate(() => document.fonts.ready);
    await expect(banner).toHaveScreenshot(`offline-banner-${isMobile ? 390 : 1440}.png`, { animations: "disabled" });
  } finally {
    await context.setOffline(false);
  }
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(banner).toHaveText("Back online");
});
