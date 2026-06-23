import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, password, role } = await req.json()

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
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
        name,
        email,
        phone: phone || null,
        password: hashedPassword,
        role,
        isVerified: false,
        isApproved: role === "AUDIENCE" ? true : false,
      }
    })

    if (role === "ARTIST") {
      await prisma.artist.create({ data: { userId: user.id } })
    }
    if (role === "ORGANISER") {
      await prisma.organiser.create({ data: { userId: user.id, orgName: name } })
    }
    if (role === "VENUE_OWNER") {
      await prisma.venueOwner.create({ data: { userId: user.id } })
    }

    return NextResponse.json({ message: "Account created successfully!" }, { status: 201 })

  } catch (error) {
    console.error("Register error:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}