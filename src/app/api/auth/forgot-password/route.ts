import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateResetToken } from "@/lib/tokens"
import { sendPasswordResetEmail } from "@/lib/email"

// Always the same response whether or not the email exists, so this
// endpoint can't be used to enumerate registered accounts.
const GENERIC_MESSAGE = "If an account exists for that email, we've sent a password reset link."

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : ""

    if (!normalizedEmail) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })

    if (user) {
      const { rawToken, tokenHash } = generateResetToken()

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      })

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      const resetUrl = `${appUrl}/reset-password?token=${rawToken}`
      await sendPasswordResetEmail(user.email, resetUrl)
    }

    return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 })
  } catch (error) {
    console.error("Forgot password error:", error instanceof Error ? error.message : error)
    // Still return the generic message - an internal error here shouldn't
    // leak anything either.
    return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 })
  }
}
