// GEN-2609-078 - whole-repo ratchet, complementing check-design-tokens.js's
// diff-only new-literal block. That check only ever asks "did THIS PR add
// a new literal on a touched line" - it can never prove the total is
// actually going down, and its own GEN-2609-057 relocated-literal
// exemption (correctly) lets a pure refactor move an existing literal
// around without failing. This script instead counts every rule's live
// matches across the WHOLE checked src/ tree, right now, and fails if any
// category's total is ABOVE a committed baseline (scripts/design-token-
// baseline.json) - the actual "is migration converging" signal, and the
// thing GEN-2609-077's own "phase 2, phase 3..." plan needs to show
// movement against.
//
// Shares its rule definitions with check-design-tokens.js (RULES,
// isCheckedFile, isExemptFile) rather than re-implementing them, so the
// diff-only check and this whole-repo count can never quietly drift out
// of sync with each other.
//
// Usage:
//   node scripts/design-token-ratchet.js
//     Counts live literals per category, compares to the committed
//     baseline, prints a progress report + top-10-files list, exits 1 if
//     any category is above its baseline (or if no baseline file exists
//     yet).
//
//   node scripts/design-token-ratchet.js --update-baseline
//     Writes the current live counts as the new baseline - but ONLY ever
//     lowers a category. If any category's live count is HIGHER than the
//     committed baseline (the ratchet already failing for that category),
//     this refuses to write and exits 1 instead - --update-baseline is
//     for recording a migration PR's real progress, not a backdoor to
//     silently raise the ratchet and hide a regression. Run this once
//     with no existing baseline file to create the first one.
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { RULES, isCheckedFile, isExemptFile, tokenOkReason } = require('./check-design-tokens')

const BASELINE_PATH = path.join(__dirname, 'design-token-baseline.json')
const UPDATE = process.argv.includes('--update-baseline')

function listCheckedFiles() {
  // git ls-files respects .gitignore and skips node_modules/.next entirely
  // - far cheaper and more correct than a manual recursive fs walk.
  const out = execFileSync('git', ['ls-files', '--', 'src'], { encoding: 'utf8' })
  return out
    .split('\n')
    .filter(Boolean)
    .filter((f) => isCheckedFile(f) && !isExemptFile(f))
}

function countAll() {
  const counts = {}
  for (const rule of RULES) counts[rule.name] = 0
  const perFile = {}
  const tokenOkUses = []

  for (const file of listCheckedFiles()) {
    let text
    try {
      text = fs.readFileSync(file, 'utf8')
    } catch {
      continue // deleted-but-still-listed edge case (rare, ls-files is normally live-tree accurate)
    }
    let fileTotal = 0
    for (const line of text.split('\n')) {
      const reason = tokenOkReason(line)
      if (reason) {
        tokenOkUses.push({ file, reason, content: line.trim() })
        continue
      }
      for (const rule of RULES) {
        if (rule.isExemptFile && rule.isExemptFile(file)) continue
        const literals = rule.extract ? rule.extract(line) : (rule.test(line) ? [line] : [])
        if (literals.length > 0) {
          counts[rule.name] += literals.length
          fileTotal += literals.length
        }
      }
    }
    if (fileTotal > 0) perFile[file] = fileTotal
  }
  return { counts, perFile, tokenOkUses }
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return null
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'))
}

function writeBaseline(counts) {
  const data = { generatedAt: new Date().toISOString(), counts }
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(data, null, 2) + '\n')
}

function printReport(counts, baseline, perFile) {
  console.log('design-token ratchet: live counts vs. baseline\n')
  const rows = []
  for (const rule of RULES) {
    const name = rule.name
    const live = counts[name] || 0
    const base = baseline ? baseline.counts[name] : undefined
    let deltaStr
    if (base === undefined) deltaStr = '(no baseline)'
    else if (live > base) deltaStr = `+${live - base}  REGRESSED`
    else if (live < base) deltaStr = `-${base - live}`
    else deltaStr = '±0'
    rows.push({ name, live, base, deltaStr })
  }
  const nameWidth = Math.max(...rows.map((r) => r.name.length))
  for (const r of rows) {
    console.log(
      `  ${r.name.padEnd(nameWidth)}  live=${String(r.live).padStart(5)}  baseline=${r.base === undefined ? 'n/a'.padStart(5) : String(r.base).padStart(5)}  ${r.deltaStr}`
    )
  }

  console.log('\nTop 10 files by literal count (all categories combined):')
  const top = Object.entries(perFile).sort((a, b) => b[1] - a[1]).slice(0, 10)
  if (top.length === 0) {
    console.log('  (none)')
  } else {
    for (const [file, count] of top) {
      console.log(`  ${String(count).padStart(5)}  ${file}`)
    }
  }

  return rows
}

function main() {
  const { counts, perFile, tokenOkUses } = countAll()
  const baseline = loadBaseline()

  if (tokenOkUses.length > 0) {
    console.log(`design-token ratchet: ${tokenOkUses.length} line(s) currently allowed via // token-ok: (always shown):\n`)
    for (const u of tokenOkUses) {
      console.log(`  ${u.file}  reason: ${u.reason}`)
      console.log(`    ${u.content}`)
    }
    console.log('')
  }

  const rows = printReport(counts, baseline, perFile)

  if (UPDATE) {
    if (!baseline) {
      writeBaseline(counts)
      console.log(`\ndesign-token ratchet: no baseline existed - created ${path.relative(process.cwd(), BASELINE_PATH)}.`)
      process.exit(0)
    }
    const raising = rows.filter((r) => r.base !== undefined && r.live > r.base)
    if (raising.length > 0) {
      console.error(
        `\ndesign-token ratchet: refusing to update baseline - ${raising.length} categor${raising.length === 1 ? 'y would' : 'ies would'} RISE: ${raising.map((r) => `${r.name} (${r.base} -> ${r.live})`).join(', ')}.`
      )
      console.error('--update-baseline only lowers a baseline deliberately (e.g. after a migration PR) - it never raises one as a side effect. Fix the regression first.')
      process.exit(1)
    }
    writeBaseline(counts)
    console.log('\ndesign-token ratchet: baseline updated (no category raised).')
    process.exit(0)
  }

  if (!baseline) {
    console.error(`\ndesign-token ratchet: no baseline file found at ${path.relative(process.cwd(), BASELINE_PATH)} - run with --update-baseline once to create it.`)
    process.exit(1)
  }

  const regressed = rows.filter((r) => r.base !== undefined && r.live > r.base)
  if (regressed.length > 0) {
    console.error(`\ndesign-token ratchet: FAILED - ${regressed.length} categor${regressed.length === 1 ? 'y' : 'ies'} above baseline:`)
    for (const r of regressed) console.error(`  ${r.name}: ${r.live} > ${r.base}`)
    process.exit(1)
  }

  console.log('\ndesign-token ratchet: all categories at or below baseline.')
  process.exit(0)
}

if (require.main === module) {
  main()
}

module.exports = { countAll, loadBaseline, writeBaseline, BASELINE_PATH }
