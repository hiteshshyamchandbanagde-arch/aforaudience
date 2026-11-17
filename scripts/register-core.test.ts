// SMS OTP toggle (Hitesh, 17 Nov) - self-tests for src/lib/register-core.ts
// (the /api/auth/register decision) in both modes, with fake deps (no DB,
// no QA PlatformSettings write).
//   ON:  unchanged - phone required, +91 only, unique, OTP sent, devOtp back.
//   OFF: no OTP call ever; phone optional (if given: same +91 + uniqueness
//        checks); user created; response says signInDirectly, no devOtp.
// Regression shape: src/lib/register-core.ts doesn't exist on origin/qa
// (the register route always sends an OTP and always requires a phone), so
// this fails there; passes on the branch.
//
//   npx tsx scripts/register-core.test.ts
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

let passed = 0
let failed = 0
async function test(name: string, fn: () => Promise<void> | void) {
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
const TAKEN_PHONE = '+919000000009'

function fakeDeps(smsOtpEnabled: boolean) {
  const calls = { otp: [] as string[], created: [] as Array<Record<string, unknown>> }
  const deps = {
    smsOtpEnabled,
    isUsernameAvailable: async () => true,
    emailTaken: async (e: string) => e === 'taken@example.com',
    phoneTaken: async (p: string) => p === TAKEN_PHONE,
    hashPassword: async (p: string) => `hashed:${p}`,
    createUser: async (data: Record<string, unknown>) => {
      calls.created.push(data)
      return { id: 'u1', email: data.email as string, phone: (data.phone as string | null) ?? null, code: 'AFA0000000001' }
    },
    sendSignupOtp: async (phone: string) => {
      calls.otp.push(phone)
      return { devCode: '123456' }
    },
  }
  return { deps, calls }
}

const base = { username: 'new_user', email: 'New@Example.com', password: 'longenough1', fullName: 'New User' }

async function main() {
  await test('register-core exists', () => {
    assert.ok(existsSync(join(ROOT, 'src/lib/register-core.ts')), 'src/lib/register-core.ts missing')
  })
  if (!existsSync(join(ROOT, 'src/lib/register-core.ts'))) return finish()
  const { registerUser } = await import('../src/lib/register-core')

  // --- ON: today's behaviour ---
  await test('ON: phone required', async () => {
    const { deps, calls } = fakeDeps(true)
    const r = await registerUser({ ...base }, deps)
    assert.equal(r.status, 400)
    assert.equal(r.body.code, 'ALL_FIELDS_REQUIRED')
    assert.equal(calls.created.length, 0)
    assert.equal(calls.otp.length, 0)
  })
  await test('ON: creates user, sends SIGNUP_VERIFY OTP, returns devOtp, no signInDirectly', async () => {
    const { deps, calls } = fakeDeps(true)
    const r = await registerUser({ ...base, phone: ' +919000000001 ' }, deps)
    assert.equal(r.status, 201)
    assert.deepEqual(calls.otp, ['+919000000001'])
    assert.equal(calls.created.length, 1)
    assert.equal(calls.created[0].email, 'new@example.com')
    assert.equal(calls.created[0].password, 'hashed:longenough1')
    assert.equal(r.body.devOtp, '123456')
    assert.equal(r.body.userId, 'u1')
    assert.equal(r.body.signInDirectly, undefined)
  })
  await test('ON: non-+91 and taken phone rejected', async () => {
    const { deps, calls } = fakeDeps(true)
    assert.equal((await registerUser({ ...base, phone: '+14155550100' }, deps)).body.code, 'PHONE_NOT_INDIA')
    assert.equal((await registerUser({ ...base, phone: TAKEN_PHONE }, deps)).body.code, 'PHONE_TAKEN')
    assert.equal(calls.created.length + calls.otp.length, 0)
  })

  // --- OFF ---
  await test('OFF: no phone -> user created with phone null, no OTP, signInDirectly', async () => {
    const { deps, calls } = fakeDeps(false)
    const r = await registerUser({ ...base }, deps)
    assert.equal(r.status, 201)
    assert.equal(calls.otp.length, 0)
    assert.equal(calls.created.length, 1)
    assert.equal(calls.created[0].phone, null)
    assert.equal(r.body.signInDirectly, true)
    assert.equal('devOtp' in r.body, false)
    assert.deepEqual(r.user, { id: 'u1', email: 'new@example.com', phone: null, code: 'AFA0000000001' })
  })
  await test('OFF: phone given -> stored, still no OTP', async () => {
    const { deps, calls } = fakeDeps(false)
    const r = await registerUser({ ...base, phone: '+919000000001' }, deps)
    assert.equal(r.status, 201)
    assert.equal(calls.created[0].phone, '+919000000001')
    assert.equal(calls.otp.length, 0)
    assert.equal(r.body.signInDirectly, true)
  })
  await test('OFF: given phone still gets the +91 + uniqueness checks', async () => {
    const { deps, calls } = fakeDeps(false)
    assert.equal((await registerUser({ ...base, phone: '+14155550100' }, deps)).body.code, 'PHONE_NOT_INDIA')
    assert.equal((await registerUser({ ...base, phone: TAKEN_PHONE }, deps)).body.code, 'PHONE_TAKEN')
    assert.equal(calls.created.length + calls.otp.length, 0)
  })
  await test('both modes: other validation unchanged', async () => {
    for (const on of [true, false]) {
      const { deps } = fakeDeps(on)
      const phone = '+919000000001'
      assert.equal((await registerUser({ ...base, phone, email: 'nope' }, deps)).body.code, 'INVALID_EMAIL_FORMAT')
      assert.equal((await registerUser({ ...base, phone, password: 'short' }, deps)).body.code, 'PASSWORD_TOO_SHORT')
      assert.equal((await registerUser({ ...base, phone, username: 'a' }, deps)).body.code, 'USERNAME_INVALID')
      assert.equal((await registerUser({ ...base, phone, email: 'taken@example.com' }, deps)).body.code, 'EMAIL_TAKEN')
      assert.equal((await registerUser({ ...base, phone, password: undefined }, deps)).body.code, 'ALL_FIELDS_REQUIRED')
    }
  })

  await test('register route uses register-core with the live smsOtpEnabled read', () => {
    const src = readFileSync(join(ROOT, 'src/app/api/auth/register/route.ts'), 'utf8')
    assert.match(src, /registerUser\(/)
    assert.match(src, /smsOtpEnabled: \(await getPlatformSettings\(\)\)\.smsOtpEnabled/)
    assert.doesNotMatch(src, /generateAndSendOtp\(normalizedPhone/, 'route must not send an OTP outside register-core')
  })
  finish()
}

function finish() {
  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed) process.exit(1)
}
main()
