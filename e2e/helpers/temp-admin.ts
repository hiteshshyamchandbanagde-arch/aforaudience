import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { AUTH_DIR } from "./personas";
import { connectQaDb, withQaDb } from "./qa-db";

/**
 * A throwaway ADMIN for the specs that need one (design-system-goal.spec.ts).
 *
 * The only real ADMIN on QA is Hitesh's own account, and it is never used,
 * read or changed by the suite. Instead global-setup.ts creates
 * e2e.admin.<run-id>@example.com with role ADMIN and a random password that
 * exists only in memory (hashed the way the app hashes: bcryptjs, cost 12,
 * see src/app/api/auth/register/route.ts), signs it in once and saves the
 * session to ADMIN_AUTH_FILE. The password is never written to disk, logs
 * or the repo. global-teardown.ts deletes the account and everything it
 * wrote (token version rows, the token's updatedBy).
 *
 * Only created when E2E_DATABASE_URL names the QA project (qa-db.ts
 * refuses anything else). Specs that use it are tagged @needs-db.
 */

/** The token the goal test edits. Never a LOCKED_TOKEN_KEYS one. */
export const GOAL_TOKEN = "--afa-selected";
/** The obvious test value: passes the value and contrast checks, never a real choice. */
export const GOAL_TEST_VALUE = "#00E5FF";
/** design-tokens.ts DEFAULTS, used only if a crashed run left the test value behind with no history to go by. */
const GOAL_TOKEN_DEFAULT = "var(--afa-amber)";

/**
 * Every e2e run (CI on qa, each PR preview, a CC autopilot's local suite)
 * shares the one QA database, so two runs can be on GOAL_TOKEN at once.
 * Without this lock one run's global teardown, seeing the other run's test
 * value, put the token back in the DB while that run's goal test still had
 * it edited: its revert then found nothing to save (BUG-2610-011). Whoever
 * reads or writes GOAL_TOKEN on purpose (the goal and restore specs, setup
 * recording the original value, teardown's restore) holds this lock.
 *
 * A Postgres transaction-level advisory lock on its own connection: the
 * QA URL is Supabase's transaction pooler, which pins a backend only for a
 * transaction, so a session lock would not hold. If the holder crashes,
 * its connection drops and the lock goes with it.
 */
export const GOAL_TOKEN_LOCK = `afa-e2e:${GOAL_TOKEN}`;
/** Longest wait for another run: its goal or restore spec holds the lock for about a minute. */
export const GOAL_LOCK_WAIT_MS = 120_000;

/** Takes the GOAL_TOKEN lock, waiting for another run to finish with it. Returns the release. */
export async function lockGoalToken(maxWaitMs = GOAL_LOCK_WAIT_MS): Promise<() => Promise<void>> {
  const client = await connectQaDb();
  const release = async () => {
    await client.query("ROLLBACK").catch(() => {});
    await client.end().catch(() => {});
  };
  try {
    await client.query("BEGIN");
    const deadline = Date.now() + maxWaitMs;
    for (;;) {
      const got = await client.query<{ ok: boolean }>(`SELECT pg_try_advisory_xact_lock(hashtext($1)) AS ok`, [GOAL_TOKEN_LOCK]);
      if (got.rows[0].ok) return release;
      if (Date.now() > deadline) throw new Error(`[e2e temp admin] Another e2e run held ${GOAL_TOKEN} for over ${maxWaitMs / 1000} s.`);
      await new Promise((r) => setTimeout(r, 2_000));
    }
  } catch (err) {
    await release();
    throw err;
  }
}

/** Runs `fn` holding the GOAL_TOKEN lock. */
export async function withGoalTokenLock<T>(fn: () => Promise<T>, maxWaitMs?: number): Promise<T> {
  const release = await lockGoalToken(maxWaitMs);
  try {
    return await fn();
  } finally {
    await release();
  }
}

export const ADMIN_AUTH_FILE = path.join(AUTH_DIR, "temp-admin.json");
const RUN_FILE = path.join(AUTH_DIR, "temp-admin-run.json");

const ADMIN_EMAIL_LIKE = "e2e.admin.%@example.com";
const ADMIN_EMAIL = /^e2e\.admin\.[a-z0-9-]+@example\.com$/;
/** A run never lasts this long (the e2e jobs stop at 30 min); older temp admins are leftovers. */
const STALE_AFTER_MINUTES = 60;

/** What global-setup.ts recorded for this run; no password in here. */
export type TempAdminRun = {
  id: string;
  email: string;
  tokenKey: string;
  /** GOAL_TOKEN's value when the run started: what the spec reverts to, and teardown's last resort. */
  originalValue: string;
  originalUpdatedBy: string | null;
};

export function readTempAdminRun(): TempAdminRun | null {
  if (!fs.existsSync(RUN_FILE)) return null;
  return JSON.parse(fs.readFileSync(RUN_FILE, "utf8")) as TempAdminRun;
}

/**
 * Creates the run's temp admin and records GOAL_TOKEN's starting value.
 * Returns the in-memory password for the one sign-in global-setup does.
 */
export async function createTempAdmin(): Promise<{ run: TempAdminRun; password: string }> {
  await deleteStaleTempAdmins();

  const runId = `${process.env.GITHUB_RUN_ID ?? "local"}-${Date.now().toString(36)}`.toLowerCase();
  const email = `e2e.admin.${runId}@example.com`;
  const id = `e2eadmin${randomBytes(8).toString("hex")}`;
  const password = randomBytes(24).toString("base64url");
  const hash = await bcrypt.hash(password, 12);

  // Under the lock: never record another run's in-flight test value as the original.
  const run = await withGoalTokenLock(() => withQaDb(async (client) => {
    await client.query(
      // onboardedAt set: an account without it gets the full-screen welcome
      // sequence (WelcomeSequence.tsx) on top of every page.
      `INSERT INTO "User" (id, name, "displayName", email, password, role, "isVerified", "isApproved", "onboardedAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 'ADMIN', true, true, now(), now())`,
      [id, `e2e_admin_${runId}`.replace(/-/g, "_"), "E2E temp admin", email, hash]
    );
    const token = await client.query<{ value: string; updatedBy: string | null }>(
      `SELECT value, "updatedBy" FROM "DesignToken" WHERE key = $1`,
      [GOAL_TOKEN]
    );
    if (token.rowCount !== 1) throw new Error(`[e2e temp admin] No ${GOAL_TOKEN} row in DesignToken.`);
    let { value: originalValue } = token.rows[0];
    // A run that crashed mid-test left the test value in place: take the
    // value from the newest version a real admin saved instead.
    if (originalValue.toUpperCase() === GOAL_TEST_VALUE) {
      const v = await client.query<{ value: string | null }>(
        `SELECT snapshot->>$1 AS value FROM "DesignTokenVersion"
         WHERE "createdBy" IS NULL OR "createdBy" NOT LIKE 'e2eadmin%'
         ORDER BY "createdAt" DESC LIMIT 1`,
        [GOAL_TOKEN]
      );
      originalValue = v.rows[0]?.value && v.rows[0].value.toUpperCase() !== GOAL_TEST_VALUE ? v.rows[0].value : GOAL_TOKEN_DEFAULT;
    }
    return { id, email, tokenKey: GOAL_TOKEN, originalValue, originalUpdatedBy: token.rows[0].updatedBy } satisfies TempAdminRun;
  }));

  fs.writeFileSync(RUN_FILE, JSON.stringify(run, null, 2));
  return { run, password };
}

/**
 * Last resort: if GOAL_TOKEN is not back to the value the run started with
 * (the spec's own revert did not happen), put it back straight in the DB.
 * Returns true if it had to; the caller then clears the site's token cache
 * as the admin, before deleteTempAdmin. Holds the GOAL_TOKEN lock, so it
 * never overwrites another run's edit while that run's spec is mid-test.
 */
export async function restoreGoalToken(run: TempAdminRun): Promise<boolean> {
  return withGoalTokenLock(() =>
    withQaDb(async (client) => {
      const current = await client.query<{ value: string }>(`SELECT value FROM "DesignToken" WHERE key = $1`, [run.tokenKey]);
      if (current.rows[0]?.value === run.originalValue) return false;
      await client.query(`UPDATE "DesignToken" SET value = $2, "updatedAt" = now() WHERE key = $1`, [run.tokenKey, run.originalValue]);
      return true;
    })
  );
}

/** Deletes the run's admin with what it wrote: its version rows and the token's updatedBy. */
export async function deleteTempAdmin(run: TempAdminRun) {
  if (!ADMIN_EMAIL.test(run.email)) throw new Error(`[e2e temp admin] Refusing to delete ${run.email}.`);
  await withQaDb((client) => removeAdminRows(client, [run.id], run));
  fs.rmSync(RUN_FILE, { force: true });
  fs.rmSync(ADMIN_AUTH_FILE, { force: true });
}

/** Temp admins a crashed or cancelled run left behind (older than STALE_AFTER_MINUTES). */
async function deleteStaleTempAdmins() {
  await withQaDb(async (client) => {
    const stale = await client.query<{ id: string; email: string }>(
      `SELECT id, email FROM "User" WHERE email LIKE $1 AND role = 'ADMIN' AND "createdAt" < now() - make_interval(mins => $2)`,
      [ADMIN_EMAIL_LIKE, STALE_AFTER_MINUTES]
    );
    const ids = stale.rows.filter((r) => ADMIN_EMAIL.test(r.email)).map((r) => r.id);
    if (ids.length === 0) return;
    await removeAdminRows(client, ids, null);
    console.log(`[e2e temp admin] deleted ${ids.length} leftover temp admin(s) from earlier runs`);
  });
}

async function removeAdminRows(client: import("pg").Client, ids: string[], run: TempAdminRun | null) {
  await client.query(`DELETE FROM "DesignTokenVersion" WHERE "createdBy" = ANY($1::text[])`, [ids]);
  if (run) {
    await client.query(`UPDATE "DesignToken" SET "updatedBy" = $2 WHERE key = $1 AND "updatedBy" = ANY($3::text[])`, [
      run.tokenKey,
      run.originalUpdatedBy,
      ids,
    ]);
  }
  await client.query(`UPDATE "DesignToken" SET "updatedBy" = NULL WHERE "updatedBy" = ANY($1::text[])`, [ids]);
  await client.query(`DELETE FROM "User" WHERE id = ANY($1::text[]) AND role = 'ADMIN' AND email LIKE $2`, [ids, ADMIN_EMAIL_LIKE]);
}
