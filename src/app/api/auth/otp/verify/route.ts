import { NextRequest, NextResponse } from "next/server"
import { verifyOtp } from "@/lib/otp"
import { prisma } from "@/lib/prisma"

// SIGNUP_VERIFY only. LOGIN-purpose OTP verification happens inside
// NextAuth's "otp-login" CredentialsProvider (see lib/auth.ts) via
// signIn("otp-login", {identifier, code}) on the client, so it can issue a
// session in the same step - no separate verify call needed for login.
export async function POST(req: NextRequest) {
  const { phone, userId, code } = (await req.json()) as {
    phone?: string
    userId?: string
    code?: string
  }

  if (!phone || !userId || !code) {
    return NextResponse.json({ error: "phone, userId and code are required." }, { status: 400 })
  }

  const result = await verifyOtp(phone, code, "SIGNUP_VERIFY")
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  await prisma.user.update({ where: { id: userId }, data: { isVerified: true } })
  return NextResponse.json({ ok: true })
}
