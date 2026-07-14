import { NextRequest, NextResponse } from "next/server"
import { isUsernameAvailable, suggestAvailableUsername } from "@/lib/auth-helpers"

// Live check while typing on the register form.
export async function GET(req: NextRequest) {
  const value = req.nextUrl.searchParams.get("value")?.trim()
  if (!value) {
    return NextResponse.json({ error: "Missing value" }, { status: 400 })
  }

  const available = await isUsernameAvailable(value)
  if (available) {
    return NextResponse.json({ available: true })
  }

  const suggestion = await suggestAvailableUsername(value)
  return NextResponse.json({ available: false, suggestion })
}
