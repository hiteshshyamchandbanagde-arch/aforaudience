import path from "path";
import { test, expect } from "@playwright/test";
import { loginFixtureOrganiser, FIXTURE_EVENT_ID, FIXTURE_EVENT_TITLE } from "./helpers/roles";

/**
 * Real target: PR #300 (Competition Show), shipped 31 Jul, Vercel-green but
 * never click-tested on a real device or automatically. Priority 1 per the
 * Session 50 handoff.
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
 * only (isCompetitionShow/prizes/celebrity/panelists) - same
 * reuse-without-recreating convention as waitlist-wallet-credit.spec.ts.
 * Everything else about FIXTURE_EVENT_ID (title, compensation, buy-in
 * amount) is untouched, so this should not interfere with that spec.
 *
 * NOT YET IN THE AUTO-RUN CADENCE - workflow_dispatch only (see
 * e2e-competition-show.yml) until a first real run has been watched end to
 * end, same convention as the waitlist/wallet spec.
 */

const FIXTURE_PHOTO = path.join(__dirname, "fixtures", "test-photo.jpg");

test("competition show fields survive edit -> photo upload -> public display -> listing badge", async ({
  page,
}) => {
  await loginFixtureOrganiser(page);

  try {
    await test.step("Enable Competition Show on the fixture event and fill prizes/celebrity/2 panelists", async () => {
      await page.goto(`/dashboard/organiser/events/${FIXTURE_EVENT_ID}/edit`);
      const toggle = page.getByText(/this is a competition show/i);
      await expect(toggle).toBeVisible({ timeout: 15_000 });
      await page
        .locator("label", { hasText: /this is a competition show/i })
        .locator('input[type="checkbox"]')
        .check();

      await page.getByPlaceholder(/e\.g\. ₹10,000 \+ trophy/i).fill("₹10,000 + trophy");
      await page.getByPlaceholder("Optional").first().fill("₹5,000");
      await page.getByPlaceholder("Optional").nth(1).fill("Goodie hamper");
      await page
        .getByPlaceholder(/shown prominently on the event page/i)
        .fill("Test Celebrity Guest");

      await page.getByRole("button", { name: /\+ add panelist/i }).click();
      await page.getByPlaceholder("Panelist name").nth(0).fill("Panelist One");
      await page.getByPlaceholder("Short bio (optional)").nth(0).fill("Bio for panelist one");

      await page.getByRole("button", { name: /\+ add panelist/i }).click();
      await page.getByPlaceholder("Panelist name").nth(1).fill("Panelist Two");
      await page.getByPlaceholder("Short bio (optional)").nth(1).fill("Bio for panelist two");

      await page.getByRole("button", { name: /save changes|save & publish/i }).click();
      await expect(page.getByText(/saved|updated/i).first()).toBeVisible({ timeout: 15_000 });
    });

    await test.step("Reload edit page - confirm prize/celebrity/panelist text persisted", async () => {
      await page.goto(`/dashboard/organiser/events/${FIXTURE_EVENT_ID}/edit`);
      await expect(page.getByPlaceholder(/e\.g\. ₹10,000 \+ trophy/i)).toHaveValue("₹10,000 + trophy");
      await expect(page.getByPlaceholder(/shown prominently on the event page/i)).toHaveValue(
        "Test Celebrity Guest"
      );
      await expect(page.getByPlaceholder("Panelist name").nth(0)).toHaveValue("Panelist One");
      await expect(page.getByPlaceholder("Panelist name").nth(1)).toHaveValue("Panelist Two");
    });

    await test.step("Newly-added, unsaved panelist shows 'Save first to add photo' - real product rule, not a bug", async () => {
      await page.getByRole("button", { name: /\+ add panelist/i }).click();
      await page.getByPlaceholder("Panelist name").nth(2).fill("Panelist Three");
      await expect(page.getByText(/save first to add photo/i)).toBeVisible();
    });

    await test.step("Save the third panelist, then upload photos for celebrity + all panelists", async () => {
      await page.getByRole("button", { name: /save changes|save & publish/i }).click();
      await expect(page.getByText(/saved|updated/i).first()).toBeVisible({ timeout: 15_000 });
      await page.goto(`/dashboard/organiser/events/${FIXTURE_EVENT_ID}/edit`);

      // Celebrity photo input comes first in DOM order, panelist photo
      // inputs follow in panelist list order (see edit/page.tsx markup).
      const fileInputs = page.locator('input[type="file"]');
      await expect(fileInputs).toHaveCount(4, { timeout: 15_000 }); // celebrity + 3 panelists (all now have real ids)

      await fileInputs.nth(0).setInputFiles(FIXTURE_PHOTO); // celebrity
      await expect(page.getByText(/celebrity photo uploaded/i)).toBeVisible({ timeout: 15_000 });

      await fileInputs.nth(1).setInputFiles(FIXTURE_PHOTO); // panelist one
      await expect(page.getByText(/panelist photo uploaded/i)).toBeVisible({ timeout: 15_000 });

      await fileInputs.nth(2).setInputFiles(FIXTURE_PHOTO); // panelist two
      await expect(page.getByText(/panelist photo uploaded/i)).toBeVisible({ timeout: 15_000 });
    });

    await test.step("Save again - confirm earlier panelists' photos survive the deleteMany+create replace cycle", async () => {
      await page.getByRole("button", { name: /save changes|save & publish/i }).click();
      await expect(page.getByText(/saved|updated/i).first()).toBeVisible({ timeout: 15_000 });
      await page.goto(`/dashboard/organiser/events/${FIXTURE_EVENT_ID}/edit`);
      // Photos are <img> tags next to each panelist row once photoUrl is
      // set - if the replace-on-save wiped them, these would be absent.
      await expect(page.locator('img[alt="Panelist One"]')).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('img[alt="Panelist Two"]')).toBeVisible({ timeout: 15_000 });
    });

    await test.step("Public event page shows prize cards, celebrity card, and panelist grid with photos", async () => {
      await page.goto(`/events/${FIXTURE_EVENT_ID}`);
      await expect(page.getByText(/🏆 Competition Show/i)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/1st Prize/i)).toBeVisible();
      await expect(page.getByText(/₹10,000 \+ trophy/i)).toBeVisible();
      await expect(page.getByText(/2nd Prize/i)).toBeVisible();
      await expect(page.getByText(/Test Celebrity Guest/i)).toBeVisible();
      await expect(page.getByText(/Panelist One/i)).toBeVisible();
      await expect(page.getByText(/Panelist Two/i)).toBeVisible();
      await expect(page.getByText(/Panelist Three/i)).toBeVisible();
    });

    await test.step("Listing page shows the 🏆 Competition badge on this event's card", async () => {
      await page.goto("/events");
      const card = page.locator("div").filter({ hasText: FIXTURE_EVENT_TITLE }).last();
      await expect(card.getByText(/🏆 Competition/i)).toBeVisible({ timeout: 15_000 });
    });
  } finally {
    await test.step("Cleanup: turn Competition Show back off, restoring the fixture event for other specs", async () => {
      await page.goto(`/dashboard/organiser/events/${FIXTURE_EVENT_ID}/edit`);
      const checkbox = page
        .locator("label", { hasText: /this is a competition show/i })
        .locator('input[type="checkbox"]');
      if (await checkbox.isChecked()) {
        await checkbox.uncheck();
        await page.getByRole("button", { name: /save changes|save & publish/i }).click();
        await expect(page.getByText(/saved|updated/i).first()).toBeVisible({ timeout: 15_000 });
      }
    });

    await test.step("Confirm cleanup: Competition Show section and badge are gone", async () => {
      await page.goto(`/events/${FIXTURE_EVENT_ID}`);
      await expect(page.getByText(/🏆 Competition Show/i)).not.toBeVisible();
      await page.goto("/events");
      const card = page.locator("div").filter({ hasText: FIXTURE_EVENT_TITLE }).last();
      await expect(card.getByText(/🏆 Competition/i)).not.toBeVisible();
    });
  }
});
