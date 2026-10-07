import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { deleteRegisteredTestUsers } from "./helpers/cleanup";
import { withQaDb } from "./helpers/qa-db";
import { useRuleViewport } from "./helpers/viewports";

/**
 * BUG-2610-017 - the top nudge banners were sticky above the top bar
 * with no background of their own, so scrolled content showed through
 * PhoneVerifyNudge's translucent error-red tint. Decision (7 Oct): the
 * banners scroll away with the page; only the top bar stays pinned, at
 * top 0. PhoneVerifyNudge is one line at 390 on a solid, neutral dark
 * surface ("Verify your phone to book" + orange Verify). OfflineBanner
 * alone stays pinned.
 *
 * Needs an account whose phone is not verified, and no QA persona is one,
 * so (like phone-verify-nudge-i18n.spec.ts) the spec makes a throwaway
 * unverified Audience account in the QA database and deletes it after.
 * @needs-db
 */

const created: string[] = [];

test.afterAll(async () => {
  await deleteRegisteredTestUsers(created);
});

async function signInUnverified(page: Page, baseURL: string | undefined) {
  const stamp = `${Date.now()}${randomBytes(2).readUInt16BE(0)}`;
  const email = `e2e.${stamp}@example.com`;
  const password = randomBytes(18).toString("base64url");
  created.push(email);
  await withQaDb(async (client) =>
    client.query(
      `INSERT INTO "User" (id, name, "displayName", email, password, role, "isVerified", "onboardedAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 'AUDIENCE', false, now(), now())`,
      [`e2enudge${randomBytes(8).toString("hex")}`, `e2e_n${stamp.slice(-12)}`, "E2E Nudge", email, await bcrypt.hash(password, 10)],
    ),
  );
  const csrf = (await (await page.request.get("/api/auth/csrf/")).json()) as { csrfToken: string };
  await page.request.post("/api/auth/callback/credentials/", {
    form: { csrfToken: csrf.csrfToken, identifier: email, password, callbackUrl: baseURL ?? "/", json: "true" },
    maxRedirects: 0,
  });
}

/** The pinned top bar: MobileTopBar's <header> at 390, SiteNav's <nav> at 1440. */
function topBar(page: Page, isMobile: boolean): Locator {
  return isMobile ? page.locator("header.lg\\:hidden") : page.locator("nav.sitenav-root");
}

async function opaqueBackground(locator: Locator) {
  return locator.evaluate((el) => {
    const c = getComputedStyle(el).backgroundColor;
    const [r, g, b, a = 1] = (c.match(/[\d.]+/g) ?? []).map(Number);
    return { r, g, b, a };
  });
}

test("[BUG-2610-017] phone-verify banner: one line, solid neutral surface, short copy, orange Verify @needs-db", async ({ page, isMobile, baseURL }) => {
  await useRuleViewport(page, isMobile);
  await signInUnverified(page, baseURL);
  await page.goto("/events/");

  const banner = page.getByRole("status", { name: "Verify your phone", exact: true });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("Verify your phone to book");
  const verify = banner.getByRole("link", { name: "Verify", exact: true });
  await expect(verify).toHaveAttribute("href", /^\/verify-phone\/?\?next=/);

  const box = (await banner.boundingBox())!;
  expect(box.height, "one line").toBeLessThan(52);
  const bg = await opaqueBackground(banner);
  expect(bg.a, "solid, nothing shows through").toBe(1);
  expect(bg.r - bg.g, "neutral, not error red").toBeLessThan(20);
  await expect(banner).toHaveScreenshot(`phone-verify-nudge-${isMobile ? 390 : 1440}.png`, { maxDiffPixelRatio: 0.02 });
});

test("[BUG-2610-017] on scroll the banner goes and the top bar sits at top 0 with nothing bleeding through @needs-db", async ({ page, isMobile, baseURL }) => {
  await useRuleViewport(page, isMobile);
  await signInUnverified(page, baseURL);
  await page.goto("/events/");
  const banner = page.getByRole("status", { name: "Verify your phone", exact: true });
  await expect(banner).toBeVisible();
  const bar = topBar(page, isMobile);
  await expect(bar).toBeVisible();

  // Far enough that a banner in the flow (under 52 px) is off screen.
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(120);

  const bannerBox = await banner.boundingBox();
  expect(bannerBox === null || bannerBox.y + bannerBox.height <= 0, "the banner scrolled away").toBe(true);
  await expect.poll(async () => Math.round((await bar.boundingBox())!.y), { message: "top bar pinned at 0" }).toBe(0);

  // What a tap at the top of the screen hits is the top bar, not a banner
  // or page content showing through above it.
  const hits = await page.evaluate(() => {
    const out: string[] = [];
    for (const x of [8, window.innerWidth / 2, window.innerWidth - 8]) {
      const el = document.elementFromPoint(x, 4);
      out.push(el?.closest("header, nav.sitenav-root") ? "top bar" : `<${el?.tagName.toLowerCase()}>`);
    }
    return out;
  });
  expect(hits).toEqual(["top bar", "top bar", "top bar"]);
});

test("[BUG-2610-017] the offline banner stays pinned while the page scrolls @needs-db", async ({ page, context, isMobile, baseURL }) => {
  await useRuleViewport(page, isMobile);
  await signInUnverified(page, baseURL);
  await page.goto("/events/");
  await expect(page.getByRole("status", { name: "Verify your phone", exact: true })).toBeVisible();

  await context.setOffline(true);
  const offline = page.getByText("You're offline — showing saved content");
  await expect(offline).toBeVisible();
  // Far enough that a banner in the flow (under 52 px) is off screen.
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(120);
  await expect.poll(async () => Math.round((await offline.boundingBox())!.y), { message: "offline banner pinned at 0" }).toBe(0);
  await context.setOffline(false);
});
