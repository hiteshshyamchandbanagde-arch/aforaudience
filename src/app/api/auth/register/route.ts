import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

// Browse-first model: registration never accepts a role. Every account is
// created as AUDIENCE. Artist / Organiser / Venue Owner are opt-in upgrades
// applied for later from Profile, each going through their own approval flow.
export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, password } = await req.json()
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : email

    if (!name || !normalizedEmail || !password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existingUser) {
      return NextResponse.json({ error: "That email address is already registered." }, { status: 400 })
    }

    if (phone?.trim()) {
      const normalizedPhone = phone.trim()
      const existingPhoneUser = await prisma.user.findFirst({ where: { phone: normalizedPhone } })
      if (existingPhoneUser) {
        return NextResponse.json({ error: "That phone number is already registered." }, { status: 400 })
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        phone: phone?.trim() || null,
        password: hashedPassword,
        role: "AUDIENCE",
        isVerified: false,
        isApproved: true,
      }
    })

    return NextResponse.json({ message: "Account created successfully!" }, { status: 201 })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("Register error:", errorMessage)
    return NextResponse.json({ error: errorMessage || "Something went wrong" }, { status: 500 })
  }
}
