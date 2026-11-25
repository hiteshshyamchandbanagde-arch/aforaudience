/**
 * User name realism correction — see docs/user-name-realism-spec.md for the
 * full brief.
 *
 * UPDATE-only pass over "User"."displayName" for rows whose "name" still
 * matches one of the two seed-pattern regexes (qa-seed.ts's `qa_role_NNN`
 * or qa-seed-load-test-users.ts's `RolePrefixNNNNNNNN`). Targets
 * displayName, not name — name is @unique and doubles as the login
 * username (see resolveIdentifierToUser in src/lib/auth-helpers.ts), so
 * writing realistic human names (which collide constantly at this volume
 * and contain spaces) into it would blow the unique constraint and break
 * username-login. displayName has no such constraint and is exactly what
 * every user-facing surface already reads via `displayName ?? name`.
 *
 * Every generated value is a pure deterministic function of the row's
 * (stable, untouched) `name` — same input always produces the same output,
 * so re-running this script is a no-op in effect even though it always
 * issues the UPDATE. That also means it naturally re-corrects the 220
 * base-seed rows, which already have a non-null displayName (faker
 * fullName(), e.g. "Chitraksh Menon III") that's just as pattern-y/fake-
 * looking as the raw name field.
 *
 * Run:
 *   npx tsx scripts/qa-fix-user-display-names.ts --check-only   (guard check only, no DB writes, no DB connection)
 *   npx tsx scripts/qa-fix-user-display-names.ts                (default: preview, read-only)
 *   npx tsx scripts/qa-fix-user-display-names.ts --preview      (same as above, explicit)
 *   npx tsx scripts/qa-fix-user-display-names.ts --execute      (real run — writes to the DB)
 *
 * Unlike scripts/qa-seed-load-test-users.ts (additive-only, defaults to a
 * real run), this script defaults to preview because it mutates existing
 * identity data across the whole User table — --execute must be passed
 * explicitly.
 */

import "dotenv/config"
import { Pool } from "pg"

// ---------------------------------------------------------------------------
// Hard guard — must run before any DB connection object is constructed.
// Identical pattern to scripts/qa-seed.ts's assertQaDatabase.
// ---------------------------------------------------------------------------

const QA_PROJECT_REF = "nqiyrypmjtogoocerxtu"
const PROD_PROJECT_REF = "cncumfwwnjcwacggrgsr"

function assertQaDatabase(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error("[fix-display-names] DATABASE_URL is not set. Refusing to run.")
    process.exit(1)
  }
  if (url.includes(PROD_PROJECT_REF)) {
    console.error(
      `[fix-display-names] DATABASE_URL points at the PROD Supabase project (${PROD_PROJECT_REF}). ` +
        `Refusing to run — this script must never touch prod.`
    )
    process.exit(1)
  }
  if (!url.includes(QA_PROJECT_REF)) {
    console.error(
      `[fix-display-names] DATABASE_URL does not reference the QA Supabase project (${QA_PROJECT_REF}). ` +
        `Refusing to run against an unrecognized database.`
    )
    process.exit(1)
  }
  return url
}

// ---------------------------------------------------------------------------
// Scope — the two seed-pattern regexes from docs/user-name-realism-spec.md.
// Postgres POSIX regex syntax, used both in the SELECT (Node side, via JS
// RegExp mirrors below) and passed as literal strings to SQL.
// ---------------------------------------------------------------------------

const BASE_SEED_SQL_PATTERN = "^qa_[a-z]+_[0-9]+$"
const LOAD_TEST_SQL_PATTERN = "^(Audi|Organiser|Venue|Artist)[0-9]{8}$"

// ---------------------------------------------------------------------------
// Deterministic hash — FNV-1a 32-bit. Not cryptographic; just needs to
// spread a stable string input across a pool index reproducibly.
// ---------------------------------------------------------------------------

function hashInt(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function pickIndex(seed: string, poolLength: number): number {
  return hashInt(seed) % poolLength
}

// ---------------------------------------------------------------------------
// Name pools — Indian-majority (sized so ~80% of draws land in the Indian
// sub-pool) with a minority international flavor for variety, per spec.
// Kept as separate Indian/Other first+last pools (rather than one flat
// list) so a picked full name is internally coherent (Indian first +
// Indian last, or Other + Other) rather than randomly mixed.
// ---------------------------------------------------------------------------

const INDIAN_FIRST_NAMES = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Krishna", "Ishaan", "Rohan",
  "Kabir", "Aryan", "Dhruv", "Karan", "Rahul", "Amit", "Rajesh", "Suresh", "Vikram", "Anil",
  "Sanjay", "Manoj", "Deepak", "Ashok", "Ramesh", "Naveen", "Praveen", "Gaurav", "Nikhil", "Varun",
  "Siddharth", "Abhishek", "Harsh", "Yash", "Aniket", "Om", "Pranav", "Tanmay", "Vedant", "Devansh",
  "Arun", "Karthik", "Vijay", "Ganesh", "Srinivas", "Venkatesh", "Mahesh", "Prakash", "Ravi", "Anand",
  "Saanvi", "Aadhya", "Ananya", "Diya", "Ira", "Myra", "Sara", "Aarohi", "Anika", "Kavya",
  "Meera", "Priya", "Neha", "Pooja", "Ritu", "Kiran", "Divya", "Shruti", "Swati", "Anjali",
  "Nisha", "Sunita", "Kavita", "Rekha", "Geeta", "Radha", "Ishita", "Riya", "Simran", "Tanvi",
  "Yamini", "Lakshmi", "Padma", "Deepa", "Anitha", "Priyanka",
]

const INDIAN_LAST_NAMES = [
  "Sharma", "Verma", "Gupta", "Mehta", "Shah", "Patel", "Desai", "Joshi", "Kulkarni", "Deshpande",
  "Iyer", "Iyengar", "Nair", "Menon", "Pillai", "Rao", "Reddy", "Naidu", "Chowdhury", "Banerjee",
  "Mukherjee", "Chatterjee", "Sengupta", "Bose", "Ghosh", "Das", "Dutta", "Sen", "Kapoor", "Khanna",
  "Malhotra", "Chopra", "Bhatia", "Arora", "Singh", "Kaur", "Gill", "Sandhu", "Sidhu", "Grewal",
  "Yadav", "Chauhan", "Rathore", "Rajput", "Thakur", "Pandey", "Mishra", "Tiwari", "Dubey", "Trivedi",
  "Shukla", "Saxena", "Agarwal", "Aggarwal", "Bansal", "Jain", "Goyal", "Mittal", "Goel", "Chandra",
  "Varma", "Prasad", "Kumar", "Nayar", "Warrier", "Krishnan", "Subramaniam", "Venkatesan", "Raghavan",
  "Balasubramanian", "Chandrasekhar", "Hegde", "Shetty", "Kamath", "Pai", "Bhat", "Acharya", "Bhatt",
  "Panicker", "Nambiar",
]

const OTHER_FIRST_NAMES = [
  "James", "Michael", "David", "John", "Robert", "Daniel", "Thomas", "Alexander", "William", "Benjamin",
  "Emma", "Olivia", "Sophia", "Isabella", "Charlotte", "Mia", "Amelia", "Grace", "Chloe", "Lily",
]

const OTHER_LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Wilson", "Anderson", "Taylor",
  "Moore", "Martin", "Lee", "Walker", "Clark", "Wright", "Baker", "Nelson", "Carter", "Evans",
]

// Multi-word stage/performer names spanning music, comedy, spoken word, and
// variety/drag — avoids generic single-word names per spec.
const STAGE_NAMES = [
  "DJ Neon", "The Firestorm Collective", "Midnight Radio", "Velvet Static", "The Ember Room",
  "Static & Sway", "Rooftop Renegades", "Paper Moon Poets", "The Laughing Anchor", "Blackout Comedy Co.",
  "Neon Owl", "The Wandering Chord", "Loose Mic Society", "The Velvet Hammer", "Copper Fox Collective",
  "The Punchline Parade", "Glass House Sessions", "The Midnight Verse", "Echo & Ember", "The Rogue Notebook",
  "Sunset Static", "The Comic Underground", "Wildfire Radio", "The Spoken Circuit", "Neon Ghost",
  "The Improv Alley", "Painted Sky Poets", "The Backstage Bandits", "Broken Compass Comedy", "The Velvet Curtain",
  "Static Bloom", "The Roadside Prophets", "Moonlight Mischief", "The Open Mic Outlaws", "Rust & Rhyme",
  "The Second Take", "Crimson Static", "The Punchdrunk Poets", "Whiskey & Wordplay", "The Late Show Renegades",
  "Neon Alley Comedy", "The Storyline Collective", "Feedback Loop", "The Green Room Gang", "Silver Static",
  "The Curtain Call Crew", "Loudmouth Theatre", "The Improv Insurgents", "Static Horizon", "The Comeback Chorus",
  "Twilight Verse", "The Backyard Bard", "Freefall Comedy", "The Amber Room", "Split Timing",
  "The Wanderlust Wordsmiths", "Analog Static", "The Encore Collective", "Downtown Drift", "The Nightcap Sessions",
  "Static Bloom Theatre", "The Runaway Poets", "Foghorn Comedy", "The Velvet Verse", "Backstage Static",
  "The Roadhouse Rhymers", "Midnight Marquee", "The Loose Ends Collective", "Firelight Comedy", "The Spare Change Poets",
  "Neon Static Theatre", "The Afterhours Collective", "Driftwood Comedy", "The Painted Curtain", "Loose Change Radio",
  "The Comic Compass", "Static Lantern", "The Rogue Ensemble", "Midnight Anthem", "The Curtain Draw Collective",
  "Off-Script Comedy", "The Wandering Verse", "Neon Marquee", "The Sideshow Poets", "Static Wanderers",
  "The Punchline Prophets", "Afterglow Comedy", "The Loose Mic Collective", "Rusty Compass", "The Encore Renegades",
  "Static & Verse", "The Backroom Bard", "Nightshade Comedy", "The Open Verse Collective", "Feedback & Flame",
  "The Improv Ensemble", "Static Parade", "The Comic Caravan", "Rooftop Radio", "The Wandering Punchline",
  "Neon Compass", "The Second Encore", "Loose Verse Society", "The Static Chorus", "Backstage Radio",
  "The Improv Circuit", "Rustbelt Comedy", "The Painted Verse", "Static & Sage", "The Wanderlust Comedy Co.",
  "Afterglow Static", "The Loose Mic Renegades", "Neon Ensemble", "The Curtain Call Comedy", "Static Marquee",
  "The Rogue Radio", "Driftwood Verse", "The Encore Ensemble", "Loose Change Comedy", "The Backroom Poets",
  "Static Wanderlust", "The Punchline Ensemble", "Rooftop Verse", "The Amber Curtain", "Static Afterglow",
  "The Comic Collective", "Firelight Verse", "The Rogue Marquee", "Neon Afterhours", "The Wandering Comic",
]

const INDIAN_LOCALE_WEIGHT = 80 // out of 100 — "Indian-majority" per spec

function humanName(name: string): string {
  const isIndian = pickIndex(`${name}:locale`, 100) < INDIAN_LOCALE_WEIGHT
  const firstPool = isIndian ? INDIAN_FIRST_NAMES : OTHER_FIRST_NAMES
  const lastPool = isIndian ? INDIAN_LAST_NAMES : OTHER_LAST_NAMES
  const first = firstPool[pickIndex(`${name}:first`, firstPool.length)]
  const last = lastPool[pickIndex(`${name}:last`, lastPool.length)]
  return `${first} ${last}`
}

function stageName(name: string): string {
  return STAGE_NAMES[pickIndex(`${name}:stage`, STAGE_NAMES.length)]
}

/**
 * Deterministic split for Artist: even/odd on the row's own trailing
 * numeric counter (already embedded in `name`, e.g. "qa_artist_007" -> 7,
 * "Artist00000123" -> 123) — guarantees an exact 50/50 split per batch
 * without needing any extra state.
 */
function generateDisplayName(name: string, role: string): string {
  if (role !== "ARTIST") return humanName(name)

  const match = name.match(/([0-9]+)$/)
  const counter = match ? parseInt(match[1], 10) : hashInt(name)
  return counter % 2 === 0 ? stageName(name) : humanName(name)
}

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------

type Row = { id: string; name: string; role: string; displayName: string | null }

async function fetchInScopeRows(pool: Pool): Promise<Row[]> {
  const { rows } = await pool.query<Row>(
    `SELECT id, name, role, "displayName" FROM "User" WHERE name ~ $1 OR name ~ $2 ORDER BY role, name`,
    [BASE_SEED_SQL_PATTERN, LOAD_TEST_SQL_PATTERN]
  )
  return rows
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function applyUpdates(pool: Pool, rows: Array<{ id: string; displayName: string }>): Promise<number> {
  let updated = 0
  for (const batch of chunk(rows, 400)) {
    const ids = batch.map((r) => r.id)
    const names = batch.map((r) => r.displayName)
    const res = await pool.query(
      `UPDATE "User" u SET "displayName" = data.dn
       FROM (SELECT unnest($1::text[]) AS id, unnest($2::text[]) AS dn) AS data
       WHERE u.id = data.id`,
      [ids, names]
    )
    updated += res.rowCount ?? 0
  }
  return updated
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function batchOf(name: string): "base-seed" | "load-test" {
  return new RegExp(`^${BASE_SEED_SQL_PATTERN.slice(1, -1)}$`).test(name) ? "base-seed" : "load-test"
}

function printReport(rows: Row[]) {
  const byBatchRole = new Map<string, number>()
  for (const r of rows) {
    const key = `${batchOf(r.name)} / ${r.role}`
    byBatchRole.set(key, (byBatchRole.get(key) ?? 0) + 1)
  }

  console.log(`\n[fix-display-names] Rows matching in-scope patterns: ${rows.length}`)
  console.log("[fix-display-names] Breakdown by pattern/role:")
  for (const [key, count] of [...byBatchRole.entries()].sort()) {
    console.log(`  - ${key}: ${count}`)
  }

  const alreadySet = rows.filter((r) => r.displayName !== null).length
  console.log(`[fix-display-names] Of these, ${alreadySet} already have a non-null displayName (will be overwritten — see spec note on faker-artifact names).`)

  console.log(`\n[fix-display-names] Sample before/after (15 rows across roles/batches):`)
  const samples: Row[] = []
  for (const role of ["AUDIENCE", "ORGANISER", "VENUE_OWNER", "ARTIST"]) {
    const baseRow = rows.find((r) => r.role === role && batchOf(r.name) === "base-seed")
    const loadRow = rows.find((r) => r.role === role && batchOf(r.name) === "load-test")
    if (baseRow) samples.push(baseRow)
    if (loadRow) samples.push(loadRow)
  }
  // Pad out to ~15 with more Artist rows so both stage-name and human-name
  // branches are visible in the sample (deterministic split is index-based).
  const moreArtists = rows.filter((r) => r.role === "ARTIST" && !samples.includes(r)).slice(0, 15 - samples.length)
  samples.push(...moreArtists)

  for (const r of samples.slice(0, 15)) {
    const after = generateDisplayName(r.name, r.role)
    console.log(`  [${batchOf(r.name)}] ${r.role.padEnd(11)} name=${r.name.padEnd(20)} before="${r.displayName ?? "(null)"}" -> after="${after}"`)
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const databaseUrl = assertQaDatabase() // must be the first thing that touches DATABASE_URL

  if (process.argv.includes("--check-only")) {
    console.log(`[fix-display-names] Guard check passed: DATABASE_URL references the QA Supabase project (${QA_PROJECT_REF}).`)
    console.log("[fix-display-names] --check-only: exiting before any database connection is made. No writes.")
    return
  }

  const execute = process.argv.includes("--execute")

  const connectionString = databaseUrl.includes("uselibpqcompat=")
    ? databaseUrl
    : `${databaseUrl}${databaseUrl.includes("?") ? "&" : "?"}uselibpqcompat=true`

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 5 })

  try {
    const rows = await fetchInScopeRows(pool)
    printReport(rows)

    if (!execute) {
      console.log("\n[fix-display-names] Preview only — nothing was written. Re-run with --execute to update for real.")
      return
    }

    console.log(`\n[fix-display-names] --execute passed. Writing displayName for ${rows.length} rows in batches of 400...`)
    const updates = rows.map((r) => ({ id: r.id, displayName: generateDisplayName(r.name, r.role) }))
    const updated = await applyUpdates(pool, updates)
    console.log(`[fix-display-names] Rows updated: ${updated}`)

    const remaining = await fetchInScopeRows(pool)
    const stillNull = remaining.filter((r) => r.displayName === null).length
    console.log(`[fix-display-names] Post-run check: ${remaining.length} rows still match the old name patterns (expected — name itself is untouched), ${stillNull} of those still have a null displayName (expected 0).`)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error("[fix-display-names] Failed:", err)
  process.exit(1)
})
