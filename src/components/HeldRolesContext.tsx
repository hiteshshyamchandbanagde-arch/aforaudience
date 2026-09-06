'use client'

import { createContext, useContext, type ReactNode } from 'react'
// `import type` only - held-roles.ts also imports `prisma`, and this file
// is a client component. A runtime import (even of an unrelated named
// export) would pull the whole module - and prisma's `pg`/net/tls chain -
// into the client bundle; a type-only import is erased at compile time,
// so it can't. See EMPTY_HELD_ROLES below, redefined locally for the same
// reason rather than imported.
import type { HeldRoles } from '@/lib/held-roles'

const EMPTY_HELD_ROLES: HeldRoles = { ORGANISER: false, ARTIST: false, VENUE_OWNER: false }

// BUG-2609-020 - held roles are now resolved server-side (see
// src/lib/held-roles.ts) by the 3 new layout.tsx files
// (dashboard/layout.tsx, tickets/layout.tsx, profile/layout.tsx) and handed
// down through this context, instead of DashboardShell.tsx firing its own
// client-side fetches after session resolves.
const HeldRolesContext = createContext<HeldRoles | null>(null)

export function HeldRolesProvider({ value, children }: { value: HeldRoles; children: ReactNode }) {
  return <HeldRolesContext.Provider value={value}>{children}</HeldRolesContext.Provider>
}

// Same name/shape as the hook it replaces in DashboardShell.tsx, so that
// call site's `const held = useHeldRoles()` doesn't need to change. Falls
// back to all-false rather than throwing if a page ever renders outside
// one of the 3 provider layouts - shouldn't happen (verified at build time
// against all 21 call sites), but a missing role section is a much safer
// failure mode than a crashed dashboard.
export function useHeldRoles(): HeldRoles {
  const ctx = useContext(HeldRolesContext)
  return ctx ?? EMPTY_HELD_ROLES
}
