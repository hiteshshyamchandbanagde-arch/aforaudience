import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getHeldRoles, EMPTY_HELD_ROLES } from '@/lib/held-roles'
import { HeldRolesProvider } from '@/components/HeldRolesContext'

// BUG-2609-020 - covers all /dashboard/* pages (the bulk of DashboardShell's
// 21 call sites: Organiser/Artist/Venue Owner/Audience/Messages/
// venue-requests). Resolves held roles server-side, once, before first
// paint - no more client-side fetch-after-session-resolves delay. Admin
// dashboard pages are also under /dashboard/* but don't use DashboardShell
// yet (BUG-2609-008, deferred) - this layout still wraps them, but an
// unused provider value is harmless.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id
  const heldRoles = userId ? await getHeldRoles(userId) : EMPTY_HELD_ROLES
  return <HeldRolesProvider value={heldRoles}>{children}</HeldRolesProvider>
}
