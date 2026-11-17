// SMS OTP toggle (17 Nov) - the register route's whole decision, with the
// database / OTP calls passed in so scripts/register-core.test.ts can run
// it in both modes without a database (same pattern as otp-signup-verify).
//
// smsOtpEnabled ON  = unchanged: phone required (+91), OTP sent, client
//                     goes to the OTP stage.
// smsOtpEnabled OFF = no OTP is ever sent. Phone is optional; if given it
//                     gets the same +91 check and uniqueness check. The
//                     response says `signInDirectly: true` so the client
//                     signs in with the password straight away.
import { isValidEmailFormat, isValidUsernameFormat } from "@/lib/validation"

export interface RegisterDeps {
  smsOtpEnabled: boolean
  isUsernameAvailable(username: string): Promise<boolean>
  emailTaken(email: string): Promise<boolean>
  phoneTaken(phone: string): Promise<boolean>
  hashPassword(password: string): Promise<string>
  createUser(data: {
    name: string
    displayName: string | null
    email: string
    phone: string | null
    password: string
    intendedRole: string | null
  }): Promise<{ id: string; email: string; phone: string | null; code: string | null }>
  sendSignupOtp(phone: string): Promise<{ devCode?: string }>
}

export type RegisterResult = {
  status: number
  body: Record<string, unknown>
  user?: { id: string; email: string }
}

const err = (status: number, body: Record<string, unknown>): RegisterResult => ({ status, body })

export async function registerUser(input: Record<string, unknown>, deps: RegisterDeps): Promise<RegisterResult> {
  const { username, email, phone, password, fullName, intendedRole } = input
  // GEN-2609-042 - purely informational, never the account's real role.
  const normalizedIntendedRole =
    intendedRole === "artist" || intendedRole === "organiser" || intendedRole === "venue" ? intendedRole : null
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : ""
  const normalizedUsername = typeof username === "string" ? username.trim() : ""
  const normalizedPhone = typeof phone === "string" ? phone.trim() : ""
  // Human-readable display name, trimmed and capped at 120 chars.
  const rawFullName = typeof fullName === "string" ? fullName.trim() : ""
  const normalizedDisplayName = rawFullName.length > 0 ? rawFullName.slice(0, 120) : null
  const phoneRequired = deps.smsOtpEnabled

  // `code` is a stable, language-independent identifier the client uses to
  // look up a translated message (tr.authErrors). `field` names which form
  // field the error belongs to (BUG-2608-038).
  if (!normalizedUsername || !normalizedEmail || (phoneRequired && !normalizedPhone) || typeof password !== "string" || !password) {
    return err(400, { error: "All fields are required", code: "ALL_FIELDS_REQUIRED" })
  }

  if (!isValidEmailFormat(normalizedEmail)) {
    return err(400, { error: "Please enter a valid email address.", code: "INVALID_EMAIL_FORMAT", field: "email" })
  }

  if (password.length < 8) {
    return err(400, { error: "Password must be at least 8 characters", code: "PASSWORD_TOO_SHORT", field: "password" })
  }

  if (!isValidUsernameFormat(normalizedUsername)) {
    return err(400, {
      error: "Username must be 3-20 characters, letters/numbers/underscore only",
      code: "USERNAME_INVALID",
      field: "username",
    })
  }

  if (!(await deps.isUsernameAvailable(normalizedUsername))) {
    return err(400, { error: "That username is already taken.", code: "USERNAME_TAKEN", field: "username" })
  }

  if (await deps.emailTaken(normalizedEmail)) {
    return err(400, { error: "That email address is already registered.", code: "EMAIL_TAKEN", field: "email" })
  }

  if (normalizedPhone) {
    if (!normalizedPhone.startsWith("+91")) {
      return err(400, {
        error: "Only Indian (+91) phone numbers are supported for OTP verification right now.",
        code: "PHONE_NOT_INDIA",
        field: "phone",
      })
    }
    if (await deps.phoneTaken(normalizedPhone)) {
      return err(400, { error: "That phone number is already registered.", code: "PHONE_TAKEN", field: "phone" })
    }
  }

  const user = await deps.createUser({
    name: normalizedUsername,
    displayName: normalizedDisplayName,
    email: normalizedEmail,
    phone: normalizedPhone || null,
    password: await deps.hashPassword(password),
    intendedRole: normalizedIntendedRole,
  })

  if (!deps.smsOtpEnabled) {
    return {
      status: 201,
      user,
      body: {
        message: "Account created!",
        userId: user.id,
        phone: user.phone,
        code: user.code,
        signInDirectly: true,
      },
    }
  }

  const otpResult = await deps.sendSignupOtp(user.phone as string)
  return {
    status: 201,
    user,
    body: {
      message: "Account created! Verify your phone to continue.",
      userId: user.id,
      phone: user.phone,
      code: user.code,
      devOtp: otpResult.devCode, // only present in QA (mock provider), undefined in prod
    },
  }
}
