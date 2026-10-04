import { test, expect } from "./helpers/test";
import { connectQaDb, withQaDb } from "./helpers/qa-db";
import { GOAL_TOKEN, readTempAdminRun, restoreGoalToken } from "./helpers/temp-admin";

/**
 * BUG-2610-011: the goal spec (design-system-goal.spec.ts) flaked when
 * another e2e run on the shared QA database finished while it had
 * GOAL_TOKEN edited. That run's global teardown saw the test value, put
 * the token back straight in the DB, and the goal spec's revert then found
 * nothing to save ("Saved", no "Save 1 change" button).
 *
 * Here this test plays the run whose goal spec is mid-edit: it holds the
 * cross-run lock the specs hold (the advisory lock below, the same key as
 * GOAL_TOKEN_LOCK in helpers/temp-admin.ts) and checks that teardown's
 * restoreGoalToken waits for it instead of writing. Nothing on QA changes:
 * the restore is asked for the value the token already has.
 */
test("@needs-db [BUG-2610-011] another run's teardown waits for the goal-token lock instead of overwriting a run mid-edit", async () => {
  test.setTimeout(150_000);
  const run = readTempAdminRun();
  expect(run, "global-setup.ts created no temp admin (needs E2E_DATABASE_URL on the QA project)").not.toBeNull();

  const holder = await connectQaDb();
  let released = false;
  const release = async () => {
    if (released) return;
    released = true;
    await holder.query("ROLLBACK").catch(() => {});
    await holder.end().catch(() => {});
  };
  try {
    await holder.query("BEGIN");
    // Blocking: if another run holds it, wait our turn like the specs do.
    await holder.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`afa-e2e:${GOAL_TOKEN}`]);

    const current = await withQaDb(async (client) => {
      const res = await client.query<{ value: string }>(`SELECT value FROM "DesignToken" WHERE key = $1`, [GOAL_TOKEN]);
      return res.rows[0].value;
    });

    const restore = restoreGoalToken({ ...run!, originalValue: current }).then(
      (wrote) => ({ done: true as const, wrote }),
      (err: unknown) => ({ done: true as const, err })
    );
    const first = await Promise.race([restore, new Promise<{ done: false }>((r) => setTimeout(() => r({ done: false }), 5_000))]);
    expect(first.done, "teardown's restoreGoalToken is still waiting while another run holds the lock").toBe(false);

    await release();
    const after = await restore;
    expect("err" in after ? String(after.err) : "", "restoreGoalToken once the lock is free").toBe("");
    expect("wrote" in after && after.wrote, "nothing to restore: the token already had that value").toBe(false);
  } finally {
    await release();
  }
});
