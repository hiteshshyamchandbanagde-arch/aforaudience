import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { hashResetToken } from "@/lib/tokens"

const INVALID_MESSAGE = "This reset link is invalid or has expired."

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json()

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: INVALID_MESSAGE }, { status: 400 })
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    const tokenHash = hashResetToken(token)
    const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } })

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return NextResponse.json({ error: INVALID_MESSAGE }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: {
          password: hashedPassword,
          tokenVersion: { increment: 1 }, // invalidates existing sessions
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      // Any other outstanding reset requests for this user are now moot.
      prisma.passwordResetToken.updateMany({
        where: { userId: resetToken.userId, usedAt: null, id: { not: resetToken.id } },
        data: { usedAt: new Date() },
      }),
    ])

    return NextResponse.json({ message: "Password updated. You can now sign in." }, { status: 200 })
  } catch (error) {
    console.error("Reset password error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}
