// BUG-2610-025 - no emoji as icons, and one money format, across the
// dashboards and the shared components. Run with tsx:
//
//   npx tsx scripts/emoji-money.test.ts
//
// The bug: venue Bookings' Past Requests drew its date with the calendar
// emoji, which Android renders as a calendar reading "July 17" right
// beside "1 Oct 2026", and showed ₹37417 where the cards above it show
// ₹37,417. Icons now come from src/components/Icon.tsx and rupee amounts
// from formatINR (src/lib/money-display.ts). This scans the same files the
// sweep covered, so a new emoji or a bare ₹ amount fails here first.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { formatINR } from '../src/lib/money-display'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

const ROOT = path.join(__dirname, '..')
const SCANNED = ['src/app/dashboard', 'src/components']

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx|ts)$/.test(name)) out.push(p)
  }
  return out
}

/** Code lines only: whole-line comments are skipped (they may name an emoji to explain a fix). */
function codeLines(file: string): { n: number; text: string }[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .map((text, i) => ({ n: i + 1, text }))
    .filter(({ text }) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(text))
}

// Pictographs a phone draws as a colour emoji. Text dingbats that render
// in the UI font (✓ ✕ ✗ ★ ☆ → ·) are typography, not icons, and are not
// matched. U+26A0 (⚠) is matched: Android draws it as an emoji.
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F2FF}\u{2600}-\u{26FF}\u{2700}-\u{2712}\u{2714}\u{2716}-\u{2728}\u{2733}-\u{2767}\u{231A}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE0F}]/u
const TEXT_DINGBATS = new Set(['✓', '✕', '✗', '★', '☆'])

export function emojiIn(line: string): string[] {
  return [...line].filter((ch) => EMOJI.test(ch) && !TEXT_DINGBATS.has(ch))
}

// A rupee sign straight before an interpolated value that isn't run
// through a formatter: `₹${amount}` or JSX `₹{amount}`.
const BARE_RUPEE = /₹\$?\{(?![^}]*(formatINR|toLocaleString|toFixed))/

// Deliberate exceptions, each with its reason.
const MONEY_ALLOWED: { file: string; contains: string; why: string }[] = [
  { file: 'src/app/dashboard/venue-requests/page.tsx', contains: 'placeholder={lastOffer ? `Counter ₹${lastOffer.amount}`', why: 'an input placeholder showing the raw number to type' },
]

test('formatINR groups digits the Indian way and keeps the ₹', () => {
  assert.equal(formatINR(37417), '₹37,417')
  assert.equal(formatINR(125000), '₹1,25,000')
  assert.equal(formatINR(999), '₹999')
  assert.equal(formatINR(0), '₹0')
  assert.equal(formatINR(10000000), '₹1,00,00,000')
})

test('formatINR shows whole rupees (dashboard figures are never fractional)', () => {
  assert.equal(formatINR(4321.4), '₹4,321')
  assert.equal(formatINR(4321.6), '₹4,322')
})

test('the emoji matcher catches the reported emoji and leaves text dingbats alone', () => {
  assert.deepEqual(emojiIn('📅 {formatDate(b.fromDate)}'), ['📅'])
  assert.deepEqual(emojiIn("{icon ?? '💬'} {label}"), ['💬'])
  assert.deepEqual(emojiIn('⏳ Waitlisted'), ['⏳'])
  assert.deepEqual(emojiIn('⚠ below AA'), ['⚠'])
  assert.deepEqual(emojiIn("'✓ Checked in' : '✕ Rejected' ★ ☆ ✗"), [])
  assert.deepEqual(emojiIn('₹4,321 · 15 Mar 2026 – 16 Mar'), [])
})

test('the bare-rupee matcher catches ₹37417-style output and passes formatted amounts', () => {
  assert.ok(BARE_RUPEE.test('· ₹{b.amount}</p>'))
  assert.ok(BARE_RUPEE.test('`₹${min}–₹${max}`'))
  assert.ok(!BARE_RUPEE.test('{formatINR(b.amount)}'))
  assert.ok(!BARE_RUPEE.test('`₹${(n / 1e5).toFixed(1)}L`'))
  assert.ok(!BARE_RUPEE.test("₹{(maxPaise / 100).toLocaleString('en-IN')}"))
})

const files = SCANNED.flatMap((d) => walk(path.join(ROOT, d)))

test(`no emoji used as an icon in ${SCANNED.join(' or ')} (${files.length} files)`, () => {
  const found: string[] = []
  for (const file of files) {
    for (const { n, text } of codeLines(file)) {
      const hits = emojiIn(text)
      if (hits.length) found.push(`${path.relative(ROOT, file)}:${n} ${hits.join(' ')}`)
    }
  }
  assert.deepEqual(found, [], `emoji found; use <Icon name=...> from src/components/Icon.tsx:\n${found.join('\n')}`)
})

test('no bare ₹ amount: every rupee value goes through formatINR', () => {
  const found: string[] = []
  for (const file of files) {
    const rel = path.relative(ROOT, file)
    for (const { n, text } of codeLines(file)) {
      if (!BARE_RUPEE.test(text)) continue
      if (MONEY_ALLOWED.some((a) => a.file === rel && text.includes(a.contains))) continue
      found.push(`${rel}:${n} ${text.trim().slice(0, 120)}`)
    }
  }
  assert.deepEqual(found, [], `bare ₹ amount; use formatINR from src/lib/money-display.ts:\n${found.join('\n')}`)
})

console.log(`\n${passed} passed`)
