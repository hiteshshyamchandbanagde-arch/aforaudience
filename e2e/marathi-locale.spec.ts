import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { useRuleViewport } from "./helpers/viewports";

/**
 * GEN-2609-120 - Marathi (मराठी) locale, Pune-first launch. No-auth,
 * read-only, at 390 and 1440.
 *
 * Picks मराठी the way a visitor does (the same two pickers as
 * language-rollout.spec.ts), reloads, and checks the choice held and the
 * nav chrome is Marathi: the Marathi labels are there, no English word is
 * left in a nav, and no label is clipped or wrapped (Marathi strings run
 * longer than English).
 *
 * Expected labels are literals on purpose, not imported from mr.ts: a
 * dictionary edit that changes a nav label has to change this spec too.
 */

const LOCALE_STORAGE_KEY = "afa-locale";

// The account-menu trigger (see language-rollout.spec.ts). `next dev` adds its
// own aria-haspopup button, so a local run leaves that one out.
const ACCOUNT_MENU = 'button[aria-haspopup="menu"]:not([data-nextjs-dev-tools-button])';

// mr.ts nav.* - the desktop header links.
const DESKTOP_NAV = ["इव्हेंट्स", "कलाकार", "ठिकाणे", "वॉल ऑफ फेम"];
// mr.ts nav.tab* / nav.messages / nav.profile - the phone tab bar on "/".
const PHONE_TAB_BAR = ["शोधा", "मेसेज", "तिकिटे", "आवडते", "प्रोफाइल"];
const SIGN_IN = "साइन इन करा";

// Brand and product terms that stay in Latin script in every language.
const LATIN_ALLOWED = new Set(["AforAudience", "AFA", "OTP", "UPI"]);

async function pickMarathi(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole("banner").getByRole("button", { name: "Language", exact: true }).click();
    await page.getByRole("banner").getByRole("button", { name: "मराठी", exact: true }).click();
  } else {
    await page.locator(ACCOUNT_MENU).click();
    await page.getByRole("menu").getByRole("button", { name: "MR", exact: true }).click();
  }
}

/** The navs a visitor can see at this width (the header links at 1440, the tab bar at 390). */
async function visibleNavs(page: Page): Promise<Locator[]> {
  const out: Locator[] = [];
  for (const nav of await page.locator("nav").all()) {
    if (await nav.isVisible()) out.push(nav);
  }
  return out;
}

/** Latin-script words in the element's visible text, minus brand terms. */
async function englishWords(el: Locator): Promise<string[]> {
  const text = await el.innerText();
  return (text.match(/[A-Za-z]{2,}/g) ?? []).filter((w) => !LATIN_ALLOWED.has(w));
}

/** Links/buttons whose label is clipped (wider than its box) or wraps onto a second line. */
async function overflowingLabels(el: Locator): Promise<string[]> {
  return el.evaluate((root) => {
    const bad: string[] = [];
    for (const item of Array.from(root.querySelectorAll<HTMLElement>("a, button"))) {
      if (!item.offsetParent) continue;
      if (item.scrollWidth > item.clientWidth + 1) bad.push(`${item.innerText.trim()} (clipped)`);
      const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const tops = new Set(Array.from(range.getClientRects()).map((r) => Math.round(r.top)));
        if (tops.size > 1) bad.push(`${node.textContent.trim()} (wraps)`);
      }
    }
    return bad;
  });
}

test("[GEN-2609-120] मराठी: picked, survives a reload, nav chrome is Marathi with nothing clipped", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  await page.goto("/");
  await pickMarathi(page, isMobile);

  await expect(page.locator("html")).toHaveAttribute("lang", "mr");
  expect(await page.evaluate((key) => window.localStorage.getItem(key), LOCALE_STORAGE_KEY)).toBe("mr");

  await page.reload();
  // No pre-paint for the locale (translate.tsx): wait for the saved choice to apply.
  await expect(page.locator("html")).toHaveAttribute("lang", "mr");
  // The phone tab bar renders only once the session has loaded.
  const firstLabel = isMobile ? PHONE_TAB_BAR[0] : DESKTOP_NAV[0];
  await expect(page.locator("nav:visible").getByText(firstLabel, { exact: true }).first()).toBeVisible();

  const navs = await visibleNavs(page);
  expect(navs.length, "a nav is visible").toBeGreaterThan(0);
  const navText = (await Promise.all(navs.map((n) => n.innerText()))).join("\n");
  for (const label of isMobile ? PHONE_TAB_BAR : DESKTOP_NAV) {
    expect(navText, `nav shows "${label}"`).toContain(label);
  }

  if (isMobile) {
    await expect(page.getByRole("banner").getByText(SIGN_IN, { exact: true })).toBeVisible();
  } else {
    await page.locator(ACCOUNT_MENU).click();
    await expect(page.getByRole("menu").getByText(SIGN_IN, { exact: true })).toBeVisible();
    await page.locator(ACCOUNT_MENU).click();
    await expect(page.getByRole("menu")).toHaveCount(0);
  }

  for (const nav of navs) {
    expect(await englishWords(nav), "English left in a nav").toEqual([]);
    expect(await overflowingLabels(nav), "nav labels clipped or wrapped").toEqual([]);
  }

  // Baseline: the nav a visitor sees at this width, in Marathi.
  // The tab bar is see-through (scrim + backdrop blur), so whatever scrolls
  // behind it would change the pixels: made opaque for the shot only.
  const shot = isMobile ? navs[navs.length - 1] : navs[0];
  await shot.evaluate((el) => {
    el.style.setProperty("backdrop-filter", "none", "important");
    el.style.setProperty("background", "black", "important");
  });
  await expect(shot).toHaveScreenshot(`marathi-nav-${isMobile ? 390 : 1440}.png`, { maxDiffPixelRatio: 0.02 });
});

test("[GEN-2609-120] English stays the default: a fresh visit is not switched to Marathi", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  await page.goto("/");
  // The provider sets lang on mount; a fresh visit has no saved choice, so English.
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(await page.evaluate((key) => window.localStorage.getItem(key), LOCALE_STORAGE_KEY)).toBeNull();
});
