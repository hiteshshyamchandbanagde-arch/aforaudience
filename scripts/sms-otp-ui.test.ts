// SMS OTP toggle (Hitesh, 17 Nov) - source self-tests for the client side
// of dispatch A (sign-up + login). The pages need a browser + a flipped
// global setting to run live, and flipping QA's PlatformSettings row in e2e
// would race the other shards, so OFF-mode UI is checked here from source
// plus a Human check. QA stays ON, so the existing OTP e2e specs cover ON.
// Regression shape: none of this exists on origin/qa, so it fails there.
//
//   npx tsx scripts/sms-otp-ui.test.ts
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log(`ok - ${name}`)
  } catch (e) {
    failed++
    console.log(`not ok - ${name}\n${(e as Error).message}`)
  }
}

const ROOT = join(__dirname, '..')
const read = (p: string) => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), 'utf8') : '')

test('GET /api/auth/sms-otp returns { enabled } from the settings read, no auth', () => {
  const src = read('src/app/api/auth/sms-otp/route.ts')
  assert.match(src, /export async function GET\(\)/)
  assert.match(src, /enabled: await getSmsOtpEnabled\(\)/)
  assert.doesNotMatch(src, /getServerSession/)
})

const reg = read('src/app/(auth)/register/RegisterForm.tsx')
test('RegisterForm reads the flag, starting unknown (null)', () => {
  assert.match(reg, /fetch\("\/api\/auth\/sms-otp"\)/)
  assert.match(reg, /useState<boolean \| null>\(null\)/)
})
test('RegisterForm: phone only required while ON; optional (but validated if given) while OFF', () => {
  assert.match(reg, /\(smsOtpEnabled !== false \|\| phoneGiven\) && !\/\^\\d\{10\}\$\/\.test\(live\.phoneNumber\)/)
  assert.match(reg, /const phone = phoneGiven \? `\+91\$\{live\.phoneNumber\}` : undefined/)
})
test('RegisterForm: signInDirectly -> password sign-in, skips the OTP stage', () => {
  const i = reg.indexOf('if (data.signInDirectly)')
  assert.ok(i >= 0, 'no signInDirectly branch')
  const j = reg.indexOf('setStage("otp")', i)
  const branch = reg.slice(i, j)
  assert.match(branch, /signIn\("credentials", \{ identifier: live\.email, password: live\.password, redirect: false \}\)/)
  assert.match(branch, /router\.push\("\/"\)\s*\n\s*return/)
})
test('RegisterForm: OTP hint only shown while ON', () => {
  assert.match(reg, /\{smsOtpEnabled === true && \(\s*<p[^>]*>\s*\{tr\.registerPage\.otpHint\}/)
})

const login = read('src/app/(auth)/login/page.tsx')
test('login: "Login with OTP" hidden while the flag is off', () => {
  assert.match(login, /fetch\("\/api\/auth\/sms-otp"\)/)
  assert.match(login, /const otpLoginHidden = smsOtpEnabled === false/)
  assert.match(login, /\{!otpLoginHidden && \(\s*<Button[\s\S]{0,200}setMode\("otp-request"\)[\s\S]{0,200}tr\.loginPage\.useOtpInstead/)
  assert.equal((login.match(/setMode\("otp-request"\)/g) ?? []).length, 1, 'only one entry into the OTP flow')
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
