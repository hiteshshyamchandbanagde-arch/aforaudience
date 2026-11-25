// GEN-2609-107 phase 2 - per-site spacing check for verify-equivalence.js
// (the precondition HANDOFF part 27 set for phase 2). Phase 1's scratch
// check found the codemod writing `margin-top: 'var(--afa-space-14px)';`
// into plain CSS text; the map-vs-globals check can't see that, because
// the map was right and the site was wrong.
//
// checkSpacingLine() pairs one changed line with the same line at the
// base ref and proves every new spacing token on it renders the px value
// the old line did. Each `var(--afa-space-*)` (or a negative
// `calc(-1 * var(--afa-space-*))`) on the new line is a "site", resolved
// to its px value from globals.css; the old line must equal the new line
// with each site put back as a literal of that value:
//   - a site that is a whole quoted JS string (`'var(--afa-space-3)'`)
//     may have been a bare JS number (`12`, React adds the px) or a
//     quoted px string (`'12px'`);
//   - any other site (inside a shorthand string, raw CSS text, a
//     Tailwind bracket) must have been `12px` exactly.
// Everything else on the line must be byte-identical, so a quoted var()
// in CSS text, a unitless quoted string (invalid CSS, never rendered),
// a wrong token or any unrelated edit is a mismatch.
//
// A line that only gained a `token-ok(...)` comment is an exemption.
// A changed line with no spacing token must keep the same spacing
// literals (so a literal can't silently change value either).
const { parseTokenOk, RULES } = require('../check-design-tokens')

const SPACING_RULE = RULES.find((r) => r.name === 'spacing-literal')

// Optional matching quotes around the site; `\1` is empty when there are none.
const SITE_RE = /(['"`]?)(calc\(\s*-1\s*\*\s*var\((--afa-space-[a-zA-Z0-9-]+)\)\s*\)|var\((--afa-space-[a-zA-Z0-9-]+)\))\1/g
// `// token-ok(...)`, `{/* token-ok(...) */}`, or in raw CSS text
// `/* // token-ok(...) */` (a CSS comment the shared parser still reads)
const TOKEN_OK_TAIL_RE = /\s*(?:\/\*\s*\/\/\s*token-ok\(.*\*\/|\/\/\s*token-ok\(.*|\{\/\*\s*token-ok\(.*?\*\/\})\s*$/

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Every --afa-space-* token in a globals.css text, as { token: px }.
function spaceTokenTable(css) {
  const out = {}
  const re = /(--afa-space-[a-zA-Z0-9-]+):\s*(-?[0-9.]+)px\s*;/g
  let m
  while ((m = re.exec(css))) if (!(m[1] in out)) out[m[1]] = parseFloat(m[2])
  return out
}

function sites(line) {
  const out = []
  SITE_RE.lastIndex = 0
  let m
  while ((m = SITE_RE.exec(line))) {
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0], quote: m[1], negative: !!m[3], token: m[3] || m[4] })
  }
  return out
}

// { kind: 'unchanged' | 'equiv' | 'exempt' | 'other' | 'mismatch', sites, message }
function checkSpacingLine(before, after, tokens) {
  if (before === after) return { kind: 'unchanged', sites: 0 }
  let body = after
  let exempt = false
  if (parseTokenOk(after) && !parseTokenOk(before)) {
    body = after.replace(TOKEN_OK_TAIL_RE, '')
    exempt = true
  }
  const found = sites(body)
  if (found.length === 0) {
    if (exempt) {
      return body === before
        ? { kind: 'exempt', sites: 0 }
        : { kind: 'mismatch', sites: 0, message: 'line gained a token-ok and also changed' }
    }
    const a = SPACING_RULE.extract(after).join(' ')
    const b = SPACING_RULE.extract(before).join(' ')
    return a === b
      ? { kind: 'other', sites: 0 }
      : { kind: 'mismatch', sites: 0, message: `spacing literal(s) changed without a token: '${b}' -> '${a}'` }
  }
  let pattern = '^'
  let last = 0
  for (const s of found) {
    const px = tokens[s.token]
    if (px === undefined) return { kind: 'mismatch', sites: found.length, message: `${s.token} is not defined in globals.css` }
    const n = String(s.negative ? -px : px)
    // a whole quoted JS string was a bare JS number or a quoted px string;
    // anything else was `Npx` in place
    const alts = s.quote
      ? [esc(s.text), `${esc(n)}(?![\\w.%])`, ...[`'`, '"', '`'].map((q) => `${q}${esc(n)}px${q}`)]
      : [esc(s.text), `${esc(n)}px`]
    pattern += esc(body.slice(last, s.start)) + `(?:${alts.join('|')})`
    last = s.end
  }
  pattern += esc(body.slice(last)) + '$'
  if (!new RegExp(pattern).test(before)) {
    const list = found.map((s) => `${s.text}=${s.negative ? -tokens[s.token] : tokens[s.token]}px`).join(', ')
    return { kind: 'mismatch', sites: found.length, message: `old line is not the new line with ${list} as literals` }
  }
  return { kind: exempt ? 'exempt' : 'equiv', sites: found.length }
}

module.exports = { checkSpacingLine, spaceTokenTable }
