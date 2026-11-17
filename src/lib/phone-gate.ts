// SMS OTP toggle (Hitesh, 17 Nov) - the one place that decides whether a
// user's unverified phone blocks an action. Pure (no Prisma) so the
// self-test can run it without a database; callers pass in the settings
// read (getPlatformSettings()).
//
// smsOtpEnabled ON  = today's behaviour: an unverified phone is gated.
// smsOtpEnabled OFF = no SMS can be sent, so the phone gate is waived for
//                     everyone. `isVerified` keeps meaning "phone verified"
//                     and is never set true without an OTP.
//
// Every server gate (src/app/api/**) goes through needsPhoneVerification -
// scripts/phone-gate.test.ts guards that no route reads user.isVerified or
// the old requireVerifiedPhone directly.

export type PhoneGateSettings = { smsOtpEnabled: boolean }

/** Is phone verification a thing at all right now? */
export function phoneVerificationRequired(settings: PhoneGateSettings): boolean {
  return settings.smsOtpEnabled === true
}

/** Must this user verify their phone before a gated action? */
export function needsPhoneVerification(
  user: { isVerified: boolean },
  settings: PhoneGateSettings
): boolean {
  return phoneVerificationRequired(settings) && !user.isVerified
}

/**
 * The refusal every SMS OTP endpoint returns while smsOtpEnabled is off
 * (404: the feature isn't there). null = go ahead.
 */
export function smsOtpBlock(settings: PhoneGateSettings) {
  if (phoneVerificationRequired(settings)) return null
  return {
    status: 404,
    body: { error: "SMS OTP is not available.", code: "SMS_OTP_DISABLED" },
  } as const
}
