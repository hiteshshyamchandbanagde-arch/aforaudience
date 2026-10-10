import type { BrowserContext, Locator, Page } from "@playwright/test";
import { test, expect, AFTER_WRITE, hideFloatingOverlays } from "./helpers/test";
import { useRuleViewport } from "./helpers/viewports";
import { authFile } from "./helpers/personas";
import { PERSONA_CITIES } from "./helpers/persona-cities";

/**
 * BUG-2610-001 - offline tickets. The install prompt promises "offline
 * tickets", but offline the cached My Tickets page used to redirect to
 * /login (the session fetch fails) and the bookings come from /api, which
 * the service worker never caches. Now the page saves a snapshot of the
 * signed-in user's upcoming confirmed tickets on every online load
 * (src/lib/offline-tickets.ts) and shows it with no network.
 *
 * As Atul, at 390 and 1440: open My Tickets online (twice, so the second
 * load goes through the service worker and its HTML is cached), go
 * offline, reload: still on /tickets/, an offline banner, and his
 * confirmed ticket with its QR drawn on the device. Then sign out with
 * the app's own control: offline My Tickets shows no ticket, only "connect
 * once to save your tickets", and nothing is left in storage.
 *
 * Uses Atul's seeded booking on a fixture event kept upcoming by
 * global-setup (helpers/upcoming-fixtures.ts); nothing is written to the
 * database. Signing out drops the city cookie, so Atul's city is put back
 * afterwards (T6). HUMAN: a real phone in airplane mode; the QR scans.
 */

const BOOKING_ID = "qa-demo-booking-full-atul-4";
const EVENT_TITLE = "Mixed Bag Comedy Lineup";
const SNAPSHOT_KEY = "afa-offline-tickets";
const ACCOUNT_MENU = 'button[aria-haspopup="menu"]:not([data-nextjs-dev-tools-button])';
const ATUL_CITY = PERSONA_CITIES.find((p) => p.persona === "atul")!;

test.use({ storageState: authFile("atul") });

test.afterEach(async ({ context, playwright, baseURL }) => {
  await context.setOffline(false);
  const atul = await playwright.request.newContext({ baseURL, storageState: authFile("atul") });
  try {
    const res = await atul.post("/api/user/location/", { data: { city: ATUL_CITY.city, country: ATUL_CITY.country } });
    expect(res.ok(), `Atul's city put back to ${ATUL_CITY.city}`).toBe(true);
  } finally {
    await atul.dispose();
  }
});

function qr(page: Page): Locator {
  return page.locator(`img[data-afa-ticket-qr="${BOOKING_ID}"]`);
}

/** My Tickets online, until Atul's ticket and its QR are on the page (the snapshot is saved then). */
async function openTicketsOnline(page: Page) {
  await page.goto("/tickets/");
  await expect(qr(page)).toBeVisible(AFTER_WRITE);
}

/** Open once, wait for the service worker to control the page, open again so the HTML is cached. */
async function primeOffline(page: Page) {
  await openTicketsOnline(page);
  await page.waitForFunction(() => navigator.serviceWorker?.ready.then((r) => !!r.active), undefined, { timeout: 30_000 });
  await openTicketsOnline(page);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), SNAPSHOT_KEY)).toContain(BOOKING_ID);
}

async function goOffline(context: BrowserContext, page: Page) {
  await context.setOffline(true);
  await page.goto("/tickets/");
}

test("[BUG-2610-001] offline, My Tickets shows the saved ticket and its QR, not the login page", async ({ page, context, isMobile }) => {
  await useRuleViewport(page, isMobile);
  await primeOffline(page);
  await goOffline(context, page);

  await expect(page.locator("[data-afa-offline-banner]")).toBeVisible();
  await expect(page.locator("[data-afa-offline-banner]")).toHaveText(/You're offline\. Showing your saved tickets, last updated .+\./);
  await expect(qr(page)).toBeVisible();
  await expect(qr(page)).toHaveJSProperty("complete", true);
  expect(await qr(page).evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByText(EVENT_TITLE).first()).toBeVisible();
  // A few seconds on, still here: no redirect to /login.
  await page.waitForTimeout(3_000);
  expect(new URL(page.url()).pathname).toBe("/tickets/");
  // Actions all need the network: none on a saved ticket.
  await expect(page.locator("[data-afa-offline-tickets]").getByRole("button", { name: /cancel ticket/i })).toHaveCount(0);

  const card = page.locator(".afa-tickets-grid > div").filter({ has: qr(page) });
  // The chat button and the phone tab bar sit over the card's lower half.
  await hideFloatingOverlays(page);
  await page.addStyleTag({ content: "[data-afa-tab-bar] { visibility: hidden !important; }" });
  await page.evaluate(() => document.fonts.ready);
  await expect(card).toHaveScreenshot(`offline-ticket-card-${isMobile ? 390 : 1440}.png`, {
    animations: "disabled",
    // The fixture event is re-dated by global-setup; the date line is not the subject.
    mask: [card.locator("span").filter({ hasText: /\d{1,2}:\d{2}/ }).first()],
  });
});

test("[BUG-2610-001] after sign-out, offline My Tickets shows no ticket", async ({ page, context, isMobile }) => {
  await useRuleViewport(page, isMobile);
  await primeOffline(page);

  // Sign out with the app's own control.
  if (!isMobile) {
    const menu = page.getByRole("menu");
    await expect(async () => {
      if (!(await menu.isVisible())) await page.locator(ACCOUNT_MENU).click();
      await expect(menu).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 15_000 });
  }
  await (isMobile ? page.getByRole("banner") : page.getByRole("menu")).getByRole("button", { name: "Sign out", exact: true }).click();
  await expect.poll(() => new URL(page.url()).pathname, AFTER_WRITE).toBe("/");
  expect(await page.evaluate((k) => localStorage.getItem(k), SNAPSHOT_KEY)).toBeNull();

  // Signed out and online: My Tickets still sends you to log in.
  await page.goto("/tickets/");
  await expect.poll(() => new URL(page.url()).pathname, AFTER_WRITE).toBe("/login/");

  await goOffline(context, page);
  const empty = page.locator("[data-afa-offline-empty]");
  await expect(empty).toBeVisible();
  await expect(empty).toContainText("No saved tickets on this device");
  await expect(empty).toContainText("open My Tickets once");
  await expect(page.locator("img[data-afa-ticket-qr]")).toHaveCount(0);
  await expect(page.getByText(EVENT_TITLE)).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  await expect(empty).toHaveScreenshot(`offline-tickets-none-${isMobile ? 390 : 1440}.png`, { animations: "disabled" });
});
