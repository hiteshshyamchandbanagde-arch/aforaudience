import { test, expect } from "./helpers/test";
import { ADMIN_AUTH_FILE } from "./helpers/temp-admin";
import { withQaDb } from "./helpers/qa-db";

/**
 * S1b-a (Hitesh, 9 Nov) - launch wave switches W1-W4. Server only (the
 * admin UI and holding page are S1b-b), so this checks the public read
 * hint and the admin settings API's validation.
 *
 * Read-only on purpose: the switches are global and specs run in
 * parallel, so nothing here writes the PlatformSettings row. The closed
 * behaviour of each gated route (403 WAVE_CLOSED, admin bypass, W4 only
 * for paid) is covered with the flags injected in
 * scripts/launch-waves.test.ts and scripts/launch-waves-routes.test.ts.
 */
test.use({ storageState: ADMIN_AUTH_FILE });

const WAVE_COLUMNS = {
  W1: "waveDiscoveryOpen",
  W2: "waveOnboardingOpen",
  W3: "waveTicketsOpen",
  W4: "waveDirectBookingsOpen",
} as const;

async function readWaveRow() {
  return withQaDb(async (db) => {
    const { rows } = await db.query<Record<string, boolean>>(
      `SELECT "waveDiscoveryOpen", "waveOnboardingOpen", "waveTicketsOpen", "waveDirectBookingsOpen"
         FROM "PlatformSettings" WHERE id = 'singleton'`
    );
    expect(rows.length, "the platform settings row exists on QA").toBe(1);
    return rows[0];
  });
}

test("[S1b-a] launch-waves read hint returns exactly four booleans W1-W4", async ({ playwright, baseURL }) => {
  // Public endpoint: use a fresh, signed-out request context.
  const anon = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  const res = await anon.get("/api/platform-settings/launch-waves");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Object.keys(body).sort()).toEqual(["W1", "W2", "W3", "W4"]);
  for (const w of ["W1", "W2", "W3", "W4"]) expect(typeof body[w], `${w} is a boolean`).toBe("boolean");
  await anon.dispose();
});

test("[S1b-a] launch-waves read hint matches the QA PlatformSettings row @needs-db", async ({ page }) => {
  const row = await readWaveRow();
  const body = await (await page.request.get("/api/platform-settings/launch-waves")).json();
  for (const [wave, col] of Object.entries(WAVE_COLUMNS)) {
    expect(body[wave], `${wave} mirrors ${col}`).toBe(row[col]);
  }
});

for (const col of Object.values(WAVE_COLUMNS)) {
  test(`[S1b-a] settings API rejects a non-boolean ${col} (nothing written) @needs-db`, async ({ page }) => {
    const before = await readWaveRow();
    for (const bad of ["yes", 1, null]) {
      const res = await page.request.patch("/api/admin/platform-settings", { data: { [col]: bad } });
      expect(res.status(), `${col}=${JSON.stringify(bad)}`).toBe(400);
      expect((await res.json()).error).toBe(`${col} must be a boolean`);
    }
    expect(await readWaveRow()).toEqual(before);
  });
}
