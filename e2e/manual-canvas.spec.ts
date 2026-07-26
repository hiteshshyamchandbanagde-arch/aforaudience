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

  // Click (not drag) the seeded seat "Row A, Seat 1" - before PR #198 this
  // created a new overlapping seat instead of just selecting the existing
  // one, because startDrag's stopPropagation() on mousedown doesn't stop
  // the separate click event fired afterward.
  await page.locator('[title="General — Row A, Seat 1"]').click();

  // Give any (incorrect) placeSeat call a moment to land before asserting -
  // this is a synchronous state update, not a network request, so a short
  // wait is enough rather than needing a network-idle wait.
  await page.waitForTimeout(300);
  await expect(seats).toHaveCount(2, { timeout: 20_000 });
});

test("resetting Row/Next# to an existing label blocks placement instead of duplicating it", async ({ page }) => {
  await loginFixtureVenueOwner(page);
  await page.goto(SEAT_MAP_URL);

  const seats = page.getByTestId("seat");
  await expect(seats).toHaveCount(2, { timeout: 20_000 });

  await page.getByRole("button", { name: /manual placement/i }).click();
  await expect(page.getByRole("button", { name: /manual placement on/i })).toBeVisible();

  // Row already defaults to "A" from the seeded seats' own lettering: set
  // Next# back to 1 (the first seeded seat's number) rather than wherever
  // auto-increment left it.
  await page.locator('label:has-text("Next #:") + input').fill("1");

  // Click an empty spot on the canvas - well away from either seeded seat
  // (which sit at x=100/140, y=150) so this is unambiguously a "new seat"
  // attempt, not a click on an existing one.
  await page.getByTestId("seatmap-canvas").click({ position: { x: 300, y: 300 } });

  await expect(page.getByRole("alert")).toContainText(/row a, seat 1 already exists/i);
  await expect(seats).toHaveCount(2, { timeout: 20_000 });
});

test("numeric fields (side margin) can be cleared and retyped without overtype-then-delete", async ({ page }) => {
  await loginFixtureVenueOwner(page);
  await page.goto(SEAT_MAP_URL);

  await page.getByRole("button", { name: /generate grid/i }).click();

  const sideMargin = page.locator('label:has-text("Side margin (px):") + input');
  await expect(sideMargin).toBeVisible();

  await sideMargin.fill("");
  // The whole point of the fix: the field can actually sit empty mid-edit,
  // not silently snap back to the previous number.
  await expect(sideMargin).toHaveValue("");

  await sideMargin.fill("77");
  await expect(sideMargin).toHaveValue("77");

  // Blur commits the clamped value (min 0, max 500 - 77 is within bounds,
  // so it should round-trip unchanged).
  await sideMargin.blur();
  await expect(sideMargin).toHaveValue("77");
});

test("an accidental refresh mid-edit offers to restore the in-progress layout", async ({ page }) => {
  await loginFixtureVenueOwner(page);
  await page.goto(SEAT_MAP_URL);

  const seats = page.getByTestId("seat");
  await expect(seats).toHaveCount(2, { timeout: 20_000 });

  await page.getByRole("button", { name: /manual placement/i }).click();
  // Place one new seat well away from the two seeded ones and from the
  // stage clearance band at the top.
  await page.getByTestId("seatmap-canvas").click({ position: { x: 400, y: 300 } });
  await expect(seats).toHaveCount(3);

  // Reload simulates the accidental refresh the bug report described.
  // The restore-draft prompt is a plain window.confirm() - accept it.
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();

  // Server still only has the original 2 seats (Save was never clicked) -
  // if the draft weren't restored, this would read 2, not 3.
  await expect(seats).toHaveCount(3, { timeout: 15_000 });
});
