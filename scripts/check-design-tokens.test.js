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

console.log(`\n${passed} passed, ${failed} failed.`)
if (failed > 0) process.exit(1)
