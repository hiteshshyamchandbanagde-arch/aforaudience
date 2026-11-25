import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { isUsernameAvailable } from "@/lib/auth-helpers"
import { generateAndSendOtp } from "@/lib/otp"
import { generateResetToken } from "@/lib/tokens" // generic sha256 token - reused for email verification too
import { sendEmailVerificationEmail } from "@/lib/email"
import { registerUser } from "@/lib/register-core"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getPlatformSettings, launchWaveBlock } from "@/lib/platform-settings"

// Browse-first model: registration never accepts a role. Every account is
// created as AUDIENCE. Artist / Organiser / Venue Owner are opt-in upgrades
// applied for later from Profile, each going through their own approval flow.
//
// `username` (stored as User.name) is the login username - see
// lib/auth-helpers.ts suggestAvailableUsername/isUsernameAvailable, used by
// the register form for live-suggest + availability check before submit.
// Phone is required while SMS OTP is on (it's the OTP verification gate);
// optional while PlatformSettings.smsOtpEnabled is off (17 Nov) - see
// lib/register-core.ts for the whole decision in both modes.
// Only +91 numbers actually receive an OTP right now (MSG91 is India-only).
export async function POST(req: NextRequest) {
  try {
    // S1b-a - W1 (discovery + signup) gate: no new accounts while the wave
    // is closed. Runs before any validation or DB write. A signed-in ADMIN
    // bypasses (testing on prod with waves closed).
    const session = await getServerSession(authOptions)
    const w1 = await launchWaveBlock("W1", (session?.user as { role?: string } | undefined)?.role)
    if (w1) return NextResponse.json(w1.body, { status: w1.status })

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const result = await registerUser(body ?? {}, {
      smsOtpEnabled: (await getPlatformSettings()).smsOtpEnabled,
      isUsernameAvailable,
      emailTaken: async (email) => !!(await prisma.user.findUnique({ where: { email } })),
      phoneTaken: async (phone) => !!(await prisma.user.findFirst({ where: { phone } })),
      hashPassword: (password) => bcrypt.hash(password, 12),
      createUser: (data) =>
        prisma.user.create({
          data: { ...data, role: "AUDIENCE", isVerified: false, isApproved: true },
          select: { id: true, email: true, phone: true, code: true },
        }),
      sendSignupOtp: (phone) => generateAndSendOtp(phone, "SIGNUP_VERIFY"),
    })

    if (result.user) {
      // Fire-and-forget - does not block signup completion. See email.ts for
      // why this stays separate from the phone-OTP verification gate.
      const { id, email } = result.user
      sendVerificationEmailAsync(id, email).catch((err) =>
        console.error("Email verification send failed:", err)
      )
    }

    return NextResponse.json(result.body, { status: result.status })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("Register error:", errorMessage)
    return NextResponse.json({ error: errorMessage || "Something went wrong" }, { status: 500 })
  }
}

async function sendVerificationEmailAsync(userId: string, email: string) {
  const { rawToken, tokenHash } = generateResetToken()
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const verifyUrl = `${appUrl}/verify-email?token=${rawToken}`
  await sendEmailVerificationEmail(email, verifyUrl)
}
