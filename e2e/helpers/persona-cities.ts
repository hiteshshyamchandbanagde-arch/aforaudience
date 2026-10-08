import type { ClientBase } from "pg";
import type { PersonaKey } from "./personas";

/**
 * The personas whose saved city (User.defaultCity) the suite relies on.
 *
 * A signed-in person's saved city beats every cookie (src/lib/location.ts),
 * so /events lists that city first. saved-events.spec.ts finds the Jaipur
 * Mic Gala 100 card on Atul's /events: with Atul saved in Mumbai the list
 * is "No events in Mumbai" and the spec fails on every branch, with no
 * code change (7 Oct 2026: Atul's city was switched to Mumbai on QA by
 * hand at 12:32, after the last qa run; every later run went red).
 *
 * Specs never change these (they pick cities signed out, in a cookie:
 * docs/testing-rules.md T6), but people do, checking a city flow on QA
 * as Atul. So global-setup.ts puts them back at the start of every run
 * that has the QA database, and seed-health.spec.ts checks them before
 * any other spec. scripts/qa-seed.ts seeds the same values.
 */
export type PersonaCity = { persona: PersonaKey; email: string; label: string; city: string; country: string; usedBy: string };

export const PERSONA_CITIES: PersonaCity[] = [
  { persona: "atul", email: "atul.audience@aforaudience.qa", label: "Atul", city: "Jaipur", country: "India", usedBy: "saved-events" },
  { persona: "hrithik", email: "hrithik.artist@aforaudience.qa", label: "Hrithik", city: "Ballari", country: "India", usedBy: "location-chip-accounts" },
];

/** Puts each persona's saved city back; returns the ones that had drifted. */
export async function keepPersonaCities(db: ClientBase): Promise<{ label: string; from: string | null; to: string }[]> {
  const fixed: { label: string; from: string | null; to: string }[] = [];
  for (const p of PERSONA_CITIES) {
    const { rows } = await db.query(`SELECT "defaultCity" FROM "User" WHERE email = $1`, [p.email]);
    if (rows.length === 0 || rows[0].defaultCity === p.city) continue;
    await db.query(
      `UPDATE "User" SET "defaultCity" = $2, "defaultCityLat" = NULL, "defaultCityLng" = NULL, "defaultCountry" = $3 WHERE email = $1`,
      [p.email, p.city, p.country],
    );
    fixed.push({ label: p.label, from: rows[0].defaultCity, to: p.city });
  }
  return fixed;
}

/**
 * GEN-2610-006 - every persona's account language (User.preferredLocale)
 * is "none", so pages render in English unless a spec picks otherwise.
 * account-locale.spec.ts sets Atul's and puts it back itself; this catches
 * a run that died in between, or a hand-picked language on QA.
 */
export async function keepPersonaLocales(db: ClientBase, emails: string[]): Promise<{ email: string; from: string }[]> {
  const { rows } = await db.query(
    `UPDATE "User" u SET "preferredLocale" = NULL FROM "User" old
     WHERE u.id = old.id AND u.email = ANY($1) AND old."preferredLocale" IS NOT NULL
     RETURNING u.email, old."preferredLocale" AS "from"`,
    [emails],
  );
  return rows as { email: string; from: string }[];
}
