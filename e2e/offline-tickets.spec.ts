import type { BrowserContext, Locator, Page } from "@playwright/test";
import jsQR from "jsqr";
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
 * As Atul, at 390 and 1440, the way a phone gets there (reopened 13 Oct:
 * the old spec used page.goto, a full load, which was the only path that
 * cached the HTML): open home, tap the Tickets tab (the header's My
 * Tickets icon at 1440) - a client-side navigation - wait for the
 * snapshot, go offline, open My Tickets afresh: his saved ticket with its
 * QR drawn on the device, an offline banner, no actions - not
 * /offline.html. With the page open, losing signal switches it to the
 * saved view and getting it back returns the live one. Then sign out with
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

/** The QR on Atul's ticket card: TicketQr draws it on the device as a PNG data URL. */
function qr(page: Page): Locator {
  return page.locator(".afa-tickets-grid > div").filter({ hasText: EVENT_TITLE }).locator('img[src^="data:image/png"]');
}

/** What the QR image says, read from its pixels. */
async function decodeQr(img: Locator): Promise<string | null> {
  await expect(img).toHaveJSProperty("complete", true);
  const { width, height, data } = await img.evaluate((el) => {
    const image = el as HTMLImageElement;
    const canvas = document.createElement("canvas");
    // A white margin, so the finder patterns are found.
    canvas.width = image.naturalWidth + 40;
    canvas.height = image.naturalHeight + 40;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 20, 20);
    const px = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return { width: px.width, height: px.height, data: Array.from(px.data) };
  });
  return jsQR(Uint8ClampedArray.from(data), width, height)?.data ?? null;
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
}

/** The ticket's actions, which all need the network. */
function actions(page: Page): Locator {
  return page.locator(".afa-tickets-grid > div").filter({ hasText: EVENT_TITLE }).getByText(/^(Download PDF|Message Organiser|Cancel ticket)$/);
}

/**
 * Home, then My Tickets by tapping the tab (the header icon at 1440): a
 * client-side navigation, as on a phone. Waits until the snapshot is saved
 * and the worker has the page's HTML, then a full load never happened.
 */
async function openTicketsByTab(page: Page, isMobile: boolean) {
  await page.goto("/");
  await page.waitForFunction(() => navigator.serviceWorker?.ready.then((r) => !!r.active), undefined, { timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.evaluate(() => ((window as unknown as { __afaSameDocument: boolean }).__afaSameDocument = true));
  await page.locator(isMobile ? '[data-afa-tab-bar] [data-afa-tab="tickets"]' : 'a.sitenav-icon-link[href^="/tickets"]').click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/tickets/");
  await expect(qr(page)).toBeVisible(AFTER_WRITE);
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), SNAPSHOT_KEY)).toContain(BOOKING_ID);
  expect(await page.evaluate(() => (window as unknown as { __afaSameDocument?: boolean }).__afaSameDocument), "a tab tap, not a page load").toBe(true);
  // The worker caches the HTML in the background. A build without the
  // fix never does; the offline open below then shows what Hitesh saw.
  await page
    .waitForFunction(async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith("afora-runtime-") && (await (await caches.open(key)).match("/tickets/", { ignoreVary: true }))) return true;
      }
      return false;
    }, undefined, { timeout: 15_000, polling: 500 })
    .catch(() => {});
}

async function goOffline(context: BrowserContext, page: Page) {
  await context.setOffline(true);
  await page.goto("/tickets/");
}

test("[BUG-2610-001] reached by the Tickets tab, offline My Tickets reopens with the saved ticket and its QR", async ({ context, isMobile }) => {
  const first = await context.newPage();
  await useRuleViewport(first, isMobile);
  await openTicketsByTab(first, isMobile);

  // Airplane mode, the tab closed, My Tickets opened again.
  await context.setOffline(true);
  await first.close();
  const page = await context.newPage();
  await useRuleViewport(page, isMobile);
  await page.goto("/tickets/");
  await expect(page.locator("[data-afa-offline-tickets]"), "the saved tickets, not /offline.html").toBeVisible(AFTER_WRITE);

  // A few seconds on, still here: no redirect to /login (the bug).
  await page.waitForTimeout(3_000);
  expect(new URL(page.url()).pathname).toBe("/tickets/");
  await expect(page.locator("[data-afa-offline-banner]")).toBeVisible();
  await expect(page.locator("[data-afa-offline-banner]")).toHaveText(/You're offline\. Showing your saved tickets, last updated .+\./);
  await expect(qr(page)).toBeVisible();
  expect(await decodeQr(qr(page)), "the QR is the booking id, as at the door").toBe(BOOKING_ID);
  await expect(page.getByText(EVENT_TITLE).first()).toBeVisible();
  // Actions all need the network: none on a saved ticket.
  await expect(actions(page)).toHaveCount(0);

  const card = page.locator(".afa-tickets-grid > div").filter({ hasText: EVENT_TITLE });
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
  // The snapshot is there, so its absence after sign-out means something.
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), SNAPSHOT_KEY)).toContain(BOOKING_ID);

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
  await expect(page.locator('img[src^="data:image/png"]')).toHaveCount(0);
  await expect(page.getByText(EVENT_TITLE)).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  await expect(empty).toHaveScreenshot(`offline-tickets-none-${isMobile ? 390 : 1440}.png`, { animations: "disabled" });
});

test("[BUG-2610-001] losing signal with My Tickets open switches to the saved view, and back", async ({ page, context, isMobile }) => {
  await useRuleViewport(page, isMobile);
  await openTicketsOnline(page);
  await expect(actions(page).first()).toBeVisible();
  await expect(page.locator("[data-afa-offline-banner]")).toHaveCount(0);

  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.locator("[data-afa-offline-banner]")).toHaveText(/You're offline\. Showing your saved tickets, last updated .+\./);
  await expect(qr(page)).toBeVisible();
  await expect(actions(page)).toHaveCount(0);

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator("[data-afa-offline-banner]")).toHaveCount(0, AFTER_WRITE);
  await expect(actions(page).first()).toBeVisible(AFTER_WRITE);
  await expect(qr(page)).toBeVisible();
});
