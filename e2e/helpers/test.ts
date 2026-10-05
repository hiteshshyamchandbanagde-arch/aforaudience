import { test as base, expect, type BrowserContext, type BrowserContextOptions, type Page } from "@playwright/test";
import { markFirstVisitDone } from "./first-visit";

/**
 * The suite's `test`: same as Playwright's, with the first-visit state
 * already settled (see first-visit.ts), so the intro splash, install
 * banner and nudges never sit on top of what a test clicks.
 *
 * Every spec imports `test` from here. The one exception is
 * first-visit.spec.ts, which tests that first-visit flow itself and so
 * imports the untouched `test` from @playwright/test.
 */
export const test = base.extend<{ newContext: (options?: BrowserContextOptions) => Promise<BrowserContext> }>({
  context: async ({ context }, use) => {
    await markFirstVisitDone(context);
    await use(context);
  },
  /**
   * Another browser context for the test (a second persona, its own
   * viewport), first-visit state settled like `context`. Every one it opened
   * is closed after the test, the way Playwright closes its own `context`.
   *
   * Use this instead of browser.newContext() with `finally { context.close() }`.
   * When a test times out, Playwright closes its contexts while the test's
   * last action is still waiting; that action rejects, the `finally` runs
   * and its close() throws "Target page, context or browser has been
   * closed", which replaces the error that said where the test was stuck
   * (BUG-2610-011 cause 2). Closing here, after the test, leaves that
   * error on the action itself. A test may still close a context early on
   * its success path; a second close() is a no-op.
   */
  newContext: async ({ browser }, use) => {
    const opened: BrowserContext[] = [];
    await use(async (options) => {
      const context = await browser.newContext(options);
      opened.push(context);
      await markFirstVisitDone(context);
      return context;
    });
    await Promise.all(opened.map((context) => context.close()));
  },
});

export { expect };

/**
 * For the assertion that follows a save. On QA a write is slow twice over:
 * the request itself takes 3-4 s, then the page refetches (another 3-4 s)
 * before it shows the result or its toast - about 9 s measured, against a
 * 10 s default. Use this there, and only there: a plain "is it on the
 * page" check keeps the short default so a missing element fails fast.
 */
export const AFTER_WRITE = { timeout: 25_000 };

// BrandLoader.tsx: a 56px copy of the app icon whose three bars pulse.
const BRAND_LOADER = 'svg[width="56"][viewBox="0 0 64 64"]:has(animate)';

/**
 * Opens a dashboard page and waits for its own data to arrive.
 *
 * Dashboard pages render the branded loader (BrandLoader: the animated
 * three-bar logo) until their first API call answers. Each API route is its
 * own serverless function, and on a cold one - any route after a quiet
 * spell, and every route on a fresh preview deployment - that call alone
 * can outlast the 10 s default, which would fail the first assertion on a
 * page that is merely still loading. The loader gets 30 s here; once it is
 * gone, everything after keeps the short default.
 */
export async function gotoDashboard(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator(BRAND_LOADER)).toHaveCount(0, { timeout: 30_000 });
}
