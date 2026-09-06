import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getHeldRoles, EMPTY_HELD_ROLES } from '@/lib/held-roles'
import { HeldRolesProvider } from '@/components/HeldRolesContext'

// Force dynamic rendering explicitly - see dashboard/layout.tsx's own
// comment for why (PR #562 regression: stale cached render served for 2 of
// 3 roles, Turbopack's implicit dynamic-detection gap around
// getServerSession()'s cookie read).
export const dynamic = 'force-dynamic'

// BUG-2609-020 - /tickets renders DashboardShell (see that file's topNav)
// outside the /dashboard/* prefix, so it needs its own copy of this layout
// rather than being covered by dashboard/layout.tsx.
export default async function TicketsLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id
  const heldRoles = userId ? await getHeldRoles(userId) : EMPTY_HELD_ROLES
  return <HeldRolesProvider value={heldRoles}>{children}</HeldRolesProvider>
}
