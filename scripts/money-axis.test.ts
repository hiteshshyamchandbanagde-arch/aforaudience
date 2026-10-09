// BUG-2610-027 - round ticks on every money axis, from one helper
// (src/lib/money-axis.ts). Run with tsx:
//
//   npx tsx scripts/money-axis.test.ts
//
// The bug: venue Sales "By venue" read ₹0 ₹10K ₹19K ₹29K ₹38K (the data
// max split into four). It must read ₹0 ₹10K ₹20K ₹30K ₹40K. The last test
// scans src/ so a new Recharts axis can't format money its own way.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { compactINR, moneyAxis, niceMoneyTicks, niceStep } from '../src/lib/money-axis'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

const labels = (max: number, count?: number) => niceMoneyTicks(max, count).map(compactINR)

test("the reported case: a ₹38,000 max reads ₹0 ₹10K ₹20K ₹30K ₹40K", () => {
  assert.deepEqual(labels(38000), ['₹0', '₹10K', '₹20K', '₹30K', '₹40K'])
})

test('a max that is already round ends on itself', () => {
  assert.deepEqual(labels(40000), ['₹0', '₹10K', '₹20K', '₹30K', '₹40K'])
  assert.deepEqual(labels(10000), ['₹0', '₹2.5K', '₹5K', '₹7.5K', '₹10K'])
  assert.deepEqual(labels(100), ['₹0', '₹25', '₹50', '₹75', '₹100'])
})

test('just over a round value moves to the next round top', () => {
  assert.deepEqual(niceMoneyTicks(40001), [0, 20000, 40000, 60000])
  assert.deepEqual(niceMoneyTicks(37417), [0, 10000, 20000, 30000, 40000])
})

test('every step is 1, 2, 2.5 or 5 times a power of ten', () => {
  for (const max of [7, 99, 512, 1234, 9999, 37417, 125000, 999999, 7340000, 25000000]) {
    const t = niceMoneyTicks(max)
    const step = t[1] - t[0]
    const power = Math.pow(10, Math.floor(Math.log10(step)))
    assert.ok([1, 2, 2.5, 5].includes(step / power), `max ${max}: step ${step}`)
    assert.equal(t[0], 0, `max ${max} starts at 0`)
    assert.ok(t[t.length - 1] >= max, `max ${max}: top ${t[t.length - 1]} covers it`)
    assert.ok(t.length >= 3 && t.length <= 6, `max ${max}: ${t.length} ticks`)
    t.forEach((v, i) => assert.equal(v, i * step, `max ${max}: evenly spaced`))
  }
})

test('lakh and crore ranges read as ₹L / ₹Cr', () => {
  assert.deepEqual(labels(380000), ['₹0', '₹1L', '₹2L', '₹3L', '₹4L'])
  assert.deepEqual(labels(150000), ['₹0', '₹50K', '₹1L', '₹1.5L'])
  assert.deepEqual(labels(160000), ['₹0', '₹50K', '₹1L', '₹1.5L', '₹2L'])
  assert.deepEqual(labels(73400000), ['₹0', '₹2Cr', '₹4Cr', '₹6Cr', '₹8Cr'])
})

test('edge cases: zero, negative, NaN, tiny, and whole-rupee steps', () => {
  assert.deepEqual(niceMoneyTicks(0), [0])
  assert.deepEqual(niceMoneyTicks(-500), [0])
  assert.deepEqual(niceMoneyTicks(Number.NaN), [0])
  assert.deepEqual(niceMoneyTicks(1), [0, 1])
  assert.deepEqual(niceMoneyTicks(3), [0, 1, 2, 3])
  assert.equal(niceStep(0.2), 1, 'never a fractional-rupee step')
  assert.deepEqual(moneyAxis(0).domain, [0, 1])
})

test('compactINR: one decimal at most, no trailing .0', () => {
  assert.equal(compactINR(0), '₹0')
  assert.equal(compactINR(950), '₹950')
  assert.equal(compactINR(2500), '₹2.5K')
  assert.equal(compactINR(20000), '₹20K')
  assert.equal(compactINR(37417), '₹37.4K')
  assert.equal(compactINR(100000), '₹1L')
  assert.equal(compactINR(7340000), '₹73.4L')
  assert.equal(compactINR(20000000), '₹2Cr')
})

test('moneyAxis gives Recharts the ticks, a domain ending on the top tick, and the formatter', () => {
  const axis = moneyAxis(38000)
  assert.deepEqual(axis.ticks, [0, 10000, 20000, 30000, 40000])
  assert.deepEqual(axis.domain, [0, 40000])
  assert.equal(axis.interval, 0, 'every tick drawn, none skipped')
  assert.equal(axis.tickFormatter(30000), '₹30K')
})

// Static: a Recharts axis that formats money must spread moneyAxis(...).
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx$/.test(name)) out.push(p)
  }
  return out
}

test('every Recharts numeric axis in src/ takes its ticks from moneyAxis', () => {
  const offenders: string[] = []
  let axes = 0
  for (const file of walk(path.join(__dirname, '..', 'src'))) {
    const src = readFileSync(file, 'utf8')
    if (!/from ['"]recharts['"]/.test(src)) continue
    const re = /<(XAxis|YAxis)\b[\s\S]*?\/>/g
    let m: RegExpExecArray | null
    while ((m = re.exec(src))) {
      const tag = m[0]
      if (/type="category"/.test(tag) || /dataKey=/.test(tag)) continue // a label axis, not a value axis
      axes++
      if (!/\{\.\.\.moneyAxis\(/.test(tag) || /tickFormatter=/.test(tag)) {
        offenders.push(`${path.relative(process.cwd(), file)}: ${tag.replace(/\s+/g, ' ').slice(0, 100)}`)
      }
    }
  }
  assert.ok(axes >= 2, `found the venue Sales value axes (${axes})`)
  assert.deepEqual(offenders, [], `value axes not using moneyAxis():\n${offenders.join('\n')}`)
})

console.log(`\n${passed} passed`)
