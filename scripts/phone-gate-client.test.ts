// SMS OTP toggle, dispatch B (Hitesh, 17 Nov) - source self-tests for the
// client side of the phone gate. While PlatformSettings.smsOtpEnabled is
// off the gate is waived, so every client redirect/block/nudge must read
// session.user.needsPhoneVerification (false for everyone while off), never
// isVerified directly. isVerified keeps its own meaning ("phone verified")
// for the artist badge and homepage stats, which are not the phone gate.
//
// Regression shape: on origin/qa the create pages, PhoneVerifyNudge and
// WelcomeSequence read isVerified, /verify-phone never checks the flag and
// the admin page has no SMS OTP card, so this fails there.
//
//   npx tsx scripts/phone-gate-client.test.ts
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

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
// Drop // and /* */ comments so prose about isVerified doesn't count.
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(relative(ROOT, full).split('\\').join('/'))
  }
  return out
}

// Client-side code: everything under src except the API routes and the
// server libs (those are covered by scripts/phone-gate.test.ts).
const clientFiles = walk(join(ROOT, 'src')).filter(
  (f) => !f.startsWith('src/app/api/') && !f.startsWith('src/lib/')
)

// Files that may still mention isVerified, and why (none is the phone gate):
const ALLOWED_IS_VERIFIED = new Set([
  'src/app/(public)/artists/[id]/page.tsx', // verified badge (dispatch B item 4)
  'src/app/(public)/artists/[id]/ArtistProfileClientPage.tsx', // badge prop
  'src/app/verify-phone/page.tsx', // "already verified" message from /api/users/me
  'src/components/WelcomeSequence.tsx', // step 2 "already verified" message (display only)
])

test('no client file outside the allowlist reads isVerified', () => {
  const offenders = clientFiles.filter((f) => !ALLOWED_IS_VERIFIED.has(f) && /\bisVerified\b/.test(code(read(f))))
  assert.deepEqual(offenders, [], `use session.user.needsPhoneVerification for the phone gate:\n${offenders.join('\n')}`)
})

test('no client file reads isVerified off the session (the phone gate is needsPhoneVerification)', () => {
  const offenders = clientFiles.filter((f) => /session\??\.user[^\n;]*\.isVerified\b/.test(code(read(f))))
  assert.deepEqual(offenders, [], offenders.join('\n'))
})

for (const f of ['src/app/dashboard/venue/create/page.tsx', 'src/app/dashboard/organiser/events/create/page.tsx']) {
  test(`${f}: the draft "verify your phone" note follows needsPhoneVerification`, () => {
    const src = code(read(f))
    assert.match(src, /needsPhoneVerification === true/)
    assert.match(src, /if \(!publish && needsPhoneVerification\)/)
  })
}

test('edit page + seat selection redirect only on the server PHONE_NOT_VERIFIED reason (off: never sent)', () => {
  for (const f of ['src/app/dashboard/organiser/events/[id]/edit/page.tsx', 'src/app/(public)/events/[id]/seats/SeatSelectionClientPage.tsx']) {
    const src = code(read(f))
    assert.match(src, /reason === ['"]PHONE_NOT_VERIFIED['"]/, f)
    assert.doesNotMatch(src, /\bisVerified\b/, f)
  }
})

test('PhoneVerifyNudge shows only when needsPhoneVerification is true', () => {
  const src = code(read('src/components/PhoneVerifyNudge.tsx'))
  assert.match(src, /\.needsPhoneVerification/)
  assert.match(src, /if \(needsVerification !== true\) return null/)
})

test('WelcomeSequence goes to step 2 (verify phone) only when needsPhoneVerification', () => {
  const src = code(read('src/components/WelcomeSequence.tsx'))
  assert.match(src, /setStep\(user\.needsPhoneVerification === true \? 2 : 3\)/)
  assert.doesNotMatch(src, /setStep\(user\.isVerified/)
  // The step-2 code send also only happens while the gate applies.
  assert.match(src, /if \(user\.needsPhoneVerification === true && user\.phone\)/)
  assert.doesNotMatch(src, /!user\.isVerified && user\.phone/)
})

test('/verify-phone sends the user on to a same-site next (or /) when SMS OTP is off', () => {
  const src = code(read('src/app/verify-phone/page.tsx'))
  assert.match(src, /fetch\('\/api\/auth\/sms-otp'\)/)
  assert.match(src, /d\.enabled !== false\) return/)
  assert.match(src, /router\.replace\(dest\)/)
  // The same-site check as a regex literal in the page.
  const m = src.match(/const dest = raw && (\/.*\/)\.test\(raw\) \? raw : '\/'/)
  assert.ok(m, 'same-site check present')
  const re = new RegExp(m![1].slice(1, -1))
  assert.equal(re.test('/events/abc/seats'), true)
  assert.equal(re.test('//evil.example'), false)
  assert.equal(re.test('/\\evil.example'), false)
  assert.equal(re.test('https://evil.example'), false)
})

test('admin settings has the SMS OTP card wired to the platform-settings API', () => {
  const page = code(read('src/app/dashboard/admin/settings/page.tsx'))
  assert.match(page, /data-afa-sms-otp-card/)
  assert.match(page, /data-afa-sms-otp-toggle/)
  assert.match(page, /JSON\.stringify\(\{ smsOtpEnabled \}\)/)
  assert.match(page, /tr\.adminSettings\.smsOtpHeading/)
  assert.match(page, /tr\.adminSettings\.smsOtpWarning/)
  const api = code(read('src/app/api/admin/platform-settings/route.ts'))
  assert.match(api, /'smsOtpEnabled must be a boolean'/)
  assert.match(api, /setSmsOtpEnabled\(body\.smsOtpEnabled\)/)
})

test('SMS OTP card strings exist in every locale (en/hi/mr hand-written)', () => {
  const dir = join(ROOT, 'src/lib/i18n/dictionaries')
  const locales = readdirSync(dir).filter((n) => n.endsWith('.ts'))
  assert.ok(locales.length >= 3)
  for (const n of locales) {
    const src = readFileSync(join(dir, n), 'utf8')
    for (const k of ['smsOtpHeading', 'smsOtpHelp', 'smsOtpToggle', 'smsOtpWarning']) {
      assert.match(src, new RegExp(`\\b${k}: "`), `${n} ${k}`)
    }
  }
  const hi = read('src/lib/i18n/dictionaries/hi.ts')
  const mr = read('src/lib/i18n/dictionaries/mr.ts')
  assert.doesNotMatch(hi, /smsOtpToggle: "Enable SMS OTP"/)
  assert.doesNotMatch(mr, /smsOtpToggle: "Enable SMS OTP"/)
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
