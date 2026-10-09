import type { Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { PHONE } from "./helpers/viewports";

/**
 * GEN-2609-002: Register on a ~1440x864 laptop window. The form was 171 px
 * taller than the window (1035 px; 1140 px with the Google button), so the
 * whole page scrolled. On desktop, Register's AuthLayout is `compact`: no
 * page padding (sm:py-16 had outranked lg:p-0: 64 px above and below),
 * 24 px column padding instead of 64, and tighter gaps inside the form
 * (.afa-auth-compact in globals.css). Nothing removed or reordered.
 *
 *   - 1440x864: with the Google button off, the page fits the window. The
 *     Google button and its "or" divider (when QA has them on) are the only
 *     thing allowed to add height; that part scrolls with the page.
 *   - Never an inner scroll box: no element in the form scrolls by itself.
 *   - Field order unchanged.
 *   - 390: the phone layout is untouched (the compact gaps are desktop-only).
 *   - Login keeps its 64 px desktop padding.
 * Signed out, read-only: nothing is submitted.
 */

const LAPTOP = { width: 1440, height: 864 };
const FIELD_ORDER = ["fullName", "username", "email", "phoneNumber", "password", "confirm"];

// Overlays that are not the form: the phone top bar (fixed; it shows the
// visitor's located city), the chat button, and a Vercel preview's toolbar.
// Hidden just before the screenshot (the page is not used afterwards, or
// is navigated away from).
const HIDE_OVERLAYS = "header, .afa-support-chat-btn, vercel-live-feedback { visibility: hidden !important; }";

async function openRegister(page: Page) {
  await page.goto("/register/");
  await expect(page.locator('input[name="confirm"]')).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
}

async function fieldOrder(page: Page) {
  return page.locator("main input[name]").evaluateAll((els) => els.map((el) => el.getAttribute("name")).filter((n) => n !== null));
}

/** Elements inside <main> that scroll on their own (an inner scroll box). */
async function innerScrollBoxes(page: Page) {
  return page.locator("main").evaluate((main) =>
    [main, ...Array.from(main.querySelectorAll("*"))]
      .filter((el) => {
        const s = getComputedStyle(el);
        return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1;
      })
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 80))
  );
}

test("[GEN-2609-002] Register fits a 1440x864 window (phone layout unchanged at 390); no inner scroll box; field order unchanged", async ({ page, isMobile }) => {
  if (isMobile) {
    await page.setViewportSize(PHONE);
    await openRegister(page);
    expect(await fieldOrder(page), "fields in their usual order").toEqual(FIELD_ORDER);
    expect(await innerScrollBoxes(page), "no inner scroll box").toEqual([]);
    // The compact gaps are desktop-only: the phone card keeps its 40 px padding.
    const card = page.locator('main input[name="fullName"]').locator("xpath=ancestor::div[contains(@style, 'border-radius')][1]");
    expect(await card.evaluate((el) => getComputedStyle(el).paddingTop), "phone card padding unchanged").toBe("40px");
    await page.addStyleTag({ content: HIDE_OVERLAYS });
    await expect(card).toHaveScreenshot("register-card-390.png", { animations: "disabled" });
    return;
  }

  await page.setViewportSize(LAPTOP);
  await openRegister(page);

  expect(await fieldOrder(page), "fields in their usual order").toEqual(FIELD_ORDER);
  expect(await innerScrollBoxes(page), "no inner scroll box").toEqual([]);

  const m = await page.evaluate(() => {
    const google = Array.from(document.querySelectorAll("main button")).find((b) => /google/i.test(b.textContent || ""));
    // The Google button plus the "or" divider after it, margins included.
    let googleBlock = 0;
    if (google) {
      const divider = google.nextElementSibling as HTMLElement | null;
      const top = google.getBoundingClientRect().top;
      const bottom = divider ? divider.getBoundingClientRect().bottom + parseFloat(getComputedStyle(divider).marginBottom) : google.getBoundingClientRect().bottom;
      googleBlock = bottom - top;
    }
    return { page: document.documentElement.scrollHeight, window: innerHeight, googleBlock: Math.ceil(googleBlock) };
  });
  test.info().annotations.push({ type: "register height", description: JSON.stringify(m) });
  expect(m.page - m.googleBlock, `form fits ${LAPTOP.height} px (page ${m.page}, Google block ${m.googleBlock})`).toBeLessThanOrEqual(m.window);

  // With the Google button off, Create Account is on screen without scrolling.
  if (m.googleBlock === 0) {
    await expect(page.getByRole("button", { name: "Create Account", exact: true })).toBeInViewport({ ratio: 1 });
  }

  // Desktop spacing really is the compact set.
  const column = page.locator("main > div").first();
  expect(await column.evaluate((el) => getComputedStyle(el).paddingTop), "Register column padding").toBe("24px");
  await page.addStyleTag({ content: HIDE_OVERLAYS });
  await expect(column).toHaveScreenshot("register-1440x864.png", { animations: "disabled" });

  // Login keeps the usual 64 px.
  await page.goto("/login/");
  await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 20_000 });
  expect(await page.locator("main > div").first().evaluate((el) => getComputedStyle(el).paddingTop), "Login unchanged").toBe("64px");
});
