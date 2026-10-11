import type { Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { OUT_OF_CITY_EVENT } from "./helpers/upcoming-fixtures";

/**
 * BUG-2610-004 - arriving on /events with ?search= (from the homepage
 * search) showed an empty search box, and the visitor's own city was
 * applied on top, so a search for an event in another city found nothing
 * ("0 events" for "rajapalayam" with Jaipur applied). Since #722 the box
 * shows the search, a search is not narrowed by the auto-applied city, and
 * clearing the box clears the URL (BUG-2610-007, the test at the bottom).
 *
 * As Atul, whose saved city is Jaipur; the event searched for is an
 * upcoming fixture in Pune (helpers/upcoming-fixtures.ts, kept upcoming by
 * global-setup; BUG-2610-034: a dated seed event went past). Read-only
 * (his city is not changed).
 */

test.use({ storageState: authFile("atul") });

const SEARCH = OUT_OF_CITY_EVENT.title.toLowerCase();

/** The /events search box: in the top bar on a phone, in the page on desktop. */
function searchBox(page: Page, isMobile: boolean) {
  return isMobile
    ? page.getByRole("banner").getByRole("searchbox")
    : page.getByRole("main").getByPlaceholder("Search events, venues...");
}

test("[BUG-2610-004] a ?search= arrival shows in the search box and searches every city", async ({ page, isMobile }) => {
  await page.goto(`/events?search=${encodeURIComponent(SEARCH)}`);

  const box = searchBox(page, isMobile);
  await expect(box).toHaveValue(SEARCH);

  // Found although it is not in Atul's city.
  const hit = page.getByRole("link", { name: new RegExp(OUT_OF_CITY_EVENT.title, "i") }).first();
  await expect(hit).toBeVisible();
  await expect(hit).toContainText(OUT_OF_CITY_EVENT.city);
  if (!isMobile) {
    // The city filter (the select listing "All Cities") was left alone.
    const citySelect = page
      .getByRole("main")
      .locator("select")
      .filter({ has: page.locator("option", { hasText: "All Cities" }) });
    await expect(citySelect.locator("option:checked")).toHaveText("All Cities");
  }

  // Clearing the box clears the search itself: the other events are back.
  await box.fill("");
  await expect(box).toHaveValue("");
  await expect(page.getByRole("link").filter({ has: page.getByRole("heading", { level: 3 }) }).nth(1)).toBeVisible();
});

// BUG-2610-007 - clearing the box left ?search= in the address (so a
// reload or a shared link brought the search back). /events is a static
// route, and after a hard load of /events/?search=x the router kept the
// query on every navigation to the bare path (#722's
// router.replace("/events") and "/events/" alike). Clearing the box now
// drops the param with the native History API. Quarantined from #723
// until this fix.
test("[BUG-2610-004] [BUG-2610-007] clearing the search box removes ?search= from the address", async ({ page, isMobile }) => {
  await page.goto(`/events?search=${encodeURIComponent(SEARCH)}`);
  const box = searchBox(page, isMobile);
  await expect(box).toHaveValue(SEARCH);

  await box.fill("");
  await expect(page).not.toHaveURL(/search=/);
  await expect(box).toHaveValue("");
});
