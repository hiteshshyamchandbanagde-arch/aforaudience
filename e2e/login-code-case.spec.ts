import { test, expect } from "@playwright/test";
import { FIXTURE_ORGANISER } from "./helpers/roles";

/**
 * Regression test for PR #199 (26 Jul, session 35): the login "code"
 * identifier was case-sensitive - a correct AFA/ART/ORG/VEN code typed in
 * lowercase or mixed case failed with the same generic invalid-account
 * error as a genuinely wrong code, since resolveIdentifierToUser did an
 * exact-case pattern test and exact-case DB lookup while codes are always
 * generated uppercase by the DB's generate_role_code() function.
 *
 * Reuses the existing fixture Organiser (see helpers/roles.ts) rather than
 * seeding a new account - its real code is already known
 * ("AFA2607000053", queried once via Supabase after the fixture was
 * created). Deliberately types it lowercase and mixed-case here; the
 * fixture account's actual code never changes, so this stays a stable,
 * repeatable regression check rather than needing a fresh lookup per run.
 */

const FIXTURE_ORGANISER_CODE = "AFA2607000053";

test("login accepts a valid code typed in lowercase", async ({ page }) => {
  await page.goto("/login");
  await page
    .getByPlaceholder(/you@example\.com, phone, username, or AFA code/i)
    .fill(FIXTURE_ORGANISER_CODE.toLowerCase());
  await page.getByPlaceholder(/your password/i).fill(FIXTURE_ORGANISER.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();

  await expect(page).toHaveURL(/\/(dashboard)?\/?($|\?)/, { timeout: 15_000 });
});

test("login accepts a valid code typed in mixed case", async ({ page }) => {
  // Flip every other character's case - "Afa2607000053" would only catch an
  // accidental case-insensitive-at-the-prefix-only fix, mix it up properly.
  const mixed = FIXTURE_ORGANISER_CODE.split("")
    .map((ch, i) => (i % 2 === 0 ? ch.toLowerCase() : ch.toUpperCase()))
    .join("");

  await page.goto("/login");
  await page
    .getByPlaceholder(/you@example\.com, phone, username, or AFA code/i)
    .fill(mixed);
  await page.getByPlaceholder(/your password/i).fill(FIXTURE_ORGANISER.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();

  await expect(page).toHaveURL(/\/(dashboard)?\/?($|\?)/, { timeout: 15_000 });
});
