import path from "path";

/**
 * QA personas (seeded by scripts/qa-seed.ts, protected from nothing - a
 * reseed recreates them with the same emails and ids). QA only, never
 * production (docs/testing-rules.md T6).
 *
 * global-setup.ts logs each one in once per run and saves the session to
 * e2e/.auth/<key>.json; specs reuse it with
 * `test.use({ storageState: authFile("omkar") })` instead of logging in
 * per test.
 */
const PERSONA_PASSWORD = process.env.E2E_PERSONA_PASSWORD ?? "QaPass!2026";
const FIXTURE_PASSWORD = process.env.E2E_FIXTURE_PASSWORD ?? "E2eFixture!2026";

export const PERSONAS = {
  atul: { label: "Atul (Audience)", identifier: "atul.audience@aforaudience.qa", password: PERSONA_PASSWORD },
  omkar: { label: "Omkar (Organiser + Venue Owner)", identifier: "omkar.organiser@aforaudience.qa", password: PERSONA_PASSWORD },
  vinayak: { label: "Vinayak (Venue Owner)", identifier: "vinayak.venue@aforaudience.qa", password: PERSONA_PASSWORD },
  hrithik: { label: "Hrithik (Artist)", identifier: "hrithik.artist@aforaudience.qa", password: PERSONA_PASSWORD },
  // A second Artist, so two different artists can want the same slot (waitlist spec).
  shahrukh: { label: "Shahrukh (Artist)", identifier: "shahrukh.artist@aforaudience.qa", password: PERSONA_PASSWORD },
  // The shared waitlist/wallet + competition-show fixture Organiser (see
  // helpers/roles.ts FIXTURE_ORGANISER).
  fixtureOrganiser: { label: "E2E Fixture Organiser", identifier: "e2e.fixture.organiser@example.com", password: FIXTURE_PASSWORD },
} as const;

export type PersonaKey = keyof typeof PERSONAS;

export const AUTH_DIR = path.join(__dirname, "..", ".auth");

/** Saved session for a persona, written by global-setup.ts. */
export function authFile(key: PersonaKey): string {
  return path.join(AUTH_DIR, `${key}.json`);
}
