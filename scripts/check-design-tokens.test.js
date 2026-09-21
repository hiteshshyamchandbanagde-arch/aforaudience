// GEN-2609-078 - fixture-based self-tests for check-design-tokens.js's
// rule set: one positive (must be flagged) and one negative (must NOT be
// flagged) fixture per rule, plus dedicated cases for the Tailwind
// arbitrary-value forms, the allowlist, the raw-button file exemption +
// its skipRelocatedCheck behavior, and the `// token-ok:` escape hatch.
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
  shouldFlag,
  tokenOkReason,
  findOffenses,
  isAllowlistedLength,
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
// // token-ok: <reason> escape hatch.
// ---------------------------------------------------------------------
t('tokenOkReason: extracts the reason text from a trailing comment', () => {
  assert.equal(
    tokenOkReason(`        fill="#4285F4" // token-ok: Google-brand SVG fixed color`),
    'Google-brand SVG fixed color'
  )
})
t('tokenOkReason: returns null when no token-ok comment is present', () => {
  assert.equal(tokenOkReason(`        fill="#4285F4"`), null)
})
t('findOffenses: a line with // token-ok: is suppressed and reported separately, not as an offense', () => {
  const diff = [
    'diff --git a/src/app/foo.tsx b/src/app/foo.tsx',
    '--- a/src/app/foo.tsx',
    '+++ b/src/app/foo.tsx',
    '@@ -0,0 +1,2 @@',
    '+  fill="#4285F4" // token-ok: Google-brand SVG fixed color',
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
t('tokenOkReason: extracts the reason text from a trailing JSX comment', () => {
  assert.equal(
    tokenOkReason(`      <path fill="#4285F4" d="M1 2"/>{/* token-ok: Google-brand SVG fixed color */}`),
    'Google-brand SVG fixed color'
  )
})
t('tokenOkReason: JSX comment form returns null when malformed (missing closing brace)', () => {
  assert.equal(
    tokenOkReason(`      <path fill="#4285F4"/>{/* token-ok: reason */`),
    null
  )
})
t('findOffenses: a line with {/* token-ok: */} is suppressed and reported separately, not as an offense', () => {
  const diff = [
    'diff --git a/src/app/foo.tsx b/src/app/foo.tsx',
    '--- a/src/app/foo.tsx',
    '+++ b/src/app/foo.tsx',
    '@@ -0,0 +1,2 @@',
    '+      <path fill="#4285F4" d="M1 2"/>{/* token-ok: Google-brand SVG fixed color */}',
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
t('GEN-2609-094: email.ts, ticket-pdf.ts and manifest.ts are exempt - var() cannot resolve in any of them', () => {
  assert.equal(isExemptFile('src/lib/email.ts'), true)
  assert.equal(isExemptFile('src/lib/ticket-pdf.ts'), true)
  assert.equal(isExemptFile('src/app/manifest.ts'), true)
})
t('GEN-2609-094: findOffenses skips a new hex literal added to email.ts', () => {
  const diff = [
    'diff --git a/src/lib/email.ts b/src/lib/email.ts',
    '--- a/src/lib/email.ts',
    '+++ b/src/lib/email.ts',
    '@@ -0,0 +1,1 @@',
    '+          <div style="color: #C8441A;">',
  ].join('\n')
  const { offenses } = findOffenses(diff)
  assert.equal(offenses.length, 0, 'email HTML literals are the intended value, not hardcoding debt')
})
t('GEN-2609-094: findOffenses skips a new rgb() literal added to ticket-pdf.ts', () => {
  const diff = [
    'diff --git a/src/lib/ticket-pdf.ts b/src/lib/ticket-pdf.ts',
    '--- a/src/lib/ticket-pdf.ts',
    '+++ b/src/lib/ticket-pdf.ts',
    '@@ -0,0 +1,1 @@',
    '+  ink: rgb(0.055, 0.047, 0.039), // #0E0C0A',
  ].join('\n')
  const { offenses } = findOffenses(diff)
  assert.equal(offenses.length, 0, 'pdf-lib rgb() calls have no CSS engine to resolve var() against')
})
t('GEN-2609-094: findOffenses skips a new hex literal added to manifest.ts', () => {
  const diff = [
    'diff --git a/src/app/manifest.ts b/src/app/manifest.ts',
    '--- a/src/app/manifest.ts',
    '+++ b/src/app/manifest.ts',
    '@@ -0,0 +1,1 @@',
    "+    theme_color: '#FF5A36',",
  ].join('\n')
  const { offenses } = findOffenses(diff)
  assert.equal(offenses.length, 0, 'the web manifest is static JSON, not CSS-aware (BUG-2609-015)')
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
    '+      <button onClick={onSave}>New</button> // token-ok: one-off, see PR description',
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

console.log(`\n${passed} passed, ${failed} failed.`)
if (failed > 0) process.exit(1)
