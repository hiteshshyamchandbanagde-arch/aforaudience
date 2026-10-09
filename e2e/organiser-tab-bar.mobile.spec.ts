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

  // The bar and its items by their data-afa-* hooks, not their English
  // labels: the role bars follow the UI language (GEN-2610-007).
  const organiserBar = page.locator('nav[data-afa-tab-bar="organiser"]');
  await expect(organiserBar).toBeVisible();
  for (const id of ["my-events", "create", "sales", "requests"]) {
    await expect(organiserBar.locator(`a[data-afa-tab="${id}"]`)).toBeVisible();
  }
  await expect(organiserBar.locator('button[data-afa-tab="more"]')).toBeVisible();

  // The legacy bar's own items (My Tickets, Messages, Profile) are nowhere
  // on screen, found by where they link: exactly one bar.
  await expect(page.locator("nav[data-afa-tab-bar]").filter({ visible: true })).toHaveCount(1);
  for (const href of ["/tickets", "/dashboard/messages", "/profile"]) {
    await expect(page.locator(`nav a[href="${href}"], nav a[href="${href}/"]`).filter({ visible: true })).toHaveCount(0);
  }

  // "My Events" is the active item. The bar marks it by weight only (no
  // aria-current), so compare it with a sibling.
  const weight = (id: string) =>
    organiserBar
      .locator(`a[data-afa-tab="${id}"]`)
      .evaluate((link) => Math.max(...[link, ...link.querySelectorAll("*")].map((el) => Number(getComputedStyle(el).fontWeight))));
  expect(await weight("my-events")).toBeGreaterThan(await weight("sales"));

  // The page's own action row is not hidden under the bar.
  const edit = page.locator("a[data-afa-edit-event]");
  await edit.scrollIntoViewIfNeeded();
  const editBox = await edit.boundingBox();
  const barBox = await organiserBar.boundingBox();
  expect(editBox && barBox && editBox.y + editBox.height <= barBox.y + 1, "Edit Event sits above the bar").toBe(true);
});
