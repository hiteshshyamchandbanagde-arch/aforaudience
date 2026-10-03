import { test, expect, gotoDashboard } from "./helpers/test";
import { authFile } from "./helpers/personas";

/**
 * BUG-2609-084 - on an organiser's event detail page the phone showed the
 * wrong bottom bar (Dashboard / My Tickets / Messages / Profile / More, the
 * legacy one) instead of the organiser's. Two hand-kept route lists had
 * drifted; src/components/mobile/tabBarRoutes.ts is now the one source (#722).
 *
 * Phone width only: there is no bottom bar on desktop.
 */

test.use({ storageState: authFile("omkar") });

// One of Omkar's seeded events (scripts/qa-seed.ts, "full" organiser).
const EVENT_ID = "qa-demo-event-full-9";

test("[BUG-2609-084] organiser event detail shows one bottom bar, the organiser's, with My Events active", async ({ page }) => {
  await gotoDashboard(page, `/dashboard/organiser/events/${EVENT_ID}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const organiserBar = page.getByRole("navigation").filter({ has: page.getByRole("link", { name: "My Events" }) });
  await expect(organiserBar).toBeVisible();
  for (const name of ["My Events", "Create", "Sales", "Requests"]) {
    await expect(organiserBar.getByRole("link", { name, exact: true })).toBeVisible();
  }
  await expect(organiserBar.getByRole("button", { name: "More" })).toBeVisible();

  // The legacy bar's own items are nowhere on screen: exactly one bar.
  for (const name of ["My Tickets", "Messages", "Profile"]) {
    await expect(page.getByRole("link", { name, exact: true }).filter({ visible: true })).toHaveCount(0);
  }

  // "My Events" is the active item. The bar marks it by weight only (no
  // aria-current), so compare it with a sibling.
  const weight = (name: string) =>
    organiserBar
      .getByRole("link", { name, exact: true })
      .evaluate((link) => Math.max(...[link, ...link.querySelectorAll("*")].map((el) => Number(getComputedStyle(el).fontWeight))));
  expect(await weight("My Events")).toBeGreaterThan(await weight("Sales"));

  // The page's own action row is not hidden under the bar.
  const edit = page.getByRole("link", { name: "Edit Event" });
  await edit.scrollIntoViewIfNeeded();
  const editBox = await edit.boundingBox();
  const barBox = await organiserBar.boundingBox();
  expect(editBox && barBox && editBox.y + editBox.height <= barBox.y + 1, "Edit Event sits above the bar").toBe(true);
});
