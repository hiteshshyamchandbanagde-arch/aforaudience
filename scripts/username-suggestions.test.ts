// Run C item 1 (Hitesh phone pass, 13-14 Oct) - every username suggestion
// must pass the same rule the field is checked against on submit
// (isValidUsernameFormat). Phone showed "tq" (under 3) and "tq.matinee"
// (a dot). Plain Node + assert, run with:
//
//   npx tsx scripts/username-suggestions.test.ts
import assert from 'node:assert/strict'
import { isValidUsernameFormat } from '../src/lib/validation'
import { generateUsernameVariants, SUGGESTION_COUNT } from '../src/lib/username-suggestions'

let passed = 0
async function test(name: string, fn: () => Promise<void>) {
  await fn()
  passed++
  console.log(`ok - ${name}`)
}

const allFree = async () => true

// Deterministic sequence so a run is repeatable; varied per seed and call.
function seeded(n: number) {
  let x = n || 1
  return () => {
    x = (x * 16807) % 2147483647
    return (x - 1) / 2147483646
  }
}

function assertAllValid(seed: string, variants: string[]) {
  for (const v of variants) assert.ok(isValidUsernameFormat(v), `${seed} -> "${v}" is not a valid username`)
  const lower = variants.map((v) => v.toLowerCase())
  assert.equal(new Set(lower).size, lower.length, `${seed} -> duplicates in ${variants.join(', ')}`)
}

const SEEDS = [
  'tq', 'TQ', 'ab', 'xy', // two-letter initials (the "tq" case)
  'Ab', 'a.b', 'a.b.c', 'o\'b', 'j-p', 'mr. x', 'a_b', '@@', '..', // punctuation
  'नाम', 'अमित', 'தமிழ்', 'محمد', '李伟', 'Ꭰ', 'café', 'zoë', // non-Latin / accented
  'abcdefghijklmnopqrstuvwxyz', 'x'.repeat(40), // longer than 20
  'hsb', 'WS', 'r2d2', 'ab1',
]

;(async () => {
  await test('every suggestion is valid and unique, for short, punctuated and non-Latin seeds', async () => {
    for (const [i, seed] of SEEDS.entries()) {
      for (let call = 0; call < 25; call++) {
        const variants = await generateUsernameVariants(seed, allFree, seeded(i * 1000 + call + 1))
        assertAllValid(seed, variants)
      }
    }
  })

  await test('the usual count is filled even when the plain initials are too short', async () => {
    for (const [i, seed] of SEEDS.entries()) {
      const variants = await generateUsernameVariants(seed, allFree, seeded(i + 7))
      assert.equal(variants.length, SUGGESTION_COUNT, `${seed} -> only ${variants.join(', ')}`)
    }
  })

  await test('"tq" never suggests "tq" or a dotted name, and the theme word uses an underscore', async () => {
    for (let call = 0; call < 50; call++) {
      const variants = await generateUsernameVariants('tq', allFree, seeded(call + 1))
      assert.ok(!variants.includes('tq'), variants.join(', '))
      assert.ok(variants.every((v) => !v.includes('.')), variants.join(', '))
      assert.ok(variants.some((v) => /^tq_[a-z]+$/.test(v)), variants.join(', '))
    }
  })

  await test('taken names are skipped and replaced, still valid', async () => {
    const taken = new Set(['hsb'])
    const isAvailable = async (name: string) => !taken.has(name.toLowerCase()) && !/^hsb\d{2}$/.test(name)
    const variants = await generateUsernameVariants('hsb', isAvailable, seeded(3))
    assertAllValid('hsb', variants)
    assert.equal(variants.length, SUGGESTION_COUNT, variants.join(', '))
    for (const v of variants) assert.ok(await isAvailable(v), v)
  })

  await test('availability is only ever asked about valid names', async () => {
    const asked: string[] = []
    const record = async (name: string) => {
      asked.push(name)
      return true
    }
    for (const seed of ['tq', 'a.b', 'नाम', 'x'.repeat(40)]) await generateUsernameVariants(seed, record, seeded(9))
    for (const name of asked) assert.ok(isValidUsernameFormat(name), `availability asked about "${name}"`)
  })

  console.log(`\n${passed} passed`)
})().catch((err) => {
  console.error(err)
  process.exit(1)
})
