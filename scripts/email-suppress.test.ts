// Load test step 1 (28 Nov 2026) - self-tests for the test-recipient
// suppression in src/lib/email.ts: mail to the fixed test domains must
// never reach Resend (QA shares prod's sending domain, so bounces from
// made-up load-test addresses would hurt prod's sender reputation).
// Run with tsx:
//
//   npx tsx scripts/email-suppress.test.ts
//
// The behaviour checks import the pure module src/lib/email-suppress.ts.
// email.ts itself is only read as text: importing it builds a Prisma client
// (design-tokens.server), which needs DATABASE_URL, and CI's self-tests
// must not need a DB (#792 red, Design Token Check run 46135074039).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SUPPRESSED_TEST_EMAIL_DOMAINS, isSuppressedTestRecipient, recipientDomain } from '../src/lib/email-suppress'

let passed = 0
async function test(name: string, fn: () => void | Promise<void>) {
  await fn()
  passed++
  console.log(`ok - ${name}`)
}

async function main() {
  const isSuppressed: ((to: string) => boolean) | undefined = isSuppressedTestRecipient
  const domains: readonly string[] | undefined = SUPPRESSED_TEST_EMAIL_DOMAINS

  await test('the helper and the domain list are exported', () => {
    assert.equal(typeof isSuppressed, 'function', 'isSuppressedTestRecipient is not exported from src/lib/email-suppress.ts')
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

  await test('email.ts uses the pure module for the check', () => {
    assert.match(src, /import \{[^}]*\bisSuppressedTestRecipient\b[^}]*\} from "@\/lib\/email-suppress"/)
    assert.ok(!/export const SUPPRESSED_TEST_EMAIL_DOMAINS/.test(src), 'email.ts keeps its own copy of the domain list')
  })

  // Was a runtime call of sendPasswordResetEmail; that needs importing
  // email.ts (and so DATABASE_URL), so it is now checked on the source.
  await test('a suppressed send logs the kind and domain only', () => {
    const m = src.match(/function suppressTestRecipient\(kind: string, to: string\): boolean \{([\s\S]*?)\n\}/)
    assert.ok(m, 'suppressTestRecipient not found in email.ts')
    const body = m[1]
    assert.match(body, /if \(!isSuppressedTestRecipient\(to\)\) return false/)
    const logs = [...body.matchAll(/console\.\w+\(([^\n]*)\)/g)].map((x) => x[1])
    assert.deepEqual(logs, ['"[email] suppressed test recipient", { kind, domain: recipientDomain(to) }'])
    assert.match(body, /return true\s*$/)
  })

  await test('recipientDomain gives the bare lower-case domain for the log', () => {
    assert.equal(recipientDomain('  Persona@AforAudience.QA '), 'aforaudience.qa')
    assert.equal(recipientDomain('no-at-sign'), null)
  })

  console.log(`\n${passed} passed`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
