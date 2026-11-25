import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getHeldRoles, EMPTY_HELD_ROLES } from '@/lib/held-roles'
import { HeldRolesProvider } from '@/components/HeldRolesContext'

// Force dynamic rendering explicitly rather than relying on Turbopack to
// auto-detect that getServerSession()'s cookie read should opt this layout
// out of caching - it has had known gaps here vs webpack. Fixes a real
// regression on PR #562: Organiser/Venue Owner role sections went missing
// entirely (not delayed - absent) while Artist rendered fine, the
// signature of a stale cached render being served for 2 of 3 roles rather
// than a logic bug (a pure computation bug would break all 3 identically).
export const dynamic = 'force-dynamic'

// BUG-2609-020 - covers all /dashboard/* pages (the bulk of DashboardShell's
// 21 call sites: Organiser/Artist/Venue Owner/Audience/Messages/
// venue-requests). Resolves held roles server-side, once, before first
// paint - no more client-side fetch-after-session-resolves delay. Admin
// dashboard pages are also under /dashboard/* but still don't use
// DashboardShell itself - this layout still wraps them, but an unused
// provider value is harmless. BUG-2609-008 (Admin had no mobile shell at
// all) is resolved a different way, not by adopting DashboardShell here:
// MobileTabBar.tsx (GEN-2609-019 Admin follow-up) now recognizes every
// /dashboard/admin/* route and renders its own Admin bar there directly.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id
  const heldRoles = userId ? await getHeldRoles(userId) : EMPTY_HELD_ROLES
  return <HeldRolesProvider value={heldRoles}>{children}</HeldRolesProvider>
}
