// Prod fresh-replay (22 Nov) - prod launch wipes the schema and runs
// `prisma migrate deploy`, i.e. every prisma/migrations/*/migration.sql in
// folder order on an EMPTY database. QA was built partly out-of-band
// (Supabase apply_migration), so nothing proved the files alone rebuild
// the schema. This test does exactly that, in memory (PGlite, real
// Postgres compiled to WASM - never touches QA or prod):
//   1. every migration.sql replays in order without error (failure names
//      the migration and the Postgres error);
//   2. the replayed DB matches prisma/schema.prisma: every model's table
//      and column exists with the right nullability, every enum exists
//      with exactly the schema's values;
//   3. seeded rows: DesignToken = the globals.css token set (same source
//      as migration-seed-parity.test.ts), PlatformSettings = only
//      'singleton', DisplayCurrencyRate = INR/USD/EUR/GBP/AED.
// Regression shape: fails on origin/qa at
// 20260802080000_feedback_workflow_overhaul (enum "FeedbackStatus" has
// no 'TESTED' on a fresh DB); passes once the replay-safe edits and the
// catch-up migration are in.
//
//   npx tsx scripts/migration-replay.test.ts
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

let passed = 0
let failed = 0
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    passed++
    console.log(`ok - ${name}`)
  } catch (e) {
    failed++
    console.log(`not ok - ${name}\n${(e as Error).message}`)
  }
}

const ROOT = join(__dirname, '..')
const MIGRATIONS = join(ROOT, 'prisma/migrations')
const norm = (v: string) => v.replace(/\s+/g, ' ').trim()

// ---- schema.prisma -> expected tables/columns/enums -----------------
type Expected = {
  tables: Map<string, Map<string, { nullable: boolean | null }>>
  enums: Map<string, string[]>
}

function parseSchema(): Expected {
  const src = readFileSync(join(ROOT, 'prisma/schema.prisma'), 'utf8')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n')
  const blocks = [...src.matchAll(/^(model|enum)\s+(\w+)\s*\{([\s\S]*?)^\}/gm)]
  const modelNames = new Set(blocks.filter((b) => b[1] === 'model').map((b) => b[2]))
  const tables: Expected['tables'] = new Map()
  const enums: Expected['enums'] = new Map()
  for (const [, kind, name, body] of blocks) {
    const lines = body.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('@@'))
    assert.ok(!/@map\(|@@map\(|@ignore/.test(body), `schema.prisma ${name}: @map/@ignore not supported by this test`)
    if (kind === 'enum') {
      enums.set(name, lines.map((l) => l.split(/\s+/)[0]))
      continue
    }
    const cols = new Map<string, { nullable: boolean | null }>()
    for (const l of lines) {
      const m = l.match(/^(\w+)\s+(\w+)(\[\])?(\?)?/)
      assert.ok(m, `schema.prisma ${name}: cannot parse field "${l}"`)
      if (modelNames.has(m[2])) continue // relation field, no column
      // Scalar lists (TEXT[]) can't be null in Prisma; Prisma's own SQL
      // leaves them nullable (init), hand-written SQL may add NOT NULL.
      // Either is fine, so nullability is not checked for lists (null).
      cols.set(m[1], { nullable: m[3] ? null : !!m[4] })
    }
    tables.set(name, cols)
  }
  return { tables, enums }
}

// ---- globals.css token set (same rule as migration-seed-parity) -----
function expectedTokens(): Map<string, string> {
  const css = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf8')
  const start = css.indexOf(':root {')
  assert.ok(start >= 0, 'no :root block in globals.css')
  const block = css.slice(start, css.indexOf('\n}', start))
  const out = new Map<string, string>()
  for (const m of block.matchAll(/(--afa-[a-z0-9-]+)\s*:\s*([^;]+);/g)) out.set(m[1], norm(m[2]))
  const dt = readFileSync(join(ROOT, 'src/lib/design-tokens.ts'), 'utf8')
  for (const k of ['--font-display', '--font-ui', '--font-sans', '--font-mono']) {
    const m = dt.match(new RegExp(`"${k}":\\s*"([^"]*)"`))
    assert.ok(m, `${k} missing from design-tokens.ts`)
    out.set(k, norm(m[1]))
  }
  return out
}

async function main() {
  const db = new PGlite()
  const dirs = readdirSync(MIGRATIONS)
    .filter((d) => statSync(join(MIGRATIONS, d)).isDirectory() && existsSync(join(MIGRATIONS, d, 'migration.sql')))
    .sort()

  let replayed = false
  await test(`all ${dirs.length} migrations replay in order on an empty database`, async () => {
    for (const d of dirs) {
      try {
        await db.exec(readFileSync(join(MIGRATIONS, d, 'migration.sql'), 'utf8'))
      } catch (e) {
        throw new Error(`migration ${d} failed: ${(e as Error).message}`)
      }
    }
    replayed = true
  })

  if (replayed) {
    const want = parseSchema()

    await test('every schema.prisma model has its table and columns (nullability matches, lists excepted)', async () => {
      const { rows } = await db.query<{ t: string; c: string; n: string }>(
        `SELECT table_name AS t, column_name AS c, is_nullable AS n FROM information_schema.columns WHERE table_schema = 'public'`,
      )
      const have = new Map<string, Map<string, boolean>>()
      for (const r of rows) {
        if (!have.has(r.t)) have.set(r.t, new Map())
        have.get(r.t)!.set(r.c, r.n === 'YES')
      }
      const problems: string[] = []
      for (const [t, cols] of want.tables) {
        const h = have.get(t)
        if (!h) { problems.push(`missing table ${t}`); continue }
        for (const [c, { nullable }] of cols) {
          if (!h.has(c)) problems.push(`missing column ${t}.${c}`)
          else if (nullable !== null && h.get(c) !== nullable) problems.push(`${t}.${c}: db ${h.get(c) ? 'NULL' : 'NOT NULL'}, schema ${nullable ? 'NULL' : 'NOT NULL'}`)
        }
      }
      assert.deepEqual(problems, [])
    })

    await test('every schema.prisma enum exists with exactly its values', async () => {
      const { rows } = await db.query<{ t: string; v: string }>(
        `SELECT t.typname AS t, e.enumlabel AS v FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
         JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' ORDER BY t.typname, e.enumsortorder`,
      )
      const have = new Map<string, string[]>()
      for (const r of rows) have.set(r.t, [...(have.get(r.t) ?? []), r.v])
      const problems: string[] = []
      for (const [e, vals] of want.enums) {
        const h = have.get(e)
        if (!h) { problems.push(`missing enum ${e}`); continue }
        const missing = vals.filter((v) => !h.includes(v))
        const extra = h.filter((v) => !vals.includes(v))
        if (missing.length || extra.length) problems.push(`${e}: missing [${missing}] extra [${extra}]`)
      }
      assert.deepEqual(problems, [])
    })

    await test('DesignToken rows equal the globals.css token set', async () => {
      const { rows } = await db.query<{ key: string; value: string }>(`SELECT key, value FROM "DesignToken"`)
      const got = new Map(rows.map((r) => [r.key, norm(r.value)]))
      const exp = expectedTokens()
      const extra = [...got.keys()].filter((k) => !exp.has(k)).sort()
      const missing = [...exp.keys()].filter((k) => !got.has(k)).sort()
      const diffs = [...exp].filter(([k, v]) => got.has(k) && got.get(k) !== v).map(([k, v]) => `${k}: db=${got.get(k)} css=${v}`)
      assert.deepEqual({ extra, missing, diffs }, { extra: [], missing: [], diffs: [] })
    })

    await test("PlatformSettings is exactly one row, 'singleton'", async () => {
      const { rows } = await db.query<{ id: string }>(`SELECT id FROM "PlatformSettings"`)
      assert.deepEqual(rows.map((r) => r.id), ['singleton'])
    })

    await test('DisplayCurrencyRate has INR, USD, EUR, GBP, AED', async () => {
      const { rows } = await db.query<{ code: string }>(`SELECT code FROM "DisplayCurrencyRate" ORDER BY code`)
      assert.deepEqual(rows.map((r) => r.code), ['AED', 'EUR', 'GBP', 'INR', 'USD'])
    })

    await test('role codes: User/Artist/Organiser/VenueOwner.code default to generate_role_code()', async () => {
      const { rows } = await db.query<{ t: string; d: string | null }>(
        `SELECT table_name AS t, column_default AS d FROM information_schema.columns
         WHERE table_schema = 'public' AND column_name = 'code' AND table_name IN ('User','Artist','Organiser','VenueOwner') ORDER BY 1`,
      )
      assert.deepEqual(
        rows.map((r) => `${r.t}: ${r.d}`),
        ['Artist: generate_role_code(\'ART\'::text)', 'Organiser: generate_role_code(\'ORG\'::text)', 'User: generate_role_code(\'AFA\'::text)', 'VenueOwner: generate_role_code(\'VEN\'::text)'],
      )
      const ins = `INSERT INTO "User" (id, name, email, password, "updatedAt") VALUES ($1, $1, $1 || '@replay.test', 'x', now()) RETURNING code`
      const a = (await db.query<{ code: string }>(ins, ['replay_u1'])).rows[0].code
      const b = (await db.query<{ code: string }>(ins, ['replay_u2'])).rows[0].code
      // Same shape as CODE_PATTERN in src/lib/auth-helpers.ts
      assert.match(a, /^AFA\d{10}$/)
      assert.equal(Number(b.slice(-6)), Number(a.slice(-6)) + 1, `${a} then ${b}`)
      await db.query(`DELETE FROM "User" WHERE id IN ('replay_u1','replay_u2')`)
    })

    await test('catch-up migration is a no-op when re-run on a DB that already has everything (QA)', async () => {
      const catchup = dirs.find((d) => d.endsWith('_fresh_db_catchup'))
      assert.ok(catchup, 'no *_fresh_db_catchup migration')
      // QA's own generate_role_code must never be replaced: simulate a
      // QA-style definition and check the re-run leaves it and the
      // column defaults alone.
      await db.exec(`ALTER TABLE "User" ALTER COLUMN "code" DROP DEFAULT`)
      await db.exec(readFileSync(join(MIGRATIONS, catchup, 'migration.sql'), 'utf8'))
      const { rows } = await db.query<{ d: string | null }>(
        `SELECT column_default AS d FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'code'`,
      )
      assert.equal(rows[0].d, null, 'catch-up re-wired User.code although generate_role_code already existed')
    })
  }

  await db.close()
  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed) process.exit(1)
}

main()
