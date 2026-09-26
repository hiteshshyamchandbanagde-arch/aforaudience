import { NextRequest, NextResponse } from "next/server"
import { isUsernameAvailable, suggestAvailableUsername } from "@/lib/auth-helpers"
import { isValidUsernameFormat } from "@/lib/validation"

// Live check while typing on the register form.
export async function GET(req: NextRequest) {
  const value = req.nextUrl.searchParams.get("value")?.trim()
  if (!value) {
    return NextResponse.json({ error: "Missing value" }, { status: 400 })
  }

  // BUG-2609-054 - a name the register route would reject is never
  // "available", however unique it is.
  if (!isValidUsernameFormat(value)) {
    return NextResponse.json({ available: false, invalid: true, code: "USERNAME_INVALID" })
  }

  const available = await isUsernameAvailable(value)
  if (available) {
    return NextResponse.json({ available: true })
  }

  const suggestion = await suggestAvailableUsername(value)
  return NextResponse.json({ available: false, suggestion })
}
