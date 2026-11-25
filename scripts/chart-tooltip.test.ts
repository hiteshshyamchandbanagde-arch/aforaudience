// BUG-2610-026 - every Recharts <Tooltip> takes its colours from the one
// shared style in src/lib/chart-tooltip.ts. Run with tsx:
//
//   npx tsx scripts/chart-tooltip.test.ts
//
// The bug: a tooltip with no itemStyle shows its value line in Recharts'
// fallback black, on our near-black tooltip box. This scans src/ for files
// that import recharts and checks each <Tooltip> spreads chartTooltipProps
// and sets no colour of its own.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import {
  chartTooltipContentStyle,
  chartTooltipItemStyle,
  chartTooltipLabelStyle,
} from '../src/lib/chart-tooltip'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

const SRC = path.join(__dirname, '..', 'src')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx|ts)$/.test(name)) out.push(p)
  }
  return out
}

/** The text of each `<Tooltip ... />` / `<Tooltip ...>` opening tag in a file. */
export function tooltipTags(source: string): string[] {
  const tags: string[] = []
  const re = /<Tooltip\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source))) {
    // Walk to the tag's closing '>' that is not inside {...}.
    let depth = 0
    let i = m.index + 1
    for (; i < source.length; i++) {
      const c = source[i]
      if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '>' && depth === 0) break
    }
    tags.push(source.slice(m.index, i + 1))
  }
  return tags
}

/** Why a tooltip tag breaks the rule, or null when it follows it. */
export function tooltipProblem(tag: string): string | null {
  if (!/\{\.\.\.chartTooltipProps\}/.test(tag)) return 'does not spread {...chartTooltipProps}'
  if (/\b(contentStyle|labelStyle|itemStyle|wrapperStyle)=/.test(tag)) return 'sets its own contentStyle/labelStyle/itemStyle'
  return null
}

const rechartsFiles = walk(SRC).filter((f) => /from ['"]recharts['"]/.test(readFileSync(f, 'utf8')))

test('the scan finds the Recharts charts (venue Sales)', () => {
  assert.ok(
    rechartsFiles.some((f) => f.endsWith(path.join('dashboard', 'venue', 'sales', 'page.tsx'))),
    'venue Sales imports recharts',
  )
})

test('[BUG-2610-026] every Recharts <Tooltip> spreads chartTooltipProps and sets no colour of its own', () => {
  let count = 0
  const problems: string[] = []
  for (const f of rechartsFiles) {
    for (const tag of tooltipTags(readFileSync(f, 'utf8'))) {
      count++
      const p = tooltipProblem(tag)
      if (p) problems.push(`${path.relative(SRC, f)}: ${p}`)
    }
  }
  assert.ok(count >= 2, `expected at least the 2 venue Sales tooltips, found ${count}`)
  assert.deepEqual(problems, [])
})

test('[BUG-2610-026] the shared style always sets the value line colour (no Recharts black fallback)', () => {
  assert.equal(chartTooltipItemStyle.color, 'var(--afa-text-primary)')
  assert.equal(chartTooltipLabelStyle.color, 'var(--afa-text-secondary)')
  assert.equal(chartTooltipContentStyle.background, 'var(--afa-surface-inverse)')
})

test('the rule catches a tooltip without the shared props (negative control)', () => {
  const bad = `<Tooltip\n  contentStyle={{ background: 'var(--afa-surface-inverse)' }}\n  formatter={(v: any) => [v, 'Revenue']}\n/>`
  assert.equal(tooltipProblem(tooltipTags(bad)[0]), 'does not spread {...chartTooltipProps}')
  const override = `<Tooltip {...chartTooltipProps} itemStyle={{ color: '#000' }} />`
  assert.equal(tooltipProblem(tooltipTags(override)[0]), 'sets its own contentStyle/labelStyle/itemStyle')
  const good = `<Tooltip {...chartTooltipProps} cursor={{ style: { fill: 'x' } }} formatter={(v) => [v, 'R']} />`
  assert.equal(tooltipProblem(tooltipTags(good)[0]), null)
})

console.log(`\n${passed} passed.`)
