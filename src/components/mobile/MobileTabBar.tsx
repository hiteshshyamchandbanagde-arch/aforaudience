'use client'

import { useEffect, useState } from 'react'
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
import { useBadgeCounts, getShellDashboardLink } from '@/components/DashboardShell'

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
// the bar's entire visual state (which row - primary or Discover's sub-
// nav - and which item is active) is a pure function of `usePathname()`,
// nothing else. There is no separate "which level am I on" state to keep
// in sync: navigating via the bar's own taps, a Link elsewhere on the
// page, or the browser's native back/forward button all change the URL,
// and the bar re-derives its correct row from that on the next render
// either way. This is what makes native back "just work" with no custom
// back-chevron UI (confirmed 9 Sep) - back is real browser history, the
// bar has nothing of its own to unwind.

type PrimaryTab = 'messages' | 'tickets' | 'saved' | 'profile'
type DiscoverSub = 'events' | 'artists' | 'venues' | 'wall-of-fame'

type BarState =
  | { kind: 'primary'; active: PrimaryTab | null }
  | { kind: 'discover'; active: DiscoverSub }
  | { kind: 'hidden' }

// Route -> bar state. Exact-match only (same as the Phase 1 bar this
// replaces) - dynamic/pushed routes like /events/[id] deliberately fall
// through to 'hidden', same as before.
//
// /dashboard/messages is the only /dashboard/* route this bar renders
// on. Every OTHER /dashboard/* route (organiser/venue/artist/admin, and
// the /dashboard/audience placeholder Discover's own Dashboard item
// lands on) is deliberately left alone this phase - DashboardShell.tsx's
// own existing mobile bottom bar (topNav + role-section "More" drawer)
// keeps covering those exactly as it does today. Role-specific bars are
// Phase C's job; building a "Dashboard" stub state here with no real
// role items behind it would either duplicate DashboardShell's bar or
// strand Organiser/Venue Owner/Artist users' only mobile path to their
// own role pages (Create Event, My Venues, Sales, etc.) for a full phase
// - not a trade worth making for a placeholder. See DashboardShell.tsx's
// own comment (this phase's one edit there) for the other half of this.
function deriveBarState(pathname: string | null): BarState {
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
    case '/events':
      return { kind: 'discover', active: 'events' }
    case '/artists':
      return { kind: 'discover', active: 'artists' }
    case '/venues':
      return { kind: 'discover', active: 'venues' }
    case '/wall-of-fame':
      return { kind: 'discover', active: 'wall-of-fame' }
    default:
      return { kind: 'hidden' }
  }
}

type ItemDef = {
  id: string
  href: string
  label: string
  Icon: typeof DiscoverTabIcon
  badge?: number
  // primary-tab siblings (Messages/Tickets/Saved/Profile) use replace -
  // switching between them is a lateral move within the same nav level,
  // not a descent, so it shouldn't grow the back-stack (same "update tab
  // in place" semantics the Figma reference's resolveNavAction uses for
  // its own in-memory stack, translated to real router history). Discover
  // (from primary) and every Discover-sub item use push - both are
  // explicit dispatch instructions: Discover descends a level, and each
  // Discover-sub item is a real distinct page a user may legitimately
  // want to back out of individually (Events -> Artists -> back to
  // Events, not straight to whatever primary tab was active before).
  nav: 'push' | 'replace'
}

export default function MobileTabBar() {
  const rawPathname = usePathname()
  const { data: session, status } = useSession()
  const { t } = useLocale()
  const { unreadCount } = useBadgeCounts()

  const barState = deriveBarState(rawPathname)

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

  useEffect(() => {
    const shouldRender = status !== 'loading' && barState.kind !== 'hidden'
    document.body.classList.toggle('afa-mobile-tab-bar-active', shouldRender)
    return () => {
      document.body.classList.remove('afa-mobile-tab-bar-active')
    }
  }, [status, barState.kind])

  if (status === 'loading' || barState.kind === 'hidden') return null

  const dashboardHref = getShellDashboardLink((session?.user as { role?: string } | undefined)?.role)

  // "Discover" and "Saved" have no existing i18n dictionary key (flagged
  // gap, not guessed - same call as the Phase 1 bar this replaces and
  // DashboardShell's ROLE_SECTIONS labels, BUG-2609-006). Everything else
  // reuses real, already-translated nav.* strings.
  const primaryItems: ItemDef[] = [
    { id: 'discover', href: '/events', label: 'Discover', Icon: DiscoverTabIcon, nav: 'push' },
    { id: 'messages', href: '/dashboard/messages', label: t.nav.messages, Icon: MessagesTabIcon, badge: unreadCount, nav: 'replace' },
    { id: 'tickets', href: '/tickets', label: t.nav.myTickets, Icon: TicketsTabIcon, nav: 'replace' },
    { id: 'saved', href: '/saved', label: 'Saved', Icon: SavedTabIcon, badge: savedCount, nav: 'replace' },
    { id: 'profile', href: '/profile', label: t.nav.profile, Icon: ProfileTabIcon, nav: 'replace' },
  ]

  const discoverItems: ItemDef[] = [
    { id: 'events', href: '/events', label: 'Events', Icon: EventsTabIcon, nav: 'push' },
    { id: 'artists', href: '/artists', label: t.nav.artists, Icon: ArtistsTabIcon, nav: 'push' },
    { id: 'venues', href: '/venues', label: t.nav.venues, Icon: PinIcon, nav: 'push' },
    { id: 'wall-of-fame', href: '/wall-of-fame', label: t.nav.wallOfFame, Icon: TrophyIcon, nav: 'push' },
    // GEN-2609-019 Phase C builds the real role-specific destination and
    // bar; for this phase, tapping Dashboard is a placeholder landing on
    // whichever route the signed-in user's role already resolves to
    // (same getShellDashboardLink SiteNav/DashboardShell/profile's Quick
    // Links already use), always push - it's a real descent, and native
    // back from there should return to whichever Discover sub-item was
    // active, not skip past it.
    { id: 'dashboard', href: dashboardHref, label: t.nav.dashboard, Icon: DashboardMorphTabIcon, nav: 'push' },
  ]

  const items = barState.kind === 'primary' ? primaryItems : discoverItems
  const activeId = barState.active

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 flex items-stretch justify-around"
      style={{
        background: 'rgba(10,10,10,0.92)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(245,245,240,0.08)',
        zIndex: 40,
        paddingLeft: 8,
        paddingRight: 88, // reserves space for SupportWidget's floating bubble, same convention as before
        paddingTop: 8,
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
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
            style={{ color: active ? 'var(--afa-fill-solid)' : 'var(--afa-text-primary)', opacity: active ? 1 : 0.55 }}
          >
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <item.Icon style={{ width: 22, height: 22 }} filled={item.id === 'saved' && active} />
              {!!item.badge && item.badge > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -6,
                    fontSize: 9,
                    fontWeight: 700,
                    color: 'var(--afa-on-fill-solid)',
                    background: 'var(--afa-fill-solid)',
                    borderRadius: 999,
                    padding: '1px 5px',
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
                fontSize: 10,
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
    </nav>
  )
}
