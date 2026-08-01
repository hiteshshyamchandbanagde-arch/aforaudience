/**
 * Load-test volume user seed script — see docs/load-test-user-seed-spec.md
 * for the full brief.
 *
 * Companion to scripts/qa-seed.ts, NOT a replacement: this is a separate,
 * additive-only volume-user generator for load/perf testing. It never
 * wipes anything, never touches qa-seed.ts's output (100 audience / 10
 * organiser / 10 venue owner / 100 artist + golden scenario + e2e
 * fixtures), never touches Feedback/FeedbackChangeLog, and never creates
 * Venues or Events.
 *
 * Run:
 *   npx tsx scripts/qa-seed-load-test-users.ts --check-only   (guard check only, no DB writes, no DB connection)
 *   npx tsx scripts/qa-seed-load-test-users.ts --preview      (read-only: prints counts/samples + collision check)
 *   npx tsx scripts/qa-seed-load-test-users.ts                (real run)
 */

import "dotenv/config"
import { PrismaClient, Role } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import bcrypt from "bcryptjs"
import { put } from "@vercel/blob"

// ---------------------------------------------------------------------------
// Hard guard — must run before any DB connection object is constructed.
// Identical pattern to scripts/qa-seed.ts's assertQaDatabase.
// ---------------------------------------------------------------------------

const QA_PROJECT_REF = "nqiyrypmjtogoocerxtu"
const PROD_PROJECT_REF = "cncumfwwnjcwacggrgsr"

function assertQaDatabase(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error("[load-test-seed] DATABASE_URL is not set. Refusing to run.")
    process.exit(1)
  }
  if (url.includes(PROD_PROJECT_REF)) {
    console.error(
      `[load-test-seed] DATABASE_URL points at the PROD Supabase project (${PROD_PROJECT_REF}). ` +
        `Refusing to run — this script must never touch prod.`
    )
    process.exit(1)
  }
  if (!url.includes(QA_PROJECT_REF)) {
    console.error(
      `[load-test-seed] DATABASE_URL does not reference the QA Supabase project (${QA_PROJECT_REF}). ` +
        `Refusing to run against an unrecognized database.`
    )
    process.exit(1)
  }
  return url
}

// ---------------------------------------------------------------------------
// Small helpers (mirrors scripts/qa-seed.ts)
// ---------------------------------------------------------------------------

const pad = (n: number, width: number) => String(n).padStart(width, "0")

const passwordHashCache = new Map<string, string>()
async function hashPassword(pw: string): Promise<string> {
  let hash = passwordHashCache.get(pw)
  if (!hash) {
    hash = await bcrypt.hash(pw, 10)
    passwordHashCache.set(pw, hash)
  }
  return hash
}

/** Runs `fn` over `items` with at most `limit` in flight at once. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)),
  ])
}

// ---------------------------------------------------------------------------
// Role config / naming scheme — fixed 8-digit zero-padded counters, per
// docs/load-test-user-seed-spec.md's naming table.
// ---------------------------------------------------------------------------

type RoleKey = "AUDIENCE" | "ORGANISER" | "VENUE_OWNER" | "ARTIST"

const EMAIL_DOMAIN = "qa.aforaudience.test"

const ROLE_CONFIG: Record<RoleKey, { role: Role; namePrefix: string; idPrefix: string; phonePrefix: string; count: number; password: string }> = {
  AUDIENCE: { role: Role.AUDIENCE, namePrefix: "Audi", idPrefix: "load-audience", phonePrefix: "98", count: 5000, password: "Audi@123" },
  ORGANISER: { role: Role.ORGANISER, namePrefix: "Organiser", idPrefix: "load-organiser", phonePrefix: "96", count: 200, password: "Organ@123" },
  VENUE_OWNER: { role: Role.VENUE_OWNER, namePrefix: "Venue", idPrefix: "load-venueowner", phonePrefix: "97", count: 100, password: "Venue@123" },
  ARTIST: { role: Role.ARTIST, namePrefix: "Artist", idPrefix: "load-artist", phonePrefix: "95", count: 300, password: "Artist@123" },
}

type Target = { id: string; name: string; email: string; phone: string }

function buildTarget(cfg: (typeof ROLE_CONFIG)[RoleKey], i: number): Target {
  const counter = pad(i, 8)
  const name = `${cfg.namePrefix}${counter}`
  return {
    id: `${cfg.idPrefix}-${counter}`,
    name,
    email: `${name}@${EMAIL_DOMAIN}`,
    phone: `${cfg.phonePrefix}${counter}`,
  }
}

function collectAllTargets(): Array<Target & { key: RoleKey }> {
  const all: Array<Target & { key: RoleKey }> = []
  for (const key of Object.keys(ROLE_CONFIG) as RoleKey[]) {
    const cfg = ROLE_CONFIG[key]
    for (let i = 1; i <= cfg.count; i++) all.push({ ...buildTarget(cfg, i), key })
  }
  return all
}

// ---------------------------------------------------------------------------
// Artist-specific: bio pool + avatar (real Vercel Blob upload, budget-aware
// placeholder fallback). No artist may end up with a null/empty bio or
// avatar.
// ---------------------------------------------------------------------------

const BIO_TEMPLATES = [
  "Storyteller at heart, always chasing the next great stage moment.",
  "Blending humor and honesty on stage, one performance at a time.",
  "A passionate performer building a career one open mic at a time.",
  "Loves connecting with a live crowd more than anything else.",
  "Constantly experimenting with new material and new formats.",
  "Draws inspiration from everyday life and turns it into art.",
  "Believes every stage, big or small, deserves full effort.",
  "On a mission to make audiences laugh, think, and feel something.",
  "Started out performing for friends, now performing for the world.",
  "Equal parts discipline and spontaneity — that's the act.",
]

function bioFor(i: number): string {
  return BIO_TEMPLATES[(i - 1) % BIO_TEMPLATES.length]
}

// Total runtime budget from the spec (~10 min end-to-end). Real uploads stop
// being attempted once this many ms have elapsed since script start, leaving
// a buffer for the rest of the run to finish inside the ~10min target -
// placeholder is a timing safety valve, not a fixed ratio.
const REAL_UPLOAD_CUTOFF_MS = 9 * 60 * 1000
const UPLOAD_TIMEOUT_MS = 20_000

/** Fast external avatar URL - same GitHub-avatar convention faker.image.avatarGitHub() produces elsewhere in qa-seed.ts. */
function placeholderAvatarUrl(counter: number): string {
  return `https://avatars.githubusercontent.com/u/${1_000_000 + counter}?v=4`
}

const scriptStart = Date.now()
const blobConfigured = !!process.env.BLOB_READ_WRITE_TOKEN
let realUploadCount = 0
let placeholderCount = 0
let budgetTripped = false

async function resolveArtistAvatar(id: string, name: string, counter: number): Promise<string> {
  const elapsed = Date.now() - scriptStart
  if (elapsed > REAL_UPLOAD_CUTOFF_MS) budgetTripped = true

  if (!blobConfigured || budgetTripped) {
    placeholderCount++
    return placeholderAvatarUrl(counter)
  }

  try {
    const imageUrl = `https://picsum.photos/seed/${encodeURIComponent(name)}/400/400`
    const res = await withTimeout(fetch(imageUrl), UPLOAD_TIMEOUT_MS)
    if (!res.ok) throw new Error(`image source returned ${res.status}`)
    const bytes = Buffer.from(await res.arrayBuffer())
    // Same key convention as src/app/api/upload/avatar/route.ts's real upload path.
    const blob = await withTimeout(
      put(`avatars/${id}-${Date.now()}.jpg`, bytes, { access: "public", addRandomSuffix: true, contentType: "image/jpeg" }),
      UPLOAD_TIMEOUT_MS
    )
    realUploadCount++
    return blob.url
  } catch (err) {
    console.warn(`[load-test-seed]   avatar real-upload failed for ${name}, falling back to placeholder: ${(err as Error).message}`)
    placeholderCount++
    return placeholderAvatarUrl(counter)
  }
}

// ---------------------------------------------------------------------------
// Pre-insert collision check — safety net against existing data (email/
// phone), not against this script's own prior runs (those are expected and
// handled via upsert-by-deterministic-id below).
// ---------------------------------------------------------------------------

async function checkCollisions(prisma: PrismaClient, targets: Target[]): Promise<string[]> {
  const emailToTarget = new Map(targets.map((t) => [t.email, t]))
  const phoneToTarget = new Map(targets.map((t) => [t.phone, t]))
  const conflicts: string[] = []

  for (const group of chunk(targets, 1000)) {
    const rows = await prisma.user.findMany({
      where: {
        OR: [{ email: { in: group.map((t) => t.email) } }, { phone: { in: group.map((t) => t.phone) } }],
      },
      select: { id: true, email: true, phone: true },
    })
    for (const row of rows) {
      const byEmail = emailToTarget.get(row.email)
      if (byEmail && byEmail.id !== row.id) {
        conflicts.push(`email ${row.email} already belongs to user id=${row.id} (expected id=${byEmail.id})`)
      }
      if (row.phone) {
        const byPhone = phoneToTarget.get(row.phone)
        if (byPhone && byPhone.id !== row.id) {
          conflicts.push(`phone ${row.phone} already belongs to user id=${row.id} (expected id=${byPhone.id})`)
        }
      }
    }
  }
  return conflicts
}

async function fetchExistingIds(prisma: PrismaClient, ids: string[]): Promise<Set<string>> {
  const existing = new Set<string>()
  for (const group of chunk(ids, 1000)) {
    const rows = await prisma.user.findMany({ where: { id: { in: group } }, select: { id: true } })
    for (const row of rows) existing.add(row.id)
  }
  return existing
}

// ---------------------------------------------------------------------------
// Seeding — Audience / Organiser / Venue Owner are plain User rows (no
// child domain row per docs/load-test-user-seed-spec.md's scope). Artist
// gets a User row + child Artist row (bio, avatar).
// ---------------------------------------------------------------------------

async function seedSimpleRole(prisma: PrismaClient, key: "AUDIENCE" | "ORGANISER" | "VENUE_OWNER") {
  const cfg = ROLE_CONFIG[key]
  const passwordHash = await hashPassword(cfg.password)
  const items = Array.from({ length: cfg.count }, (_, idx) => idx + 1)
  const targetIds = items.map((i) => buildTarget(cfg, i).id)
  const existingIds = await fetchExistingIds(prisma, targetIds)

  console.log(`\n[load-test-seed] ${cfg.role}: seeding ${cfg.count}...`)
  let created = 0
  let updated = 0

  await mapWithConcurrency(items, 50, async (i) => {
    const t = buildTarget(cfg, i)
    await prisma.user.upsert({
      where: { id: t.id },
      update: { email: t.email, phone: t.phone, password: passwordHash, role: cfg.role, isVerified: true, isApproved: true },
      create: {
        id: t.id,
        name: t.name,
        email: t.email,
        phone: t.phone,
        password: passwordHash,
        role: cfg.role,
        isVerified: true,
        isApproved: true,
      },
    })
    if (existingIds.has(t.id)) updated++
    else created++
  })

  console.log(`  - created: ${created}, already existed (re-run, updated): ${updated}`)
  return { role: cfg.role, created, updated, target: cfg.count }
}

async function seedArtists(prisma: PrismaClient) {
  const cfg = ROLE_CONFIG.ARTIST
  const passwordHash = await hashPassword(cfg.password)
  const items = Array.from({ length: cfg.count }, (_, idx) => idx + 1)
  const targetIds = items.map((i) => buildTarget(cfg, i).id)
  const existingIds = await fetchExistingIds(prisma, targetIds)

  console.log(`\n[load-test-seed] ${cfg.role}: seeding ${cfg.count} (+ Artist child rows)...`)
  console.log(
    `  - avatar mode: ${blobConfigured ? "real Vercel Blob upload (default), placeholder fallback on timeout/error/budget" : "BLOB_READ_WRITE_TOKEN not set — placeholder for all"}`
  )
  let created = 0
  let updated = 0

  await mapWithConcurrency(items, 50, async (i) => {
    const t = buildTarget(cfg, i)
    const avatar = await resolveArtistAvatar(t.id, t.name, i)
    const bio = bioFor(i)

    await prisma.user.upsert({
      where: { id: t.id },
      update: { email: t.email, phone: t.phone, password: passwordHash, role: cfg.role, avatar, isVerified: true, isApproved: true },
      create: {
        id: t.id,
        name: t.name,
        email: t.email,
        phone: t.phone,
        password: passwordHash,
        role: cfg.role,
        avatar,
        isVerified: true,
        isApproved: true,
      },
    })

    await prisma.artist.upsert({
      where: { userId: t.id },
      update: { bio },
      create: {
        id: `${t.id}-profile`,
        userId: t.id,
        bio,
        genre: [],
        styleTag: [],
        videoReel: [],
      },
    })

    if (existingIds.has(t.id)) updated++
    else created++
  })

  console.log(`  - created: ${created}, already existed (re-run, updated): ${updated}`)
  console.log(`  - avatars: ${realUploadCount} real Blob uploads, ${placeholderCount} placeholder fallbacks`)
  return { role: cfg.role, created, updated, target: cfg.count, realUploadCount, placeholderCount }
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

function printPreview() {
  console.log("\n[load-test-seed] PREVIEW — read-only, no writes will be made.\n")
  let total = 0
  for (const key of Object.keys(ROLE_CONFIG) as RoleKey[]) {
    const cfg = ROLE_CONFIG[key]
    total += cfg.count
    const first = buildTarget(cfg, 1)
    const last = buildTarget(cfg, cfg.count)
    console.log(`${cfg.role}: ${cfg.count} rows, password "${cfg.password}"`)
    console.log(`  first: id=${first.id}  name=${first.name}  email=${first.email}  phone=${first.phone}`)
    console.log(`  last:  id=${last.id}  name=${last.name}  email=${last.email}  phone=${last.phone}`)
  }
  console.log(`\nTotal User rows: ${total}`)
  console.log(`Artist child rows: ${ROLE_CONFIG.ARTIST.count} (bio cycled from ${BIO_TEMPLATES.length} templates)`)
  console.log(
    `Artist avatars: ${
      blobConfigured
        ? "BLOB_READ_WRITE_TOKEN is set — real Vercel Blob upload will be attempted for each artist by default"
        : "BLOB_READ_WRITE_TOKEN is NOT set in this environment — every artist will fall back to the placeholder avatar URL"
    }`
  )
  console.log("All created/updated rows: isVerified=true, isApproved=true.")
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const databaseUrl = assertQaDatabase() // must be the first thing that touches DATABASE_URL

  if (process.argv.includes("--check-only")) {
    console.log(`[load-test-seed] Guard check passed: DATABASE_URL references the QA Supabase project (${QA_PROJECT_REF}).`)
    console.log("[load-test-seed] --check-only: exiting before any database connection is made. No writes.")
    return
  }

  const connectionString = databaseUrl.includes("uselibpqcompat=")
    ? databaseUrl
    : `${databaseUrl}${databaseUrl.includes("?") ? "&" : "?"}uselibpqcompat=true`

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 5 })
  const adapter = new PrismaPg(pool, { disposeExternalPool: false })
  const prisma = new PrismaClient({ adapter })

  try {
    const targets = collectAllTargets()

    if (process.argv.includes("--preview")) {
      printPreview()
      console.log("\n[load-test-seed] Running pre-insert collision check against existing data (read-only)...")
      const conflicts = await checkCollisions(prisma, targets)
      if (conflicts.length > 0) {
        console.log(`\n[load-test-seed] WARNING: ${conflicts.length} potential collision(s) found:`)
        conflicts.slice(0, 20).forEach((c) => console.log(`  - ${c}`))
      } else {
        console.log("[load-test-seed] No collisions found against existing data.")
      }
      console.log("\n[load-test-seed] Preview only — nothing was written. Re-run without --preview to insert for real.")
      return
    }

    console.log("[load-test-seed] Pre-insert collision check (email/phone vs existing data)...")
    const conflicts = await checkCollisions(prisma, targets)
    if (conflicts.length > 0) {
      console.error(`[load-test-seed] Aborting: ${conflicts.length} collision(s) found against existing data. No writes made.`)
      conflicts.slice(0, 20).forEach((c) => console.error(`  - ${c}`))
      process.exit(1)
    }
    console.log("[load-test-seed] No collisions. Proceeding.")

    const audience = await seedSimpleRole(prisma, "AUDIENCE")
    const organiser = await seedSimpleRole(prisma, "ORGANISER")
    const venueOwner = await seedSimpleRole(prisma, "VENUE_OWNER")
    const artist = await seedArtists(prisma)

    console.log("\n[load-test-seed] Self-tallied summary:")
    for (const r of [audience, organiser, venueOwner, artist]) {
      console.log(`  - ${r.role}: ${r.created} created, ${r.updated} already existed, target ${r.target}`)
    }
    console.log(`  - Artist avatars: ${artist.realUploadCount} real Blob uploads, ${artist.placeholderCount} placeholder fallbacks`)

    console.log("\n[load-test-seed] Independent DB row counts (query, not self-tally):")
    const [audienceCount, organiserCount, venueOwnerCount, artistUserCount, artistProfileCount] = await Promise.all([
      prisma.user.count({ where: { id: { startsWith: "load-audience-" } } }),
      prisma.user.count({ where: { id: { startsWith: "load-organiser-" } } }),
      prisma.user.count({ where: { id: { startsWith: "load-venueowner-" } } }),
      prisma.user.count({ where: { id: { startsWith: "load-artist-" } } }),
      prisma.artist.count({ where: { id: { startsWith: "load-artist-" } } }),
    ])
    console.log(`  - User rows id LIKE 'load-audience-%':   ${audienceCount} (target ${ROLE_CONFIG.AUDIENCE.count})`)
    console.log(`  - User rows id LIKE 'load-organiser-%':  ${organiserCount} (target ${ROLE_CONFIG.ORGANISER.count})`)
    console.log(`  - User rows id LIKE 'load-venueowner-%': ${venueOwnerCount} (target ${ROLE_CONFIG.VENUE_OWNER.count})`)
    console.log(`  - User rows id LIKE 'load-artist-%':     ${artistUserCount} (target ${ROLE_CONFIG.ARTIST.count})`)
    console.log(`  - Artist rows id LIKE 'load-artist-%':   ${artistProfileCount} (target ${ROLE_CONFIG.ARTIST.count})`)

    console.log(`\n[load-test-seed] Total elapsed: ${((Date.now() - scriptStart) / 1000).toFixed(1)}s`)
    console.log("[load-test-seed] Done.")
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((err) => {
  console.error("[load-test-seed] Failed:", err)
  process.exit(1)
})
