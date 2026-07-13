import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { isUsernameAvailable } from "@/lib/auth-helpers"
import { generateAndSendOtp } from "@/lib/otp"
import { generateResetToken } from "@/lib/tokens" // generic sha256 token - reused for email verification too
import { sendEmailVerificationEmail } from "@/lib/email"

// Browse-first model: registration never accepts a role. Every account is
// created as AUDIENCE. Artist / Organiser / Venue Owner are opt-in upgrades
// applied for later from Profile, each going through their own approval flow.
//
// `username` (stored as User.name) is the login username - see
// lib/auth-helpers.ts suggestAvailableUsername/isUsernameAvailable, used by
// the register form for live-suggest + availability check before submit.
// Phone is now required (was optional) since it's the mandatory OTP
// verification gate before the account can sign in via password or OTP.
// Only +91 numbers actually receive an OTP right now (MSG91 is India-only).
export async function POST(req: NextRequest) {
  try {
    const { username, email, phone, password, fullName } = await req.json()
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : email
    const normalizedUsername = typeof username === "string" ? username.trim() : username
    const normalizedPhone = typeof phone === "string" ? phone.trim() : phone
    // Human-readable display name. Optional in the request for backward
    // compatibility with any older client, but the new register form
    // always sends it. Trimmed and length-capped to a reasonable ceiling
    // (120 chars — long enough for any real name, short enough to fit
    // on a ticket PDF and in an email subject line without weirdness).
    const rawFullName = typeof fullName === "string" ? fullName.trim() : ""
    const normalizedDisplayName = rawFullName.length > 0 ? rawFullName.slice(0, 120) : null

    if (!normalizedUsername || !normalizedEmail || !normalizedPhone || !password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(normalizedUsername)) {
      return NextResponse.json(
        { error: "Username must be 3-20 characters, letters/numbers/underscore only" },
        { status: 400 }
      )
    }

    const usernameOk = await isUsernameAvailable(normalizedUsername)
    if (!usernameOk) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existingUser) {
      return NextResponse.json({ error: "That email address is already registered." }, { status: 400 })
    }

    if (!normalizedPhone.startsWith("+91")) {
      return NextResponse.json(
        { error: "Only Indian (+91) phone numbers are supported for OTP verification right now." },
        { status: 400 }
      )
    }

    const existingPhoneUser = await prisma.user.findFirst({ where: { phone: normalizedPhone } })
    if (existingPhoneUser) {
      return NextResponse.json({ error: "That phone number is already registered." }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        name: normalizedUsername,
        displayName: normalizedDisplayName,
        email: normalizedEmail,
        phone: normalizedPhone,
        password: hashedPassword,
        role: "AUDIENCE",
        isVerified: false,
        isApproved: true,
      }
    })

    const otpResult = await generateAndSendOtp(normalizedPhone, "SIGNUP_VERIFY")

    // Fire-and-forget - does not block signup completion. See email.ts for
    // why this stays separate from the phone-OTP verification gate.
    sendVerificationEmailAsync(user.id, user.email).catch((err) =>
      console.error("Email verification send failed:", err)
    )

    return NextResponse.json(
      {
        message: "Account created! Verify your phone to continue.",
        userId: user.id,
        phone: user.phone,
        code: user.code,
        devOtp: otpResult.devCode, // only present in QA (mock provider), undefined in prod
      },
      { status: 201 }
    )

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
