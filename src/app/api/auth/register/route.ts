import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, password, role } = await req.json()
    const normalizedRole = typeof role === "string" ? role.toUpperCase() : role
    const validRoles = ["AUDIENCE", "ARTIST", "ORGANISER", "VENUE_OWNER"]

    if (!name || !email || !password || !normalizedRole) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    if (!validRoles.includes(normalizedRole)) {
      return NextResponse.json({ error: "Invalid role selected" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        password: hashedPassword,
        role: normalizedRole,
        isVerified: false,
        isApproved: normalizedRole === "AUDIENCE",
      }
    })

    if (normalizedRole === "ARTIST") {
      await prisma.artist.create({
        data: {
          userId: user.id,
          bio: "",
          genre: [],
          styleTag: [],
          videoReel: [],
          socialLinks: {},
        }
      })
    }
    if (normalizedRole === "ORGANISER") {
      await prisma.organiser.create({ data: { userId: user.id, orgName: name } })
    }
    if (normalizedRole === "VENUE_OWNER") {
      await prisma.venueOwner.create({ data: { userId: user.id } })
    }

    return NextResponse.json({ message: "Account created successfully!" }, { status: 201 })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("Register error:", errorMessage)
    return NextResponse.json({ error: errorMessage || "Something went wrong" }, { status: 500 })
  }
}