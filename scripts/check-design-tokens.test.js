// GEN-2609-078 - fixture-based self-tests for check-design-tokens.js's
// rule set: one positive (must be flagged) and one negative (must NOT be
// flagged) fixture per rule, plus dedicated cases for the Tailwind
// arbitrary-value forms, the allowlist, the raw-button file exemption +
// its skipRelocatedCheck behavior, and the `// token-ok(<rule>):` escape hatch.
//
// No test framework is configured in this repo (no Jest/Vitest - checked
// package.json before writing this; `test:e2e` is Playwright, a
// different layer entirely). Plain Node + the built-in `assert` module,
// same "small script, no new dependency" convention this whole checker
// already follows (see check-design-tokens.js's own header comment and
// GEN-2609-057's design.md entry). Run directly:
//
//   node scripts/check-design-tokens.test.js
//
// Wired into .github/workflows/design-tokens.yml so a change to the
// rules that breaks one of these fixtures fails CI, not just a future
// manual dogfooding pass.
const assert = require('node:assert/strict')
const {
  RULES,
  isExemptFile,
  isSizingExemptFile,
  isMigrationExcludedFile,
  shouldFlag,
  parseTokenOk,
  stripLineComments,
  bareReason,
  findOffenses,
  isAllowlistedLength,
  isAllowlistedFontFamily,
} = require('./check-design-tokens')

let passed = 0
let failed = 0

function t(name, fn) {
  try {
    fn()
    passed++
    console.log(`  ok  - ${name}`)
  } catch (err) {
    failed++
    console.error(`  FAIL - ${name}`)
    console.error(`         ${err.message}`)
  }
}

function ruleByName(name) {
  const rule = RULES.find((r) => r.name === name)
  assert.ok(rule, `rule "${name}" exists in RULES`)
  return rule
}

// ---------------------------------------------------------------------
// One positive + one negative fixture per rule.
// ---------------------------------------------------------------------
const RULE_FIXTURES = {
  'hex-color-literal': {
    positive: `        background: "#241a10",`,
    negative: `        background: 'var(--afa-surface-page)',`,
  },
  'rgb-rgba-literal': {
    positive: `        color: 'rgba(20,20,20,0.7)',`,
    negative: `        color: 'var(--afa-text-primary)',`,
  },
  'hardcoded-font-family': {
    positive: `        fontFamily: 'Georgia, serif',`,
    negative: `        fontFamily: 'var(--font-display)',`,
  },
  'font-size-literal': {
    positive: `        fontSize: 14,`,
    negative: `        fontSize: 'var(--afa-text-body)',`,
  },
  'spacing-literal': {
    positive: `        padding: '10px 20px',`,
    negative: `        padding: 'var(--afa-space-2)',`,
  },
  'radius-literal': {
    positive: `        borderRadius: 8,`,
    negative: `        borderRadius: 'var(--afa-radius-sm)',`,
  },
  'raw-button': {
    positive: `        <button onClick={onSave}>Save</button>`,
    negative: `        <Button onClick={onSave}>Save</Button>`,
  },
  'bare-button': {
    positive: `        <Button variant="bare" onClick={onSave}>Save</Button>`,
    negative: `        <Button variant="solid" size="sm" onClick={onSave}>Save</Button>`,
  },
}

console.log('check-design-tokens.js self-tests\n')

for (const [ruleName, fixtures] of Object.entries(RULE_FIXTURES)) {
  const rule = ruleByName(ruleName)
  t(`${ruleName}: positive fixture is flagged`, () => {
    assert.equal(rule.test(fixtures.positive), true, 'test() should return true')
    const literals = rule.extract(fixtures.positive)
    assert.ok(literals.length > 0, 'extract() should find at least one literal')
  })
  t(`${ruleName}: negative fixture is NOT flagged`, () => {
    assert.equal(rule.test(fixtures.negative), false, 'test() should return false')
  })
}

// ---------------------------------------------------------------------
// Tailwind arbitrary-value forms (separate from the JS-prop fixtures
// above - each rule's extract() checks both forms independently).
// ---------------------------------------------------------------------
t('font-size-literal: Tailwind text-[Npx] is flagged', () => {
  const rule = ruleByName('font-size-literal')
  assert.equal(rule.test(`      <span className="text-[15px] uppercase">`), true)
})
t('font-size-literal: Tailwind text-sm (scale class, not arbitrary) is NOT flagged', () => {
  const rule = ruleByName('font-size-literal')
  assert.equal(rule.test(`      <span className="text-sm uppercase">`), false)
})
t('spacing-literal: Tailwind gap-[Npx] is flagged', () => {
  const rule = ruleByName('spacing-literal')
  assert.equal(rule.test(`      <div className="flex gap-[10px]">`), true)
})
t('spacing-literal: Tailwind gap-4 (scale class) is NOT flagged', () => {
  const rule = ruleByName('spacing-literal')
  assert.equal(rule.test(`      <div className="flex gap-4">`), false)
})
t('radius-literal: Tailwind rounded-[Npx] is flagged', () => {
  const rule = ruleByName('radius-literal')
  assert.equal(rule.test(`      <div className="rounded-[6px] overflow-hidden">`), true)
})
t('radius-literal: Tailwind rounded-t-[Npx] (side variant) is flagged', () => {
  const rule = ruleByName('radius-literal')
  assert.equal(rule.test(`      <div className="rounded-t-[6px]">`), true)
})

// ---------------------------------------------------------------------
// Allowlist: 0, hairline 1px/0.5px, and any % value.
// ---------------------------------------------------------------------
t('isAllowlistedLength: 0 and 0px are allowed', () => {
  assert.equal(isAllowlistedLength('0'), true)
  assert.equal(isAllowlistedLength('0px'), true)
})
t('isAllowlistedLength: hairline 1px/0.5px are allowed', () => {
  assert.equal(isAllowlistedLength('1px'), true)
  assert.equal(isAllowlistedLength('0.5px'), true)
})
t('isAllowlistedLength: any percent value is allowed', () => {
  assert.equal(isAllowlistedLength('50%'), true)
  assert.equal(isAllowlistedLength('100%'), true)
})
t('isAllowlistedLength: an ordinary literal (2px, 14px) is NOT allowed', () => {
  assert.equal(isAllowlistedLength('2px'), false)
  assert.equal(isAllowlistedLength('14px'), false)
})
t('GEN-2609-094: isAllowlistedFontFamily allows inherit, case-insensitively', () => {
  assert.equal(isAllowlistedFontFamily('inherit'), true)
  assert.equal(isAllowlistedFontFamily('Inherit'), true)
  assert.equal(isAllowlistedFontFamily('INHERIT'), true)
})
t('GEN-2609-094: isAllowlistedFontFamily does not allow a real hardcoded family', () => {
  assert.equal(isAllowlistedFontFamily('Georgia'), false)
  assert.equal(isAllowlistedFontFamily('SF Mono'), false)
})
t('GEN-2609-094: hardcoded-font-family rule does not flag fontFamily: inherit', () => {
  const rule = ruleByName('hardcoded-font-family')
  assert.equal(rule.test(`fontFamily: 'inherit',`), false)
  assert.deepEqual(rule.extract(`fontFamily: 'inherit',`), [])
})
t('GEN-2609-094: hardcoded-font-family rule still flags a real hardcoded family', () => {
  const rule = ruleByName('hardcoded-font-family')
  assert.equal(rule.test(`fontFamily: 'Georgia',`), true)
  assert.deepEqual(rule.extract(`fontFamily: 'Georgia',`), ['Georgia'])
})
t('spacing-literal: zero padding is not flagged, a real value in the same shorthand still is', () => {
  const rule = ruleByName('spacing-literal')
  assert.equal(rule.test(`        padding: '0',`), false)
  const literals = rule.extract(`        padding: '0 12px',`)
  assert.deepEqual(literals, ['12px'], 'only the non-zero part of the shorthand should be extracted')
})
t('radius-literal: border-radius 50%/100% (circle/pill) is not flagged', () => {
  const rule = ruleByName('radius-literal')
  assert.equal(rule.test(`        borderRadius: '50%',`), false)
  assert.equal(rule.test(`        borderRadius: '100%',`), false)
})

// ---------------------------------------------------------------------
// GEN-2609-089 (checker fix) - unquoted multi-value CSS shorthand. The
// quoted form (`padding: '10px 20px'`) already counted every token (see
// the shorthand test above); an UNQUOTED shorthand - the form raw CSS
// text inside a `<style>{`...`}</style>` block uses, e.g.
// `padding: 8px 12px;` - used to stop at the first token, because the
// bare-value branch's lookahead treated plain whitespace as a valid
// terminator on its own (needed so a JS single value like
// `fontSize: 14 }` still matches). See CSS_PROP_VALUE_RE's own comment.
// ---------------------------------------------------------------------
t('spacing-literal: unquoted two-value shorthand counts both tokens', () => {
  const rule = ruleByName('spacing-literal')
  assert.deepEqual(rule.extract(`        padding: 8px 12px;`), ['8px', '12px'])
})
t('spacing-literal: unquoted four-value shorthand counts all four tokens', () => {
  const rule = ruleByName('spacing-literal')
  assert.deepEqual(rule.extract(`        margin: 4px 8px 4px 8px;`), ['4px', '8px', '4px', '8px'])
})
t('font-size-literal: unquoted shorthand with mixed units counts both tokens', () => {
  const rule = ruleByName('font-size-literal')
  assert.deepEqual(rule.extract(`        font-size: 8px 1rem;`), ['8px', '1rem'])
})
t('spacing-literal: two adjacent unquoted single-value declarations are each counted once, not merged', () => {
  const rule = ruleByName('spacing-literal')
  assert.deepEqual(
    rule.extract(`        padding: 8px; margin: 12px;`),
    ['8px', '12px'],
    'each declaration is a single value terminated by its own semicolon - neither should bleed into the other or be counted twice'
  )
})

// ---------------------------------------------------------------------
// raw-button: file-level exemption for Button.tsx itself.
// ---------------------------------------------------------------------
t('raw-button: isExemptFile is true only for src/components/ui/Button.tsx', () => {
  const rule = ruleByName('raw-button')
  assert.equal(rule.isExemptFile('src/components/ui/Button.tsx'), true)
  assert.equal(rule.isExemptFile('src/app/dashboard/admin/settings/page.tsx'), false)
})

// ---------------------------------------------------------------------
// raw-button: skipRelocatedCheck - a raw <button> must always flag, even
// though the literal "<button>" text trivially already exists elsewhere
// in the base tree (the GEN-2609-057 relocated-literal exemption, built
// for value-uniqueness checks like a specific color, would otherwise
// silently defeat this rule for every new site).
// ---------------------------------------------------------------------
t('raw-button: shouldFlag() ignores the relocated-literal exemption', () => {
  const rule = ruleByName('raw-button')
  const alwaysKnown = () => true // simulate "<button>" already existing everywhere
  assert.equal(shouldFlag(rule, ['<button>'], alwaysKnown), true)
})
t('spacing-literal (contrast case): shouldFlag() DOES honor the relocated-literal exemption', () => {
  const rule = ruleByName('spacing-literal')
  const alwaysKnown = () => true
  assert.equal(shouldFlag(rule, ['10px'], alwaysKnown), false, 'a relocated spacing literal should be treated as pre-existing debt, not new')
  const neverKnown = () => false
  assert.equal(shouldFlag(rule, ['10px'], neverKnown), true, 'a genuinely new spacing literal should still be flagged')
})

// ---------------------------------------------------------------------
// // token-ok(<rule>): <reason> escape hatch (GEN-2609-117: scoped).
// ---------------------------------------------------------------------
t('parseTokenOk: extracts the rule and reason from a trailing comment', () => {
  assert.deepEqual(
    parseTokenOk(`        fill="#4285F4" // token-ok(hex-color-literal): Google-brand SVG fixed color`),
    { rules: ['hex-color-literal'], reason: 'Google-brand SVG fixed color' }
  )
})
t('parseTokenOk: returns null when no token-ok comment is present', () => {
  assert.equal(parseTokenOk(`        fill="#4285F4"`), null)
})
t('parseTokenOk: multi-rule scope, whitespace tolerated, duplicates dropped', () => {
  assert.deepEqual(
    parseTokenOk(`  x // token-ok( font-size-literal , spacing-literal,font-size-literal ): one-off hero`).rules,
    ['font-size-literal', 'spacing-literal']
  )
})
t('parseTokenOk: the unscoped form is an error naming the new syntax', () => {
  const r = parseTokenOk(`  fill="#4285F4" // token-ok: Google-brand SVG fixed color`)
  assert.ok(r.error, 'unscoped is an error')
  assert.match(r.error, /unscoped/)
  assert.match(r.error, /token-ok\(<rule>/)
  assert.ok(parseTokenOk(`  <path fill="#4285F4"/>{/* token-ok: brand */}`).error, 'unscoped JSX form is an error too')
})
t('parseTokenOk: an unknown rule name is an error listing the valid ones', () => {
  const r = parseTokenOk(`  fontSize: 30, // token-ok(font-size): stat figure`)
  assert.match(r.error, /unknown rule "font-size"/)
  assert.match(r.error, /font-size-literal/)
  assert.match(parseTokenOk(`  x // token-ok(font-size-literal,bogus): r`).error, /"bogus"/, 'one bad name in a list fails the whole comment')
})
t('parseTokenOk: an empty scope or a missing reason is an error', () => {
  assert.ok(parseTokenOk(`  fontSize: 30, // token-ok(): stat figure`).error)
  assert.ok(parseTokenOk(`  fontSize: 30, // token-ok(font-size-literal):`).error)
  assert.ok(parseTokenOk(`  fontSize: 30, // token-ok(font-size-literal) stat figure`).error)
})
t('findOffenses: an unscoped token-ok on an added line is a token-ok-syntax offense and exempts nothing', () => {
  const diff = oneFileDiff(['+  fill="#ABCDE3" // token-ok: Google-brand SVG fixed color'])
  const { offenses, tokenOkUses } = findOffenses(diff)
  assert.equal(tokenOkUses.length, 0)
  assert.deepEqual(offenses.map((o) => o.rule).sort(), ['hex-color-literal', 'token-ok-syntax'])
  assert.match(offenses.find((o) => o.rule === 'token-ok-syntax').message, /unscoped/)
})
t('findOffenses: an unknown-rule token-ok is a token-ok-syntax offense', () => {
  const diff = oneFileDiff([`+  style={{ fontSize: '41px' }} // token-ok(fontsize-literal): one-off`])
  const { offenses } = findOffenses(diff)
  assert.ok(offenses.some((o) => o.rule === 'token-ok-syntax' && /unknown rule/.test(o.message)))
})
t('findOffenses: a scoped token-ok exempts its rule; another rule on the same line is still flagged', () => {
  const diff = oneFileDiff([
    `+  <h1 style={{ fontSize: '4211px', padding: '4213px' }} />{/* token-ok(font-size-literal): one-off hero */}`,
  ])
  const { offenses, tokenOkUses } = findOffenses(diff)
  assert.equal(tokenOkUses.length, 1)
  assert.deepEqual(tokenOkUses[0].rules, ['font-size-literal'])
  assert.deepEqual(offenses.map((o) => o.rule), ['spacing-literal'], 'the padding is not hidden by the fontSize reason')
})
t('findOffenses: a multi-rule scope exempts each named rule and nothing else', () => {
  const diff = oneFileDiff([
    `+  style={{ fontSize: '4211px', padding: '4213px', borderRadius: '4217px' }} // token-ok(font-size-literal,spacing-literal): one-off hero`,
  ])
  const { offenses } = findOffenses(diff)
  assert.deepEqual(offenses.map((o) => o.rule), ['radius-literal'])
})
t('findOffenses: a line with // token-ok(<rule>): is suppressed and reported separately, not as an offense', () => {
  const diff = [
    'diff --git a/src/app/foo.tsx b/src/app/foo.tsx',
    '--- a/src/app/foo.tsx',
    '+++ b/src/app/foo.tsx',
    '@@ -0,0 +1,2 @@',
    '+  fill="#4285F4" // token-ok(hex-color-literal): Google-brand SVG fixed color',
    '+  fill="#111827"',
  ].join('\n')
  const { offenses, tokenOkUses } = findOffenses(diff)
  assert.equal(tokenOkUses.length, 1, 'exactly one token-ok use recorded')
  assert.equal(tokenOkUses[0].reason, 'Google-brand SVG fixed color')
  assert.equal(offenses.length, 1, 'the un-annotated hex literal on the next line is still flagged')
  assert.equal(offenses[0].rule, 'hex-color-literal')
})

// ---------------------------------------------------------------------
// GEN-2609-085 - `{/* token-ok: <reason> */}` JSX-comment form. Needed
// for raw JSX markup lines (e.g. an inline SVG icon's own attributes)
// where a trailing `//` isn't a comment at all - it would become a
// literal sibling text node instead. See check-design-tokens.js's own
// comment above TOKEN_OK_JSX_RE.
// ---------------------------------------------------------------------
t('parseTokenOk: extracts the rule and reason from a trailing JSX comment', () => {
  assert.deepEqual(
    parseTokenOk(`      <path fill="#4285F4" d="M1 2"/>{/* token-ok(hex-color-literal): Google-brand SVG fixed color */}`),
    { rules: ['hex-color-literal'], reason: 'Google-brand SVG fixed color' }
  )
})
t('parseTokenOk: JSX comment form is an error when malformed (missing closing brace)', () => {
  const r = parseTokenOk(`      <path fill="#4285F4"/>{/* token-ok(hex-color-literal): reason */`)
  assert.ok(r.error)
  assert.match(r.error, /malformed/)
})
t('findOffenses: a line with {/* token-ok(<rule>): */} is suppressed and reported separately, not as an offense', () => {
  const diff = [
    'diff --git a/src/app/foo.tsx b/src/app/foo.tsx',
    '--- a/src/app/foo.tsx',
    '+++ b/src/app/foo.tsx',
    '@@ -0,0 +1,2 @@',
    '+      <path fill="#4285F4" d="M1 2"/>{/* token-ok(hex-color-literal): Google-brand SVG fixed color */}',
    '+      <path fill="#111827" d="M3 4"/>',
  ].join('\n')
  const { offenses, tokenOkUses } = findOffenses(diff)
  assert.equal(tokenOkUses.length, 1, 'exactly one token-ok use recorded')
  assert.equal(tokenOkUses[0].reason, 'Google-brand SVG fixed color')
  assert.equal(offenses.length, 1, 'the un-annotated hex literal on the next line is still flagged')
  assert.equal(offenses[0].rule, 'hex-color-literal')
})
t('findOffenses: a clean diff with no literals produces zero offenses', () => {
  const diff = [
    'diff --git a/src/app/foo.tsx b/src/app/foo.tsx',
    '--- a/src/app/foo.tsx',
    '+++ b/src/app/foo.tsx',
    '@@ -0,0 +1,1 @@',
    "+  color: 'var(--afa-text-primary)',",
  ].join('\n')
  const { offenses } = findOffenses(diff)
  assert.equal(offenses.length, 0)
})
t('findOffenses: exempt files (globals.css-equivalent path) are skipped entirely', () => {
  assert.equal(isExemptFile('src/lib/design-tokens.ts'), true)
  const diff = [
    'diff --git a/src/lib/design-tokens.ts b/src/lib/design-tokens.ts',
    '--- a/src/lib/design-tokens.ts',
    '+++ b/src/lib/design-tokens.ts',
    '@@ -0,0 +1,1 @@',
    '+  primary: "#241a10",',
  ].join('\n')
  const { offenses } = findOffenses(diff)
  assert.equal(offenses.length, 0, 'the exempt token-definition file should never be scanned')
})
t('GEN-2609-119: email.ts, ticket-pdf.ts, manifest.ts and the poster routes are no longer exempt files', () => {
  for (const f of ['src/lib/email.ts', 'src/lib/ticket-pdf.ts', 'src/app/manifest.ts', 'src/lib/poster-colors.ts', 'src/app/api/posters/organiser/[eventId]/route.tsx', 'src/app/api/posters/artist/[performanceId]/route.tsx']) {
    assert.equal(isExemptFile(f), false, f)
  }
})
t('GEN-2609-119: a new hex literal in email.ts is an offense', () => {
  const diff = [
    'diff --git a/src/lib/email.ts b/src/lib/email.ts',
    '--- a/src/lib/email.ts',
    '+++ b/src/lib/email.ts',
    '@@ -0,0 +1,1 @@',
    '+          <div style="color: #ABCDE4;">',
  ].join('\n')
  const { offenses } = findOffenses(diff)
  assert.deepEqual(offenses.map((o) => o.rule), ['hex-color-literal'])
})
t('GEN-2609-119: a new rgb() literal in ticket-pdf.ts is an offense', () => {
  const diff = [
    'diff --git a/src/lib/ticket-pdf.ts b/src/lib/ticket-pdf.ts',
    '--- a/src/lib/ticket-pdf.ts',
    '+++ b/src/lib/ticket-pdf.ts',
    '@@ -0,0 +1,1 @@',
    '+  ink: rgb(0.1234, 0.4567, 0.7891),',
  ].join('\n')
  const { offenses } = findOffenses(diff)
  assert.deepEqual(offenses.map((o) => o.rule), ['rgb-rgba-literal'])
})
t('GEN-2609-119: a new hex literal in manifest.ts is an offense', () => {
  const diff = [
    'diff --git a/src/app/manifest.ts b/src/app/manifest.ts',
    '--- a/src/app/manifest.ts',
    '+++ b/src/app/manifest.ts',
    '@@ -0,0 +1,1 @@',
    "+    theme_color: '#ABCDE5',",
  ].join('\n')
  const { offenses } = findOffenses(diff)
  assert.deepEqual(offenses.map((o) => o.rule), ['hex-color-literal'])
})
t('GEN-2609-119: a new hex literal in a poster route is an offense', () => {
  const diff = [
    'diff --git a/src/app/api/posters/organiser/[eventId]/route.tsx b/src/app/api/posters/organiser/[eventId]/route.tsx',
    '--- a/src/app/api/posters/organiser/[eventId]/route.tsx',
    '+++ b/src/app/api/posters/organiser/[eventId]/route.tsx',
    '@@ -0,0 +1,1 @@',
    "+          background: '#ABCDE6',",
  ].join('\n')
  const { offenses } = findOffenses(diff)
  assert.deepEqual(offenses.map((o) => o.rule), ['hex-color-literal'])
})
t('GEN-2609-119: a logo literal carrying token-ok passes and is listed', () => {
  const diff = [
    'diff --git a/src/lib/poster-colors.ts b/src/lib/poster-colors.ts',
    '--- a/src/lib/poster-colors.ts',
    '+++ b/src/lib/poster-colors.ts',
    '@@ -0,0 +1,1 @@',
    "+  tile: '#ABCDE7', // token-ok(hex-color-literal): logo, fixed by design",
  ].join('\n')
  const { offenses, tokenOkUses } = findOffenses(diff)
  assert.equal(offenses.length, 0)
  assert.equal(tokenOkUses.length, 1)
})
t('GEN-2609-119: px sizes stay allowed in email.ts and the poster routes, where var() cannot render', () => {
  assert.equal(isSizingExemptFile('src/lib/email.ts'), true)
  assert.equal(isSizingExemptFile('src/app/api/posters/artist/[performanceId]/route.tsx'), true)
  assert.equal(isSizingExemptFile('src/lib/ticket-pdf.ts'), false)
  assert.equal(isSizingExemptFile('src/app/manifest.ts'), false)
  for (const [file, line] of [
    ['src/lib/email.ts', '+          <div style="font-size: 4217px; padding: 4219px 0; border-radius: 4223px;">'],
    ['src/app/api/posters/organiser/[eventId]/route.tsx', "+        <div style={{ fontSize: '4217px', padding: '4219px', borderRadius: '4223px', fontFamily: 'Poster Serif Unique' }}>"],
  ]) {
    const diff = ['diff --git a/' + file + ' b/' + file, '--- a/' + file, '+++ b/' + file, '@@ -0,0 +1,1 @@', line].join('\n')
    assert.equal(findOffenses(diff).offenses.length, 0, file)
  }
})
t('GEN-2609-119: the same px sizes are still offenses in an ordinary file', () => {
  const diff = [
    'diff --git a/src/app/foo.tsx b/src/app/foo.tsx',
    '--- a/src/app/foo.tsx',
    '+++ b/src/app/foo.tsx',
    '@@ -0,0 +1,1 @@',
    "+        <div style={{ fontSize: '4217px', padding: '4219px', borderRadius: '4223px' }}>",
  ].join('\n')
  const rules = findOffenses(diff).offenses.map((o) => o.rule).sort()
  assert.deepEqual(rules, ['font-size-literal', 'radius-literal', 'spacing-literal'])
})
t('GEN-2609-119: the codemod still never rewrites a surface where var() cannot render', () => {
  for (const f of ['src/lib/email.ts', 'src/lib/ticket-pdf.ts', 'src/app/manifest.ts', 'src/lib/poster-colors.ts', 'src/app/api/posters/artist/[performanceId]/route.tsx', 'src/app/globals.css', 'src/lib/design-tokens.ts']) {
    assert.equal(isMigrationExcludedFile(f), true, f)
  }
  assert.equal(isMigrationExcludedFile('src/components/SiteNav.tsx'), false)
})

// ---------------------------------------------------------------------
// GEN-2609-080 - raw-button is count-based over the WHOLE diff, not
// per-line like every other rule (see check-design-tokens.js's own
// header comment and the rule's own comment for why: a token retrofit
// of an EXISTING raw button is 1 removed + 1 added line, and per-line
// matching alone can't tell that apart from a genuinely new button).
// ---------------------------------------------------------------------
t('raw-button (count-based): a retrofit-only diff (1 removed, 1 added, same button) passes', () => {
  const diff = [
    'diff --git a/src/app/foo.tsx b/src/app/foo.tsx',
    '--- a/src/app/foo.tsx',
    '+++ b/src/app/foo.tsx',
    '@@ -10,1 +10,1 @@',
    "-      <button style={{ padding: '8px' }}>Save</button>",
    "+      <button style={{ padding: 'var(--afa-space-2)' }}>Save</button>",
  ].join('\n')
  const { offenses } = findOffenses(diff)
  assert.equal(offenses.length, 0, 'the button count did not change, so nothing should flag')
})
t('raw-button (count-based): one genuinely new raw button (0 removed, 1 added) fails', () => {
  const diff = [
    'diff --git a/src/app/foo.tsx b/src/app/foo.tsx',
    '--- a/src/app/foo.tsx',
    '+++ b/src/app/foo.tsx',
    '@@ -0,0 +1,1 @@',
    '+      <button onClick={onSave}>New</button>',
  ].join('\n')
  const { offenses } = findOffenses(diff)
  assert.equal(offenses.length, 1)
  assert.equal(offenses[0].rule, 'raw-button')
})
t('raw-button (count-based): 2 added + 1 removed nets a surplus of 1, reports only the last added line', () => {
  const diff = [
    'diff --git a/src/app/foo.tsx b/src/app/foo.tsx',
    '--- a/src/app/foo.tsx',
    '+++ b/src/app/foo.tsx',
    '@@ -5,1 +5,2 @@',
    '-      <button>Old</button>',
    '+      <button>First</button>',
    '+      <button>Second</button>',
  ].join('\n')
  const { offenses } = findOffenses(diff)
  assert.equal(offenses.length, 1, 'surplus = 2 added - 1 removed = 1')
  assert.ok(offenses[0].content.includes('Second'), 'the reported line should be the last of the added entries, in diff order')
})
t('raw-button (count-based): a button moved between files (-1 in one, +1 in another) nets to 0 and passes', () => {
  const diff = [
    'diff --git a/src/app/source.tsx b/src/app/source.tsx',
    '--- a/src/app/source.tsx',
    '+++ b/src/app/source.tsx',
    '@@ -5,1 +5,0 @@',
    '-      <button onClick={onSave}>Save</button>',
    'diff --git a/src/app/dest.tsx b/src/app/dest.tsx',
    '--- a/src/app/dest.tsx',
    '+++ b/src/app/dest.tsx',
    '@@ -0,0 +1,1 @@',
    '+      <button onClick={onSave}>Save</button>',
  ].join('\n')
  const { offenses } = findOffenses(diff)
  assert.equal(offenses.length, 0, 'diff-wide net is 0 even though it is +1 in the destination file alone')
})
t('raw-button (count-based): a token-ok-annotated new button is suppressed, not counted as added, and still reported', () => {
  const diff = [
    'diff --git a/src/app/foo.tsx b/src/app/foo.tsx',
    '--- a/src/app/foo.tsx',
    '+++ b/src/app/foo.tsx',
    '@@ -0,0 +1,1 @@',
    '+      <button onClick={onSave}>New</button> // token-ok(raw-button): one-off, see PR description',
  ].join('\n')
  const { offenses, tokenOkUses } = findOffenses(diff)
  assert.equal(offenses.length, 0)
  assert.equal(tokenOkUses.length, 1)
  assert.equal(tokenOkUses[0].reason, 'one-off, see PR description')
})
t('raw-button (count-based): Button.tsx stays exempt (an added <button> there never counts, even alone)', () => {
  const diff = [
    'diff --git a/src/components/ui/Button.tsx b/src/components/ui/Button.tsx',
    '--- a/src/components/ui/Button.tsx',
    '+++ b/src/components/ui/Button.tsx',
    '@@ -0,0 +1,1 @@',
    '+    <button {...rest} style={merged}>{content}</button>',
  ].join('\n')
  const { offenses } = findOffenses(diff)
  assert.equal(offenses.length, 0)
})

// ---------------------------------------------------------------------
// GEN-2609-109 - raw-button matches JSX only, never prose in comments.
// The 2 real false positives on qa before this fix are the fixtures.
// ---------------------------------------------------------------------
t('raw-button: <button inside a // comment is NOT flagged (EventSaveButton.tsx:90)', () => {
  const rule = ruleByName('raw-button')
  const line = '        // toggle save (native <button> keyboard activation) AND navigate'
  assert.equal(rule.test(line), false)
  assert.deepEqual(rule.extract(line), [])
})
t('raw-button: <button inside a /* */ comment is NOT flagged (VenuePortalUI.tsx:426)', () => {
  const rule = ruleByName('raw-button')
  assert.equal(rule.test('/* ---------------- Nav pills + CTA links (Next <Link>, not <button>) ---------------- */'), false)
  assert.equal(rule.test(' * a block-comment continuation line mentioning <button> tags'), false)
})
t('raw-button: real JSX is still flagged - multi-line open tag, trailing comment, bare <button>', () => {
  const rule = ruleByName('raw-button')
  assert.equal(rule.test('                      <button'), true, 'multi-line JSX opening tag (RegisterForm.tsx:458 shape)')
  assert.equal(rule.test('      <button onClick={x}>Go</button> // TODO restyle'), true)
  assert.equal(rule.test('      {/* note */}<button>Go</button>'), true)
  assert.equal(rule.test('      <button>'), true)
})
t('raw-button: a tag that merely starts with "button" is NOT a raw button', () => {
  const rule = ruleByName('raw-button')
  assert.equal(rule.test('      <buttonGroup items={x} />'), false)
})
t("stripLineComments keeps a URL's // intact", () => {
  assert.equal(stripLineComments("  const u = 'https://example.com'"), "  const u = 'https://example.com'")
})
t('raw-button (count-based): adding a comment that mentions <button> never counts', () => {
  const diff = [
    'diff --git a/src/components/EventSaveButton.tsx b/src/components/EventSaveButton.tsx',
    '--- a/src/components/EventSaveButton.tsx',
    '+++ b/src/components/EventSaveButton.tsx',
    '@@ -0,0 +1,1 @@',
    '+        // toggle save (native <button> keyboard activation) AND navigate',
  ].join('\n')
  assert.equal(findOffenses(diff).offenses.length, 0)
})

// ---------------------------------------------------------------------
// GEN-2609-109 - bare-button: count-based, same diff-wide surplus as
// raw-button. Converting bare -> a real variant must never trip it.
// ---------------------------------------------------------------------
function oneFileDiff(lines, file = 'src/app/foo.tsx') {
  return [`diff --git a/${file} b/${file}`, `--- a/${file}`, `+++ b/${file}`, '@@ -1,1 +1,1 @@', ...lines].join('\n')
}
t('bare-button: matches every quoting form, and counts occurrences not lines', () => {
  const rule = ruleByName('bare-button')
  assert.equal(rule.test(`<Button variant='bare'>`), true)
  assert.equal(rule.test(`<Button variant={'bare'}>`), true)
  assert.equal(rule.test('<Button variant={`bare`}>'), true)
  assert.equal(rule.extract('<Button variant="bare">a</Button><Button variant="bare">b</Button>').length, 2)
})
t('bare-button: does not match other variants, the type union, a case label, or comments', () => {
  const rule = ruleByName('bare-button')
  assert.equal(rule.test('<Button variant="barely">'), false)
  assert.equal(rule.test("type ButtonVariant = 'primary' | 'bare'"), false)
  assert.equal(rule.test("    case 'bare':"), false)
  assert.equal(rule.test('  // routed via <Button variant="bare"> for now'), false)
})
t('bare-button (count-based): converting bare -> a real variant passes', () => {
  const diff = oneFileDiff([
    '-      <Button variant="bare" onClick={retry} style={{ padding: 8 }}>Retry</Button>',
    '+      <Button variant="solid" size="sm" fullWidth={false} onClick={retry}>Retry</Button>',
  ])
  assert.equal(findOffenses(diff).offenses.length, 0)
})
t('bare-button (count-based): restyling an existing bare site (-1/+1) passes', () => {
  const diff = oneFileDiff([
    `-      <Button variant="bare" style={{ padding: 'var(--afa-space-2)' }}>Row</Button>`,
    `+      <Button variant="bare" style={{ padding: 'var(--afa-space-3)' }}>Row</Button>`,
  ])
  assert.equal(findOffenses(diff).offenses.length, 0)
})
t('bare-button (count-based): raw <button> -> bare passes raw-button but fails bare-button', () => {
  const diff = oneFileDiff([
    '-      <button onClick={go}>Go</button>',
    '+      <Button variant="bare" onClick={go}>Go</Button>',
  ])
  const { offenses } = findOffenses(diff)
  assert.equal(offenses.length, 1)
  assert.equal(offenses[0].rule, 'bare-button')
})
t('bare-button (count-based): 2 bare on one added line vs 1 removed nets a surplus of 1', () => {
  const diff = oneFileDiff([
    '-      <Button variant="bare">a</Button>',
    '+      <Button variant="bare">a</Button><Button variant="bare">b</Button>',
  ])
  const { offenses } = findOffenses(diff)
  assert.equal(offenses.length, 1)
  assert.equal(offenses[0].rule, 'bare-button')
})
t('bare-button (count-based): token-ok(bare-button) suppresses it like every other rule', () => {
  const diff = oneFileDiff([
    '+      <Button variant="bare" onClick={go}>Cell</Button> {/* token-ok(bare-button): seat cell, structural */}',
  ])
  const { offenses, tokenOkUses } = findOffenses(diff)
  assert.equal(offenses.length, 0)
  assert.equal(tokenOkUses.length, 1)
})
t('bare-button (count-based): a token-ok naming another rule does not suppress it', () => {
  const diff = oneFileDiff([
    '+      <Button variant="bare" onClick={go}>Cell</Button> {/* token-ok(spacing-literal): seat cell, structural */}',
  ])
  const { offenses } = findOffenses(diff)
  assert.deepEqual(offenses.map((o) => o.rule), ['bare-button'])
})
t('raw-button (count-based): removing a token-ok(raw-button) line is not a -1 that pays for a new button', () => {
  const diff = oneFileDiff([
    '-      <button onClick={a}>Old</button> // token-ok(raw-button): one-off',
    '+      <button onClick={b}>New</button>',
  ])
  const { offenses } = findOffenses(diff)
  assert.deepEqual(offenses.map((o) => o.rule), ['raw-button'])
})

// GEN-2609-117 - the checker (diff) and the ratchet (whole file) share
// parseTokenOk, so the same fixture must count the same per rule. Each
// line holds at most one literal per rule (the checker reports per
// line, the ratchet per literal). Values are ones git grep won't find
// in origin/qa, so the relocated-literal exemption stays out of it.
t('checker and ratchet agree per rule on a token-ok fixture', () => {
  const { countLines, newAccumulator } = require('./design-token-ratchet')
  const fixture = [
    `  <h1 style={{ fontSize: '4211px', padding: '4213px' }} />{/* token-ok(font-size-literal): hero */}`,
    `  style={{ fontSize: '4219px', padding: '4223px', borderRadius: '4217px' }} // token-ok(font-size-literal,spacing-literal): hero`,
    `  fill="#ABCDE1" // token-ok(hex-color-literal): brand`,
    `  fill="#ABCDE2" // token-ok: brand`,
    `  background: 'rgba(1,2,3,0.4211)', // token-ok(font-size-literal): wrong rule named`,
    `  <button onClick={go}>x</button> // token-ok(raw-button): one-off`,
    `  <Button variant="bare">x</Button> // token-ok(radius-literal): wrong rule named`,
    `  gap: '4229px',`,
  ]
  const file = 'src/app/fixture-117.tsx'
  const diff = oneFileDiff(fixture.map((l) => `+${l}`), file)
  const { offenses } = findOffenses(diff)
  const checker = {}
  for (const o of offenses) if (o.rule !== 'token-ok-syntax') checker[o.rule] = (checker[o.rule] || 0) + 1
  const acc = newAccumulator()
  countLines(file, fixture.join('\n'), acc)
  const ratchet = Object.fromEntries(Object.entries(acc.counts).filter(([, n]) => n > 0))
  assert.deepEqual(checker, ratchet)
  assert.deepEqual(ratchet, {
    'hex-color-literal': 1,
    'rgb-rgba-literal': 1,
    'spacing-literal': 2,
    'radius-literal': 1,
    'bare-button': 1,
  })
  assert.equal(acc.tokenOkErrors.length, 1, 'the unscoped line is an error in the ratchet')
  assert.equal(offenses.filter((o) => o.rule === 'token-ok-syntax').length, 1, 'and in the checker')
})

// GEN-2609-110 - bare-button counts only bare Buttons WITHOUT a
// `bare-reason` comment on the line directly above.
const REASON = '// bare-reason: seat-grid cell sized by the canvas grid, no variant fits'
t('bare-reason: both comment forms parse; a short or empty reason does not count', () => {
  assert.equal(bareReason(`        ${REASON}`), 'seat-grid cell sized by the canvas grid, no variant fits')
  assert.equal(bareReason('      {/* bare-reason: carousel progress dot, width animates */}'), 'carousel progress dot, width animates')
  assert.equal(bareReason('        // bare-reason: custom'), null)
  assert.equal(bareReason('        // bare-reason:'), null)
  assert.equal(bareReason('        variant="bare" // bare-reason: trailing on the same line is not above it'), null)
  assert.equal(bareReason(undefined), null)
})
t('bare-button: a bare-reason on the line above explains it (not counted)', () => {
  const rule = ruleByName('bare-button')
  assert.equal(rule.extract('        variant="bare"', `        ${REASON}`).length, 0)
  assert.equal(rule.test('        variant="bare"', `        ${REASON}`), false)
  assert.equal(rule.extract('        variant="bare"', '        key={n}').length, 1)
  assert.equal(rule.extract('        variant="bare"').length, 1)
})
t('bare-button: the reason line itself is never counted as a bare Button', () => {
  const rule = ruleByName('bare-button')
  assert.equal(rule.extract('        // bare-reason: keeps variant="bare" because the dot animates').length, 0)
})
t('bare-button (diff): a new bare Button with a reason above passes', () => {
  const diff = oneFileDiff([
    '       <Button',
    `+        ${REASON}`,
    '+        variant="bare"',
    '         onClick={go}',
  ])
  const { offenses, bareReasonUses } = findOffenses(diff)
  assert.equal(offenses.length, 0)
  assert.equal(bareReasonUses.length, 1)
})
t('bare-button (diff): a new bare Button without a reason still fails', () => {
  const diff = oneFileDiff([
    '       <Button',
    '+        variant="bare"',
    '         onClick={go}',
  ])
  const { offenses } = findOffenses(diff)
  assert.equal(offenses.length, 1)
  assert.equal(offenses[0].rule, 'bare-button')
})
t('bare-button (diff): a too-short reason does not explain a new bare Button', () => {
  const diff = oneFileDiff([
    '       <Button',
    '+        // bare-reason: custom',
    '+        variant="bare"',
  ])
  assert.equal(findOffenses(diff).offenses.length, 1)
})
t('bare-button (diff): deleting the reason above an unchanged bare Button fails', () => {
  const diff = oneFileDiff([
    '       <Button',
    `-        ${REASON}`,
    '         variant="bare"',
    '         onClick={go}',
  ])
  const { offenses } = findOffenses(diff)
  assert.equal(offenses.length, 1)
  assert.equal(offenses[0].rule, 'bare-button')
})
t('bare-button (diff): adding a reason above an existing bare Button passes', () => {
  const diff = oneFileDiff([
    '       <Button',
    `+        ${REASON}`,
    '         variant="bare"',
  ])
  assert.equal(findOffenses(diff).offenses.length, 0)
})
t('bare-button (diff): an explained bare -> real variant is not a surplus', () => {
  const diff = oneFileDiff([
    '       <Button',
    `-        ${REASON}`,
    '-        variant="bare"',
    '+        variant="toggle-box"',
  ])
  assert.equal(findOffenses(diff).offenses.length, 0)
})
t('bare-button (diff): context lines keep new-file line numbers right', () => {
  const diff = oneFileDiff([
    '       <Button',
    '         key={n}',
    '+        variant="bare"',
  ])
  const { offenses } = findOffenses(diff)
  assert.equal(offenses.length, 1)
  assert.equal(offenses[0].line, 3)
})

console.log(`\n${passed} passed, ${failed} failed.`)
if (failed > 0) process.exit(1)
