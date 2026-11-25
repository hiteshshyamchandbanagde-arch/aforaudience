import { NextResponse } from 'next/server'
import { getPlatformSettings } from '@/lib/platform-settings'
import { needsPhoneVerification } from '@/lib/phone-gate'

// Gate for actions where an unverified identity becomes something someone
// else relies on or is bound by - a published venue listing an Organiser
// plans around, an accepted venue booking, a submitted spot application an
// Organiser builds a lineup on. NOT for browsing, profile edits, or role
// apply itself (see design.md §9.5 - verify at first external commitment,
// not at signup).
//
// `action` names what's actually being gated so the message can say why,
// not just assert a rule - e.g. "publishing this venue" instead of a
// generic "doing this" reused across four unrelated actions.
//
// SMS OTP toggle (17 Nov): waived entirely while PlatformSettings
// .smsOtpEnabled is off - see src/lib/phone-gate.ts.
export async function requirePhoneVerification(user: { isVerified: boolean }, action: string) {
  if (needsPhoneVerification(user, await getPlatformSettings())) {
    return NextResponse.json(
      { error: `Please verify your mobile number before ${action}.` },
      { status: 403 }
    )
  }
  return null
}
