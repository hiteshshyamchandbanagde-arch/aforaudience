import { NextRequest, NextResponse } from "next/server"
import { suggestUsernameVariants } from "@/lib/auth-helpers"

// Feedback cmse195bc1e27d60e27596011 follow-up (2 Aug) - the register
// form's initials suggestion used to call /api/auth/username-check and
// get back one flat string. This is a dedicated endpoint for the richer,
// multi-option version (see suggestUsernameVariants) - kept separate
// from username-check so that endpoint's existing "is this exact typed
// value available" contract doesn't change for the taken-username
// suggestion elsewhere on the same form.
export async function GET(req: NextRequest) {
  const seed = req.nextUrl.searchParams.get("seed")?.trim()
  if (!seed || seed.length < 2) {
    return NextResponse.json({ error: "Missing or too-short seed" }, { status: 400 })
  }

  const variants = await suggestUsernameVariants(seed)
  return NextResponse.json({ variants })
}
