"use client"

import { useEffect } from "react"
import { useSession, signOut } from "next-auth/react"

// Watches for a session the server has flagged invalid (password reset
// since this JWT was issued, or - H3 - the account was suspended mid-
// session) and signs the user out immediately, instead of leaving them
// on a stale session for up to 7 days until the JWT naturally expires.
export default function SessionGuard() {
  const { data: session } = useSession()

  useEffect(() => {
    const error = (session as any)?.error
    if (error === "SessionInvalidated") {
      signOut({ callbackUrl: "/login" })
    } else if (error === "AccountSuspended") {
      signOut({ callbackUrl: "/login?suspended=1" })
    }
  }, [session])

  return null
}
