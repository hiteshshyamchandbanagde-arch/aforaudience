import fs from "fs";
import path from "path";
import { Client } from "pg";

/**
 * Direct access to the QA database, for the two things the app gives a
 * test no way to do through the UI: delete an account it registered, and
 * put a one-shot fixture back to its starting state (docs/testing-rules.md
 * T6: tests that write data clean up after themselves).
 *
 * The connection string comes from E2E_DATABASE_URL (a GitHub Actions
 * secret in CI). On a developer machine it falls back to DATABASE_URL in
 * .env.local, which points at QA.
 *
 * It must name the QA Supabase project. Anything else, production
 * included, is refused before a connection is opened.
 */
const QA_PROJECT_REF = "nqiyrypmjtogoocerxtu";

/** The QA connection string, or null when this machine has none. */
export function qaDatabaseUrl(): string | null {
  const url = process.env.E2E_DATABASE_URL || localEnvDatabaseUrl();
  if (!url) return null;
  if (!url.includes(QA_PROJECT_REF)) {
    throw new Error("[e2e db] The database URL does not point at the QA project - refusing to connect.");
  }
  return url;
}

export function hasQaDatabase(): boolean {
  return qaDatabaseUrl() !== null;
}

/** An open client on the QA database; the caller ends it. Throws if there is no connection string. */
export async function connectQaDb(): Promise<Client> {
  const url = qaDatabaseUrl();
  if (!url) throw new Error("[e2e db] No QA database URL (set E2E_DATABASE_URL).");

  // pg-connection-string treats sslmode=require as full chain verification,
  // which fails against Supabase's pooler; uselibpqcompat restores the
  // behaviour the explicit ssl option below asks for (same as src/lib/prisma.ts).
  const connectionString = url.includes("uselibpqcompat=")
    ? url
    : `${url}${url.includes("?") ? "&" : "?"}uselibpqcompat=true`;
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  return client;
}

/** Runs `fn` inside one transaction on the QA database. Throws if there is no connection string. */
export async function withQaDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = await connectQaDb();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

/** A warning that shows as a check-run annotation in CI and a plain line locally. */
export function warn(title: string, message: string) {
  console.warn(process.env.GITHUB_ACTIONS ? `::warning title=${title}::${message}` : `[${title}] ${message}`);
}

function localEnvDatabaseUrl(): string | null {
  if (process.env.CI) return null;
  const file = path.join(__dirname, "..", "..", ".env.local");
  if (!fs.existsSync(file)) return null;
  const line = fs.readFileSync(file, "utf8").match(/^DATABASE_URL=(.*)$/m);
  return line ? line[1].trim().replace(/^["']|["']$/g, "") : null;
}
