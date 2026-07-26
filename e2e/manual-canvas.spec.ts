import { test, expect } from "@playwright/test";
import { loginFixtureVenueOwner, FIXTURE_NUMBERED_VENUE_ID } from "./helpers/roles";

/**
 * Regression tests for the seat-map Manual Canvas fixes shipped session 35
 * (26 Jul): PR #196 (autosave/draft persistence) and PR #198 (click-to-
 * select creating a duplicate seat, duplicate labels on manual Row/Next#
 * reset, and numeric fields that couldn't be cleared directly).
 *
 * Uses the fixture Venue Owner + Numbered venue (helpers/roles.ts,
 * `e2efixturevo0001ven`) - 2 real seats seeded (row A, seats 1-2, zone
 * "General") so the builder loads straight into the canvas view instead
 * of the Guided-Setup-vs-Draw-It-Myself choice screen.
 *
 * Every test here interacts with the canvas client-side only and never
 * clicks Save - nothing is ever mutated server-side, so the fixture venue
 * stays in its original 2-seat state across every run regardless of pass
 * or fail.
 */

const SEAT_MAP_URL = `/dashboard/venue/${FIXTURE_NUMBERED_VENUE_ID}/seat-map`;

test("clicking an existing seat selects it, does not create a duplicate", async ({ page }) => {
  await loginFixtureVenueOwner(page);
  await page.goto(SEAT_MAP_URL);

  const seats = page.getByTestId("seat");
  await expect(seats).toHaveCount(2, { timeout: 20_000 });

  await page.locator('[title="General — Row A, Seat 1"]').click();
  await page.waitForTimeout(300);
  await expect(seats).toHaveCount(2);
});

test("resetting Row/Next# to an existing label blocks placement instead of duplicating it", async ({ page }) => {
  await loginFixtureVenueOwner(page);
  await page.goto(SEAT_MAP_URL);

  const seats = page.getByTestId("seat");
  await expect(seats).toHaveCount(2, { timeout: 20_000 });

  await page.getByRole("button", { name: /manual placement/i }).click();
  await expect(page.getByRole("button", { name: /manual placement on/i })).toBeVisible();

  await page.locator('label:has-text("Next #:") + input').fill("1");
  await page.getByTestId("seatmap-canvas").click({ position: { x: 300, y: 300 } });

  await expect(page.getByRole("alert")).toContainText(/row a, seat 1 already exists/i);
  await expect(seats).toHaveCount(2);
});

test("numeric fields (side margin) can be cleared and retyped without overtype-then-delete", async ({ page }) => {
  await loginFixtureVenueOwner(page);
  await page.goto(SEAT_MAP_URL);

  await page.getByRole("button", { name: /generate grid/i }).click();

  const sideMargin = page.locator('label:has-text("Side margin (px):") + input');
  await expect(sideMargin).toBeVisible({ timeout: 20_000 });

  await sideMargin.fill("");
  await expect(sideMargin).toHaveValue("");

  await sideMargin.fill("77");
  await expect(sideMargin).toHaveValue("77");

  await sideMargin.blur();
  await expect(sideMargin).toHaveValue("77");
});

test("an accidental refresh mid-edit offers to restore the in-progress layout", async ({ page }) => {
  await loginFixtureVenueOwner(page);
  await page.goto(SEAT_MAP_URL);

  const seats = page.getByTestId("seat");
  await expect(seats).toHaveCount(2, { timeout: 20_000 });

  await page.getByRole("button", { name: /manual placement/i }).click();
  await page.getByTestId("seatmap-canvas").click({ position: { x: 400, y: 300 } });
  await expect(seats).toHaveCount(3);

  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();

  await expect(seats).toHaveCount(3, { timeout: 15_000 });
});
