'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Session 39 unification (Feedback f96a1262) - Pending Approvals moved
// into /dashboard/admin/feedback alongside the feedback tracker as one
// unified admin surface, instead of two separate pages. This route is
// kept as a redirect rather than deleted outright, since it's likely
// bookmarked/linked from elsewhere (nav, memory, old handoffs).
export default function AdminDashboardRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dashboard/admin/feedback')
  }, [router])
  return null
}
