// GEN-2609-089 - lighter-weight replacement for the verify-equivalence.js
// rebuilt-3-times-before scratch script (see docs/design.md's
// verify-equivalence-recurring-bugs finding). Earlier batches' version
// re-derived token values from a resolved diff and compared them against
// the literal they replaced - useful when a migration script does fuzzy
// or generated replacement. migrate-tokens.js instead replaces directly
// from SPACING_MAP/FONT_SIZE_MAP/RADIUS_MAP, whose entries are dictionary
// literals hand-copied from globals.css once - so the actual risk isn't
// "did the replacement resolve to the right value" (it's true by
// construction, every replacement IS a map lookup), it's "did the map
// itself get transcribed correctly." This script checks exactly that:
// parses globals.css's real --afa-* declarations and diffs them against
// migrate-tokens.js's hardcoded maps, catching any stale/mistyped entry
// before it can ever silently produce a wrong-value replacement.
//
// GEN-2609-090 - extended with the same check for COLOR_MAP (the new
// "colour" category's exact-hex map, e.g. `--afa-white: #FFF`), since
// migrate-tokens.js's --categories flag can now select it same as any
// dimension category and it deserves the same staleness guardrail.
// FONT_FAMILY_MAP is NOT checked here - it's deliberately empty (see
// migrate-tokens.js's own comment on it), so there is nothing yet that
// could go stale.
//
// Also re-checks every `className=` on the migrated file for the
// GEN-2609-086 Tailwind var()-arbitrary-value ambiguity
// (`text-[var(--x)]` collides between a color and a font-size utility)
// - migrate-tokens.js never touches Tailwind classes at all, so this is
// a defensive check that stays true, not a live risk from this script.
//
// GEN-2609-112 - `--base=<ref>` adds a per-site radius check: every
// changed line is compared against the same line at <ref>, and each
// radius value that became a var(--afa-radius-*) is classified as an
// EQUIVALENCE (the token's live globals.css value equals the literal -
// a bare `12` counts as `12px`, as React renders it), a ROUNDED site
// (the literal is a RADIUS_ROUND key pointing at that exact token - an
// intentional, decided value change, listed so it can be reviewed), or
// a MISMATCH (anything else - fails). The map-vs-globals check below
// can't see this: it proves the maps are transcribed right, not that
// every edited site landed on the token its map entry names.
//
// GEN-2609-113 - `--base` also runs a per-site COLOUR check with the
// same line pairing: every colour literal that became var(--afa-*) is an
// EQUIVALENCE (same RGBA as the token's live globals.css value), ROUNDED
// (resolveColor() maps it to that token for its context - a COLOR_ROUND
// entry, or either side of a context-dependent entry when the line
// itself doesn't say), or a MISMATCH. A var() that became a different
// var() must be one of the decided contrast swaps (SWAPS). Lines that
// gained a token-ok comment are counted as exemptions, not checked.
//
// Usage: node scripts/dev/verify-equivalence.js [--base=<ref>] [--list-rounded] <file...>
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const { SPACING_MAP, FONT_SIZE_MAP, RADIUS_MAP, RADIUS_ROUND, COLOR_MAP, COLOR_ROUND, FONT_SIZE_ROUNDED_KEYS, RADIUS_PROPS, colorContext, resolveColor } = require('./migrate-tokens')

const baseArg = process.argv.find((a) => a.startsWith('--base='))
const BASE = baseArg ? baseArg.slice('--base='.length) : null
const files = process.argv.slice(2).filter((a) => !a.startsWith('--'))
if (files.length === 0) {
  console.error('usage: node scripts/dev/verify-equivalence.js [--base=<ref>] [--list-rounded] <file...>')
  process.exit(1)
}

function loadGlobalsTokens() {
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'app', 'globals.css'), 'utf8')
  const tokens = {}
  const re = /--afa-(space|text|radius)-([a-zA-Z0-9-]+):\s*([0-9.]+)px\s*;/g
  let m
  while ((m = re.exec(css))) {
    tokens[`--afa-${m[1]}-${m[2]}`] = parseFloat(m[3])
  }
  return tokens
}

// GEN-2609-090 - same idea as loadGlobalsTokens() above, for hex colour
// declarations instead of `Npx` dimensions (a separate loader rather
// than one shared regex, since a colour value's shape - `#` + hex
// digits - has nothing in common with a dimension's `number + unit`).
// Scoped to any `--afa-*` custom property (not just the 3 name prefixes
// above), since colour tokens don't share a single naming convention.
//
// GEN-2609-099 - extended to also capture `rgba(...)`/`rgb(...)`
// declarations, not just hex. Found the gap live: COLOR_MAP only ever
// held one hex entry (--afa-white) until this ticket added 5 rgba
// ones, so this regex's hex-only shape was never exercised against a
// real rgba COLOR_MAP entry before - every one false-flagged as "not
// found in globals.css at all" despite being defined there, simply
// because the loader's regex couldn't match the value shape at all.
// Comparison is whitespace-normalized (strip all spaces before
// comparing) on BOTH sides in checkColorMap() below, since globals.css's
// own convention is spaced (`rgba(245, 245, 240, 0.08)`) while
// COLOR_MAP's keys are unspaced (matching real application code,
// confirmed the unspaced form is the only one that appears there - see
// migrate-tokens.js's own COLOR_MAP comment) - comparing the raw
// strings directly would produce the same false mismatch for a
// different reason (whitespace, not shape).
function loadGlobalsColorTokens() {
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'app', 'globals.css'), 'utf8')
  const tokens = {}
  const re = /(--afa-[a-zA-Z0-9-]+):\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\s*;/g
  let m
  while ((m = re.exec(css))) {
    tokens[m[1]] = m[2]
  }
  return tokens
}

// GEN-2609-112 - live values of every --afa-radius-* token, keyed by
// token name, for resolving var() references on migrated lines.
function loadRadiusTokens(liveTokens) {
  const out = {}
  for (const [k, v] of Object.entries(liveTokens)) if (k.startsWith('--afa-radius-')) out[k] = v
  return out
}

// Every radius value on a line, in source order, as whitespace-split
// parts: `prop: value` pairs for the 5 radius props (bare JS number,
// quoted string, or unquoted raw-CSS text up to `;`/`}`), then Tailwind
// `rounded[-side]-[...]` brackets.
const RADIUS_DECL_RE = /([a-zA-Z-]+)\s*:\s*(?:(['"`])([^'"`]*)\2|([^,;}'"`]+?))(?=\s*[,;}]|\s*$)/g
const TW_ROUNDED_RE = /\brounded(?:-[tbrl]{1,2})?-\[([^\]]+)\]/g
function radiusParts(line) {
  const parts = []
  RADIUS_DECL_RE.lastIndex = 0
  let m
  while ((m = RADIUS_DECL_RE.exec(line))) {
    const norm = m[1].replace(/-/g, '').toLowerCase()
    if (!RADIUS_PROPS.has(norm)) continue
    const bare = m[3] === undefined
    const raw = (bare ? m[4] : m[3]).replace(/\s*!important\s*$/, '').trim()
    for (const p of raw.split(/\s+/).filter(Boolean)) parts.push({ text: p, bare })
  }
  TW_ROUNDED_RE.lastIndex = 0
  while ((m = TW_ROUNDED_RE.exec(line))) parts.push({ text: m[1], bare: false })
  return parts
}

// A literal part's px value (`12`, `12px`, `0`), or null if it is not a
// plain px length (%, rem, calc(), a JS expression...).
function literalPx(part) {
  const m = /^(-?\d+(?:\.\d+)?)(px)?$/.exec(part.text)
  if (!m) return null
  return parseFloat(m[1])
}

let radiusEquivCount = 0
let baseRadiusCache = null
function baseRadius() {
  if (!baseRadiusCache) {
    const css = execFileSync('git', ['show', `${BASE}:src/app/globals.css`], { encoding: 'utf8' })
    baseRadiusCache = {}
    const re = /(--afa-radius-[a-zA-Z0-9-]+):\s*([0-9.]+)px\s*;/g
    let m
    while ((m = re.exec(css))) baseRadiusCache[m[1]] = parseFloat(m[2])
  }
  return baseRadiusCache
}
function checkRadiusSites(file, liveRadius, rounded) {
  let oldText
  try {
    oldText = execFileSync('git', ['show', `${BASE}:${file.replace(/\\/g, '/')}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return true // new file at this ref - nothing to compare against
  }
  const oldLines = oldText.split(/\r?\n/)
  const newLines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  if (oldLines.length !== newLines.length) {
    console.error(`  RADIUS CHECK SKIPPED in ${file}: line count changed (${oldLines.length} -> ${newLines.length}), sites can't be paired line-by-line - review by hand`)
    return false
  }
  let ok = true
  for (let i = 0; i < newLines.length; i++) {
    if (oldLines[i] === newLines[i]) continue
    const before = radiusParts(oldLines[i])
    const after = radiusParts(newLines[i])
    if (!after.some((p) => /^var\(--afa-radius-/.test(p.text))) continue
    if (before.length !== after.length) {
      console.error(`  RADIUS MISMATCH ${file}:${i + 1}: ${before.length} radius part(s) before, ${after.length} after`)
      ok = false
      continue
    }
    for (let j = 0; j < after.length; j++) {
      const tm = /^var\((--afa-radius-[a-z0-9-]+)\)$/.exec(after[j].text)
      if (!tm) {
        if (after[j].text !== before[j].text) {
          console.error(`  RADIUS MISMATCH ${file}:${i + 1}: '${before[j].text}' became '${after[j].text}'`)
          ok = false
        }
        continue
      }
      // A var() on the base side (a token renamed/retired in this
      // branch, e.g. --afa-radius-12px -> lg) resolves against the base
      // ref's own globals.css, then goes through the same equivalence /
      // rounded / mismatch classification as a literal.
      const bm = /^var\((--afa-radius-[a-z0-9-]+)\)$/.exec(before[j].text)
      if (bm && before[j].text === after[j].text) continue
      const token = tm[1]
      const px = bm ? baseRadius()[bm[1]] ?? null : literalPx(before[j])
      const live = liveRadius[token]
      if (px === null || live === undefined) {
        console.error(`  RADIUS MISMATCH ${file}:${i + 1}: '${before[j].text}' -> ${token} (${live === undefined ? 'token not in globals.css' : 'literal is not a px length'})`)
        ok = false
      } else if (!bm && !/px$/.test(before[j].text) && px !== 0 && !before[j].bare) {
        console.error(`  RADIUS MISMATCH ${file}:${i + 1}: quoted unitless '${before[j].text}' was invalid CSS (never rendered) - converting it changes the page`)
        ok = false
      } else if (px === live) {
        radiusEquivCount++
      } else if (RADIUS_ROUND[String(px)] === token) {
        rounded.push({ site: `${file}:${i + 1}`, from: px, to: token, toPx: live })
      } else {
        console.error(`  RADIUS MISMATCH ${file}:${i + 1}: '${before[j].text}' -> ${token} (${live}px), not an exact or RADIUS_ROUND mapping`)
        ok = false
      }
    }
  }
  return ok
}

// GEN-2609-106 - `roundedKeys` (FONT_SIZE_MAP only) names keys that are
// a deliberate ROUND to their target token, not an exact-value
// transcription - see migrate-tokens.js's own FONT_SIZE_ROUNDED_KEYS
// comment for why. Those keys still must resolve to a real token in
// globals.css (a renamed/deleted target token is still a real bug),
// just not to the identical px number.
function checkMap(name, map, liveTokens, roundedKeys) {
  let ok = true
  for (const [px, token] of Object.entries(map)) {
    const live = liveTokens[token]
    if (live === undefined) {
      console.error(`  MISMATCH [${name}]: ${token} not found in globals.css at all`)
      ok = false
      continue
    }
    if (roundedKeys && roundedKeys.has(px)) continue
    if (live !== parseFloat(px)) {
      console.error(`  MISMATCH [${name}]: map says ${px}px -> ${token}, globals.css defines ${token} as ${live}px`)
      ok = false
    }
  }
  return ok
}

// GEN-2609-090 - same purpose as checkMap() above, case-insensitive hex
// string comparison instead of numeric equality (colour values, unlike
// the dimension maps, aren't parsed to a number anywhere in this
// pipeline - see migrate-tokens.js's own migrateExactStringValue()
// comment for why that's deliberate).
function normalizeColorValue(v) {
  const rgba = parseRGBA(v)
  return rgba ? rgba.join(',') : v.replace(/\s+/g, '').toLowerCase()
}

// GEN-2609-113 - hex and rgb()/rgba() to [r,g,b,a], so #0A0A0A equals
// rgb(10,10,10) and #F7F3EE equals #f7f3ee.
function parseRGBA(v) {
  const s = v.replace(/\s+/g, '').toLowerCase()
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s)
  if (m) {
    const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1]
  }
  m = /^rgba?\((\d+),(\d+),(\d+)(?:,([\d.]+))?\)$/.exec(s)
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])]
  return null
}

function checkColorMap(name, map, liveColors) {
  let ok = true
  for (const [value, token] of Object.entries(map)) {
    const live = liveColors[token]
    if (live === undefined) {
      console.error(`  MISMATCH [${name}]: ${token} not found in globals.css at all`)
      ok = false
      continue
    }
    if (normalizeColorValue(live) !== normalizeColorValue(value)) {
      console.error(`  MISMATCH [${name}]: map says ${value} -> ${token}, globals.css defines ${token} as ${live}`)
      ok = false
    }
  }
  return ok
}

// GEN-2609-113 - per-site colour check (see header).
// Every --afa-* colour token in a globals.css text, var() references
// resolved, as { token: [r,g,b,a] }.
function colorTokenTable(css) {
  const raw = {}
  const re = /(--afa-[a-zA-Z0-9-]+):\s*([^;{}]+);/g
  let m
  while ((m = re.exec(css))) if (!(m[1] in raw)) raw[m[1]] = m[2].trim()
  const out = {}
  const resolve = (v, depth) => {
    const ref = /^var\((--afa-[a-zA-Z0-9-]+)\)$/.exec(v)
    if (ref && depth < 5 && raw[ref[1]] !== undefined) return resolve(raw[ref[1]], depth + 1)
    return parseRGBA(v)
  }
  for (const [k, v] of Object.entries(raw)) {
    const rgba = resolve(v, 0)
    if (rgba) out[k] = rgba
  }
  return out
}
const liveColorTable = colorTokenTable(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'app', 'globals.css'), 'utf8'))
let baseColorTableCache = null
function baseColorTable() {
  if (!baseColorTableCache) baseColorTableCache = colorTokenTable(execFileSync('git', ['show', `${BASE}:src/app/globals.css`], { encoding: 'utf8' }))
  return baseColorTableCache
}

// The decided var() -> var() swaps (GEN-2609-113 step 2 contrast fixes).
const SWAPS = new Set(['--afa-gold -> --afa-amber', '--afa-error -> --afa-error-bright'])

const COLOR_ITEM_RE = /var\((--afa-[a-zA-Z0-9-]+)(?:\s*,[^()]*)?\)|rgba?\([^()]*\)|#[0-9a-fA-F]{3,8}\b/g
function colorItems(line, isColorToken) {
  const items = []
  COLOR_ITEM_RE.lastIndex = 0
  let m
  while ((m = COLOR_ITEM_RE.exec(line))) {
    if (m[1]) {
      if (isColorToken(m[1])) items.push({ token: m[1], pos: m.index })
    } else if (m[0][0] === '#' && /&$/.test(line.slice(0, m.index))) {
      continue
    } else if (parseRGBA(m[0]) || m[0].includes('${')) {
      items.push({ lit: m[0], pos: m.index })
    }
  }
  return items
}
const isCommentish = (l) => /^\s*(\/\/|\*|\/\*)/.test(l)
const hasTokenOk = (l) => /\/\/\s*token-ok:|\{\/\*\s*token-ok:/.test(l)

const colorStats = { equiv: 0, rounded: [], swaps: [], exempt: [], removed: [], dynamic: [] }
function checkColorSites(file) {
  let oldText
  try {
    oldText = execFileSync('git', ['show', `${BASE}:${file.replace(/\\/g, '/')}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return true
  }
  const oldLines = oldText.split(/\r?\n/)
  const newLines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  if (oldLines.length !== newLines.length) {
    console.error(`  COLOUR CHECK SKIPPED in ${file}: line count changed (${oldLines.length} -> ${newLines.length}) - review by hand`)
    return false
  }
  const base = baseColorTable()
  const isColorToken = (t) => t in liveColorTable || t in base
  let ok = true
  for (let i = 0; i < newLines.length; i++) {
    const before = oldLines[i]
    const after = newLines[i]
    if (before === after) continue
    const site = `${file}:${i + 1}`
    const b = colorItems(before, isColorToken)
    if (isCommentish(after) && isCommentish(before)) {
      if (b.some((x) => x.lit)) colorStats.removed.push(site)
      continue
    }
    if (hasTokenOk(after) && !hasTokenOk(before)) {
      colorStats.exempt.push(site)
      continue
    }
    const a = colorItems(after, isColorToken)
    if (b.length !== a.length) {
      console.error(`  COLOUR MISMATCH ${site}: ${b.length} colour item(s) before, ${a.length} after`)
      ok = false
      continue
    }
    for (let j = 0; j < a.length; j++) {
      const x = b[j]
      const y = a[j]
      if (x.token && y.token) {
        if (x.token === y.token) continue
        const swap = `${x.token} -> ${y.token}`
        if (SWAPS.has(swap)) colorStats.swaps.push({ site, swap })
        else {
          console.error(`  COLOUR MISMATCH ${site}: var(${x.token}) became var(${y.token}), not a decided swap`)
          ok = false
        }
        continue
      }
      if (x.lit && y.lit) {
        if (x.lit !== y.lit) {
          console.error(`  COLOUR MISMATCH ${site}: '${x.lit}' became '${y.lit}'`)
          ok = false
        }
        continue
      }
      if (x.token && y.lit) {
        console.error(`  COLOUR MISMATCH ${site}: var(${x.token}) became literal '${y.lit}'`)
        ok = false
        continue
      }
      if (x.lit.includes('${')) {
        // a runtime-built colour (template alpha) replaced by hand - nothing
        // to compare statically, so it is listed for review instead
        colorStats.dynamic.push({ site, from: x.lit, to: y.token })
        continue
      }
      const live = liveColorTable[y.token]
      const litRGBA = parseRGBA(x.lit)
      if (live && litRGBA && live.join(',') === litRGBA.join(',')) {
        colorStats.equiv++
        continue
      }
      const ctx = colorContext(before, x.pos)
      const res = resolveColor(x.lit, ctx)
      if (res && (res.token === y.token || (res.ambiguous && res.ambiguous.includes(y.token)))) {
        colorStats.rounded.push({ site, from: x.lit.replace(/\s+/g, ''), to: y.token, ctx: res.ambiguous ? 'by hand' : ctx || 'any' })
      } else {
        console.error(`  COLOUR MISMATCH ${site}: '${x.lit}' (${ctx || 'no context'}) -> ${y.token}, not an exact or COLOR_ROUND mapping`)
        ok = false
      }
    }
  }
  return ok
}

function printColorReport() {
  const c = colorStats
  console.log(`colour vs ${BASE}: ${c.equiv} equivalence(s), ${c.rounded.length} rounded site(s), ${c.swaps.length} decided swap(s), ${c.exempt.length} token-ok exemption(s), ${c.removed.length} comment rewording(s).`)
  const per = {}
  for (const r of c.rounded) per[`${r.from} -> ${r.to}`] = (per[`${r.from} -> ${r.to}`] || 0) + 1
  for (const [k, n] of Object.entries(per).sort((p, q) => q[1] - p[1])) console.log(`  rounded ${n}x  ${k}`)
  const sw = {}
  for (const r of c.swaps) sw[r.swap] = (sw[r.swap] || 0) + 1
  for (const [k, n] of Object.entries(sw)) console.log(`  swap ${n}x  ${k}`)
  for (const d of c.dynamic) console.log(`  by hand (dynamic): ${d.site}  ${d.from} -> ${d.to}`)
  // A token whose own value changed (--afa-text-muted 0.4 -> 0.5) moves
  // every consumer at once - listed, not a per-site mismatch.
  const base = baseColorTable()
  for (const [t, v] of Object.entries(liveColorTable)) {
    if (base[t] && base[t].join(',') !== v.join(',')) console.log(`  token value changed: ${t} rgba(${base[t]}) -> rgba(${v})`)
  }
  if (process.argv.includes('--list-rounded')) {
    for (const r of c.rounded) console.log(`    ${r.site}  ${r.from} -> ${r.to}  [${r.ctx}]`)
    for (const r of c.swaps) console.log(`    ${r.site}  ${r.swap}`)
    for (const s of c.exempt) console.log(`    ${s}  token-ok`)
    for (const s of c.removed) console.log(`    ${s}  comment reworded`)
  }
}

function checkClassNames(file) {
  const text = fs.readFileSync(file, 'utf8')
  let ok = true
  const re = /className=(?:\{`([^`]*)`\}|"([^"]*)")/g
  let m
  while ((m = re.exec(text))) {
    const cls = m[1] !== undefined ? m[1] : m[2]
    // GEN-2609-112 - `rounded` dropped from this check: unlike `text-`,
    // `rounded-[var(...)]` has one possible type (border-radius) and
    // compiles correctly unhinted (verified via @tailwindcss/node - see
    // migrate-tokens.js's MATCH_RE_TW_RADIUS_BRACKET comment).
    if (/\btext-\[var\(/.test(cls)) {
      console.error(`  className ISSUE in ${file}: ambiguous Tailwind var() arbitrary value: ${cls}`)
      ok = false
    }
  }
  return ok
}

const liveTokens = loadGlobalsTokens()
const liveColorTokens = loadGlobalsColorTokens()
let allOk = true
allOk = checkMap('SPACING_MAP', SPACING_MAP, liveTokens) && allOk
allOk = checkMap('FONT_SIZE_MAP', FONT_SIZE_MAP, liveTokens, FONT_SIZE_ROUNDED_KEYS) && allOk
allOk = checkMap('RADIUS_MAP', RADIUS_MAP, liveTokens) && allOk
// GEN-2609-112 - every RADIUS_ROUND entry is a deliberate value change,
// so only "target token exists" is checked for it.
allOk = checkMap('RADIUS_ROUND', RADIUS_ROUND, liveTokens, new Set(Object.keys(RADIUS_ROUND))) && allOk
allOk = checkColorMap('COLOR_MAP', COLOR_MAP, liveColorTokens) && allOk
// GEN-2609-113 - every COLOR_ROUND target must exist as a colour token.
for (const v of Object.values(COLOR_ROUND)) {
  for (const t of typeof v === 'string' ? [v] : Object.values(v)) {
    if (!(t in liveColorTable)) {
      console.error(`  MISMATCH [COLOR_ROUND]: ${t} not found in globals.css at all`)
      allOk = false
    }
  }
}
const liveRadius = loadRadiusTokens(liveTokens)
const roundedSites = []
for (const file of files) {
  allOk = checkClassNames(file) && allOk
  if (BASE) allOk = checkRadiusSites(file, liveRadius, roundedSites) && allOk
  if (BASE) allOk = checkColorSites(file) && allOk
}

if (BASE) {
  console.log(`radius vs ${BASE}: ${radiusEquivCount} equivalence(s), ${roundedSites.length} rounded site(s).`)
  const perValue = {}
  for (const r of roundedSites) {
    const k = `${r.from}px -> ${r.to} (${r.toPx}px)`
    perValue[k] = (perValue[k] || 0) + 1
  }
  for (const [k, n] of Object.entries(perValue).sort((a, b) => b[1] - a[1])) console.log(`  rounded ${n}x  ${k}`)
  if (process.argv.includes('--list-rounded')) for (const r of roundedSites) console.log(`    ${r.site}  ${r.from}px -> ${r.to}`)
}

if (BASE) printColorReport()

if (allOk) {
  const mapEntryCount = Object.keys(SPACING_MAP).length + Object.keys(FONT_SIZE_MAP).length + Object.keys(RADIUS_MAP).length + Object.keys(RADIUS_ROUND).length + Object.keys(COLOR_MAP).length
  console.log(`verify-equivalence: 0 mismatches (${mapEntryCount} map entries, ${files.length} file(s) className-checked).`)
  process.exit(0)
} else {
  process.exit(1)
}
