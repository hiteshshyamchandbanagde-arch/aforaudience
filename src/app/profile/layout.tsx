import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getHeldRoles, EMPTY_HELD_ROLES } from '@/lib/held-roles'
import { HeldRolesProvider } from '@/components/HeldRolesContext'

// BUG-2609-020 - /profile renders DashboardShell (see that file's topNav)
// outside the /dashboard/* prefix, so it needs its own copy of this layout
// rather than being covered by dashboard/layout.tsx.
export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id
  const heldRoles = userId ? await getHeldRoles(userId) : EMPTY_HELD_ROLES
  return <HeldRolesProvider value={heldRoles}>{children}</HeldRolesProvider>
}
