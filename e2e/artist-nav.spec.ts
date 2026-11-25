import type { Locator } from "@playwright/test";
import { test, expect, gotoDashboard, hideFloatingOverlays } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { useRuleViewport } from "./helpers/viewports";

/**
 * Run E (Hitesh phone pass 13-14 Oct) - the Artist bar's "My Events" went
 * to /dashboard/artist/events, the page for finding gigs to apply to, not
 * the artist's own events; and the overview, /dashboard/artist, had no bar
 * item, so once you left it the bar had no way back.
 *
 * Now, as Hrithik (Artist): the phone bar (390) reads Overview first, then
 * Find gigs; Overview goes to /dashboard/artist and is the active item
 * there; Find gigs goes to /dashboard/artist/events and is active there.
 * The desktop sidebar's Artist section (1440) has the same two items.
 * English (the persona's account language is none). Read-only.
 */

test.use({ storageState: authFile("hrithik") });

/** The heaviest font weight inside a bar item: the bar marks the active one by weight only. */
const weight = (item: Locator) =>
  item.evaluate((link) => Math.max(...[link, ...link.querySelectorAll("*")].map((el) => Number(getComputedStyle(el).fontWeight))));

test("[artist-nav-E] Artist bar (390) / sidebar (1440): Overview first, Find gigs, each goes where its name says", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  await gotoDashboard(page, "/dashboard/artist/events/");

  if (isMobile) {
    const bar = page.locator('nav[data-afa-tab-bar="artist"]');
    await expect(bar).toBeVisible();
    const tabs = bar.locator("a[data-afa-tab]");
    await expect(tabs).toHaveCount(4);
    expect(await tabs.evaluateAll((els) => els.map((el) => el.getAttribute("data-afa-tab")))).toEqual([
      "overview",
      "find-gigs",
      "edit-profile",
      "inquiries",
    ]);
    const overview = bar.locator('a[data-afa-tab="overview"]');
    const findGigs = bar.locator('a[data-afa-tab="find-gigs"]');
    await expect(overview).toHaveText("Overview");
    await expect(findGigs).toHaveText("Find gigs");
    await expect(bar.getByText("My Events", { exact: true })).toHaveCount(0);

    // On the gig browser, Find gigs is the active item.
    expect(await weight(findGigs)).toBeGreaterThan(await weight(overview));

    await hideFloatingOverlays(page);
    await expect(bar).toHaveScreenshot("artist-bar-en-390.png", { animations: "disabled" });

    await overview.click();
    await expect(page).toHaveURL(/\/dashboard\/artist\/?$/);
    await expect(overview).toBeVisible();
    expect(await weight(overview)).toBeGreaterThan(await weight(findGigs));

    await findGigs.click();
    await expect(page).toHaveURL(/\/dashboard\/artist\/events\/?$/);
    expect(await weight(findGigs)).toBeGreaterThan(await weight(overview));
  } else {
    const section = page.locator("aside").filter({ visible: true }).first().locator('[data-afa-role-section="artist"]');
    await expect(section).toBeVisible();
    const overview = section.getByRole("link", { name: "Overview", exact: true });
    const findGigs = section.getByRole("link", { name: "Find gigs", exact: true });
    await expect(overview).toBeVisible();
    await expect(findGigs).toBeVisible();
    await expect(section.getByText("My Events", { exact: true })).toHaveCount(0);
    // Overview is the section's first link.
    await expect(section.getByRole("link").first()).toHaveText("Overview");

    await hideFloatingOverlays(page);
    await expect(section).toHaveScreenshot("artist-sidebar-en-1440.png", { animations: "disabled" });

    await overview.click();
    await expect(page).toHaveURL(/\/dashboard\/artist\/?$/);
    await findGigs.click();
    await expect(page).toHaveURL(/\/dashboard\/artist\/events\/?$/);
  }
});
