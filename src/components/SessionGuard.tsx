"use client"

import { useEffect } from "react"
import { useSession, signOut } from "next-auth/react"

// Watches for a session the server has flagged invalid (currently: a
// password reset happened after this JWT was issued) and signs the user
// out immediately, instead of leaving them on a stale session for up to
// 7 days until the JWT naturally expires.
export default function SessionGuard() {
  const { data: session } = useSession()

  useEffect(() => {
    if ((session as any)?.error === "SessionInvalidated") {
      signOut({ callbackUrl: "/login" })
    }
  }, [session])

  return null
}
