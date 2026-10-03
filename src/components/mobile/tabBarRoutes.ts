// Which bottom bar a route gets on mobile. One source for both
// MobileTabBar (which renders the bar) and DashboardShell (which keeps
// its own older bar out of the way wherever this one shows).
//
// BUG-2609-084 - these used to be two hand-kept lists (an exact-match
// switch in MobileTabBar and MOBILE_TAB_BAR_ROUTES in DashboardShell).
// A route in neither, like /dashboard/organiser/events/<id>, got
// DashboardShell's older bar (Dashboard / My Tickets / Messages /
// Profile / More) in the middle of the organiser dashboard.

export type PrimaryTab = 'messages' | 'tickets' | 'saved' | 'profile'
export type DiscoverSub = 'events' | 'artists' | 'venues' | 'wall-of-fame'
export type RoleBarKind = 'ARTIST' | 'ORGANISER' | 'VENUE_OWNER' | 'ADMIN'

export type BarState =
  | { kind: 'primary'; active: PrimaryTab | null }
  | { kind: 'discover'; active: DiscoverSub }
  | { kind: 'role'; role: RoleBarKind; active: string | null }
  | { kind: 'hidden' }

// Route (+ role, for the one shared route) -> bar state. Exact routes
// first; then the prefix rules for the pages reached from a role bar's
// own lists (an organiser's event or tour, a venue), which keep that
// role's bar with the list they came from highlighted. Everything else -
// public detail pages like /events/[id], checkout, a message thread -
// falls through to 'hidden', as before.
export function deriveBarState(pathname: string | null, role: string | undefined): BarState {
  const p = pathname && pathname !== '/' ? pathname.replace(/\/$/, '') : pathname
  switch (p) {
    case '/':
      return { kind: 'primary', active: null }
    case '/dashboard/messages':
      return { kind: 'primary', active: 'messages' }
    case '/tickets':
      return { kind: 'primary', active: 'tickets' }
    case '/saved':
      return { kind: 'primary', active: 'saved' }
    case '/profile':
      return { kind: 'primary', active: 'profile' }
    // The audience dashboard is a DashboardShell page with no bar item
    // of its own - primary bar, nothing highlighted, same as '/'.
    case '/dashboard/audience':
      return { kind: 'primary', active: null }
    case '/events':
      return { kind: 'discover', active: 'events' }
    case '/artists':
      return { kind: 'discover', active: 'artists' }
    case '/venues':
      return { kind: 'discover', active: 'venues' }
    case '/wall-of-fame':
      return { kind: 'discover', active: 'wall-of-fame' }

    // Artist - base /dashboard/artist overview isn't any of the 3 bar
    // items' own href (none of them point there, same as none of
    // ORGANISER/VENUE_OWNER's items point at a bare "overview" route
    // either) - bar shows, nothing highlighted, same treatment as '/'.
    case '/dashboard/artist':
      return { kind: 'role', role: 'ARTIST', active: null }
    case '/dashboard/artist/events':
      return { kind: 'role', role: 'ARTIST', active: 'my-events' }
    case '/dashboard/artist/edit':
      return { kind: 'role', role: 'ARTIST', active: 'edit-profile' }
    case '/dashboard/artist/corporate-inquiries':
      return { kind: 'role', role: 'ARTIST', active: 'inquiries' }

    case '/dashboard/organiser':
      return { kind: 'role', role: 'ORGANISER', active: 'my-events' }
    case '/dashboard/organiser/events/create':
      return { kind: 'role', role: 'ORGANISER', active: 'create' }
    case '/dashboard/organiser/sales':
      return { kind: 'role', role: 'ORGANISER', active: 'sales' }
    case '/dashboard/organiser/payouts':
      return { kind: 'role', role: 'ORGANISER', active: 'payouts' }
    case '/dashboard/organiser/tours':
      return { kind: 'role', role: 'ORGANISER', active: 'tours' }
    case '/dashboard/organiser/edit':
      return { kind: 'role', role: 'ORGANISER', active: 'edit-profile' }

    case '/dashboard/venue':
      return { kind: 'role', role: 'VENUE_OWNER', active: 'my-venues' }
    case '/dashboard/venue/bookings':
      return { kind: 'role', role: 'VENUE_OWNER', active: 'bookings' }
    case '/dashboard/venue/sales':
      return { kind: 'role', role: 'VENUE_OWNER', active: 'sales' }
    case '/dashboard/venue/create':
      return { kind: 'role', role: 'VENUE_OWNER', active: 'register-venue' }
    case '/dashboard/venue/edit':
      return { kind: 'role', role: 'VENUE_OWNER', active: 'account-settings' }

    // Shared route - the page itself resolves `callerSide` from
    // session.user.role (src/app/dashboard/venue-requests/page.tsx),
    // reused here rather than building new role-detection. A signed-in
    // user with neither role hitting this URL directly (shouldn't
    // happen - the page's own gating gives them an empty view, not a
    // redirect) gets the primary bar rather than a guessed-wrong role.
    case '/dashboard/venue-requests':
      if (role === 'ORGANISER') return { kind: 'role', role: 'ORGANISER', active: 'requests' }
      if (role === 'VENUE_OWNER') return { kind: 'role', role: 'VENUE_OWNER', active: 'requests' }
      return { kind: 'primary', active: null }

    // Admin - unlike the other 3 roles' base route, "Overview" is a real
    // bar item pointing at this exact URL (not just an unhighlighted
    // landing state), so it gets its own active id instead of null.
    case '/dashboard/admin':
      return { kind: 'role', role: 'ADMIN', active: 'overview' }
    case '/dashboard/admin/bookings':
      return { kind: 'role', role: 'ADMIN', active: 'bookings' }
    case '/dashboard/admin/revenue':
      return { kind: 'role', role: 'ADMIN', active: 'revenue' }
    case '/dashboard/admin/users':
      return { kind: 'role', role: 'ADMIN', active: 'users' }
    case '/dashboard/admin/artists':
      return { kind: 'role', role: 'ADMIN', active: 'artists' }
    case '/dashboard/admin/diary':
      return { kind: 'role', role: 'ADMIN', active: 'diary' }
    case '/dashboard/admin/feedback':
      return { kind: 'role', role: 'ADMIN', active: 'feedback' }
    case '/dashboard/admin/settings':
      return { kind: 'role', role: 'ADMIN', active: 'settings' }
    // No bar item points here (it is in the desktop sidebar only), so
    // the admin bar shows with nothing highlighted.
    case '/dashboard/admin/design-system':
      return { kind: 'role', role: 'ADMIN', active: null }
  }

  if (p) {
    // An organiser's event (detail, edit, lineup, check-in, sales) is
    // reached from My Events; a tour (detail, create) from Tours; a
    // venue (detail, edit, seat map, sales) from My Venues.
    if (p.startsWith('/dashboard/organiser/events/')) return { kind: 'role', role: 'ORGANISER', active: 'my-events' }
    if (p.startsWith('/dashboard/organiser/tours/')) return { kind: 'role', role: 'ORGANISER', active: 'tours' }
    if (p.startsWith('/dashboard/venue/')) return { kind: 'role', role: 'VENUE_OWNER', active: 'my-venues' }
  }

  return { kind: 'hidden' }
}

/** True when MobileTabBar shows a bar on this route, so no other bottom bar should. */
export function unifiedTabBarShows(pathname: string | null, role: string | undefined): boolean {
  return deriveBarState(pathname, role).kind !== 'hidden'
}
