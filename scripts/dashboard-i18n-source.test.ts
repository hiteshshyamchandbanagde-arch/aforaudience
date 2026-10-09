// GEN-2610-007 - the role dashboards are translated (Admin stays English).
// Run with tsx (from the repo root):
//
//   npx tsx scripts/dashboard-i18n-source.test.ts
//
// i18n-untranslated.test.ts checks the dictionaries; this checks the pages
// actually read them. It fails on hard-coded English UI text in:
// - every page under src/app/dashboard/artist/ and PosterShareCard: JSX
//   text, string props users see (placeholder, title, alt, aria-label),
//   toasts, confirm dialogs and BrandLoader without a label;
// - DashboardShell's and MobileTabBar's role items: a `label: '...'`
//   literal outside the Admin section/bar.
// Proper nouns that read the same in every language are allowed.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

const ROOT = join(__dirname, '..')

/** Words that stay as they are in every language. */
const PROPER_NOUNS = new Set(['Instagram', 'YouTube', 'AforAudience', 'AFA'])

function filesUnder(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...filesUnder(path))
    else if (path.endsWith('.tsx')) out.push(path)
  }
  return out
}

function hasEnglish(text: string): boolean {
  const words = text.match(/[A-Za-z]{2,}/g) ?? []
  return words.some((w) => !PROPER_NOUNS.has(w))
}

/** Lines with English a user would see, as "line: text". */
export function englishUiText(source: string): string[] {
  const found: string[] = []
  const lines = source.split('\n')
  lines.forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '').replace(/\{\/\*.*?\*\/\}/g, '')
    if (/^\s*(\*|\/\*)/.test(line)) return
    // JSX text between tags on one line: <p ...>Text</p>
    for (const m of code.matchAll(/>([^<>{}]+)</g)) {
      if (/=>/.test(m[0]) || /^\s*$/.test(m[1])) continue
      if (hasEnglish(m[1])) found.push(`${i + 1}: ${m[1].trim()}`)
    }
    // JSX text alone on its line (a child between an opening and closing tag)
    const trimmed = code.trim()
    if (trimmed && /^[A-Za-z✓✕+][^<>{}=;()'"`]*$/.test(trimmed) && !/^(import|export|return|const|let|type|interface|if|else|case|default)\b/.test(trimmed) && hasEnglish(trimmed)) {
      const prev = lines[i - 1]?.trim() ?? ''
      if (prev.endsWith('>')) found.push(`${i + 1}: ${trimmed}`)
    }
    // String props a user sees
    for (const m of code.matchAll(/\b(placeholder|title|alt|aria-label|label)="([^"]*)"/g)) {
      if (hasEnglish(m[2]) && !/^https?:/.test(m[2])) found.push(`${i + 1}: ${m[1]}="${m[2]}"`)
    }
    // Toasts, confirm dialogs, setError with a literal
    for (const m of code.matchAll(/\b(showToast|setError)\(\s*(['"`])([^'"`]*)\2/g)) {
      if (hasEnglish(m[3])) found.push(`${i + 1}: ${m[1]}('${m[3]}')`)
    }
    for (const m of code.matchAll(/\b(title|body|confirmLabel|cancelLabel):\s*(['"])([^'"]*)\2/g)) {
      if (hasEnglish(m[3])) found.push(`${i + 1}: ${m[1]}: '${m[3]}'`)
    }
    if (/<BrandLoader\s*\/>/.test(code)) found.push(`${i + 1}: <BrandLoader /> (English "Loading..." default)`)
  })
  return found
}

/** `label: '...'` literals in the file, minus the ones inside the named Admin blocks. */
export function roleLabelLiterals(source: string, adminBlocks: string[]): string[] {
  let rest = source
  for (const start of adminBlocks) {
    const at = rest.indexOf(start)
    assert.ok(at !== -1, `${start} not found`)
    const end = rest.indexOf('\n  ]', at)
    rest = rest.slice(0, at) + rest.slice(end)
  }
  return [...rest.matchAll(/\blabel:\s*'([^']+)'/g)].map((m) => m[1])
}

const ARTIST_FILES = [
  ...filesUnder(join(ROOT, 'src/app/dashboard/artist')),
  join(ROOT, 'src/components/PosterShareCard.tsx'),
]

test('[GEN-2610-007] the check catches English UI text and lets translated text and proper nouns through (negative control)', () => {
  const bad = [
    '<h2 style={{ x: 1 }}>',
    '  Reviews',
    '</h2>',
    '<p style={{ opacity: 0.5 }}>No reviews yet.</p>',
    '<input placeholder="Write a reply..." />',
    "showToast('Profile saved.', 'success')",
    "confirm({ title: 'Cancel this performance?' })",
    '<BrandLoader />',
  ].join('\n')
  assert.equal(englishUiText(bad).length, 6)
  const good = [
    '<h2 style={{ x: 1 }}>',
    '  {a.reviewsTitle}',
    '</h2>',
    '<label style={labelStyle}>Instagram</label>',
    '<input placeholder={a.replyPlaceholder} />',
    "showToast(a.profileSaved, 'success')",
    '<BrandLoader label={chrome.loading} />',
  ].join('\n')
  assert.deepEqual(englishUiText(good), [])
})

test('[GEN-2610-007] no hard-coded English UI text on the Artist dashboard pages or PosterShareCard', () => {
  const found: string[] = []
  for (const file of ARTIST_FILES) {
    for (const hit of englishUiText(readFileSync(file, 'utf8'))) found.push(`${file.slice(ROOT.length + 1)}:${hit}`)
  }
  assert.deepEqual(found, [])
})

test('[GEN-2610-007] DashboardShell: only the Admin section keeps English item labels', () => {
  const src = readFileSync(join(ROOT, 'src/components/DashboardShell.tsx'), 'utf8')
  assert.deepEqual(roleLabelLiterals(src, ['const ADMIN_SECTION']), [])
  assert.ok(!/>\s*(More|My Roles)\s*</.test(src), 'the More drawer still has English text')
})

test('[GEN-2610-007] MobileTabBar: only the Admin bar keeps English item labels', () => {
  const src = readFileSync(join(ROOT, 'src/components/mobile/MobileTabBar.tsx'), 'utf8')
  assert.deepEqual(roleLabelLiterals(src, ['const adminItems', 'const adminMoreItems']), [])
  assert.ok(!/^\s*More\s*$/m.test(src) && !/>More</.test(src), 'the More slot or sheet still has English text')
})

console.log(`\n${passed} passed`)
