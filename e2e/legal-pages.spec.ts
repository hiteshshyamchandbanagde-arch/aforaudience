import { test, expect } from "./helpers/test";
import { useRuleViewport } from "./helpers/viewports";
import { REFUND_FULL_MIN_DAYS, REFUND_HALF_MIN_DAYS } from "../src/lib/refund-policy";

/**
 * L1 (8 Nov 2026) - legal pages for Razorpay website verification.
 * Terms and Privacy had <Placeholder>s ("once registered", "to be
 * finalized") where the operating company belonged, and there was no
 * Refund or Contact page. Each page must now load, name Shyamkasturi
 * Productions Private Limited and carry no placeholder text; the refund
 * page states the same day tiers the refund API uses (refund-policy.ts).
 *
 * Guest; nothing is written. At 390 and 1440 (one project each).
 */

const COMPANY = "Shyamkasturi Productions Private Limited";
const PLACEHOLDER_TEXT = /to be finalized|once registered|placeholder|to be set on publish|to be defined/i;
const PAGES = ["/terms/", "/privacy/", "/refund-policy/", "/contact/"];

test.use({ storageState: { cookies: [], origins: [] } });

for (const path of PAGES) {
  test(`${path} loads, names the company and has no placeholder text`, async ({ page, isMobile }) => {
    await useRuleViewport(page, isMobile);
    const res = await page.goto(path);
    expect(res?.status(), `${path} status`).toBe(200);
    const body = page.locator("main");
    await expect(body).toContainText(COMPANY);
    expect(await body.innerText()).not.toMatch(PLACEHOLDER_TEXT);
  });
}

test("contact page shows the support email, address and grievance officer", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  await page.goto("/contact/");
  await expect(page.locator('a[href="mailto:info@aforaudience.com"]').first()).toBeVisible();
  await expect(page.locator('a[href="tel:+919225139690"]').first()).toBeVisible();
  await expect(page.locator("address").first()).toContainText("Ravet, Haveli, Pune 412101");
  await expect(page.locator("main")).toContainText("Shyamchand Bangade");
  await expect(page.locator('main a[href="/refund-policy/"]')).toBeVisible();
  const content = page.locator("h1").locator("xpath=..");
  await expect(content).toHaveScreenshot(`contact-${isMobile ? 390 : 1440}.png`, {
    animations: "disabled",
    maxDiffPixelRatio: 0.02,
  });
});

test("refund page states the same day tiers as refund-policy.ts", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  await page.goto("/refund-policy/");
  const main = page.locator("main");
  await expect(main).toContainText(`${REFUND_FULL_MIN_DAYS} days or more before the show`);
  await expect(main).toContainText(`${REFUND_HALF_MIN_DAYS} to ${REFUND_FULL_MIN_DAYS} days before the show`);
  await expect(main).toContainText(`Less than ${REFUND_HALF_MIN_DAYS} days before the show`);
  await expect(main).toContainText("50%");
  await expect(main).toContainText("including the booking fee");
  await expect(main).toContainText("5–7 working days");
  const content = page.locator("h1").locator("xpath=..");
  await expect(content).toHaveScreenshot(`refund-policy-${isMobile ? 390 : 1440}.png`, {
    animations: "disabled",
    maxDiffPixelRatio: 0.02,
  });
});

test("terms links its refund section to /refund-policy/", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  await page.goto("/terms/");
  await expect(page.locator('main a[href="/refund-policy/"]')).toBeVisible();
});
