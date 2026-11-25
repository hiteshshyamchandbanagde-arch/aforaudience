// BUG-2610-024 - builds public/offline.html, the page the service worker
// shows when a navigation fails with no signal. Runs in the "prebuild" npm
// hook (after stamp-sw-version.js); run it by hand after editing the
// template or the tokens it uses:
//
//   node scripts/build-offline-page.js          write public/offline.html
//   node scripts/build-offline-page.js --check  exit 1 if it is out of date
//
// The page is served from the SW cache, never rendered by Next, so it
// can't read the runtime design tokens or fetch the app's fonts. Instead:
//   - every var(--afa-*) the template uses is defined in an inline :root
//     block, with the value from src/app/globals.css (var() chains
//     resolved), so the page has the app's dark surface and colours;
//   - the display and body fonts (Young Serif, Instrument Sans) are
//     embedded as data: URIs, so they render with no network at all.
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const TEMPLATE = path.join(__dirname, 'offline-page', 'offline.template.html')
const GLOBALS = path.join(ROOT, 'src', 'app', 'globals.css')
const OUT = path.join(ROOT, 'public', 'offline.html')

const FONTS = [
  { family: 'AFA Display', file: 'src/fonts/young-serif/YoungSerif-Regular.woff2', weight: '400' },
  { family: 'AFA Sans', file: 'src/fonts/instrument-sans/InstrumentSans-VF.woff2', weight: '400 700' },
]

/** name -> raw value, from the first `:root { ... }` block of globals.css. */
function rootTokens(css) {
  const start = css.search(/(^|\n):root\s*\{/)
  if (start < 0) throw new Error('[build-offline-page] no :root block in globals.css')
  const open = css.indexOf('{', start)
  const close = css.indexOf('\n}', open)
  const body = css.slice(open + 1, close)
  const tokens = new Map()
  for (const m of body.matchAll(/(--afa-[\w-]+)\s*:\s*([^;]+);/g)) {
    if (!tokens.has(m[1])) tokens.set(m[1], m[2].trim())
  }
  return tokens
}

/** A token's value with every var(--afa-*) inside it replaced, recursively. */
function resolve(name, tokens, seen = new Set()) {
  if (seen.has(name)) throw new Error(`[build-offline-page] var() cycle at ${name}`)
  const raw = tokens.get(name)
  if (raw === undefined) throw new Error(`[build-offline-page] ${name} is used by the offline template but not defined in globals.css :root`)
  seen.add(name)
  return raw.replace(/var\((--afa-[\w-]+)\)/g, (_, inner) => resolve(inner, tokens, new Set(seen)))
}

function build() {
  const template = fs.readFileSync(TEMPLATE, 'utf8')
  const tokens = rootTokens(fs.readFileSync(GLOBALS, 'utf8'))
  const used = [...new Set([...template.matchAll(/var\((--afa-[\w-]+)\)/g)].map((m) => m[1]))].sort()
  const tokenCss = used.map((name) => `      ${name}: ${resolve(name, tokens)};`).join('\n')
  const fontCss = FONTS.map(({ family, file, weight }) => {
    const data = fs.readFileSync(path.join(ROOT, file)).toString('base64')
    return `    @font-face { font-family: "${family}"; src: url(data:font/woff2;base64,${data}) format("woff2"); font-weight: ${weight}; font-style: normal; font-display: block; }`
  }).join('\n')
  return template
    .replace('{{THEME_COLOR}}', resolve('--afa-surface-page', tokens))
    .replace('{{FONT_FACES}}', fontCss)
    .replace('{{TOKENS}}', tokenCss)
}

module.exports = { build, rootTokens, resolve, OUT }

if (require.main === module) {
  const html = build()
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : ''
    if (current !== html) {
      console.error('[build-offline-page] public/offline.html is out of date: run node scripts/build-offline-page.js')
      process.exit(1)
    }
    console.log('[build-offline-page] public/offline.html is up to date')
  } else {
    fs.writeFileSync(OUT, html)
    console.log(`[build-offline-page] wrote public/offline.html (${Math.round(html.length / 1024)} KB)`)
  }
}
