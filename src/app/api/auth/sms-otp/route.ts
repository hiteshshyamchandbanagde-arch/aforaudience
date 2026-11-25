import { NextResponse } from "next/server"
import { getSmsOtpEnabled } from "@/lib/platform-settings"

// SMS OTP toggle (17 Nov) - public, no auth: the sign-up and login forms
// need to know before submit whether the OTP stage / "Login with OTP"
// exists. Same uncached settings read as the other settings callers.
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({ enabled: await getSmsOtpEnabled() })
}
