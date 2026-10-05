import fs from "fs";
import { request, type FullConfig } from "@playwright/test";
import { AUTH_DIR, PERSONAS, authFile, type PersonaKey } from "./helpers/personas";
import { hasQaDatabase, warn, withQaDb } from "./helpers/qa-db";
import { keepFixturesUpcoming } from "./helpers/upcoming-fixtures";
import { ADMIN_AUTH_FILE, createTempAdmin, deleteTempAdmin } from "./helpers/temp-admin";

/**
 * Runs once before the suite.
 *
 * 1. Warm-up: one request to the base URL with a 60 s budget. The first
 *    request of a run can hit a cold Vercel function and a sleeping
 *    Supabase pool; paying for that here keeps it out of the first test.
 *    If the site is down, the whole run fails in about a minute with one
 *    clear message instead of timing out test by test.
 * 2. Shared logins: each persona signs in once (the same credentials
 *    endpoint the login form posts to) and its session is saved to
 *    e2e/.auth/<persona>.json for specs to reuse. The login form itself
 *    is covered by login-code-case.spec.ts.
 * 3. Temp admin (QA database only): a throwaway ADMIN for this run, signed
 *    in once and saved to e2e/.auth/temp-admin.json; its password is
 *    random and lives only in memory (helpers/temp-admin.ts).
 *    global-teardown.ts deletes it.
 * 4. Upcoming fixtures (QA database only, BUG-2610-013): the seeded events
 *    the specs need upcoming are moved forward if the clock has caught up
 *    with them (helpers/upcoming-fixtures.ts). seed-health.spec.ts runs
 *    before every other spec and fails in one line if they still aren't.
 */
const WARM_UP_BUDGET_MS = 60_000;

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL;
  if (!baseURL) throw new Error("[e2e setup] No baseURL configured.");

  const warmUp = await request.newContext({ baseURL });
  try {
    const started = Date.now();
    const res = await warmUp.get("/", { timeout: WARM_UP_BUDGET_MS });
    if (!res.ok()) {
      throw new Error(`HTTP ${res.status()} ${res.statusText()}`);
    }
    console.log(`[e2e setup] ${baseURL} answered in ${Date.now() - started} ms`);
  } catch (err) {
    throw new Error(
      `[e2e setup] The site under test is not reachable: ${baseURL} (${(err as Error).message}). ` +
        `No tests were run.`
    );
  } finally {
    await warmUp.dispose();
  }

  if (!hasQaDatabase()) {
    warn(
      "e2e setup",
      "E2E_DATABASE_URL is not set: specs tagged @needs-db (waitlist-wallet-credit, design-system-goal) are NOT run, and accounts registered by registration.spec.ts are not deleted."
    );
  }

  fs.mkdirSync(AUTH_DIR, { recursive: true });
  for (const key of Object.keys(PERSONAS) as PersonaKey[]) {
    await signIn(baseURL, PERSONAS[key], authFile(key));
  }

  if (hasQaDatabase()) {
    const moved = await withQaDb(keepFixturesUpcoming);
    for (const m of moved) {
      console.log(`[e2e setup] upcoming fixture "${m.title}" moved from ${m.from.toISOString()} to ${m.to.toISOString()}`);
    }

    const { run, password } = await createTempAdmin();
    try {
      await signIn(baseURL, { label: "E2E temp admin", identifier: run.email, password }, ADMIN_AUTH_FILE);
    } catch (err) {
      // A failed setup may not reach global teardown: remove it here.
      await deleteTempAdmin(run);
      throw err;
    }
  }
}

async function signIn(
  baseURL: string,
  persona: { label: string; identifier: string; password: string },
  stateFile: string
) {
  const ctx = await request.newContext({ baseURL });
  try {
    // next.config has trailingSlash: true - ask for the slashed paths so a
    // POST is never turned into a redirect.
    const csrfRes = await ctx.get("/api/auth/csrf/");
    const { csrfToken } = (await csrfRes.json()) as { csrfToken?: string };
    if (!csrfToken) throw new Error(`no CSRF token (HTTP ${csrfRes.status()})`);

    await ctx.post("/api/auth/callback/credentials/", {
      form: {
        csrfToken,
        identifier: persona.identifier,
        password: persona.password,
        callbackUrl: baseURL,
        json: "true",
      },
    });

    const sessionRes = await ctx.get("/api/auth/session/");
    const session = (await sessionRes.json()) as { user?: { email?: string } };
    if (!session?.user) {
      throw new Error("the credentials were not accepted (no session after sign-in)");
    }

    await ctx.storageState({ path: stateFile });
    console.log(`[e2e setup] signed in ${persona.label}`);
  } catch (err) {
    throw new Error(
      `[e2e setup] Could not sign in ${persona.label} <${persona.identifier}> at ${baseURL}: ` +
        `${(err as Error).message}. No tests were run.`
    );
  } finally {
    await ctx.dispose();
  }
}
