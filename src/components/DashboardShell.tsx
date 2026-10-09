'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useLocale, type Dictionary } from '@/lib/i18n/translate'
import { useHeldRoles } from '@/components/HeldRolesContext'
import Button from '@/components/ui/Button'
import { useModalSheet } from '@/lib/use-modal-sheet'
import { unifiedTabBarShows } from '@/components/mobile/tabBarRoutes'
import { BADGE_REFRESH_EVENT } from '@/lib/badge-refresh'
import { Icon, type IconName } from '@/components/Icon'

// Shared shell for the Audience-tier dashboard pages (Dashboard/My
// Activity, Messages, Tickets). Desktop: persistent 220px left sidebar,
// top tier of real links always present + one section per held role
// (Organiser/Artist/Venue Owner), gated by the same profile-existence
// checks the Profile page's apply flows already use. Mobile: bottom tab
// bar for the 4 top-tier items + a "More" drawer for the role sections.
// See docs/design.md, "Audience Dashboard Shell — Architecture Decision"
// (5 Sep 2026), ported from the Figma Make export's Sidebar/
// MobileBottomBar/MobileDrawer.
//
const SIDEBAR_BORDER = '1px solid var(--afa-tint-08)'

// The icon registry lives in components/Icon.tsx (BUG-2610-025); re-exported
// here for the callers that already import it from the shell.
export { Icon, type IconName } from '@/components/Icon'

// 'ADMIN' widens this purely for RoleSectionDef.role/RoleSectionBlock's
// active-key typing below - this type is module-private (never exported),
// so widening it can't affect HeldRoles (src/lib/held-roles.ts) or any
// other file. ADMIN_SECTION (below) deliberately stays out of the
// held-role-filtered ROLE_SECTIONS array; Admin is a single exclusive
// session.user.role, never an additive held role.
type RoleKey = 'ORGANISER' | 'ARTIST' | 'VENUE_OWNER' | 'ADMIN'

type BadgeKey = 'venueBookings' | 'flexRequestsOrganiser' | 'flexRequestsVenue' | 'adminFeedbackPending' | 'adminBookingsErrored'

// GEN-2610-007 - the held-role items name a dashboardChrome key (they are
// translated); Admin's items keep a plain English label (Admin stays English).
type ChromeLabel = keyof Dictionary['dashboardChrome']

type RoleSectionDef = {
  role: RoleKey
  icon: IconName
  items: { label?: string; labelKey?: ChromeLabel; icon: IconName; href: string; badgeKey?: BadgeKey }[]
}

// BUG-2609-006: these were built as inert placeholders on a wrong claim
// that the target pages didn't exist yet - all 11 are real, already-built
// pages. Item labels were hardcoded English until GEN-2610-007 (8 Oct):
// the Organiser/Artist/Venue Owner items now name a dashboardChrome key
// and render in the UI language; Admin's stay English.
//
// Organiser's "My Events" points at /dashboard/organiser itself, not
// /dashboard/organiser/events - that route doesn't exist (only
// /dashboard/organiser/events/create and /dashboard/organiser/events/[id]
// do). The base organiser dashboard page IS the events list ("Your
// Events" heading), the same overlap already specified for Venue Owner's
// "My Venues" -> /dashboard/venue below.
//
// BUG-2609-010: consolidated in each dashboard page's own action buttons
// (Edit Profile, Account Settings, Flexible Requests) so the sidebar is
// the single source of truth - see each page's own diff for the removed
// buttons/BackLinks. "Flexible Requests" is genuinely the same feature
// for both ORGANISER and VENUE_OWNER (src/app/dashboard/venue-requests/
// page.tsx is role-gated by callerSide, not two different pages), so it
// gets one sidebar entry per role rather than living in neither.
// Narrowed to the 3 held roles specifically (not the wider RoleKey that
// includes 'ADMIN') so `held[s.role]` below stays a valid HeldRoles
// index at the type level, not just at runtime.
const ROLE_SECTIONS: (Omit<RoleSectionDef, 'role'> & { role: 'ORGANISER' | 'ARTIST' | 'VENUE_OWNER' })[] = [
  {
    role: 'ORGANISER',
    icon: 'briefcase',
    items: [
      { labelKey: 'myEvents', icon: 'calendar', href: '/dashboard/organiser' },
      { labelKey: 'createEvent', icon: 'plus', href: '/dashboard/organiser/events/create' },
      { labelKey: 'tours', icon: 'map', href: '/dashboard/organiser/tours' },
      { labelKey: 'sales', icon: 'trendUp', href: '/dashboard/organiser/sales' },
      { labelKey: 'payouts', icon: 'dollarSign', href: '/dashboard/organiser/payouts' },
      { labelKey: 'editProfile', icon: 'user', href: '/dashboard/organiser/edit' },
      { labelKey: 'flexibleRequests', icon: 'tag', href: '/dashboard/venue-requests', badgeKey: 'flexRequestsOrganiser' },
    ],
  },
  {
    role: 'ARTIST',
    icon: 'music',
    items: [
      { labelKey: 'editProfile', icon: 'user', href: '/dashboard/artist/edit' },
      { labelKey: 'myEvents', icon: 'calendar', href: '/dashboard/artist/events' },
      { labelKey: 'corporateInquiries', icon: 'briefcase', href: '/dashboard/artist/corporate-inquiries' },
    ],
  },
  {
    role: 'VENUE_OWNER',
    // Was 'building', identical to this section's own "My Venues" item
    // icon below (BUG-2609-011) - reads as just another row instead of a
    // category label. 'map' isn't used by any of this section's items.
    icon: 'map',
    items: [
      { labelKey: 'myVenues', icon: 'building', href: '/dashboard/venue' },
      // BUG-2609-013: was an icon-only "+" affordance next to the section
      // header (BUG-2609-010 Part 1) - reversed as confusing; a normal
      // SidebarLink row is the same treatment ORGANISER's "Create Event"
      // already gets right after its own primary listing item, and that
      // one hasn't been flagged.
      { labelKey: 'registerVenue', icon: 'plus', href: '/dashboard/venue/create' },
      { labelKey: 'bookings', icon: 'grid', href: '/dashboard/venue/bookings', badgeKey: 'venueBookings' },
      { labelKey: 'sales', icon: 'trendUp', href: '/dashboard/venue/sales' },
      { labelKey: 'accountSettings', icon: 'user', href: '/dashboard/venue/edit' },
      { labelKey: 'flexibleRequests', icon: 'tag', href: '/dashboard/venue-requests', badgeKey: 'flexRequestsVenue' },
    ],
  },
]

// Admin's own section - deliberately NOT part of ROLE_SECTIONS (see the
// RoleKey comment above: held[s.role] would just silently drop this,
// since Admin is never a held role). Same order as the mobile nav
// (MobileTabBar.tsx's adminItems/adminMoreItems) for a consistent mental
// model across breakpoints.
const ADMIN_SECTION: RoleSectionDef = {
  role: 'ADMIN',
  icon: 'dashboard', // unused by RoleSectionBlock's render, same as every other role's section.icon - just satisfies the type
  items: [
    { label: 'Overview', icon: 'dashboard', href: '/dashboard/admin' },
    { label: 'Bookings', icon: 'ticket', href: '/dashboard/admin/bookings', badgeKey: 'adminBookingsErrored' },
    { label: 'Revenue', icon: 'dollarSign', href: '/dashboard/admin/revenue' },
    { label: 'Users', icon: 'user', href: '/dashboard/admin/users' },
    { label: 'Artists', icon: 'music', href: '/dashboard/admin/artists' },
    { label: 'Diary', icon: 'calendar', href: '/dashboard/admin/diary' },
    { label: 'Feedback', icon: 'message', href: '/dashboard/admin/feedback', badgeKey: 'adminFeedbackPending' },
    { label: 'Settings', icon: 'settings', href: '/dashboard/admin/settings' },
    // GEN-2609-076 - had no sidebar entry point at all since GEN-2609-075
    // shipped it; only reachable by typing the URL directly. No dedicated
    // palette/swatch icon exists in this file's Icon component - reusing
    // 'grid' (closest fit to "a grid of tokens") rather than adding a new
    // icon case for one nav item.
    { label: 'Design System', icon: 'grid', href: '/dashboard/admin/design-system' },
  ],
}

// BUG-2609-005: SiteNav's account dropdown (src/components/SiteNav.tsx,
// same 3 endpoints/gating around lines 186-226) already fetches these
// counts for its own icon badges, but filtering the dropdown down to just
// language/location/sign-out on shell pages (BUG-2609-004) removed the
// only place these badges rendered - the sidebar never had badge support.
// Kept as this file's own one-shot fetches rather than sharing SiteNav's
// state (they're siblings under each page, not parent/child, so sharing
// would mean lifting state into every page that renders both, or a new
// Context) - these are cheap one-shot status calls, not polling loops, so
// the small duplication is a fair trade against changing SiteNav's
// already-verified fetch logic.
// GEN-2609-013 - exported so profile/page.tsx's mobile "Quick links"
// group can recover the same Dashboard/Messages badge counts the bar
// below used to show on /profile, without recomputing them separately.
export function useBadgeCounts(): { pendingCount: number; unreadCount: number; pendingCompanionCount: number; venueBookingsPending: number; flexRequestsOrganiser: number; flexRequestsVenue: number; adminFeedbackPending: number; adminBookingsErrored: number } {
  const { data: session } = useSession()
  const user = session?.user as { email?: string | null; role?: string } | undefined

  const [pendingCount, setPendingCount] = useState(0)
  useEffect(() => {
    if (user?.role !== 'VENUE_OWNER' && user?.role !== 'ORGANISER') return
    let cancelled = false
    const load = () => {
      fetch('/api/notifications/pending-count')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => { if (!cancelled && data) setPendingCount(data.count) })
        .catch(() => {})
    }
    load()
    // BUG-2609-073 - an accept/counter/decline changes this total too.
    window.addEventListener(BADGE_REFRESH_EVENT, load)
    return () => {
      cancelled = true
      window.removeEventListener(BADGE_REFRESH_EVENT, load)
    }
  }, [user?.role])

  // BUG-2609-010: these per-item counts used to live on the Venue Owner/
  // Organiser dashboard pages' own "Booking Requests"/"Flexible Requests"
  // action buttons (same fetch-and-filter each page already did) - moved
  // here so the now-consolidated sidebar entries (ROLE_SECTIONS below)
  // keep the same signal instead of losing it to the aggregate Dashboard
  // badge (pendingCount, /api/notifications/pending-count) alone.
  const [venueBookingsPending, setVenueBookingsPending] = useState(0)
  useEffect(() => {
    if (user?.role !== 'VENUE_OWNER') return
    let cancelled = false
    fetch('/api/venues/my-bookings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled && Array.isArray(data)) setVenueBookingsPending(data.filter((b: { status: string }) => b.status === 'PENDING').length) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user?.role])

  // BUG-2609-073 - one count per held role (a user can be both an
  // Organiser and a Venue Owner), counting only the requests waiting on
  // this user's action on that side. Refetched when a page changes what
  // it counts (refreshBadgeCounts, lib/badge-refresh.ts) and when the tab
  // comes back into view, so the other side's action shows up too.
  const [flexRequestsWaiting, setFlexRequestsWaiting] = useState({ ORGANISER: 0, VENUE_OWNER: 0 })
  useEffect(() => {
    if (user?.role !== 'VENUE_OWNER' && user?.role !== 'ORGANISER' && user?.role !== 'ARTIST') return
    let cancelled = false
    const load = () => {
      fetch('/api/venue-booking-requests/waiting-count')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => { if (!cancelled && data) setFlexRequestsWaiting({ ORGANISER: data.ORGANISER ?? 0, VENUE_OWNER: data.VENUE_OWNER ?? 0 }) })
        .catch(() => {})
    }
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    load()
    window.addEventListener(BADGE_REFRESH_EVENT, load)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      window.removeEventListener(BADGE_REFRESH_EVENT, load)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [user?.role])

  const [unreadCount, setUnreadCount] = useState(0)
  useEffect(() => {
    if (!user?.email) return
    let cancelled = false
    fetch('/api/conversations/unread-count')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled && data) setUnreadCount(data.count) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user?.email])

  const [pendingCompanionCount, setPendingCompanionCount] = useState(0)
  useEffect(() => {
    if (!user?.email) return
    let cancelled = false
    fetch('/api/companions/pending-count')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled && data) setPendingCompanionCount(data.count) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user?.email])

  // Admin sidebar badges (ADMIN_SECTION below) - reuse existing endpoints
  // rather than building new ones. command-center's `kpis.pending` is
  // already NEW+UNDER_REVIEW feedback count. bookings' `counts.errored`
  // is computed via its own dedicated count query independent of the
  // status/limit params - status=errored&limit=1 shrinks the unneeded
  // detail array to one row without touching the count itself.
  const [adminFeedbackPending, setAdminFeedbackPending] = useState(0)
  useEffect(() => {
    if (user?.role !== 'ADMIN') return
    let cancelled = false
    fetch('/api/admin/command-center')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled && data) setAdminFeedbackPending(data.kpis?.pending ?? 0) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user?.role])

  const [adminBookingsErrored, setAdminBookingsErrored] = useState(0)
  useEffect(() => {
    if (user?.role !== 'ADMIN') return
    let cancelled = false
    fetch('/api/admin/bookings?status=errored&limit=1')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled && data) setAdminBookingsErrored(data.counts?.errored ?? 0) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user?.role])

  return { pendingCount, unreadCount, pendingCompanionCount, venueBookingsPending, flexRequestsOrganiser: flexRequestsWaiting.ORGANISER, flexRequestsVenue: flexRequestsWaiting.VENUE_OWNER, adminFeedbackPending, adminBookingsErrored }
}

// BUG-2609-007: the sidebar's own "Dashboard" link was hardcoded to
// /dashboard/audience regardless of the signed-in user's role - wrong for
// every non-Audience role using the shell. Mirrors SiteNav's
// getDashboardLink() (src/components/SiteNav.tsx) - same duplication
// tradeoff already made for useBadgeCounts() above, kept consistent
// rather than exporting/importing across the two files. ADMIN is
// deliberately left as a dead branch: /dashboard/admin/ is out of scope
// for this round and is never wrapped in this shell, so this case never
// actually fires - kept only so the switch mirrors SiteNav's exactly.
type NavEntry = { id: string; href: string }

// BUG-2609-012: was a per-item pathname.startsWith(href + '/') check, so
// every registered href that happened to be a string-prefix of the
// current pathname reported active at once (e.g. dashboardHref
// "/dashboard/organiser" prefixes "/dashboard/organiser/sales" - both lit
// up together). Resolves a single winner across every entry in play
// instead, identified by id rather than href alone: Organiser's/Venue
// Owner's own "My Events"/"My Venues" item deliberately shares its href
// with the top-nav Dashboard item (see ROLE_SECTIONS's own comment on
// this), so on those two routes' root page two entries tie on href
// length - the role-section entry (the more specific one, someone is
// literally looking at "My Events") wins that tie, topNav's generic
// Dashboard entry doesn't.
function resolveActiveId(pathname: string | null, entries: NavEntry[]): string | undefined {
  if (!pathname) return undefined
  let bestId: string | undefined
  let bestScore = -1
  for (const e of entries) {
    if (pathname === e.href || pathname.startsWith(e.href + '/')) {
      const score = e.href.length * 2 + (e.id.startsWith('role:') ? 1 : 0)
      if (score > bestScore) {
        bestScore = score
        bestId = e.id
      }
    }
  }
  return bestId
}

// GEN-2609-013 - exported so profile/page.tsx's mobile "Quick links"
// group can route to the same role-specific dashboard this shell's own
// topNav does, instead of hardcoding a route.
export function getShellDashboardLink(role?: string): string {
  switch (role) {
    case 'VENUE_OWNER':
      return '/dashboard/venue'
    case 'ARTIST':
      return '/dashboard/artist'
    case 'ORGANISER':
      return '/dashboard/organiser'
    case 'ADMIN':
      return '/dashboard/admin'
    default:
      return '/dashboard/audience'
  }
}

function SidebarLink({ href, label, icon, active, badge, compact }: { href: string; label: string; icon: IconName; active: boolean; badge?: number; compact?: boolean }) {
  return (
    <Link
      href={href}
      className={compact ? 'flex items-center gap-3 rounded-lg px-3 text-left transition-colors' : 'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors'}
      style={{
        background: active ? 'var(--afa-selected-bg)' : 'transparent',
        color: active ? 'var(--afa-selected)' : 'var(--afa-text-primary)',
        opacity: active ? 1 : 0.75,
        fontWeight: active ? 600 : 400,
        ...(compact ? { fontSize: 'var(--afa-text-ui)', paddingTop: 'var(--afa-space-2)', paddingBottom: 'var(--afa-space-2)' } : {}),
      }}
    >
      <Icon name={icon} size={compact ? 14 : 16} />
      {label}
      {badge && badge > 0 ? (
        <span
          className="ml-auto"
          style={{ fontSize: 'var(--afa-text-micro)', fontWeight: 700, color: 'var(--afa-on-fill-solid)', background: 'var(--afa-amber)', borderRadius: 'var(--afa-radius-pill)', padding: 'var(--afa-space-2px) 7px', lineHeight: 1.3 }} // token-ok(spacing-literal): 7px odd value, no exact token (GEN-2609-107)
        >
          {badge}
        </span>
      ) : (
        active && <span className="ml-auto h-1 w-1 rounded-full" style={{ background: 'var(--afa-selected)' }} />
      )}
    </Link>
  )
}

function RoleSectionBlock({ section, roleLabel, chrome, isActive, badgeFor, dense, onNavigate }: { section: RoleSectionDef; roleLabel: string; chrome: Dictionary['dashboardChrome']; isActive: (id: string) => boolean; badgeFor: (key?: BadgeKey) => number | undefined; dense?: boolean; onNavigate?: () => void }) {
  return (
    <div data-afa-role-section={section.role.toLowerCase()} className={dense ? undefined : 'pt-3 mt-1'} style={dense ? undefined : { borderTop: SIDEBAR_BORDER }}>
      {/* BUG-2609-011: no icon on this row (every real nav row below has
          one) is what marks it as a category label rather than a link -
          it used to carry section.icon, which for Venue Owner duplicated
          its own "My Venues" item icon and reinforced the opposite
          impression. */}
      <div className="flex items-center gap-2 px-3 mb-1.5" style={dense ? { paddingLeft: 0 } : undefined}>
        <span style={{ color: 'var(--afa-amber)', fontSize: dense ? 11 : 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {roleLabel}
        </span>
      </div>
      <div className={dense ? 'space-y-0.5' : undefined} onClick={onNavigate}>
        {section.items.map((item) => (
          <SidebarLink
            key={item.href}
            href={item.href}
            label={item.labelKey ? chrome[item.labelKey] : item.label ?? ''}
            icon={item.icon}
            active={isActive(`role:${section.role}:${item.href}`)}
            badge={badgeFor(item.badgeKey)}
            compact={!dense}
          />
        ))}
      </div>
    </div>
  )
}

export default function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { t } = useLocale()
  const { data: session } = useSession()
  const held = useHeldRoles()
  const { pendingCount, unreadCount, pendingCompanionCount, venueBookingsPending, flexRequestsOrganiser, flexRequestsVenue, adminFeedbackPending, adminBookingsErrored } = useBadgeCounts()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  useModalSheet(drawerOpen, drawerRef, () => setDrawerOpen(false), { label: t.dashboardChrome.myRoles })
  const badgeFor = (key?: BadgeKey): number | undefined =>
    key === 'venueBookings' ? venueBookingsPending
      : key === 'flexRequestsOrganiser' ? flexRequestsOrganiser
      : key === 'flexRequestsVenue' ? flexRequestsVenue
      : key === 'adminFeedbackPending' ? adminFeedbackPending
      : key === 'adminBookingsErrored' ? adminBookingsErrored
      : undefined

  // Admin is a single exclusive session.user.role, never an additive held
  // role - computed independently of `held`/HeldRoles, never added to it.
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'ADMIN'

  const dashboardHref = getShellDashboardLink((session?.user as { role?: string } | undefined)?.role)

  const topNav: { href: string; label: string; icon: IconName; badge?: number }[] = [
    { href: dashboardHref, label: t.nav.dashboard, icon: 'dashboard', badge: pendingCount },
    { href: '/tickets', label: t.nav.myTickets, icon: 'ticket', badge: pendingCompanionCount },
    { href: '/dashboard/messages', label: t.nav.messages, icon: 'message', badge: unreadCount },
    { href: '/profile', label: t.nav.profile, icon: 'user' },
  ]

  const roleLabelFor: Record<RoleKey, string> = {
    ORGANISER: t.roles.ORGANISER,
    ARTIST: t.roles.ARTIST,
    VENUE_OWNER: t.roles.VENUE_OWNER,
    // Hardcoded English, not routed through t.roles/the i18n Dictionary -
    // matches this file's own established precedent (see the comment
    // above ROLE_SECTIONS) that sidebar item/section labels stay
    // hand-written English for these admin-only, single-user surfaces
    // rather than adding a key across all 11 locale files for it.
    ADMIN: 'Admin',
  }
  const roleSections = ROLE_SECTIONS.filter((s) => held[s.role])

  // Every entry registered for this session, across all 3 nav surfaces
  // below (desktop sidebar, mobile drawer, mobile bottom bar share this
  // one resolution) - see resolveActiveId above.
  const allEntries: NavEntry[] = [
    ...topNav.map((i) => ({ id: `top:${i.href}`, href: i.href })),
    ...roleSections.flatMap((s) => s.items.map((i) => ({ id: `role:${s.role}:${i.href}`, href: i.href }))),
    ...(isAdmin ? ADMIN_SECTION.items.map((i) => ({ id: `role:ADMIN:${i.href}`, href: i.href })) : []),
  ]
  const activeId = resolveActiveId(pathname, allEntries)
  const isActive = (id: string) => id === activeId

  // MobileTabBar.tsx's unified bar owns the bottom of the screen on
  // mobile (GEN-2609-013 for /tickets and /profile, GEN-2609-019 for
  // messages and the four role dashboards). Rendering this component's
  // own bottom bar there too would stack two fixed bars, so it is
  // suppressed wherever that one shows.
  //
  // BUG-2609-084 - the route list that used to live here is gone: it and
  // MobileTabBar's own switch were two hand-kept copies, and a route in
  // neither (the organiser event detail page) got this component's bar
  // instead of the organiser one. Both now ask tabBarRoutes.ts. Every
  // page that renders this shell is mapped there, so this bar is only a
  // fallback for a future page that is added without a mapping.
  const hideMobileBarForUnifiedTabBar = unifiedTabBarShows(pathname, (session?.user as { role?: string } | undefined)?.role)

  return (
    <div className="lg:flex" style={{ background: 'var(--afa-surface-page)' }}>
      <aside
        className="hidden lg:flex flex-col flex-shrink-0"
        style={{ width: 220, borderRight: SIDEBAR_BORDER, background: 'var(--afa-surface-inverse)' }}
      >
        <div className="flex-1 p-3">
          <div className="mb-4 space-y-1">
            {topNav.map((item) => (
              <SidebarLink key={item.href} href={item.href} label={item.label} icon={item.icon} active={isActive(`top:${item.href}`)} badge={item.badge} />
            ))}
          </div>
          {roleSections.map((section) => (
            <RoleSectionBlock key={section.role} section={section} roleLabel={roleLabelFor[section.role]} chrome={t.dashboardChrome} isActive={isActive} badgeFor={badgeFor} />
          ))}
          {isAdmin && (
            <RoleSectionBlock section={ADMIN_SECTION} roleLabel={roleLabelFor.ADMIN} chrome={t.dashboardChrome} isActive={isActive} badgeFor={badgeFor} />
          )}
        </div>
      </aside>

      {/* GEN-2609-013 - this bottom padding exists to reserve scroll space
          for this component's own mobile bar below. On /tickets/profile
          that bar no longer renders - MobileTabBar.tsx's unified bar
          reserves its own space via the `.afa-mobile-tab-bar-active` body
          class instead (see that file), so adding pb-20 here too would
          double the reserved space into a visible empty gap. */}
      <div className={`flex-1 min-w-0 lg:pb-0${hideMobileBarForUnifiedTabBar ? '' : ' pb-20 afa-shell-bar-clearance'}`}>{children}</div>

      {/* Mobile bottom tab bar.
          GEN-2609-013 - suppressed on /tickets and /profile now that
          MobileTabBar.tsx covers those routes for everyone; see
          hideMobileBarForUnifiedTabBar above. Note this also removes the
          "More" role-sections drawer trigger below from mobile on those 2
          routes for held-role users, since that trigger lives inside this
          same bar - the brief didn't ask for a replacement entry point
          for that, so none was added; flagged in docs/design.md rather
          than guessed at. */}
      {!hideMobileBarForUnifiedTabBar && (
        <nav
          className="lg:hidden fixed bottom-0 left-0 right-0 flex items-center justify-around px-2 py-2"
          style={{ background: 'var(--afa-surface-inverse)', borderTop: SIDEBAR_BORDER, zIndex: 40, paddingBottom: 'calc(var(--afa-space-2) + env(safe-area-inset-bottom))' }}
        >
          {topNav.map((item) => {
            const active = isActive(`top:${item.href}`)
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-1 rounded-lg px-3 py-1.5"
                style={{ color: active ? 'var(--afa-selected)' : 'var(--afa-text-primary)', opacity: active ? 1 : 0.7 }}
              >
                <span style={{ position: 'relative', display: 'inline-flex' }}>
                  <Icon name={item.icon} size={20} />
                  {/* was `item.badge && item.badge > 0 &&` - the classic JSX
                      footgun where a falsy-but-not-nullish 0 still renders as
                      a literal "0" text node next to the icon, visible for
                      every user whose count is genuinely zero. */}
                  {!!item.badge && item.badge > 0 && (
                    <span
                      style={{ position: 'absolute', top: -4, right: -6, fontSize: 'var(--afa-text-caption)', fontWeight: 700, color: 'var(--afa-on-fill-solid)', background: 'var(--afa-amber)', borderRadius: 'var(--afa-radius-pill)', padding: '1px 5px', minWidth: 15, textAlign: 'center', lineHeight: 1.4 }} // token-ok(spacing-literal): 5px odd value, no exact token (GEN-2609-107)
                    >
                      {item.badge}
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 'var(--afa-text-caption)', fontWeight: active ? 600 : 400 }}>{item.label}</span>
              </Link>
            )
          })}
          {roleSections.length > 0 && (
            <Button
              // bare-reason: tab-bar slot that must match its sibling tab items, which are <Link>s styled by the same Tailwind classes, not Buttons
              variant="bare"
              onClick={() => setDrawerOpen(true)}
              aria-label={t.dashboardChrome.more}
              className="flex flex-col items-center gap-1 rounded-lg px-3 py-1.5"
              style={{ color: 'var(--afa-text-primary)', opacity: 0.7 }}
            >
              <Icon name="more" size={20} />
              <span style={{ fontSize: 'var(--afa-text-caption)' }}>{t.dashboardChrome.more}</span>
            </Button>
          )}
        </nav>
      )}

      {/* Mobile "More" drawer - role sections only, matches desktop grouping */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0" style={{ zIndex: 50 }}>
          <div className="absolute inset-0" style={{ background: 'var(--afa-scrim)' }} onClick={() => setDrawerOpen(false)} />
          <div
            ref={drawerRef}
            className="absolute bottom-0 left-0 right-0 rounded-t-2xl overflow-y-auto"
            style={{ background: 'var(--afa-surface-inverse)', maxHeight: '75vh', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: SIDEBAR_BORDER }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-lead)', color: 'var(--afa-text-primary)' }}>{t.dashboardChrome.myRoles}</span>
              <Button
                variant="icon"
                onClick={() => setDrawerOpen(false)}
                aria-label={t.dashboardChrome.close}
                style={{ color: 'var(--afa-text-primary)', opacity: 0.7 }}
              >
                <Icon name="x" size={20} />
              </Button>
            </div>
            <div className="p-4 space-y-5">
              {roleSections.map((section) => (
                <RoleSectionBlock
                  key={section.role}
                  section={section}
                  roleLabel={roleLabelFor[section.role]}
                  chrome={t.dashboardChrome}
                  isActive={isActive}
                  badgeFor={badgeFor}
                  dense
                  onNavigate={() => setDrawerOpen(false)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
