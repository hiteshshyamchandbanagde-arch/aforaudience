"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { signOutAndClearCache, clearSwRuntimeCacheOnUserChange } from "@/lib/sw-cache"

// Watches for a session the server has flagged invalid (password reset
// since this JWT was issued, or - H3 - the account was suspended mid-
// session) and signs the user out immediately, instead of leaving them
// on a stale session for up to 7 days until the JWT naturally expires.
export default function SessionGuard() {
  const { data: session } = useSession()

  useEffect(() => {
    const error = (session as any)?.error
    if (error === "SessionInvalidated") {
      signOutAndClearCache({ callbackUrl: "/login" })
    } else if (error === "AccountSuspended") {
      signOutAndClearCache({ callbackUrl: "/login?suspended=1" })
    }
  }, [session])

  // BUG-2609-088 - a different user than the last one seen on this
  // device (session expired, someone else signed in) must not inherit
  // the service worker's offline copies of the previous user's pages.
  const userId = (session?.user as { id?: string } | undefined)?.id
  useEffect(() => {
    if (userId) clearSwRuntimeCacheOnUserChange(userId)
  }, [userId])

  return null
}
