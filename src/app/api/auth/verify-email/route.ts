import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashResetToken } from "@/lib/tokens" // generic sha256 hash - reused as-is, not reset-specific despite the name

const INVALID_MESSAGE = "This verification link is invalid or has expired."

// Deliberately does NOT touch User.isVerified - that flag is owned by the
// mandatory phone-OTP step at signup (see otp/verify/route.ts). Email
// verification is a separate, non-blocking confirmation; the consumed
// token record (usedAt below) is its own audit trail. If you later want a
// UI indicator for "email confirmed," add a dedicated boolean rather than
// overloading isVerified with two different meanings.

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: INVALID_MESSAGE }, { status: 400 })
    }

    const tokenHash = hashResetToken(token)
    const verifyToken = await prisma.emailVerificationToken.findUnique({ where: { tokenHash } })

    if (!verifyToken || verifyToken.usedAt || verifyToken.expiresAt < new Date()) {
      return NextResponse.json({ error: INVALID_MESSAGE }, { status: 400 })
    }

    await prisma.emailVerificationToken.update({
      where: { id: verifyToken.id },
      data: { usedAt: new Date() },
    })

    return NextResponse.json({ message: "Email verified." }, { status: 200 })
  } catch (error) {
    console.error("Verify email error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}
