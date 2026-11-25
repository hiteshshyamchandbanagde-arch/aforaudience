import type { Page, Route } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { useRuleViewport } from "./helpers/viewports";

/**
 * BUG-2609-077 - /events sometimes said "0 events" and "No events
 * published yet" while there were events: two loads raced (the All Cities
 * one and the auto-applied city one) and a failed load fell through to the
 * empty state. Since the fix each load is aborted when superseded and a
 * failed load shows "Couldn't load events" with Retry (#719).
 *
 * The slow and failed loads are made here by holding or failing the
 * browser's /api/events request. Signed out; nothing is written.
 */

const NONE_PUBLISHED = "No events published yet";

/** The events list call itself, not /api/events/<id> or /api/events/saved. */
function isEventsList(url: URL) {
  return /^\/api\/events\/?$/.test(url.pathname);
}

/** Any event card: every card is a link holding the event title as an h3. */
function anyEventCard(page: Page) {
  return page.getByRole("link").filter({ has: page.getByRole("heading", { level: 3 }) }).first();
}

/** Records whether "No events published yet" was ever on the page, however briefly. */
async function watchForNonePublished(page: Page) {
  await page.addInitScript((text) => {
    const w = window as unknown as { __nonePublishedSeen?: boolean };
    w.__nonePublishedSeen = false;
    const check = () => {
      if (document.body?.innerText.includes(text)) w.__nonePublishedSeen = true;
    };
    new MutationObserver(check).observe(document, { childList: true, subtree: true, characterData: true });
  }, NONE_PUBLISHED);
  return async () => page.evaluate(() => (window as unknown as { __nonePublishedSeen?: boolean }).__nonePublishedSeen);
}

test.beforeEach(async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
});

test("[BUG-2609-077] /events loads its events and never shows the 'nothing published' state on the way", async ({ page }) => {
  const seenNonePublished = await watchForNonePublished(page);
  await page.goto("/events/");
  await expect(anyEventCard(page)).toBeVisible();
  // The auto-applied city's load can land after the first one: give it time to.
  await page.waitForLoadState("networkidle");
  await expect(anyEventCard(page)).toBeVisible();
  expect(await seenNonePublished(), `"${NONE_PUBLISHED}" appeared while events were loading`).toBe(false);
});

test("[BUG-2609-077] a slow /api/events shows loading, never 'nothing published', then the events", async ({ page }) => {
  const seenNonePublished = await watchForNonePublished(page);
  const held: Route[] = [];
  await page.route(isEventsList, (route) => {
    held.push(route);
  });
  await page.goto("/events/");
  await expect.poll(() => held.length, { message: "the page asked for /api/events" }).toBeGreaterThan(0);
  await expect(page.getByText("Loading events", { exact: false }).first()).toBeVisible();
  await expect(page.getByText(NONE_PUBLISHED)).toHaveCount(0);

  // Let the held requests (and any later ones) through. A load the page
  // superseded meanwhile was aborted by it, so its route is already gone.
  await page.unroute(isEventsList);
  await Promise.all(held.map((route) => route.continue().catch(() => {})));
  await expect(anyEventCard(page)).toBeVisible();
  expect(await seenNonePublished(), `"${NONE_PUBLISHED}" appeared during a slow load`).toBe(false);
});

test("[BUG-2610-009] a slow /api/events never shows a '0 events' count before the events arrive", async ({ page }) => {
  // Watches the whole load, however briefly the count is painted.
  await page.addInitScript(() => {
    const w = window as unknown as { __zeroCountSeen?: string };
    const check = () => {
      const m = document.body?.innerText.match(/\bshowing 0 events\b|\b0 events\b/i);
      if (m && !w.__zeroCountSeen) w.__zeroCountSeen = m[0];
    };
    new MutationObserver(check).observe(document, { childList: true, subtree: true, characterData: true });
  });
  const held: Route[] = [];
  await page.route(isEventsList, (route) => {
    held.push(route);
  });
  await page.goto("/events/");
  await expect.poll(() => held.length, { message: "the page asked for /api/events" }).toBeGreaterThan(0);
  await expect(page.getByText("Loading events", { exact: false }).first()).toBeVisible();
  await expect(page.getByText(/\bshowing \d+ events?\b/i)).toHaveCount(0);

  await page.unroute(isEventsList);
  await Promise.all(held.map((route) => route.continue().catch(() => {})));
  await expect(anyEventCard(page)).toBeVisible();
  // Once the data is in, the count is back and is not 0.
  await expect(page.getByText(/\bshowing [1-9]\d* events?\b/i)).toBeVisible();
  const zeroSeen = await page.evaluate(() => (window as unknown as { __zeroCountSeen?: string }).__zeroCountSeen);
  expect(zeroSeen, `"${zeroSeen}" was on the page before the events arrived`).toBeUndefined();
});

test("[BUG-2609-077] a failed /api/events shows an error with Retry, never 'nothing published'; Retry loads the events", async ({
  page,
}) => {
  const seenNonePublished = await watchForNonePublished(page);
  await page.route(isEventsList, (route) => route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"test"}' }));
  await page.goto("/events/");

  const alert = page.getByRole("alert").filter({ hasText: "Couldn't load events" });
  await expect(alert).toBeVisible();
  await expect(page.getByText(NONE_PUBLISHED)).toHaveCount(0);
  await expect(page.getByText(/\b0 events\b/i)).toHaveCount(0);

  await page.unroute(isEventsList);
  await alert.getByRole("button", { name: "Retry" }).click();
  await expect(anyEventCard(page)).toBeVisible();
  await expect(alert).toHaveCount(0);
  expect(await seenNonePublished(), `"${NONE_PUBLISHED}" appeared after a failed load`).toBe(false);
});
