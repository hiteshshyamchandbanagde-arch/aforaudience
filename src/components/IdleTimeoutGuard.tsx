'use client'

import { useEffect, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'

// Feedback a3630648: no session timeout enforced anywhere. Originally
// scoped Admin-only (PR #203); extended here per Hitesh's follow-up
// question to also cover Organiser/Venue Owner, who handle real bookings
// and money even though they're not full-platform Admins. Deliberately
// NOT extended to Artist/Audience - those roles are pure browse/attend
// use (matches design.md's "gate only at real commitment" principle), and
// a stale mobile session there is low-stakes (worst case: someone else on
// the same device sees your ticket list, not your money or your ability
// to suspend accounts).
//
// Threshold is intentionally tiered by how much damage a hijacked idle
// session could do, not a single one-size value:
//   - ADMIN: 30 min - can suspend accounts, sees platform-wide financials
//   - ORGANISER / VENUE_OWNER: 24 hours - can accept/reject bookings, set
//     prices, see their own revenue, but not other users' data or
//     platform-wide controls
//   - ARTIST / AUDIENCE: no timeout - matches SessionGuard's existing
//     30-day JWT lifetime, no change from today's behavior
const IDLE_LIMITS_MS: Record<string, number> = {
  ADMIN: 30 * 60 * 1000,
  ORGANISER: 24 * 60 * 60 * 1000,
  VENUE_OWNER: 24 * 60 * 60 * 1000,
}
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const

export default function IdleTimeoutGuard() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role as string | undefined
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const limit = role ? IDLE_LIMITS_MS[role] : undefined
    if (!limit) return

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        signOut({ callbackUrl: '/login?idle=1' })
      }, limit)
    }

    resetTimer()
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }))

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimer))
    }
  }, [role])

  return null
}
