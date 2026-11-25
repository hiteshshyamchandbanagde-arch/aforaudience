/**
 * Deletes the throwaway accounts registration.spec.ts left in QA when a
 * run could not clean up after itself (a run without E2E_DATABASE_URL, a
 * cancelled job). QA only: it goes through e2e/helpers/cleanup.ts's
 * deleteRegisteredTestUsers, which refuses any database that is not the
 * QA project and only ever touches e2e.<digits>@example.com addresses, so
 * the fixture Organiser (e2e.fixture.organiser@example.com), the fixture
 * venue owner and every @aforaudience.qa persona are out of its reach.
 *
 * Accounts younger than --min-age-minutes (default 60, twice the e2e job
 * limit) are left alone: they may belong to a run that is still going.
 *
 *   E2E_DATABASE_URL=<QA url> npx tsx scripts/dev/delete-leftover-e2e-users.ts [--dry-run] [--min-age-minutes=60]
 */
import { deleteRegisteredTestUsers } from "../../e2e/helpers/cleanup";
import { withQaDb } from "../../e2e/helpers/qa-db";

const TEST_EMAIL_LIKE = "e2e.%@example.com";
const TEST_EMAIL = /^e2e\.\d+@example\.com$/;

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const ageArg = process.argv.find((a) => a.startsWith("--min-age-minutes="));
  const minAgeMinutes = ageArg ? Number(ageArg.split("=")[1]) : 60;
  if (!Number.isFinite(minAgeMinutes) || minAgeMinutes < 30) {
    throw new Error("--min-age-minutes must be a number of at least 30 (a run may still own younger accounts).");
  }

  const rows = await withQaDb(async (client) => {
    const res = await client.query<{ email: string; createdAt: Date }>(
      `SELECT email, "createdAt" FROM "User" WHERE email LIKE $1 ORDER BY "createdAt"`,
      [TEST_EMAIL_LIKE]
    );
    return res.rows;
  });

  const cutoff = Date.now() - minAgeMinutes * 60_000;
  const registered = rows.filter((r) => TEST_EMAIL.test(r.email));
  const targets = registered.filter((r) => new Date(r.createdAt).getTime() < cutoff).map((r) => r.email);

  console.log(`e2e.*@example.com accounts in QA: ${rows.length} (${registered.length} registered by the suite, the rest are fixtures and never touched).`);
  console.log(`Older than ${minAgeMinutes} min, to delete: ${targets.length}${targets.length ? ` - ${targets.join(", ")}` : ""}`);

  if (dryRun || targets.length === 0) return;
  await deleteRegisteredTestUsers(targets);

  const after = await withQaDb(async (client) => {
    const res = await client.query(`SELECT count(*)::int AS n FROM "User" WHERE email LIKE $1`, [TEST_EMAIL_LIKE]);
    return res.rows[0].n as number;
  });
  console.log(`e2e.*@example.com accounts in QA after: ${after}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
