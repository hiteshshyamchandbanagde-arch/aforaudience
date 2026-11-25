// Prod-parity (16 Nov) - a fresh database built only from
// `prisma migrate deploy` must end up with the same DesignToken rows and
// the same single PlatformSettings row as QA. QA was fixed out-of-band and
// the migrations never caught up, so prod would have read a dead
// PlatformSettings 'default' row and stale/missing design tokens.
//
// This replays every prisma/migrations/*/migration.sql statement that
// touches "DesignToken" or "PlatformSettings" (INSERT / UPDATE / DELETE),
// in order, in memory, and checks:
//   1. the DesignToken key -> value map equals the token set in
//      src/app/globals.css (:root --afa-*) plus the 4 --font-* tokens in
//      src/lib/design-tokens.ts DEFAULT_TOKEN_VALUES (they live there, not
//      in globals.css), whitespace normalised;
//   2. PlatformSettings ends with exactly one row, 'singleton';
//   3. no `platformSettings.findFirst(` is left in src/ (an unkeyed read
//      could pick up a stray row).
// Regression shape: fails on origin/qa (2 value diffs, 10 extra keys,
// 42 missing keys, a 'default' settings row, 3 findFirst calls); passes
// once 20261117120000_prod_parity_settings_tokens and the call-site fix
// are in.
//
//   npx tsx scripts/migration-seed-parity.test.ts
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try {
    fn()
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

/** Split SQL into statements: strips -- comments, splits on ; outside quotes. */
function statements(sql: string): string[] {
  const out: string[] = []
  let cur = ''
  let inStr = false
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i]
    if (!inStr && c === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++
      cur += '\n'
      continue
    }
    if (c === "'") {
      if (inStr && sql[i + 1] === "'") { cur += "''"; i++; continue }
      inStr = !inStr
    }
    if (c === ';' && !inStr) { if (cur.trim()) out.push(cur.trim()); cur = ''; continue }
    cur += c
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

/** Every single-quoted literal in order. */
const literals = (s: string) => [...s.matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, "'"))

/** Top-level parenthesised tuples after VALUES, each split into raw fields. */
function tuples(valuesPart: string): string[][] {
  const rows: string[][] = []
  let depth = 0
  let inStr = false
  let field = ''
  let row: string[] = []
  for (let i = 0; i < valuesPart.length; i++) {
    const c = valuesPart[i]
    if (c === "'") {
      if (inStr && valuesPart[i + 1] === "'") { field += "'"; i++; continue }
      inStr = !inStr
      continue
    }
    if (!inStr) {
      if (c === '(') { depth++; if (depth === 1) { row = []; field = ''; continue } }
      if (c === ')') { depth--; if (depth === 0) { row.push(field.trim()); rows.push(row); continue } }
      if (c === ',' && depth === 1) { row.push(field.trim()); field = ''; continue }
      if (depth === 0) continue
    }
    field += c
  }
  return rows
}

type Replay = { tokens: Map<string, string>; settings: Set<string> }

function replay(): Replay {
  const tokens = new Map<string, string>()
  const settings = new Set<string>()
  const dirs = readdirSync(MIGRATIONS)
    .filter((d) => statSync(join(MIGRATIONS, d)).isDirectory())
    .sort()
  for (const d of dirs) {
    let sql: string
    try { sql = readFileSync(join(MIGRATIONS, d, 'migration.sql'), 'utf8') } catch { continue }
    for (const st of statements(sql)) {
      const where = `${d}: ${st.slice(0, 80)}`
      const ins = st.match(/^INSERT\s+INTO\s+"(DesignToken|PlatformSettings)"\s*\(([^)]*)\)\s*VALUES\s*([\s\S]*)$/i)
      if (ins) {
        const cols = ins[2].split(',').map((c) => c.trim().replace(/"/g, ''))
        let body = ins[3]
        const conflict = body.match(/\bON\s+CONFLICT\b[\s\S]*$/i)
        const doNothing = !!conflict && /DO\s+NOTHING/i.test(conflict[0])
        assert.ok(!conflict || doNothing, `unsupported ON CONFLICT in ${where}`)
        if (conflict) body = body.slice(0, conflict.index)
        const keyCol = ins[1] === 'DesignToken' ? 'key' : 'id'
        const ki = cols.indexOf(keyCol)
        const vi = cols.indexOf('value')
        assert.ok(ki >= 0, `no ${keyCol} column in ${where}`)
        for (const row of tuples(body)) {
          const key = row[ki]
          if (ins[1] === 'DesignToken') {
            if (tokens.has(key)) { assert.ok(doNothing, `duplicate DesignToken ${key} in ${where}`); continue }
            tokens.set(key, norm(row[vi]))
          } else {
            if (settings.has(key)) { assert.ok(doNothing, `duplicate PlatformSettings ${key} in ${where}`); continue }
            settings.add(key)
          }
        }
        continue
      }
      const del = st.match(/^DELETE\s+FROM\s+"(DesignToken|PlatformSettings)"\s+WHERE\s+"?(key|id)"?\s*(=|IN)\s*([\s\S]*)$/i)
      if (del) {
        for (const k of literals(del[4])) (del[1] === 'DesignToken' ? tokens : settings).delete(k)
        continue
      }
      const upd = st.match(/^UPDATE\s+"DesignToken"\s+SET\s+"?value"?\s*=\s*'((?:[^']|'')*)'[\s\S]*?WHERE\s+"?key"?\s*=\s*'((?:[^']|'')*)'/i)
      if (upd) {
        const key = upd[2].replace(/''/g, "'")
        if (tokens.has(key)) tokens.set(key, norm(upd[1].replace(/''/g, "'")))
        continue
      }
      assert.ok(
        !/^(INSERT|UPDATE|DELETE)\b[\s\S]*"(DesignToken|PlatformSettings)"/i.test(st) || /^UPDATE\s+"PlatformSettings"/i.test(st),
        `unparsed statement touching DesignToken/PlatformSettings in ${where}`,
      )
    }
  }
  return { tokens, settings }
}

function expectedTokens(): Map<string, string> {
  const css = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf8')
  const start = css.indexOf(':root {')
  assert.ok(start >= 0, 'no :root block in globals.css')
  const block = css.slice(start, css.indexOf('\n}', start))
  const out = new Map<string, string>()
  for (const m of block.matchAll(/(--afa-[a-z0-9-]+)\s*:\s*([^;]+);/g)) out.set(m[1], norm(m[2]))
  // The 4 font tokens are set by next/font in layout.tsx; their DB
  // defaults live in DEFAULT_TOKEN_VALUES.
  const dt = readFileSync(join(ROOT, 'src/lib/design-tokens.ts'), 'utf8')
  for (const k of ['--font-display', '--font-ui', '--font-sans', '--font-mono']) {
    const m = dt.match(new RegExp(`"${k}":\\s*"([^"]*)"`))
    assert.ok(m, `${k} missing from design-tokens.ts`)
    out.set(k, norm(m[1]))
  }
  return out
}

const { tokens, settings } = replay()
const want = expectedTokens()

test('replayed DesignToken keys equal globals.css tokens (no extra, none missing)', () => {
  const extra = [...tokens.keys()].filter((k) => !want.has(k)).sort()
  const missing = [...want.keys()].filter((k) => !tokens.has(k)).sort()
  assert.deepEqual({ extra, missing }, { extra: [], missing: [] })
})

test('replayed DesignToken values equal globals.css values', () => {
  const diffs = [...want].filter(([k, v]) => tokens.has(k) && tokens.get(k) !== v).map(([k, v]) => `${k}: db=${tokens.get(k)} css=${v}`)
  assert.deepEqual(diffs, [])
})

test('replayed PlatformSettings is exactly one row, singleton', () => {
  assert.deepEqual([...settings], ['singleton'])
})

test('no unkeyed platformSettings.findFirst( in src/', () => {
  const hits: string[] = []
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(ts|tsx)$/.test(e.name) && readFileSync(p, 'utf8').includes('platformSettings.findFirst(')) hits.push(p.slice(ROOT.length + 1))
    }
  }
  walk(join(ROOT, 'src'))
  assert.deepEqual(hits, [])
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
