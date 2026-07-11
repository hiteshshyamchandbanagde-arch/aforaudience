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

  if (purpose === "SIGNUP_VERIFY") {
    if (!phone) return NextResponse.json({ error: "Phone required." }, { status: 400 })
    targetPhone = phone
  } else if (purpose === "LOGIN") {
    if (!identifier) return NextResponse.json({ error: "Identifier required." }, { status: 400 })
    const user = await resolveIdentifierToUser(identifier)
    if (!user || !user.phone) {
      // Deliberately vague - don't reveal whether the identifier exists.
      return NextResponse.json(
        { ok: true, message: "If this account exists and has a phone on file, a code has been sent." },
        { status: 200 }
      )
    }
    targetPhone = user.phone
  } else {
    return NextResponse.json({ error: "Invalid purpose." }, { status: 400 })
  }

  try {
    const result = await generateAndSendOtp(targetPhone, purpose)
    return NextResponse.json({ ok: true, devOtp: result.devCode }) // devOtp only present in QA
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send OTP."
    return NextResponse.json({ error: message }, { status: 429 })
  }
}
