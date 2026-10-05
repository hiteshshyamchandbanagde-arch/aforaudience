// GEN-2609-120 / BUG-2609-029 - self-tests for the UI dictionaries in
// src/lib/i18n/dictionaries. Run with tsx:
//
//   npx tsx scripts/i18n-dictionaries.test.ts
//
// Parity: every locale has exactly the keys of en.ts, no empty values and
// the same {placeholders} as English. tsc already catches a missing key
// (Dictionary = typeof en), but not an empty string, a dropped or renamed
// placeholder, or a locale that is in LOCALES with no dictionary at all.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DEFAULT_LOCALE, LOCALES, VALID_LOCALE_IDS } from '../src/lib/i18n/locales'
import { dateLocale } from '../src/lib/format-date'
import en from '../src/lib/i18n/dictionaries/en'

let passed = 0
async function test(name: string, fn: () => void | Promise<void>) {
  await fn()
  passed++
  console.log(`ok - ${name}`)
}

// Duplicated on purpose (like e2e/language-rollout.spec.ts): adding a
// language means updating this list too, not inheriting it silently.
const EXPECTED_LOCALES = ['en', 'hi', 'mr', 'te', 'ta', 'kn', 'ml', 'gu', 'bn', 'de', 'fr', 'es']

type Flat = Record<string, unknown>
function flatten(obj: Record<string, unknown>, prefix = '', out: Flat = {}): Flat {
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object') flatten(v as Record<string, unknown>, `${prefix}${k}.`, out)
    else out[`${prefix}${k}`] = v
  }
  return out
}

function placeholders(s: string): string[] {
  return [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
}

// A sentence split around a highlighted word ("Discover " + "Artists" + "")
// can legitimately leave the prefix or suffix empty when the word order
// moves (Hindi: "" + "कलाकारों" + " को खोजें"). Only those fragments - a
// key with "Prefix"/"Suffix" in it whose group also has an "Emphasis" key -
// may be empty.
function isSplitFragment(key: string, flatEn: Flat): boolean {
  const dot = key.lastIndexOf('.')
  const group = key.slice(0, dot + 1)
  const leaf = key.slice(dot + 1)
  if (!/Prefix|Suffix/.test(leaf)) return false
  return Object.keys(flatEn).some((k) => k.startsWith(group) && /Emphasis/.test(k.slice(group.length)))
}

async function loadDictionary(id: string): Promise<Record<string, unknown>> {
  const mod = await import(`../src/lib/i18n/dictionaries/${id}`)
  return mod.default
}

const flatEn = flatten(en)

async function main() {
  await test('LOCALES lists exactly the expected locales, Marathi right after Hindi', () => {
    assert.deepEqual(LOCALES.map((l) => l.id), EXPECTED_LOCALES)
    assert.deepEqual(VALID_LOCALE_IDS, EXPECTED_LOCALES)
  })

  await test('Marathi entry is labelled for the picker', () => {
    const mr = LOCALES.find((l) => l.id === 'mr')
    assert.deepEqual(mr && { ...mr }, { id: 'mr', label: 'Marathi', nativeLabel: 'मराठी' })
  })

  await test('DEFAULT_LOCALE stays English (Marathi is never auto-selected)', () => {
    assert.equal(DEFAULT_LOCALE, 'en')
  })

  await test('dates in Marathi use the Indian region, Latin digits', () => {
    assert.equal(dateLocale('mr'), 'mr-IN-u-nu-latn')
  })

  for (const id of EXPECTED_LOCALES) {
    const dict = flatten(await loadDictionary(id))

    await test(`${id}: same keys as en`, () => {
      const missing = Object.keys(flatEn).filter((k) => !(k in dict))
      const extra = Object.keys(dict).filter((k) => !(k in flatEn))
      assert.deepEqual({ missing, extra }, { missing: [], extra: [] })
    })

    await test(`${id}: every value is a non-empty string`, () => {
      const bad = Object.keys(flatEn).filter((k) => {
        const v = dict[k]
        if (typeof v !== 'string') return true
        if (v.trim() !== '') return false
        return (flatEn[k] as string).trim() !== '' && !isSplitFragment(k, flatEn)
      })
      assert.deepEqual(bad, [])
    })

    await test(`${id}: placeholders match en`, () => {
      const bad = Object.keys(flatEn)
        .filter((k) => typeof dict[k] === 'string')
        .filter((k) => placeholders(flatEn[k] as string).join() !== placeholders(dict[k] as string).join())
        .map((k) => `${k}: en "${flatEn[k]}" vs ${id} "${dict[k]}"`)
      assert.deepEqual(bad, [])
    })
  }

  // BUG-2609-029 - the phone-verify banner was hard-coded English.
  await test('phoneVerifyNudge strings exist and are translated in hi and mr', async () => {
    const nudge = (en as Record<string, unknown>).phoneVerifyNudge as Record<string, string> | undefined
    assert.ok(nudge, 'en.phoneVerifyNudge is missing')
    for (const key of ['ariaLabel', 'message', 'verifyNow']) assert.ok(nudge[key], `en.phoneVerifyNudge.${key}`)
    for (const id of ['hi', 'mr']) {
      const other = ((await loadDictionary(id)).phoneVerifyNudge ?? {}) as Record<string, string>
      for (const key of Object.keys(nudge)) {
        assert.ok(other[key] && other[key] !== nudge[key], `${id}.phoneVerifyNudge.${key} is not translated`)
        assert.match(other[key], /[ऀ-ॿ]/, `${id}.phoneVerifyNudge.${key} is not in Devanagari`)
      }
    }
  })

  await test('PhoneVerifyNudge.tsx renders dictionary strings, no English literals', () => {
    // Run from the repo root (as CI does).
    const src = readFileSync('src/components/PhoneVerifyNudge.tsx', 'utf8')
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    assert.match(code, /useLocale\(\)/)
    for (const literal of ['Verify your phone', 'to book tickets or venues', 'Verify now']) {
      assert.ok(!code.includes(literal), `hard-coded "${literal}" still in PhoneVerifyNudge.tsx`)
    }
  })

  console.log(`\n${passed} passed`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
