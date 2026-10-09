// BUG-2610-024 - the offline fallback page (public/offline.html) looks
// like the app: dark surface tokens and the AFA fonts, inlined so it works
// with no network. Run with tsx:
//
//   npx tsx scripts/offline-page.test.ts
//
// The bug: the page the service worker shows with no signal was light
// cream (#F7F3EE) with a system font, so it read like another product.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { build, rootTokens, resolve } = require('./build-offline-page.js') as {
  build: () => string
  rootTokens: (css: string) => Map<string, string>
  resolve: (name: string, tokens: Map<string, string>) => string
}

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

const ROOT = path.join(__dirname, '..')
const html = readFileSync(path.join(ROOT, 'public', 'offline.html'), 'utf8')
const tokens = rootTokens(readFileSync(path.join(ROOT, 'src', 'app', 'globals.css'), 'utf8'))
const style = html.slice(html.indexOf('<style>'), html.indexOf('</style>'))
const body = html.slice(html.indexOf('<body>'))

/** The inline :root block's own definitions. */
function inlineTokens(): Map<string, string> {
  const block = style.slice(style.indexOf(':root {'), style.indexOf('}', style.indexOf(':root {')))
  return new Map([...block.matchAll(/(--afa-[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
}

function luminance(hex: string): number {
  const n = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

test('public/offline.html is what scripts/build-offline-page.js builds now (template and globals.css in sync)', () => {
  assert.ok(build() === html, 'out of date: run node scripts/build-offline-page.js')
})

test('the page background and text are the app tokens: dark surface, light text', () => {
  const inline = inlineTokens()
  assert.equal(inline.get('--afa-surface-page'), resolve('--afa-surface-page', tokens))
  assert.equal(inline.get('--afa-text-primary'), resolve('--afa-text-primary', tokens))
  assert.ok(luminance(inline.get('--afa-surface-page')!) < 0.05, 'surface is dark')
  assert.match(style, /html, body \{[^}]*background: var\(--afa-surface-page\)/)
  assert.match(style, /html, body \{[^}]*color: var\(--afa-text-primary\)/)
  // The old light page: cream background, ink text.
  assert.doesNotMatch(style, /#F7F3EE|--bg:|--ink:/i)
})

test('every token the page uses is defined inline, with no var() left to resolve', () => {
  const inline = inlineTokens()
  const used = new Set([...style.matchAll(/var\((--afa-[\w-]+)\)/g)].map((m) => m[1]))
  for (const name of used) assert.ok(inline.has(name), `${name} defined in the page`)
  for (const [name, value] of inline) assert.ok(!value.includes('var('), `${name} is a plain value`)
})

test('the AFA display and body fonts are embedded, and nothing loads from the network', () => {
  const faces = [...style.matchAll(/@font-face \{ font-family: "([^"]+)"; src: url\(data:font\/woff2;base64,/g)].map((m) => m[1])
  assert.deepEqual(faces, ['AFA Display', 'AFA Sans'])
  assert.match(style, /h1 \{[^}]*font-family: "AFA Display"/)
  assert.match(style, /html, body \{[^}]*font-family: "AFA Sans"/)
  // Only data: URLs in CSS; the favicon link is the one same-origin asset (precached by sw.js).
  const urls = [...style.matchAll(/url\(([^)]{0,30})/g)].map((m) => m[1])
  assert.ok(urls.every((u) => u.startsWith('data:')), `only data: URLs in CSS (${urls.join(', ')})`)
  assert.doesNotMatch(html, /https?:\/\/|\/_next\//)
})

test('the copy, Try again and the My Tickets tip are unchanged', () => {
  assert.match(body, /<h1>You're offline<\/h1>/)
  assert.match(body, /No signal right now — but any tickets you've already opened are still saved for the door\./)
  assert.match(body, /<button onclick="location\.reload\(\)">Try again<\/button>/)
  assert.match(body, /Tip: open your tickets from the "My Tickets" screen — they'll show even without a connection once you've viewed them once\./)
})

test('Try again is the solid action colour with its on-fill text (AA)', () => {
  const inline = inlineTokens()
  assert.match(style, /button \{[^}]*background: var\(--afa-fill-solid\);[^}]*color: var\(--afa-on-fill-solid\)/)
  const [a, b] = [luminance(inline.get('--afa-fill-solid')!), luminance(inline.get('--afa-on-fill-solid')!)]
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  assert.ok(ratio >= 4.5, `button text contrast ${ratio.toFixed(2)}:1`)
})

test('the build runs before every next build (prebuild)', () => {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
  assert.match(pkg.scripts.prebuild, /node scripts\/build-offline-page\.js/)
})

test('the service worker still precaches and falls back to /offline.html', () => {
  const sw = readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8')
  assert.match(sw, /PRECACHE_URLS = \[[^\]]*'\/offline\.html'/)
  assert.match(sw, /caches\.match\('\/offline\.html'\)/)
})

console.log(`\n${passed} passed`)
