// BUG-2610-023 - <Button> spreads its caller's `style` after the variant's
// own style, so a key set to `undefined` (`background: full ? 'transparent'
// : undefined`) does not "leave the variant alone": it deletes the
// variant's value. That turned the artist "Apply to Perform" button into
// dark text with no fill. This scans src/ for any <Button>/<MessageButton>
// whose inline style sets background, border or color to undefined in a
// ternary. Set the key only when you need it: `...(full ? { background:
// 'transparent' } : {})`.
//
//   npx tsx scripts/button-style-override.test.ts
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.join(__dirname, '..', 'src')
const KEYS = /\b(background|backgroundColor|border|borderColor|color)\s*:[^,\n]*\?[^,\n]*:\s*undefined\b|\b(background|backgroundColor|border|borderColor|color)\s*:\s*undefined\b/

// Deliberate: the view-toggle buttons clear the `icon` variant's inline
// `color: inherit` so their CSS class (.afa-events-view-btn) sets it.
const ALLOWED = new Set(['app/(public)/events/page.tsx:color: undefined'])

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name)
    return d.isDirectory() ? files(p) : p.endsWith('.tsx') ? [p] : []
  })
}

/** The opening tag of every <Button>/<MessageButton> in `src`, with its line. */
export function buttonTags(src: string): { line: number; tag: string }[] {
  const out: { line: number; tag: string }[] = []
  for (const m of src.matchAll(/<(Button|MessageButton)\b/g)) {
    let i = m.index! + m[0].length
    let depth = 0
    for (; i < src.length; i++) {
      const c = src[i]
      if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '>' && depth === 0 && src[i - 1] !== '=') break
    }
    out.push({ line: src.slice(0, m.index).split('\n').length, tag: src.slice(m.index, i) })
  }
  return out
}

export function overrides(src: string): { line: number; text: string }[] {
  const found: { line: number; text: string }[] = []
  for (const { line, tag } of buttonTags(src)) {
    const style = tag.match(/style=\{\{([\s\S]*?)\}\}/)
    if (!style) continue
    for (const part of style[1].split('\n')) {
      const hit = part.match(KEYS)
      if (hit) found.push({ line, text: hit[0].trim() })
    }
  }
  return found
}

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

test('the scanner finds the BUG-2610-023 pattern and ignores the fixed form', () => {
  const bad = `<Button variant="primary" style={{\n  color: 'x',\n  background: full ? 'transparent' : undefined,\n}}>Apply</Button>`
  assert.deepEqual(overrides(bad).map((o) => o.text), ["background: full ? 'transparent' : undefined"])
  const good = `<Button variant="primary" style={{\n  ...(full ? { background: 'transparent' } : {}),\n  opacity: a ? 0.6 : 1,\n}}>Apply</Button>`
  assert.deepEqual(overrides(good), [])
  // Keys a variant does not set are not this bug.
  assert.deepEqual(overrides(`<Button style={{ flex: a ? 1 : undefined }} />`), [])
})

test('no <Button> in src/ clears its variant background, border or colour with undefined', () => {
  const hits: string[] = []
  for (const f of files(ROOT)) {
    const rel = path.relative(ROOT, f).split(path.sep).join('/')
    for (const o of overrides(fs.readFileSync(f, 'utf8'))) {
      if (!ALLOWED.has(`${rel}:${o.text}`)) hits.push(`src/${rel}:${o.line}  ${o.text}`)
    }
  }
  assert.deepEqual(hits, [], `set the key only when needed instead:\n${hits.join('\n')}`)
})

console.log(`\n${passed} passed`)
