import type { Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { PHONE } from "./helpers/viewports";
import { authFile } from "./helpers/personas";
import { markFirstVisitDone } from "./helpers/first-visit";

/**
 * GEN-2609-013 - the phone's bottom tab bar was not one bar: on /tickets
 * and /profile guests got the new bar but signed-in people got
 * DashboardShell's older one (Dashboard / My Tickets / Messages /
 * Profile). Now the same bar shows there for everyone.
 *
 * Since then /events and the other listings got their own Discover bar
 * (src/components/mobile/tabBarRoutes.ts: 'discover'); the unified bar is
 * the 'primary' one, on /, /tickets, /saved and /profile. A signed-out
 * visitor cannot stay on /tickets, /profile or /saved (each sends them
 * to /login once the session has loaded), so the reference is the bar a
 * signed-out visitor sees on /. At 390 x 844, signed in as Atul,
 * /tickets/ and /profile/ show that bar, item for item, and only that
 * bar, where DashboardShell's older bar used to be. Read-only.
 *
 * GEN-2609-017 put the same bar on / too (the homepage stays the phone's
 * landing page): the reference read from / is that bar.
 */

test.use({ viewport: PHONE });

/** Every visible bar fixed to the bottom of the screen, as its links' "label -> href". */
async function bottomBars(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("nav"))
      .filter((nav) => {
        const r = nav.getBoundingClientRect();
        const cs = getComputedStyle(nav);
        return cs.position === "fixed" && cs.display !== "none" && r.height > 0 && Math.abs(r.bottom - window.innerHeight) <= 2;
      })
      .map((nav) =>
        Array.from(nav.querySelectorAll("a[href]")).map(
          (a) => `${(a as HTMLElement).innerText.trim().toLowerCase()} -> ${new URL((a as HTMLAnchorElement).href).pathname.replace(/\/$/, "")}`
        )
      )
  );
}

async function onlyBar(page: Page, path: string) {
  await page.goto(path);
  await expect(page, `${path} is shown, not redirected`).toHaveURL(new URL(path, page.url()).href);
  // Counted and read in one pass: the bar can re-render between two reads.
  let bar: string[] = [];
  await expect
    .poll(
      async () => {
        const bars = await bottomBars(page);
        bar = bars[0] ?? [];
        return bars.length;
      },
      { message: `exactly one bottom bar on ${path}` }
    )
    .toBe(1);
  return bar;
}

test("[GEN-2609-013] [GEN-2609-017] signed in, /tickets/ and /profile/ show the same bottom tab bar a visitor sees on /", async ({
  page,
  browser,
}) => {
  const reference = await onlyBar(page, "/");
  expect(reference.length, "the bar on / has tabs").toBeGreaterThanOrEqual(4);
  expect(reference.join(" | "), "the bar on / is the unified one").toMatch(/tickets -> \/tickets.*profile -> \/profile/);

  const atul = await browser.newContext({ storageState: authFile("atul"), viewport: PHONE, isMobile: true, hasTouch: true });
  await markFirstVisitDone(atul);
  try {
    const signedIn = await atul.newPage();
    for (const path of ["/", "/tickets/", "/profile/"]) {
      expect(await onlyBar(signedIn, path), `Atul: the bar on ${path}`).toEqual(reference);
    }
    // Still there once the page has loaded its data (no late swap to another bar).
    await expect(signedIn.getByRole("main").first()).toBeVisible();
    expect(await onlyBar(signedIn, "/profile/"), "Atul: the bar on /profile/ after load").toEqual(reference);
  } finally {
    await atul.close();
  }
});
