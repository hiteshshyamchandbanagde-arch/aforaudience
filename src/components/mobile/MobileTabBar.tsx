'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useLocale } from '@/lib/i18n/translate'
import {
  DiscoverTabIcon,
  TicketsTabIcon,
  SavedTabIcon,
  ProfileTabIcon,
  MessagesTabIcon,
  EventsTabIcon,
  ArtistsTabIcon,
  DashboardMorphTabIcon,
} from '@/components/icons/MobileTabIcons'
import { PinIcon, TrophyIcon } from '@/components/icons/EventIcons'
import { useBadgeCounts, getShellDashboardLink, Icon as DashboardIcon, type IconName } from '@/components/DashboardShell'
import Button from '@/components/ui/Button'
import { useModalSheet } from '@/lib/use-modal-sheet'
import { deriveBarState, type RoleBarKind } from './tabBarRoutes'

// Mobile Nav v3, Phase B (GEN-2609-019) - this is Phase 1's
// (GEN-2609-003) static 4-item MobileTabBar evolved in place into a
// morphing bar, per the Figma Make "AFA Mobile App v3" export's
// MorphingNav/resolveNavAction (src/nav.tsx). Same mount point
// (layout.tsx, untouched by this phase) and same file/export name, so
// there is still exactly one bottom-nav component ever mounted - this
// isn't a second bar living alongside the old one.
//
// Deliberately NOT a port of the Figma prototype's own state model: that
// prototype tracks `navHistory: NavState[]` as pure in-memory React state
// with no browser-history wiring (fine for a click-through mock, wrong
// for a real app with deep-linkable routes and a real back button). Here,
// the bar's entire visual state (which row and which item is active) is
// (almost - see the role param note below) a pure function of
// `usePathname()`, nothing else. There is no separate "which level am I
// on" state to keep in sync: navigating via the bar's own taps, a Link
// elsewhere on the page, or the browser's native back/forward button all
// change the URL, and the bar re-derives its correct row from that on the
// next render either way. This is what makes native back "just work"
// with no custom back-chevron UI (confirmed 9 Sep) - back is real browser
// history, the bar has nothing of its own to unwind.
//
// Phase C (GEN-2609-019, revised - Admin split into its own follow-up,
// no Admin persona in QA seed data to verify it against) adds
// role-specific Dashboard bars for Artist/Organiser/Venue Owner,
// reached via the Discover-sub "Dashboard" item's placeholder landing
// from Phase B. `deriveBarState` (./tabBarRoutes) is not a pure function of
// pathname ALONE - /dashboard/venue-requests is one shared page (gated
// by `callerSide` inside that page itself, see its own comment) used by
// both Organiser and Venue Owner, so which role's bar renders there
// depends on the signed-in user's role too. Every other route is still
// pathname-only.
//
// Admin follow-up (GEN-2609-019, also closes BUG-2609-008 - Admin
// dashboard had no mobile shell at all) - the earlier assumption that
// this needed a QA persona was wrong: the one ADMIN-role account is
// Hitesh's own real Google-auth account, protected from every reseed
// by the seed script's delete-guard, so it was always testable live.
// Unlike the other 3 roles, DashboardShell.tsx never wrapped
// /dashboard/admin/* to begin with (see dashboard/layout.tsx's own
// comment - that's the actual substance of BUG-2609-008), so there was
// no old bar to fight with here; this bar is the first bottom nav
// Admin has ever had on mobile. Item split (Overview/Bookings/Revenue/
// Users primary, Artists/Diary/Feedback/Settings in More) is the
// lowest-confidence guess in the whole mobile nav v3 brief - no usage
// data behind it, shipped as specified so there's something real to
// react to, most likely item to need correction once Hitesh has
// actually used it for a few days.
// Which bar a route gets (deriveBarState) lives in ./tabBarRoutes, shared
// with DashboardShell so the two can never disagree (BUG-2609-084).

type ItemDef = {
  id: string
  href: string
  label: string
  Icon: typeof DiscoverTabIcon
  badge?: number
  // primary-tab siblings (Messages/Tickets/Saved/Profile) and role-bar
  // siblings (every item within one role's own bar, including its More
  // sheet) use replace - switching between them is a lateral move within
  // the same nav level, not a descent, so it shouldn't grow the back-
  // stack (same "update tab in place" semantics the Figma reference's
  // resolveNavAction uses for its own in-memory stack, translated to
  // real router history - and the same policy Phase B already applied to
  // primary-tab siblings, extended here to role-bar siblings for the
  // same reason). Discover (from primary) and every Discover-sub item -
  // including Dashboard, entering a role bar for the first time - use
  // push: both are real descents, and native back from deep inside a
  // role bar should return to Discover/primary, not skip past it.
  nav: 'push' | 'replace'
}

// Small adapter so DashboardShell's name-based Icon (reused here for
// visual consistency with the desktop sidebar's own choices for these
// exact items, e.g. "My Events" already uses 'calendar' there) fits the
// same `Icon: typeof DiscoverTabIcon` component-prop shape every other
// item in this file already uses - style/filled are accepted (needed to
// satisfy that shared type) and simply unused, since DashboardIcon sizes
// itself via its own `size` prop, not CSS.
function roleIcon(name: IconName): typeof DiscoverTabIcon {
  return function RoleBarIcon(_props: { className?: string; style?: CSSProperties; filled?: boolean }) {
    return <DashboardIcon name={name} size={21} />
  }
}

type MoreItemDef = { id: string; href: string; label: string; Icon: typeof DiscoverTabIcon }

export default function MobileTabBar() {
  const rawPathname = usePathname()
  const { data: session, status } = useSession()
  const { t } = useLocale()
  const { unreadCount, flexRequestsOrganiser, flexRequestsVenue, venueBookingsPending } = useBadgeCounts()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreSheetRef = useRef<HTMLDivElement>(null)

  const role = (session?.user as { role?: string } | undefined)?.role
  const barState = deriveBarState(rawPathname, role)
  // GEN-2610-007 - Admin stays English, its More slot and sheet included.
  const moreLabel = barState.kind === 'role' && barState.role === 'ADMIN' ? 'More' : t.dashboardChrome.more
  const closeLabel = barState.kind === 'role' && barState.role === 'ADMIN' ? 'Close' : t.dashboardChrome.close
  useModalSheet(moreOpen, moreSheetRef, () => setMoreOpen(false), { label: moreLabel })

  // Saved count - "live count from the same source /saved itself already
  // uses" (GET /api/events/saved, .length) rather than a second data
  // source. Refetches on pathname change (a natural checkpoint - saving
  // an event from Discover then tapping into another tab should show the
  // new count) and on focus/visibilitychange (same pattern
  // profile/page.tsx already uses for its own "data may have changed
  // elsewhere" refetch) rather than polling or inventing a cross-
  // component event bus just for this one badge.
  const [savedCount, setSavedCount] = useState(0)
  useEffect(() => {
    if (!session?.user) { setSavedCount(0); return }
    let cancelled = false
    const load = () => {
      fetch('/api/events/saved')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => { if (!cancelled && Array.isArray(data)) setSavedCount(data.length) })
        .catch(() => {})
    }
    load()
    const handleVisibility = () => { if (document.visibilityState === 'visible') load() }
    window.addEventListener('focus', load)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      cancelled = true
      window.removeEventListener('focus', load)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, rawPathname])

  // Closes the More sheet on every navigation (own tap included - Link's
  // own click already starts the route change, this just clears the
  // sheet so it's not still open over whatever renders next) and
  // whenever the bar leaves 'role' state entirely (e.g. native back out
  // of a role bar while the sheet happened to be open).
  useEffect(() => {
    setMoreOpen(false)
  }, [rawPathname])

  useEffect(() => {
    const shouldRender = status !== 'loading' && barState.kind !== 'hidden'
    document.body.classList.toggle('afa-mobile-tab-bar-active', shouldRender)
    return () => {
      document.body.classList.remove('afa-mobile-tab-bar-active')
    }
  }, [status, barState.kind])

  if (status === 'loading' || barState.kind === 'hidden') return null

  const dashboardHref = getShellDashboardLink(role)
  const chrome = t.dashboardChrome

  // Role-bar item labels come from t.dashboardChrome, the same keys as
  // DashboardShell's ROLE_SECTIONS where the item is the same concept
  // (e.g. "My Events"/"Sales"/"Payouts"). GEN-2610-007: the Artist,
  // Organiser and Venue Owner bars are translated; the Admin bar stays
  // English.
  //
  // The visitor bars below are translated (GEN-2609-120: they were the
  // English left in the Marathi nav). Discover/Tickets/Saved/Events/WOF/Dashboard
  // use their own short nav.tab* keys rather than t.nav.myTickets /
  // t.nav.wallOfFame / t.nav.dashboard: this bar's 5 equal-width slots wrapped those full
  // words to two lines at 10px/0.08em tracking.
  const primaryItems: ItemDef[] = [
    { id: 'discover', href: '/events', label: t.nav.tabDiscover, Icon: DiscoverTabIcon, nav: 'push' },
    { id: 'messages', href: '/dashboard/messages', label: t.nav.messages, Icon: MessagesTabIcon, badge: unreadCount, nav: 'replace' },
    { id: 'tickets', href: '/tickets', label: t.nav.tabTickets, Icon: TicketsTabIcon, nav: 'replace' },
    { id: 'saved', href: '/saved', label: t.nav.tabSaved, Icon: SavedTabIcon, badge: savedCount, nav: 'replace' },
    { id: 'profile', href: '/profile', label: t.nav.profile, Icon: ProfileTabIcon, nav: 'replace' },
  ]

  const discoverItems: ItemDef[] = [
    { id: 'events', href: '/events', label: t.nav.tabEvents, Icon: EventsTabIcon, nav: 'push' },
    { id: 'artists', href: '/artists', label: t.nav.artists, Icon: ArtistsTabIcon, nav: 'push' },
    { id: 'venues', href: '/venues', label: t.nav.venues, Icon: PinIcon, nav: 'push' },
    { id: 'wall-of-fame', href: '/wall-of-fame', label: t.nav.tabWallOfFame, Icon: TrophyIcon, nav: 'push' },
    // Phase C fills this in for real now (previously a placeholder
    // landing on /dashboard/audience-style routes per Phase B's own
    // comment) - getShellDashboardLink already resolves to each role's
    // real base dashboard route (/dashboard/artist, /dashboard/organiser,
    // /dashboard/venue), which deriveBarState recognizes as
    // that role's own bar state instead of falling through to hidden.
    // Always push - a real descent, and native back from anywhere inside
    // the resulting role bar should return to whichever Discover sub-item
    // was active, not skip past it. Single-role resolution only - none of
    // the current QA personas hold 2+ roles, and multi-role switching is
    // Phase D's Profile role-switcher territory, not solvable here
    // regardless of build order.
    { id: 'dashboard', href: dashboardHref, label: t.nav.tabDashboard, Icon: DashboardMorphTabIcon, nav: 'push' },
  ]

  // Artist - 3 items, no "More" (nothing to overflow). Icons match
  // ROLE_SECTIONS' own choices for these exact items in the desktop
  // sidebar (calendar/user/briefcase) via the roleIcon() adapter above.
  const artistItems: ItemDef[] = [
    { id: 'my-events', href: '/dashboard/artist/events', label: chrome.myEvents, Icon: roleIcon('calendar'), nav: 'replace' },
    // Label fix (caught live, not in the original brief): this is
    // /dashboard/artist/edit, the artist's public performer profile -
    // a different page from the primary bar's own "Profile" (/profile,
    // the account page). "Edit Profile" matches ROLE_SECTIONS' own label
    // for this exact item, not a new label invented for this bar.
    { id: 'edit-profile', href: '/dashboard/artist/edit', label: chrome.editProfile, Icon: roleIcon('user'), nav: 'replace' },
    { id: 'inquiries', href: '/dashboard/artist/corporate-inquiries', label: chrome.inquiries, Icon: roleIcon('briefcase'), nav: 'replace' },
  ]

  // Organiser - primary 4 + More. "Requests" reuses flexRequestsOrganiser,
  // same source DashboardShell's own sidebar already badges - not a
  // second data fetch.
  const organiserItems: ItemDef[] = [
    { id: 'my-events', href: '/dashboard/organiser', label: chrome.myEvents, Icon: roleIcon('calendar'), nav: 'replace' },
    { id: 'create', href: '/dashboard/organiser/events/create', label: chrome.create, Icon: roleIcon('plus'), nav: 'replace' },
    { id: 'sales', href: '/dashboard/organiser/sales', label: chrome.sales, Icon: roleIcon('trendUp'), nav: 'replace' },
    { id: 'requests', href: '/dashboard/venue-requests', label: chrome.requests, Icon: roleIcon('tag'), badge: flexRequestsOrganiser, nav: 'replace' },
  ]
  const organiserMoreItems: MoreItemDef[] = [
    { id: 'payouts', href: '/dashboard/organiser/payouts', label: chrome.payouts, Icon: roleIcon('dollarSign') },
    { id: 'tours', href: '/dashboard/organiser/tours', label: chrome.tours, Icon: roleIcon('map') },
    { id: 'edit-profile', href: '/dashboard/organiser/edit', label: chrome.editProfile, Icon: roleIcon('user') },
  ]

  // Venue Owner - primary 4 + More. "Bookings" reuses venueBookingsPending,
  // "Requests" reuses flexRequestsVenue - both the same sources
  // DashboardShell's own sidebar already badges.
  const venueOwnerItems: ItemDef[] = [
    { id: 'my-venues', href: '/dashboard/venue', label: chrome.myVenues, Icon: roleIcon('building'), nav: 'replace' },
    { id: 'bookings', href: '/dashboard/venue/bookings', label: chrome.bookings, Icon: roleIcon('grid'), badge: venueBookingsPending, nav: 'replace' },
    { id: 'sales', href: '/dashboard/venue/sales', label: chrome.sales, Icon: roleIcon('trendUp'), nav: 'replace' },
    { id: 'requests', href: '/dashboard/venue-requests', label: chrome.requests, Icon: roleIcon('tag'), badge: flexRequestsVenue, nav: 'replace' },
  ]
  const venueOwnerMoreItems: MoreItemDef[] = [
    { id: 'register-venue', href: '/dashboard/venue/create', label: chrome.registerVenue, Icon: roleIcon('plus') },
    { id: 'account-settings', href: '/dashboard/venue/edit', label: chrome.accountSettings, Icon: roleIcon('user') },
  ]

  // Admin - primary 4 + More. Icons pulled from the same shared
  // DashboardShell name set every other role bar uses (via roleIcon()
  // above), not the admin overview page's own page-local icon set -
  // best-fit matches: 'dashboard' for Overview (a real landing/summary
  // page, unlike the other roles' base routes), 'ticket' for Bookings
  // (matches the desktop admin page's own QuickLink choice for this
  // exact item), 'trendUp' for Revenue (Admin's equivalent of the
  // Organiser/Venue Owner bars' own "Sales" item), 'grid' for Users (a
  // list/table, and avoids colliding with 'user' below). More sheet:
  // 'music' for Artists (matches the Artist role bar's own base icon),
  // 'calendar' for Diary, 'message' for Feedback (matches the desktop
  // page's own chat-icon choice), 'user' for Settings (matches
  // Organiser/Venue Owner's own "Edit Profile"/"Account Settings" icon
  // choice for the same concept).
  const adminItems: ItemDef[] = [
    { id: 'overview', href: '/dashboard/admin', label: 'Overview', Icon: roleIcon('dashboard'), nav: 'replace' },
    { id: 'bookings', href: '/dashboard/admin/bookings', label: 'Bookings', Icon: roleIcon('ticket'), nav: 'replace' },
    { id: 'revenue', href: '/dashboard/admin/revenue', label: 'Revenue', Icon: roleIcon('trendUp'), nav: 'replace' },
    { id: 'users', href: '/dashboard/admin/users', label: 'Users', Icon: roleIcon('grid'), nav: 'replace' },
  ]
  const adminMoreItems: MoreItemDef[] = [
    { id: 'artists', href: '/dashboard/admin/artists', label: 'Artists', Icon: roleIcon('music') },
    { id: 'diary', href: '/dashboard/admin/diary', label: 'Diary', Icon: roleIcon('calendar') },
    { id: 'feedback', href: '/dashboard/admin/feedback', label: 'Feedback', Icon: roleIcon('message') },
    { id: 'settings', href: '/dashboard/admin/settings', label: 'Settings', Icon: roleIcon('user') },
  ]

  const roleItems: Record<RoleBarKind, ItemDef[]> =
    { ARTIST: artistItems, ORGANISER: organiserItems, VENUE_OWNER: venueOwnerItems, ADMIN: adminItems }
  const roleMoreItems: Record<RoleBarKind, MoreItemDef[]> =
    { ARTIST: [], ORGANISER: organiserMoreItems, VENUE_OWNER: venueOwnerMoreItems, ADMIN: adminMoreItems }

  let items: ItemDef[]
  let activeId: string | null
  let moreItems: MoreItemDef[] = []
  let moreActive = false

  if (barState.kind === 'primary') {
    items = primaryItems
    activeId = barState.active
  } else if (barState.kind === 'discover') {
    items = discoverItems
    activeId = barState.active
  } else {
    items = roleItems[barState.role]
    activeId = barState.active
    moreItems = roleMoreItems[barState.role]
    moreActive = !!barState.active && moreItems.some((m) => m.id === barState.active)
  }

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 flex items-stretch justify-around"
        style={{
          background: 'var(--afa-scrim-strong)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid var(--afa-tint-08)',
          zIndex: 40,
          paddingLeft: 'var(--afa-space-2)',
          paddingRight: 'var(--afa-space-2)',
          paddingTop: 'var(--afa-space-2)',
          paddingBottom: 'calc(var(--afa-space-2) + env(safe-area-inset-bottom))',
        }}
      >
        {items.map((item) => {
          const active = item.id === activeId
          return (
            <Link
              key={item.id}
              href={item.href}
              replace={item.nav === 'replace'}
              className="relative flex flex-1 flex-col items-center gap-1 py-1.5"
              style={{ color: active ? 'var(--afa-selected)' : 'var(--afa-text-primary)', opacity: active ? 1 : 0.55 }}
            >
              <span style={{ position: 'relative', display: 'inline-flex' }}>
                <item.Icon style={{ width: 22, height: 22 }} filled={item.id === 'saved' && active} />
                {!!item.badge && item.badge > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -6,
                      fontSize: 'var(--afa-text-caption)',
                      fontWeight: 700,
                      color: 'var(--afa-on-fill-solid)',
                      background: 'var(--afa-fill-solid)',
                      borderRadius: 'var(--afa-radius-pill)',
                      padding: '1px 5px', // token-ok(spacing-literal): 5px odd value, no exact token (GEN-2609-107)
                      minWidth: 15,
                      textAlign: 'center',
                      lineHeight: 1.4,
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--afa-text-caption)',
                  fontWeight: active ? 600 : 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                {item.label}
              </span>
            </Link>
          )
        })}

        {moreItems.length > 0 && (
          <Button
            // bare-reason: tab-bar slot that must match its sibling tab items, which are <Link>s styled by the same Tailwind classes, not Buttons
            variant="bare"
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center gap-1 py-1.5"
            style={{ color: moreActive ? 'var(--afa-selected)' : 'var(--afa-text-primary)', opacity: moreActive ? 1 : 0.55 }}
          >
            <DashboardIcon name="more" size={22} />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--afa-text-caption)',
                fontWeight: moreActive ? 600 : 500,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {moreLabel}
            </span>
          </Button>
        )}
      </nav>

      {moreOpen && moreItems.length > 0 && (
        <div className="lg:hidden fixed inset-0" style={{ zIndex: 50 }}>
          <div className="absolute inset-0" style={{ background: 'var(--afa-scrim)' }} onClick={() => setMoreOpen(false)} />
          <div
            ref={moreSheetRef}
            className="absolute bottom-0 left-0 right-0 rounded-t-2xl overflow-y-auto"
            style={{ background: 'var(--afa-surface-inverse)', maxHeight: '75vh', paddingBottom: 'calc(var(--afa-space-4) + env(safe-area-inset-bottom))' }}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--afa-tint-08)' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-lead)', color: 'var(--afa-text-primary)' }}>{moreLabel}</span>
              <Button
                variant="icon"
                onClick={() => setMoreOpen(false)}
                aria-label={closeLabel}
                style={{ color: 'var(--afa-text-primary)', opacity: 0.7 }}
              >
                <DashboardIcon name="x" size={20} />
              </Button>
            </div>
            <div className="p-2">
              {moreItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  replace
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-3"
                  style={{
                    color: item.id === activeId ? 'var(--afa-selected)' : 'var(--afa-text-primary)',
                    background: item.id === activeId ? 'var(--afa-selected-bg)' : 'transparent',
                    fontWeight: item.id === activeId ? 600 : 400,
                    textDecoration: 'none',
                  }}
                >
                  <item.Icon style={{ width: 20, height: 20 }} />
                  <span style={{ fontSize: 'var(--afa-text-body-lg)' }}>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
