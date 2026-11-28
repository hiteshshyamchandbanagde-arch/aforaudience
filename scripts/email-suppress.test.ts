// Load test step 1 (28 Nov 2026) - self-tests for the test-recipient
// suppression in src/lib/email.ts: mail to the fixed test domains must
// never reach Resend (QA shares prod's sending domain, so bounces from
// made-up load-test addresses would hurt prod's sender reputation).
// Run with tsx:
//
//   npx tsx scripts/email-suppress.test.ts
//
// email.ts imports the design-token resolver's server half, which builds a
// Prisma client at import time; it is never queried here.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

let passed = 0
async function test(name: string, fn: () => void | Promise<void>) {
  await fn()
  passed++
  console.log(`ok - ${name}`)
}

async function main() {
  const email = (await import('../src/lib/email')) as Record<string, unknown>
  const isSuppressed = email.isSuppressedTestRecipient as ((to: string) => boolean) | undefined
  const domains = email.SUPPRESSED_TEST_EMAIL_DOMAINS as readonly string[] | undefined

  await test('the helper and the domain list are exported', () => {
    assert.equal(typeof isSuppressed, 'function', 'isSuppressedTestRecipient is not exported from src/lib/email.ts')
    assert.deepEqual([...(domains ?? [])].sort(), ['aforaudience.qa', 'example.com', 'loadtest.aforaudience.qa'])
  })

  await test('every listed domain is suppressed, in any case', () => {
    for (const to of [
      'artist0001@loadtest.aforaudience.qa',
      'Audience42@LoadTest.AforAudience.QA',
      'admin@aforaudience.qa',
      'ARTIST@AFORAUDIENCE.QA',
      'fixture@example.com',
      'Fixture@Example.COM',
      '  padded@example.com  ',
    ]) {
      assert.equal(isSuppressed!(to), true, `${to} should be suppressed`)
    }
  })

  await test('real and look-alike domains are NOT suppressed', () => {
    for (const to of [
      'someone@gmail.com',
      'x@evilaforaudience.qa',
      'x@aforaudience.qa.evil.com',
      'x@sub.loadtest.aforaudience.qa',
      'x@sub.example.com',
      'x@example.com.evil.com',
      'x@aforaudience.com',
      'not-an-email',
      '',
    ]) {
      assert.equal(isSuppressed!(to), false, `${to} should NOT be suppressed`)
    }
  })

  // Source check: each exported send* function must check suppression
  // before anything else, and in particular before resend.emails.send.
  const src = readFileSync(join(__dirname, '..', 'src', 'lib', 'email.ts'), 'utf8')
  const starts = [...src.matchAll(/export async function (send\w+)\s*\(/g)]
  await test('the four known send functions exist', () => {
    const names = starts.map((m) => m[1]).sort()
    for (const n of ['sendCorporateInquiryEmail', 'sendEmailVerificationEmail', 'sendPasswordResetEmail', 'sendTicketEmail']) {
      assert.ok(names.includes(n), `${n} not found`)
    }
  })

  for (let i = 0; i < starts.length; i++) {
    const name = starts[i][1]
    const body = src.slice(starts[i].index!, i + 1 < starts.length ? starts[i + 1].index : src.length)
    await test(`${name} checks the suppression first, before resend.emails.send`, () => {
      const sendAt = body.indexOf('resend.emails.send')
      assert.ok(sendAt > 0, `${name} has no resend.emails.send`)
      const guard = body.match(/\{\s*\n\s*if \(suppressTestRecipient\("[\w-]+", [\w.]+\)\) return\n/)
      assert.ok(guard, `${name} does not start with the suppressTestRecipient guard`)
      assert.ok(guard.index! < sendAt, `${name} sends before checking suppression`)
      assert.ok(body.indexOf('if (!resend)') > guard.index!, `${name} checks resend before suppression`)
    })
  }

  await test('a suppressed send returns without error and logs the domain only', async () => {
    const logs: unknown[][] = []
    const orig = console.info
    console.info = (...a: unknown[]) => void logs.push(a)
    try {
      const reset = email.sendPasswordResetEmail as (to: string, url: string) => Promise<void>
      await reset('Persona@AforAudience.QA', 'https://qa.aforaudience.com/reset?token=SECRET123')
    } finally {
      console.info = orig
    }
    assert.equal(logs.length, 1)
    assert.equal(logs[0][0], '[email] suppressed test recipient')
    assert.deepEqual(logs[0][1], { kind: 'password-reset', domain: 'aforaudience.qa' })
    const text = JSON.stringify(logs)
    assert.ok(!text.includes('SECRET123') && !text.toLowerCase().includes('persona@'), 'log leaks the address or token')
  })

  console.log(`\n${passed} passed`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
