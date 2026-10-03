import type { Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { authFile } from "./helpers/personas";

/**
 * BUG-2610-004 - arriving on /events with ?search= (from the homepage
 * search) showed an empty search box, and the visitor's own city was
 * applied on top, so a search for an event in another city found nothing
 * ("0 events" for "rajapalayam" with Jaipur applied). Since #722 the box
 * shows the search, a search is not narrowed by the auto-applied city, and
 * clearing the box is meant to clear the URL (that last part does not work
 * on the deployed QA - see the quarantined test at the bottom).
 *
 * As Atul, whose saved city is Jaipur; the event searched for is in
 * Byasanagar. Read-only (his city is not changed).
 */

test.use({ storageState: authFile("atul") });

const SEARCH = "rajapalayam";

/** The /events search box: in the top bar on a phone, in the page on desktop. */
function searchBox(page: Page, isMobile: boolean) {
  return isMobile
    ? page.getByRole("banner").getByRole("searchbox")
    : page.getByRole("main").getByPlaceholder("Search events, venues...");
}

test("a ?search= arrival shows in the search box and searches every city", async ({ page, isMobile }) => {
  await page.goto(`/events?search=${SEARCH}`);

  const box = searchBox(page, isMobile);
  await expect(box).toHaveValue(SEARCH);

  // Found although it is not in Atul's city.
  const hit = page.getByRole("link", { name: /Rajapalayam Comedy Jam/i }).first();
  await expect(hit).toBeVisible();
  await expect(hit).toContainText("Byasanagar");
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

// QUARANTINED (docs/testing-rules.md T2) - real app bug, found 3 Oct 2026 by
// the e2e repair; ticket number to be assigned by chat (see that handoff).
// On the deployed QA, clearing the box does NOT remove ?search= from the
// address (so a reload or a shared link brings the search back). #722
// added `router.replace("/events")` for this and it passed on a local
// build, but on Vercel, after a hard load of /events/?search=x, no router
// navigation to /events changes the address at all (not this replace, not
// router.push, not the Events nav link); other paths and a query added
// client-side behave. Kept runnable so it goes green when that is fixed.
test.fixme("clearing the search box removes ?search= from the address", async ({ page, isMobile }) => {
  await page.goto(`/events?search=${SEARCH}`);
  const box = searchBox(page, isMobile);
  await expect(box).toHaveValue(SEARCH);

  await box.fill("");
  await expect(page).not.toHaveURL(/search=/);
  await expect(box).toHaveValue("");
});
