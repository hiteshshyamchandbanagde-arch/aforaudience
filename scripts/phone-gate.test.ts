// SMS OTP toggle (Hitesh, 17 Nov) - self-tests for src/lib/phone-gate.ts and
// a source guard that every server phone gate goes through it.
//   1. truth table: needsPhoneVerification = smsOtpEnabled && !isVerified;
//   2. no file under src/app/api reads `.isVerified` or calls the old
//      requireVerifiedPhone directly (object keys like `isVerified: true`
//      in a select/where/data are writes/filters, not gate reads);
//   3. each of the 10 known gate sites calls the helper.
// Regression shape: on origin/qa src/lib/phone-gate.ts doesn't exist and 10
// routes gate on user.isVerified directly, so this fails; passes on the
// branch.
//
//   npx tsx scripts/phone-gate.test.ts
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

let passed = 0
let failed = 0
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    passed++
    console.log(`ok - ${name}`)
  } catch (e) {
    failed++
    console.log(`not ok - ${name}\n${(e as Error).message}`)
  }
}

const ROOT = join(__dirname, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

const GATE_SITES = [
  'src/app/api/venue-booking-requests/[id]/route.ts',
  'src/app/api/events/route.ts',
  'src/app/api/events/[id]/route.ts',
  'src/app/api/performances/[id]/plus-ones/route.ts',
  'src/app/api/venues/route.ts',
  'src/app/api/venues/[id]/route.ts',
  'src/app/api/applications/route.ts',
  'src/app/api/organiser/payout-account/route.ts',
  'src/app/api/bookings/route.ts',
  'src/app/api/venue-bookings/route.ts',
]

async function main() {
  await test('phone-gate helper exists', () => {
    assert.ok(existsSync(join(ROOT, 'src/lib/phone-gate.ts')), 'src/lib/phone-gate.ts missing')
  })

  if (existsSync(join(ROOT, 'src/lib/phone-gate.ts'))) {
    const { needsPhoneVerification, phoneVerificationRequired } = await import('../src/lib/phone-gate')
    await test('truth table: OFF never gates, ON gates only unverified', () => {
      const cases: Array<[boolean, boolean, boolean]> = [
        // smsOtpEnabled, isVerified, expected needsPhoneVerification
        [true, false, true],
        [true, true, false],
        [false, false, false],
        [false, true, false],
      ]
      for (const [smsOtpEnabled, isVerified, want] of cases) {
        assert.equal(
          needsPhoneVerification({ isVerified }, { smsOtpEnabled }),
          want,
          `smsOtpEnabled=${smsOtpEnabled} isVerified=${isVerified}`
        )
      }
      assert.equal(phoneVerificationRequired({ smsOtpEnabled: true }), true)
      assert.equal(phoneVerificationRequired({ smsOtpEnabled: false }), false)
    })
  }

  if (existsSync(join(ROOT, 'src/lib/phone-gate.ts'))) {
    const { smsOtpBlock } = await import('../src/lib/phone-gate')
    await test('smsOtpBlock: 404 SMS_OTP_DISABLED when off, null when on', () => {
      assert.equal(smsOtpBlock({ smsOtpEnabled: true }), null)
      const off = smsOtpBlock({ smsOtpEnabled: false })
      assert.ok(off)
      assert.equal(off.status, 404)
      assert.equal(off.body.code, 'SMS_OTP_DISABLED')
    })
  }

  for (const f of ['src/app/api/auth/otp/request/route.ts', 'src/app/api/auth/otp/verify/route.ts']) {
    await test(`${f} refuses (smsOtpBlock) before any OTP send/verify`, () => {
      const src = read(f)
      const gate = src.search(/smsOtpBlock\(await getPlatformSettings\(\)\)/)
      assert.ok(gate >= 0, 'no smsOtpBlock gate')
      const work = src.search(/generateAndSendOtp\(|verifySignupOtp\(|resolveIdentifierToUser\(/)
      assert.ok(work > gate, 'gate must run before the OTP work')
      assert.match(src, /if \(smsOff\) return NextResponse\.json\(smsOff\.body, \{ status: smsOff\.status \}\)/)
    })
  }

  await test('otp-login and signup-otp sign-ins refuse while SMS OTP is off', () => {
    const src = read('src/lib/auth.ts')
    for (const id of ['otp-login', 'signup-otp']) {
      const start = src.indexOf(`id: "${id}"`)
      assert.ok(start >= 0, `${id} provider missing`)
      const body = src.slice(start, src.indexOf('CredentialsProvider(', start) > 0 ? src.indexOf('CredentialsProvider(', start) : start + 3000)
      const gate = body.search(/if \(smsOtpBlock\(await getPlatformSettings\(\)\)\) return null/)
      assert.ok(gate >= 0, `${id}: no smsOtpBlock gate`)
      assert.ok(body.indexOf('verifyOtp(') > gate, `${id}: gate must run before verifyOtp`)
    }
  })

  await test('session exposes needsPhoneVerification via the helper', () => {
    assert.match(read('src/lib/auth.ts'), /\.needsPhoneVerification = needsPhoneVerification\(\s*currentUser,\s*await getPlatformSettings\(\)\s*\)/)
  })

  await test('no route under src/app/api reads .isVerified or calls requireVerifiedPhone', () => {
    const offenders: string[] = []
    for (const f of walk(join(ROOT, 'src/app/api'))) {
      const src = readFileSync(f, 'utf8')
      src.split('\n').forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return // comments aren't reads
        if (/\.isVerified\b/.test(line) || /\brequireVerifiedPhone\b/.test(line)) {
          offenders.push(`${f.slice(ROOT.length + 1)}:${i + 1}: ${line.trim()}`)
        }
      })
    }
    assert.deepEqual(offenders, [], `direct phone-gate reads:\n${offenders.join('\n')}`)
  })

  for (const f of GATE_SITES) {
    await test(`${f} gates through the phone-gate helper`, () => {
      assert.match(read(f), /\b(requirePhoneVerification|needsPhoneVerification)\(/)
    })
  }

  await test('requirePhoneVerification is built on needsPhoneVerification', () => {
    const src = read('src/lib/verification.ts')
    assert.match(src, /needsPhoneVerification\(user, await getPlatformSettings\(\)\)/)
    assert.doesNotMatch(src, /!user\.isVerified/)
  })

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed) process.exit(1)
}
main()
