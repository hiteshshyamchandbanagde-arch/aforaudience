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
// L2b (8 Nov 2026): the "Draft — pending legal review ... once the company is
// formally registered" banner was false once the company was registered.
const PLACEHOLDER_TEXT =
  /to be finalized|once registered|placeholder|to be set on publish|to be defined|pending legal review|formally registered/i;
const PAGES = ["/terms/", "/privacy/", "/refund-policy/", "/contact/"];
// The sticky site header, chat button and Vercel toolbar float over the
// content box depending on scroll; they are not part of the page under test.
const HIDE_OVERLAYS = "header, nav, .afa-support-chat-btn, vercel-live-feedback { visibility: hidden !important; }";

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
  await page.addStyleTag({ content: HIDE_OVERLAYS });
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
  await page.addStyleTag({ content: HIDE_OVERLAYS });
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

/**
 * D4 (8 Nov 2026) - launch moves no money through AFA. Priced shows are Pay
 * at entry and Organiser<->Venue Owner / Organiser<->Artist deals are paid
 * directly between the parties. Terms and Refund policy described only
 * online payment and a booking fee; they must now cover both.
 */
test("terms cover pay at entry and direct payments between users", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  await page.goto("/terms/");
  const main = page.locator("main");
  await expect(main).toContainText("Direct payments between users");
  await expect(main).toContainText("pay the Organiser directly at the venue");
});

test("refund page covers pay at entry", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  await page.goto("/refund-policy/");
  const main = page.locator("main");
  await expect(main).toContainText("Pay at entry");
  // The deployed build once dropped the space after </strong> here.
  await expect(main).toContainText("Pay at entry tickets nothing is collected online");
});
