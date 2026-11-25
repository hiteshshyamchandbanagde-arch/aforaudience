// Run S2 (8 Nov) - self-tests for src/lib/otp-signup-verify.ts and its use
// in /api/auth/otp/verify. A valid SIGNUP_VERIFY code for phone A must not
// verify another account B. Same plain Node + assert convention as the
// other scripts/*.test.ts (no test framework). Run with:
//
//   npx tsx scripts/otp-signup-verify.test.ts
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { verifySignupOtp, SIGNUP_VERIFY_GENERIC_ERROR, type SignupVerifyDeps } from '../src/lib/otp-signup-verify'

let passed = 0
async function test(name: string, fn: () => Promise<void> | void) {
  await fn()
  passed++
  console.log(`ok - ${name}`)
}

const PHONE_A = '+919000000001'
const PHONE_B = '+919000000002'

/** An in-memory stand-in for the User and Otp tables. */
function fakeDb() {
  const users: Record<string, { phone: string | null; isVerified: boolean }> = {
    userA: { phone: PHONE_A, isVerified: false },
    userB: { phone: PHONE_B, isVerified: false },
    noPhone: { phone: null, isVerified: false },
  }
  // One pending code per phone; consumed on a correct check.
  const otps: Record<string, { code: string; consumed: boolean; attempts: number }> = {
    [PHONE_A]: { code: '123456', consumed: false, attempts: 0 },
  }
  const deps: SignupVerifyDeps = {
    async findUserPhone(userId) {
      const u = users[userId]
      return u ? { phone: u.phone } : null
    },
    async verifyOtp(phone, code) {
      const otp = otps[phone]
      if (!otp || otp.consumed) return { ok: false, error: 'No pending code for this number. Request a new one.' }
      if (otp.code !== code) {
        otp.attempts++
        return { ok: false, error: 'Incorrect code.' }
      }
      otp.consumed = true
      return { ok: true }
    },
    async markVerified(userId, phone) {
      const u = users[userId]
      if (!u || u.phone !== phone) return 0
      u.isVerified = true
      return 1
    },
  }
  return { users, otps, deps }
}

async function main() {
  await test('regression: A\'s valid code + B\'s userId is rejected and B stays unverified', async () => {
    const db = fakeDb()
    const res = await verifySignupOtp({ phone: PHONE_A, userId: 'userB', code: '123456' }, db.deps)
    assert.deepEqual(res, { ok: false, error: SIGNUP_VERIFY_GENERIC_ERROR })
    assert.equal(db.users.userB.isVerified, false)
    assert.equal(db.users.userA.isVerified, false)
  })

  await test('a wrong pairing does not consume or burn an attempt on A\'s pending code', async () => {
    const db = fakeDb()
    await verifySignupOtp({ phone: PHONE_A, userId: 'userB', code: '123456' }, db.deps)
    await verifySignupOtp({ phone: PHONE_A, userId: 'userB', code: '999999' }, db.deps)
    assert.equal(db.otps[PHONE_A].consumed, false)
    assert.equal(db.otps[PHONE_A].attempts, 0)
    // A can still verify with the same code afterwards.
    const res = await verifySignupOtp({ phone: PHONE_A, userId: 'userA', code: '123456' }, db.deps)
    assert.deepEqual(res, { ok: true })
    assert.equal(db.users.userA.isVerified, true)
  })

  await test('happy path: A\'s code + A\'s userId verifies A only', async () => {
    const db = fakeDb()
    const res = await verifySignupOtp({ phone: PHONE_A, userId: 'userA', code: '123456' }, db.deps)
    assert.deepEqual(res, { ok: true })
    assert.equal(db.users.userA.isVerified, true)
    assert.equal(db.users.userB.isVerified, false)
    assert.equal(db.otps[PHONE_A].consumed, true)
  })

  await test('unknown user and user with no phone get the same generic error', async () => {
    const db = fakeDb()
    const unknown = await verifySignupOtp({ phone: PHONE_A, userId: 'nobody', code: '123456' }, db.deps)
    const noPhone = await verifySignupOtp({ phone: PHONE_A, userId: 'noPhone', code: '123456' }, db.deps)
    const mismatch = await verifySignupOtp({ phone: PHONE_A, userId: 'userB', code: '123456' }, db.deps)
    assert.deepEqual(unknown, mismatch)
    assert.deepEqual(noPhone, mismatch)
    assert.equal(db.otps[PHONE_A].consumed, false)
  })

  await test('phone is compared exactly as the OTP is keyed (no extra normaliser)', async () => {
    const db = fakeDb()
    const res = await verifySignupOtp({ phone: ` ${PHONE_A}`, userId: 'userA', code: '123456' }, db.deps)
    assert.equal(res.ok, false)
    assert.equal(db.users.userA.isVerified, false)
  })

  await test('wrong code for the right pairing is rejected and not verified', async () => {
    const db = fakeDb()
    const res = await verifySignupOtp({ phone: PHONE_A, userId: 'userA', code: '000000' }, db.deps)
    assert.equal(res.ok, false)
    assert.equal(db.users.userA.isVerified, false)
  })

  await test('phone changed between the check and the update (0 rows) is a reject', async () => {
    const db = fakeDb()
    const deps: SignupVerifyDeps = { ...db.deps, markVerified: async () => 0 }
    const res = await verifySignupOtp({ phone: PHONE_A, userId: 'userA', code: '123456' }, deps)
    assert.deepEqual(res, { ok: false, error: SIGNUP_VERIFY_GENERIC_ERROR })
  })

  await test('missing or non-string fields are rejected before any lookup', async () => {
    const db = fakeDb()
    let looked = false
    const deps: SignupVerifyDeps = { ...db.deps, findUserPhone: async (id) => { looked = true; return db.deps.findUserPhone(id) } }
    for (const input of [{}, { phone: PHONE_A, userId: 'userA' }, { phone: PHONE_A, userId: ['userA'], code: '123456' }]) {
      const res = await verifySignupOtp(input, deps)
      assert.equal(res.ok, false)
    }
    assert.equal(looked, false)
  })

  await test('route uses the helper and only marks verified where id AND phone match', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/app/api/auth/otp/verify/route.ts'), 'utf8')
    assert.match(src, /verifySignupOtp\(/)
    assert.doesNotMatch(src, /prisma\.user\.update\(/, 'no unconditional update by userId')
    assert.match(src, /updateMany\(\s*\{\s*where:\s*\{\s*id:\s*userId,\s*phone\s*\}/)
  })

  console.log(`\n${passed} passed`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
