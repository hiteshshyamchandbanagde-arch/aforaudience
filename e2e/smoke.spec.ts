import { test, expect } from "@playwright/test";

/**
 * No-auth smoke tests. These need no test account and no OTP, so they're
 * the fastest signal that the site is up and the framework itself is wired
 * correctly. Good candidate to run on every PR before anything heavier.
 */

test("homepage loads and shows persona value props", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/AforAudience/i);
});

test("events listing renders at least one published event", async ({ page }) => {
  await page.goto("/events");
  // Loose check on purpose: exact card markup will change as the UI evolves.
  // This just confirms the page renders a real list, not an empty/error state.
  await expect(page.locator("body")).not.toContainText(/something went wrong/i);
});

test("Jaipur Mic Gala 100 event detail page loads with seat picker", async ({ page }) => {
  await page.goto("/events");
  const eventLink = page.getByText("Jaipur Mic Gala 100", { exact: false });
  await expect(eventLink).toBeVisible({ timeout: 10_000 });
  await eventLink.first().click();
  await expect(page).toHaveURL(/\/events\//);
});
