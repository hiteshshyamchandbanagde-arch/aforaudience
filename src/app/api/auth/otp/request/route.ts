import { NextRequest, NextResponse } from "next/server"
import { generateAndSendOtp } from "@/lib/otp"
import { resolveIdentifierToUser } from "@/lib/auth-helpers"

// Sends an OTP for one of two purposes:
//   SIGNUP_VERIFY - phone is provided directly (user just registered).
//   LOGIN          - identifier (email/phone/username/code) is resolved to
//                     a user first, then the OTP goes to that user's phone
//                     on file. The actual verify-and-sign-in step happens
//                     via signIn("otp-login", {identifier, code}) on the
//                     client - see lib/auth.ts - not a route here.
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { purpose, phone, identifier } = body as {
    purpose: "LOGIN" | "SIGNUP_VERIFY"
    phone?: string
    identifier?: string
  }

  let targetPhone: string | null = null

  // `code` is a stable, language-independent identifier the client uses to
  // look up a translated message (tr.authErrors) instead of showing the raw
  // English `error` string (BUG-2608-038 - login used to display
  // "No account found for that identifier." verbatim even in Hindi mode).
  if (purpose === "SIGNUP_VERIFY") {
    if (!phone) return NextResponse.json({ error: "Phone required.", code: "PHONE_REQUIRED" }, { status: 400 })
    targetPhone = phone
  } else if (purpose === "LOGIN") {
    if (!identifier) return NextResponse.json({ error: "Identifier required.", code: "IDENTIFIER_REQUIRED" }, { status: 400 })
    const user = await resolveIdentifierToUser(identifier)
    const isMock = (process.env.OTP_PROVIDER ?? "msg91") === "mock"

    if (!user || !user.phone) {
      if (isMock) {
        // QA only - anti-enumeration protection isn't the concern here, and
        // silently returning ok:true left testers staring at a fake OTP
        // screen that never had a real code behind it. Give an honest error
        // instead so the client doesn't advance past this step.
        return NextResponse.json(
          user
            ? {
                error: "This account has no phone number on file, so OTP login isn't available for it.",
                code: "NO_PHONE_ON_FILE",
              }
            : { error: "No account found for that identifier.", code: "ACCOUNT_NOT_FOUND" },
          { status: 400 }
        )
      }
      // Deliberately vague in production - don't reveal whether the
      // identifier exists or whether it has a phone on file.
      return NextResponse.json(
        { ok: true, message: "If this account exists and has a phone on file, a code has been sent." },
        { status: 200 }
      )
    }
    targetPhone = user.phone
  } else {
    return NextResponse.json({ error: "Invalid purpose.", code: "INVALID_PURPOSE" }, { status: 400 })
  }

  // Every branch above either returns early or sets targetPhone to a
  // real string — this check is redundant today but narrows the type
  // for TS (the if/else reassignment chain above doesn't narrow on its
  // own) and is a safe guard against a future edit reintroducing a gap.
  if (!targetPhone) {
    return NextResponse.json({ error: "Phone required.", code: "PHONE_REQUIRED" }, { status: 400 })
  }

  try {
    const result = await generateAndSendOtp(targetPhone, purpose)
    return NextResponse.json({ ok: true, devOtp: result.devCode }) // devOtp only present in QA
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send OTP."
    return NextResponse.json({ error: message, code: "OTP_SEND_FAILED" }, { status: 429 })
  }
}
