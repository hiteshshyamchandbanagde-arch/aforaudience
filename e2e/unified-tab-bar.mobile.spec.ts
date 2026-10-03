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
 * the 'primary' one, on /, /tickets, /saved and /profile. So the
 * reference is the bar a guest sees on / (/saved sends a guest to sign in): at 390 x 844, /tickets/ and
 * /profile/ show that bar, item for item, and only that bar, signed out
 * and signed in as Atul. Read-only.
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
  await expect.poll(async () => (await bottomBars(page)).length, { message: `exactly one bottom bar on ${path}` }).toBe(1);
  const [bar] = await bottomBars(page);
  return bar;
}

test("[GEN-2609-013] [GEN-2609-017] /tickets/ and /profile/ show the unified bottom tab bar, signed out and signed in", async ({ page, browser }) => {
  const reference = await onlyBar(page, "/");
  expect(reference.length, "the bar on / has tabs").toBeGreaterThanOrEqual(4);
  expect(reference.join(" | "), "the bar on / is the unified one").toMatch(/tickets -> \/tickets.*profile -> \/profile/);

  for (const path of ["/tickets/", "/profile/"]) {
    expect(await onlyBar(page, path), `signed out: the bar on ${path}`).toEqual(reference);
  }

  const atul = await browser.newContext({ storageState: authFile("atul"), viewport: PHONE, isMobile: true, hasTouch: true });
  await markFirstVisitDone(atul);
  try {
    const signedIn = await atul.newPage();
    for (const path of ["/tickets/", "/profile/"]) {
      const bar = await onlyBar(signedIn, path);
      expect(bar, `Atul: the bar on ${path}`).toEqual(reference);
    }
  } finally {
    await atul.close();
  }
});
