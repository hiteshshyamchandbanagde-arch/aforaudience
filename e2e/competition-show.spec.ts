import type { Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { FIXTURE_EVENT_ID, FIXTURE_EVENT_TITLE } from "./helpers/roles";
import { authFile } from "./helpers/personas";

/**
 * Real target: PR #300 (Competition Show), shipped 31 Jul.
 *
 * Reuses the shared, already-APPROVED FIXTURE_EVENT_ID (see helpers/roles.ts)
 * instead of creating a fresh event, deliberately - the real create-page
 * Publish flow requires attaching a venue, and attaching a venue puts a new
 * event into PENDING_APPROVAL (see api/events/route.ts:
 * `status: !publish ? 'DRAFT' : venueId ? 'PENDING_APPROVAL' : 'APPROVED'`),
 * which would need a separate Admin-approval step this spec has no login
 * for. Competition Show is an optional layer bolted onto *any* EventType,
 * not a new type (confirmed in the PR's own framing) - so toggling it on
 * for an existing published event is exactly the real usage pattern, not a
 * workaround.
 *
 * Mutates then restores the shared fixture event's Competition Show fields
 * only (the toggle and the three prizes). Everything else about
 * FIXTURE_EVENT_ID (title, compensation, buy-in amount) is untouched, so
 * this does not interfere with waitlist-wallet-credit.spec.ts.
 *
 * 3 Oct 2026 - cut down to what the feature is today. When this spec was
 * written, a celebrity was a free-text name and panelists were free-text
 * rows, each with a photo upload, and most of the spec was about those
 * (typed names surviving a save, "save first to add photo", uploaded photos
 * surviving the replace-on-save cycle). Celebrities and panelists are now
 * registered users invited by search, with their own accept flow; the
 * free-text fields and the upload inputs are gone, so those steps had
 * nothing left to test and waited out the timeout. What remains - the
 * toggle, the prizes and the public section - is kept with its original
 * assertions. The listing badge step is its own test at the bottom
 * (BUG-2610-006). Inviting a panelist is NOT covered here: it
 * writes an invitation onto another account, so it needs its own spec with
 * its own cleanup.
 *
 * Back in the main suite (it had its own manual-only workflow, which was
 * never promoted): it runs in well under a minute and always restores the
 * fixture, including when a step fails.
 */

// Signed in as the fixture Organiser (session saved by global-setup.ts).
test.use({ storageState: authFile("fixtureOrganiser") });

const EDIT_URL = `/dashboard/organiser/events/${FIXTURE_EVENT_ID}/edit`;
const PRIZE_FIRST = "₹10,000 + trophy";
const PRIZE_SECOND = "₹5,000";
const PRIZE_THIRD = "Goodie hamper";

function competitionCheckbox(page: Page) {
  return page.locator("label", { hasText: /this is a competition show/i }).locator('input[type="checkbox"]');
}

async function saveEvent(page: Page) {
  await page.getByRole("button", { name: /^save changes$/i }).click();
  // A successful save leaves the edit page for the organiser's event page.
  await expect(page).toHaveURL(new RegExp(`/dashboard/organiser/events/${FIXTURE_EVENT_ID}/?$`), { timeout: 20_000 });
}

/** The fixture event's card on the public listing, the same on both viewports. */
async function openListingCard(page: Page) {
  // Searched for by title so mobile shows the plain list, not its carousels.
  await page.goto(`/events?search=${encodeURIComponent(FIXTURE_EVENT_TITLE)}`);
  const card = page.getByRole("link", { name: /E2E Fixture: Waitlist\/Wallet Flow/i });
  await expect(card).toBeVisible();
  return card;
}


async function enableCompetitionShow(page: Page) {
  await page.goto(EDIT_URL);
  await expect(competitionCheckbox(page)).toBeVisible();
  await competitionCheckbox(page).check();

  await page.getByPlaceholder(/e\.g\. ₹10,000 \+ trophy/i).fill(PRIZE_FIRST);
  await page.getByPlaceholder("Optional").first().fill(PRIZE_SECOND);
  await page.getByPlaceholder("Optional").nth(1).fill(PRIZE_THIRD);

  await saveEvent(page);
}

/** Turns Competition Show back off, restoring the fixture event for other specs. */
async function restoreFixtureEvent(page: Page) {
  await page.goto(EDIT_URL);
  await expect(competitionCheckbox(page)).toBeVisible();
  if (await competitionCheckbox(page).isChecked()) {
    await competitionCheckbox(page).uncheck();
    await saveEvent(page);
  }
}

// Two saves and several page loads, and a server-rendered page on QA takes
// 3-6 s: these flows are honestly longer than the 60 s default. Each single
// wait still fails in 10-20 s.
const FLOW_TIMEOUT_MS = 150_000;

test("competition show: toggle and prizes survive a save and show on the public event page", async ({ page }) => {
  test.setTimeout(FLOW_TIMEOUT_MS);

  try {
    await test.step("Enable Competition Show on the fixture event and fill the three prizes", async () => {
      await enableCompetitionShow(page);
    });

    await test.step("Reload the edit page - the toggle and prize text persisted", async () => {
      await page.goto(EDIT_URL);
      await expect(competitionCheckbox(page)).toBeChecked();
      await expect(page.getByPlaceholder(/e\.g\. ₹10,000 \+ trophy/i)).toHaveValue(PRIZE_FIRST);
      await expect(page.getByPlaceholder("Optional").first()).toHaveValue(PRIZE_SECOND);
      await expect(page.getByPlaceholder("Optional").nth(1)).toHaveValue(PRIZE_THIRD);
    });

    await test.step("Public event page shows the Competition Show section with all three prizes", async () => {
      await page.goto(`/events/${FIXTURE_EVENT_ID}`);
      const main = page.locator("main");
      await expect(main.getByText("Competition Show", { exact: true })).toBeVisible();
      await expect(main.getByText("1st Prize", { exact: true })).toBeVisible();
      await expect(main.getByText(PRIZE_FIRST, { exact: true })).toBeVisible();
      await expect(main.getByText("2nd Prize", { exact: true })).toBeVisible();
      await expect(main.getByText(PRIZE_SECOND, { exact: true })).toBeVisible();
      await expect(main.getByText("3rd Prize", { exact: true })).toBeVisible();
      await expect(main.getByText(PRIZE_THIRD, { exact: true })).toBeVisible();
    });
  } finally {
    await test.step("Cleanup: turn Competition Show back off", async () => {
      await restoreFixtureEvent(page);
    });
  }

  await test.step("Confirm cleanup: the Competition Show section is gone from the public page", async () => {
    await page.goto(`/events/${FIXTURE_EVENT_ID}`);
    await expect(page.getByRole("heading", { level: 1, name: FIXTURE_EVENT_TITLE })).toBeVisible();
    await expect(page.locator("main").getByText("Competition Show", { exact: true })).toBeHidden();
  });
});

// BUG-2610-006 - the listing card had lost its Competition badge: the
// Events directory rebuild (#514, 20 Aug) dropped the
// `{event.isCompetitionShow && 🏆 {tr.eventsPage.competitionBadge}}` block,
// while EventCard still received `isCompetitionShow` and all 11
// dictionaries still carried `competitionBadge`. Quarantined from #723
// until the badge was back (CompetitionBadge in EventCard.tsx).
test("BUG-2610-006: competition show: the listing card shows the Competition badge", async ({ page }) => {
  test.setTimeout(FLOW_TIMEOUT_MS);

  try {
    await enableCompetitionShow(page);
    const card = await openListingCard(page);
    await expect(card.getByText(/Competition/)).toBeVisible();
  } finally {
    await restoreFixtureEvent(page);
  }

  const card = await openListingCard(page);
  await expect(card.getByText(/Competition/)).toBeHidden();
});
