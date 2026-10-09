import type { BrowserContext, BrowserContextOptions, Locator, Page } from "@playwright/test";
import { test, expect, gotoDashboard, hideFloatingOverlays } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { useRuleViewport } from "./helpers/viewports";

/**
 * BUG-2610-028 - the Venue Owner portal's page titles (Your Venues,
 * Revenue Overview, Edit Your Profile, Venue Booking Requests) were a
 * 34px sans while the Organiser/Artist titles were the display serif;
 * the stat-card labels were mono on one side and sans bold on the other;
 * and "Change Photo" was a CTA-orange button although orange is for
 * commit/payment only. Every dashboard title now comes from one
 * PageTitle (src/components/dashboard/PageTitle.tsx) and every stat
 * label from one StatLabel.
 *
 * As Vinayak (venue owner), compared against Omkar's (organiser) pages in
 * a second context. Read-only: nothing is saved. At 390 and 1440, with a
 * screenshot baseline of each venue title.
 */

test.use({ storageState: authFile("vinayak") });

test.beforeEach(async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
});

type Font = { family: string; weight: string; size: string; transform: string };

async function fontOf(el: Locator): Promise<Font> {
  await expect(el).toBeVisible();
  return el.evaluate((node) => {
    const cs = getComputedStyle(node);
    return { family: cs.fontFamily, weight: cs.fontWeight, size: cs.fontSize, transform: cs.textTransform };
  });
}

/** The px value a font-size token resolves to on this page. */
async function tokenPx(page: Page, token: string): Promise<string> {
  return page.evaluate((t) => {
    const probe = document.createElement("div");
    probe.style.fontSize = `var(${t})`;
    document.body.appendChild(probe);
    const px = getComputedStyle(probe).fontSize;
    probe.remove();
    return px;
  }, token);
}

/** Omkar's organiser page title and stat label: the style the venue portal must match. */
async function organiserReference(newContext: (o?: BrowserContextOptions) => Promise<BrowserContext>, isMobile: boolean) {
  const ctx = await newContext({ storageState: authFile("omkar"), viewport: isMobile ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await gotoDashboard(page, "/dashboard/organiser/sales");
  // data-afa-* hooks, not the English text: the Organiser pages follow the UI language (GEN-2610-007).
  const h1 = page.locator("h1[data-afa-page-title]");
  await expect(h1).toHaveText("Sales Overview");
  const title = await fontOf(h1);
  const label = await fontOf(page.locator("[data-afa-stat-label]").first());
  await ctx.close();
  return { title, label };
}

const VENUE_PAGES = [
  { url: "/dashboard/venue", title: "Your Venues", tier: "--afa-text-page-title-lg", shot: "your-venues" },
  { url: "/dashboard/venue/sales", title: "Revenue Overview", tier: "--afa-text-page-title", shot: "revenue-overview" },
  { url: "/dashboard/venue/edit", title: "Edit Your Profile", tier: "--afa-text-page-title-lg", shot: "edit-profile" },
  { url: "/dashboard/venue-requests", title: "Venue Booking Requests", tier: "--afa-text-page-title", shot: "booking-requests" },
] as const;

/** The font family the display-serif token resolves to on this page. */
async function displayFamily(page: Page): Promise<string> {
  return page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.fontFamily = "var(--font-display)";
    document.body.appendChild(probe);
    const family = getComputedStyle(probe).fontFamily;
    probe.remove();
    return family;
  });
}

for (const p of VENUE_PAGES) {
  test(`[BUG-2610-028] ${p.title}: the page title is the shared display-serif PageTitle (Organiser/Artist style)`, async ({ page, isMobile }) => {
    await gotoDashboard(page, p.url);
    await hideFloatingOverlays(page);
    const h1 = page.getByRole("heading", { level: 1, name: p.title, exact: true });
    const font = await fontOf(h1);
    expect(font.family, `${p.title}: font family = --font-display`).toBe(await displayFamily(page));
    expect(font.weight, `${p.title}: weight 700`).toBe("700");
    expect(font.size, `${p.title}: size = ${p.tier}`).toBe(await tokenPx(page, p.tier));
    await expect(h1).toHaveScreenshot(`venue-title-${p.shot}-${isMobile ? 390 : 1440}.png`, { animations: "disabled" });
  });
}

test("[BUG-2610-028] the Organiser title the venue titles match is the same PageTitle", async ({ page, newContext, isMobile }) => {
  const ref = await organiserReference(newContext, isMobile);
  await gotoDashboard(page, "/dashboard/venue/sales");
  const venue = await fontOf(page.getByRole("heading", { level: 1, name: "Revenue Overview", exact: true }));
  expect(venue, "Revenue Overview (venue) = Sales Overview (organiser)").toEqual(ref.title);
});

test("[BUG-2610-028] venue Revenue Overview stat labels match the organiser stat labels", async ({ page, isMobile, newContext }) => {
  const ref = await organiserReference(newContext, isMobile);
  await gotoDashboard(page, "/dashboard/venue/sales");
  for (const name of ["Total Revenue", "Confirmed Bookings", "Avg. Booking Value"]) {
    const font = await fontOf(page.getByRole("main").getByText(name, { exact: true }).first());
    expect(font.family, `${name}: label font = organiser stat label's`).toBe(ref.label.family);
    expect(font.weight, `${name}: label weight = organiser's`).toBe(ref.label.weight);
    expect(font.transform, `${name}: uppercase like organiser's`).toBe(ref.label.transform);
  }
});

test("[BUG-2610-028] Edit Your Profile: Change Photo is a secondary (outline) button, not CTA orange", async ({ page, isMobile }) => {
  await gotoDashboard(page, "/dashboard/venue/edit");
  await hideFloatingOverlays(page);
  const photo = page.getByRole("main").locator("label").filter({ hasText: /^(Change Photo|Upload Photo)$/ });
  const save = page.getByRole("button", { name: "Save Profile" });
  await expect(photo).toBeVisible();
  await expect(save).toBeVisible();
  const [photoBg, saveBg] = await Promise.all([
    photo.evaluate((n) => getComputedStyle(n).backgroundColor),
    save.evaluate((n) => getComputedStyle(n).backgroundColor),
  ]);
  test.info().annotations.push({ type: "colours", description: `photo ${photoBg}, save ${saveBg}` });
  // Save Profile keeps the orange fill (it commits); the photo button has none.
  expect(saveBg).not.toBe("rgba(0, 0, 0, 0)");
  expect(photoBg, "Change Photo has no CTA fill").toBe("rgba(0, 0, 0, 0)");
  const border = await photo.evaluate((n) => getComputedStyle(n).borderTopStyle);
  expect(border, "an outline button has a border").toBe("solid");
  await photo.scrollIntoViewIfNeeded();
  await expect(photo).toHaveScreenshot(`venue-change-photo-${isMobile ? 390 : 1440}.png`, { animations: "disabled" });
});
