// GEN-2609-052 - blocks new hardcoded design-token literals (raw hex
// colors, rgb()/rgba() literals, hardcoded font-family strings) from
// landing on ADDED OR CHANGED lines in src/**/*.ts(x). This is the
// recurring pattern that kept surfacing screen-by-screen this session
// (Georgia,serif on /tickets, a duplicated {bg,color} STATUS_STYLE
// table on dashboard/organiser, legacy --afa-terracotta reappearing) -
// the point is to fail the PR that introduces it, not discover it
// later during another audit pass.
//
// Deliberately diff-only: pre-existing literals elsewhere in src/ (e.g.
// the hand-authored rgba() borders documented in
// docs/afa-design-tokens-reference.md Section 1) are real, known debt
// and are NOT this check's job to clean up. Only lines the current
// branch/PR actually adds or changes are scanned, via
// `git diff <base>...<head>` - same approach as GEN-2609-052's own
// verification pass. See docs/design.md and
// docs/afa-design-tokens-reference.md Section 1 for the token contract
// this enforces.
//
// Usage:
//   node scripts/check-design-tokens.js
//   BASE_REF=origin/qa HEAD_REF=HEAD node scripts/check-design-tokens.js
//
// BASE_REF defaults to origin/qa (this repo's integration branch).
// HEAD_REF defaults to HEAD. Both accept any git ref/SHA - CI sets
// BASE_REF to the PR's actual base branch (see
// .github/workflows/design-tokens.yml).
const { execSync } = require('child_process')

const BASE_REF = process.env.BASE_REF || 'origin/qa'
const HEAD_REF = process.env.HEAD_REF || 'HEAD'

const RULES = [
  {
    // Scoped to hex tokens INSIDE a quoted string, not "#" anywhere on the
    // line - a bare /#[0-9a-fA-F]{3,8}\b/ also matches this repo's own PR-
    // reference comment convention (e.g. "// ... (#261)", "PR #212"), which
    // is all-digit and therefore hex-shaped. That convention is used in 20+
    // files today and would false-positive on essentially every future
    // commit's header comment. Real hex literals in this codebase are
    // always written as quoted string values (fill="#4285F4", background:
    // "#241a10"), never bare in a comment, so requiring the match to sit
    // inside quotes removes the false positive without missing real hits.
    name: 'hex-color-literal',
    //
    // The opening and closing delimiter use a backreference (\1), not two
    // independent ['"`] classes - found via GEN-2609-053's own dogfooding:
    // a comment combining a backtick-quoted code term with a later
    // apostrophe (a plain contraction like "repo's") let the un-anchored
    // version treat the backtick as an opener and the apostrophe as its
    // closer, false-flagging an unrelated hex value sitting in between.
    test: (line) => /(['"`])[^'"`]*#[0-9a-fA-F]{3,8}\b[^'"`]*\1/.test(line),
  },
  { name: 'rgb-rgba-literal', test: (line) => /rgba?\([^)]+\)/.test(line) },
  {
    // Scoped to just the quoted font-family VALUE, not "rest of the line" -
    // a naive /font-?[Ff]amily:\s*['"](?!.*var\()/ lookahead scans to end
    // of line and is defeated whenever another var()-using style prop
    // (e.g. `color: 'var(--afa-text-primary)'`) sits later on the same
    // inline-style line - which is exactly how the real pre-fix Georgia
    // hits on /tickets were written. Found via this check's own
    // GEN-2609-052 verification pass against that historical case.
    name: 'hardcoded-font-family',
    test: (line) => {
      const re = /font-?[Ff]amily:\s*['"]([^'"]*)['"]/g
      let m
      while ((m = re.exec(line))) {
        if (!m[1].includes('var(')) return true
      }
      return false
    },
  },
]

// Exact-path exemptions - the actual token source and the tone
// source-of-truth extracted in GEN-2609-051 legitimately hold literal
// values; everything else should draw from them instead of re-typing.
const EXEMPT_FILES = new Set([
  'src/app/globals.css',
  'src/lib/statusStyle.ts',
])

function isExemptFile(file) {
  if (EXEMPT_FILES.has(file)) return true
  // Server-rendered OG/poster canvas images - not UI, already documented
  // as its own exception in docs/afa-design-tokens-reference.md Section 8.1.
  if (file.startsWith('src/app/api/posters/')) return true
  if (/\.test\.tsx?$/.test(file)) return true
  return false
}

function isCheckedFile(file) {
  return /^src\/.*\.tsx?$/.test(file)
}

function getDiff() {
  const range = `${BASE_REF}...${HEAD_REF}`
  try {
    return execSync(
      `git diff --unified=0 --diff-filter=ACMR "${range}" -- src`,
      { encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 }
    )
  } catch (err) {
    console.error(`design-token check: failed to diff ${range}`)
    console.error(err.message)
    process.exit(1)
  }
}

function findOffenses(diffText) {
  const offenses = []
  let currentFile = null
  let checkCurrentFile = false
  let newLineNo = 0

  for (const rawLine of diffText.split('\n')) {
    if (rawLine.startsWith('+++ ')) {
      const p = rawLine.slice(4).trim()
      currentFile = p === '/dev/null' ? null : p.replace(/^b\//, '')
      checkCurrentFile = !!currentFile && isCheckedFile(currentFile) && !isExemptFile(currentFile)
      continue
    }
    if (rawLine.startsWith('@@')) {
      const m = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(rawLine)
      newLineNo = m ? parseInt(m[1], 10) : 0
      continue
    }
    if (!checkCurrentFile) continue
    if (rawLine.startsWith('---')) continue

    if (rawLine.startsWith('+')) {
      const content = rawLine.slice(1)
      for (const rule of RULES) {
        if (rule.test(content)) {
          offenses.push({ file: currentFile, line: newLineNo, rule: rule.name, content: content.trim() })
        }
      }
      newLineNo++
    } else if (rawLine.startsWith('-')) {
      // removed line - doesn't occupy a line number in the new file
    }
  }

  return offenses
}

function main() {
  const diffText = getDiff()
  const offenses = findOffenses(diffText)

  if (offenses.length === 0) {
    console.log(`design-token check: no new hardcoded design-token literals (${BASE_REF}...${HEAD_REF}).`)
    process.exit(0)
  }

  console.error(`design-token check: found ${offenses.length} new hardcoded design-token literal(s):\n`)
  for (const o of offenses) {
    console.error(`  ${o.file}:${o.line}  [${o.rule}]`)
    console.error(`    ${o.content}`)
  }
  console.error('\nUse the --afa-* / --font-* tokens from src/app/globals.css instead of literal values.')
  console.error('See docs/afa-design-tokens-reference.md Section 1 and docs/design.md.')
  process.exit(1)
}

if (require.main === module) {
  main()
}

module.exports = { RULES }
