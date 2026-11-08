import { NextRequest, NextResponse } from "next/server"
import { verifyOtp } from "@/lib/otp"
import { verifySignupOtp } from "@/lib/otp-signup-verify"
import { prisma } from "@/lib/prisma"

// SIGNUP_VERIFY only. LOGIN-purpose OTP verification happens inside
// NextAuth's "otp-login" CredentialsProvider (see lib/auth.ts) via
// signIn("otp-login", {identifier, code}) on the client, so it can issue a
// session in the same step - no separate verify call needed for login.
//
// Run S2 (8 Nov): the code only verifies the account whose stored phone is
// `phone` - see lib/otp-signup-verify.ts for the order of checks.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    phone?: unknown
    userId?: unknown
    code?: unknown
  }

  const result = await verifySignupOtp(body ?? {}, {
    findUserPhone: (userId) => prisma.user.findUnique({ where: { id: userId }, select: { phone: true } }),
    verifyOtp: (phone, code) => verifyOtp(phone, code, "SIGNUP_VERIFY"),
    markVerified: async (userId, phone) =>
      (await prisma.user.updateMany({ where: { id: userId, phone }, data: { isVerified: true } })).count,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
