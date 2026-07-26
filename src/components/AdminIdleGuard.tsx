'use client'

import { useEffect, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'

// Feedback a3630648: no session timeout enforced anywhere - a session
// stayed active/usable after 5+ hours idle on mobile. Deliberately scoped
// to the Admin role only rather than applied platform-wide: AforAudience
// is a browse-first leisure/ticketing marketplace (see design.md's own
// "gate only at real commitment" principle), and forcing a hard idle
// logout on Audience/Artist/Organiser/Venue Owner roles during casual
// browsing or mid-event ticket-checking would be a real UX regression for
// no real security benefit at those privilege levels. Admin is different:
// elevated privileges (account suspension, financial visibility across
// the whole platform) justify a stricter policy - same reasoning already
// applied to phone verification only gating real commitments, not browsing.
const IDLE_LIMIT_MS = 30 * 60 * 1000 // 30 minutes
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const

export default function AdminIdleGuard() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role as string | undefined
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (role !== 'ADMIN') return

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        signOut({ callbackUrl: '/login?idle=1' })
      }, IDLE_LIMIT_MS)
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
