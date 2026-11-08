import { test, expect } from "./helpers/test";
import { isTopmostAtCentre, useRuleViewport } from "./helpers/viewports";

/**
 * L2 (8 Nov 2026) - footer legal links for Razorpay website verification.
 * The homepage footer linked only Privacy; Terms, Refund and Contact were
 * not reachable from the site, and the copyright line ("© 2025
 * AforAudience") named no company. The footer must now link all four legal
 * pages (each loading), name Shyamkasturi Productions Private Limited with
 * the 2026 copyright, and keep the company name in Latin script in an Indic
 * locale. Terms must state how tickets are delivered.
 *
 * Guest; nothing is written (the hi locale lives only in this test's
 * localStorage). At 390 and 1440 (one project each).
 */

const COMPANY = "Shyamkasturi Productions Private Limited";
const LEGAL_HREFS = ["/privacy/", "/terms/", "/refund-policy/", "/contact/"];
const LOCALE_STORAGE_KEY = "afa-locale";
// The sticky header, phone tab bar (a <nav>), chat button and Vercel toolbar
// float over the footer depending on scroll; they are not the footer.
const HIDE_OVERLAYS = "header, nav, .afa-support-chat-btn, vercel-live-feedback { visibility: hidden !important; }";

test.use({ storageState: { cookies: [], origins: [] } });

test("homepage footer links every legal page and names the company", async ({ page, request, isMobile }) => {
  await useRuleViewport(page, isMobile);
  await page.goto("/");
  const footer = page.locator("footer").last();
  await footer.scrollIntoViewIfNeeded();
  for (const href of LEGAL_HREFS) {
    const link = footer.locator(`a[href="${href}"]`);
    await expect(link, `footer link ${href}`).toHaveCount(1);
    await expect(link).toBeVisible();
    const res = await request.get(href);
    expect(res.status(), `${href} status`).toBe(200);
  }
  await expect(footer).toContainText(COMPANY);
  await expect(footer).toContainText("© 2026");
  await expect(footer).toContainText(`AforAudience is a product of ${COMPANY}.`);
  await expect(footer).not.toContainText("2025");
  // At the very bottom of the page the company line is not under the phone tab bar.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const productOf = footer.getByText(`AforAudience is a product of ${COMPANY}.`);
  await expect.poll(() => isTopmostAtCentre(productOf)).toBe(true);
  await page.addStyleTag({ content: HIDE_OVERLAYS });
  // Run L2 amend: the footer's height (1147.78 px at 390) and its top on the
  // page are fractional (line-heights like 23.1 px above and inside it), and
  // the top's fraction differs between builds, so the screenshot clip spanned
  // 1148 px on the preview and 1149 px locally. Pin the box to a whole-pixel
  // height and shift it onto the pixel grid (same content, same styles) so
  // the shot always covers the same pixels.
  await footer.evaluate((node: HTMLElement) => {
    const rect = node.getBoundingClientRect();
    const frac = (rect.top + window.scrollY) % 1;
    Object.assign(node.style, {
      boxSizing: "border-box",
      height: `${Math.ceil(rect.height)}px`,
      transform: frac ? `translateY(${-frac}px)` : "none",
    });
  });
  await expect(footer).toHaveScreenshot(`footer-legal-${isMobile ? 390 : 1440}.png`, {
    animations: "disabled",
    maxDiffPixelRatio: 0.02,
  });
});

test("hi footer keeps the company name in Latin script", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  await page.addInitScript(([key]) => window.localStorage.setItem(key, "hi"), [LOCALE_STORAGE_KEY]);
  await page.goto("/");
  // No pre-paint for the locale (translate.tsx): wait for the saved choice to apply.
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  const footer = page.locator("footer").last();
  await expect(footer).toContainText(COMPANY);
  await expect(footer).toContainText("© 2026");
  // Labels are translated: the English labels must not leak into hi.
  await expect(footer.locator('a[href="/terms/"]')).not.toHaveText("Terms of Service");
  await expect(footer.locator('a[href="/refund-policy/"]')).not.toHaveText("Refund & Cancellation");
});

test("terms states how tickets are delivered", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  await page.goto("/terms/");
  const main = page.locator("main");
  await expect(main.getByRole("heading", { name: /Delivery of tickets/ })).toBeVisible();
  await expect(main).toContainText("AforAudience sells no physical goods");
  await expect(main).toContainText("My Tickets");
  await expect(main.locator('a[href="mailto:info@aforaudience.com"]').first()).toBeVisible();
});
