import { hasQaDatabase, warn, withQaDb } from "./qa-db";

/**
 * Deletes the throwaway accounts registration.spec.ts created, with the
 * bookings they made. The app has no "delete account" endpoint, so this
 * goes to the QA database directly (see qa-db.ts for the guards on that).
 *
 * Only addresses shaped like the ones registerTestAudience generates
 * (e2e.<digits>@example.com) are ever touched, whatever is passed in.
 *
 * Without a database URL nothing is deleted and the leftover addresses are
 * reported as a warning (an annotation in CI), so a missing secret is
 * visible instead of silently filling QA with test accounts.
 */
const TEST_EMAIL = /^e2e\.\d+@example\.com$/;

export async function deleteRegisteredTestUsers(emails: string[]) {
  const targets = emails.filter((email) => TEST_EMAIL.test(email));
  if (targets.length === 0) return;

  if (!hasQaDatabase()) {
    warn("e2e cleanup", `E2E_DATABASE_URL is not set - test account(s) left in QA: ${targets.join(", ")}`);
    return;
  }

  const deleted = await withQaDb(async (client) => {
    // Payment and BookingSeat rows cascade from Booking; everything else
    // that points at User either cascades or is never created by this flow.
    await client.query(
      `DELETE FROM "Booking" WHERE "userId" IN (SELECT id FROM "User" WHERE email = ANY($1::text[]))`,
      [targets]
    );
    const res = await client.query(`DELETE FROM "User" WHERE email = ANY($1::text[])`, [targets]);
    return res.rowCount;
  });
  console.log(`[e2e cleanup] deleted ${deleted} test account(s): ${targets.join(", ")}`);
}
