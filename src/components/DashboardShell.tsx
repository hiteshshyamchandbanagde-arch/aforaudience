'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useLocale } from '@/lib/i18n/translate'

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
const SIDEBAR_BORDER = '1px solid rgba(245,245,240,0.08)'

type IconName =
  | 'dashboard' | 'ticket' | 'message' | 'user' | 'calendar' | 'plus'
  | 'map' | 'trendUp' | 'dollarSign' | 'briefcase' | 'building' | 'music'
  | 'grid' | 'more' | 'x' | 'tag'

function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'dashboard':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      )
    case 'ticket':
      return (<svg {...common}><path d="M15 5H9a2 2 0 0 0-2 2v.5a2.5 2.5 0 0 1 0 5V13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-.5a2.5 2.5 0 0 1 0-5V7a2 2 0 0 0-2-2z" /></svg>)
    case 'message':
      return (<svg {...common}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>)
    case 'user':
      return (<svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>)
    case 'calendar':
      return (<svg {...common}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>)
    case 'plus':
      return (<svg {...common}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>)
    case 'map':
      return (<svg {...common}><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" /><line x1="9" y1="3" x2="9" y2="18" /><line x1="15" y1="6" x2="15" y2="21" /></svg>)
    case 'trendUp':
      return (<svg {...common}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>)
    case 'dollarSign':
      return (<svg {...common}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>)
    case 'briefcase':
      return (<svg {...common}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>)
    case 'building':
      return (<svg {...common}><rect x="4" y="2" width="16" height="20" /><path d="M9 22V12h6v10" /><rect x="8" y="6" width="3" height="3" /><rect x="13" y="6" width="3" height="3" /></svg>)
    case 'music':
      return (<svg {...common}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>)
    case 'grid':
      return (<svg {...common}><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" /></svg>)
    case 'more':
      return (<svg {...common}><circle cx="12" cy="5" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="19" r="1" fill="currentColor" /></svg>)
    case 'x':
      return (<svg {...common}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>)
    case 'tag':
      return (<svg {...common}><path d="M12.59 2.59 20.41 10.41a2 2 0 0 1 0 2.83l-6.17 6.17a2 2 0 0 1-2.83 0L3.59 11.59A2 2 0 0 1 3 10.17V4a2 2 0 0 1 2-2h6.17a2 2 0 0 1 1.42.59Z" /><circle cx="7.5" cy="7.5" r="0.5" fill="currentColor" /></svg>)
    default:
      return null
  }
}

type RoleKey = 'ORGANISER' | 'ARTIST' | 'VENUE_OWNER'

type BadgeKey = 'venueBookings' | 'flexRequests'

type RoleSectionDef = {
  role: RoleKey
  icon: IconName
  items: { label: string; icon: IconName; href: string; badgeKey?: BadgeKey }[]
}

// BUG-2609-006: these were built as inert placeholders on a wrong claim
// that the target pages didn't exist yet - all 11 are real, already-built
// pages. Item labels stay hardcoded English (this repo's i18n Dictionary
// type requires real, hand-written translations across all 11 locale
// files for any new key - see src/lib/i18n/translate.tsx - and guessing
// translations is worse than a flagged gap, same call as the profile
// page's skipped column-eyebrow labels from PR #554), but the links
// themselves are now real.
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
const ROLE_SECTIONS: RoleSectionDef[] = [
  {
    role: 'ORGANISER',
    icon: 'briefcase',
    items: [
      { label: 'My Events', icon: 'calendar', href: '/dashboard/organiser' },
      { label: 'Create Event', icon: 'plus', href: '/dashboard/organiser/events/create' },
      { label: 'Tours', icon: 'map', href: '/dashboard/organiser/tours' },
      { label: 'Sales', icon: 'trendUp', href: '/dashboard/organiser/sales' },
      { label: 'Payouts', icon: 'dollarSign', href: '/dashboard/organiser/payouts' },
      { label: 'Edit Profile', icon: 'user', href: '/dashboard/organiser/edit' },
      { label: 'Flexible Requests', icon: 'tag', href: '/dashboard/venue-requests', badgeKey: 'flexRequests' },
    ],
  },
  {
    role: 'ARTIST',
    icon: 'music',
    items: [
      { label: 'Edit Profile', icon: 'user', href: '/dashboard/artist/edit' },
      { label: 'My Events', icon: 'calendar', href: '/dashboard/artist/events' },
      { label: 'Corporate Inquiries', icon: 'briefcase', href: '/dashboard/artist/corporate-inquiries' },
    ],
  },
  {
    role: 'VENUE_OWNER',
    // Was 'building', identical to this section's own "My Venues" item
    // icon below (BUG-2609-011) - reads as just another row instead of a
    // category label. 'map' isn't used by any of this section's items.
    icon: 'map',
    items: [
      { label: 'My Venues', icon: 'building', href: '/dashboard/venue' },
      // BUG-2609-013: was an icon-only "+" affordance next to the section
      // header (BUG-2609-010 Part 1) - reversed as confusing; a normal
      // SidebarLink row is the same treatment ORGANISER's "Create Event"
      // already gets right after its own primary listing item, and that
      // one hasn't been flagged.
      { label: 'Register Venue', icon: 'plus', href: '/dashboard/venue/create' },
      { label: 'Bookings', icon: 'grid', href: '/dashboard/venue/bookings', badgeKey: 'venueBookings' },
      { label: 'Sales', icon: 'trendUp', href: '/dashboard/venue/sales' },
      { label: 'Account Settings', icon: 'user', href: '/dashboard/venue/edit' },
      { label: 'Flexible Requests', icon: 'tag', href: '/dashboard/venue-requests', badgeKey: 'flexRequests' },
    ],
  },
]

// Mirrors the profile page's loadStatuses() calls (src/app/profile/page.tsx)
// - same three status endpoints, same "check profile existence directly"
// approach, since an account's held roles are independent of whichever
// single role is currently active (see each route's own comment for why).
function useHeldRoles(): Record<RoleKey, boolean> {
  const { data: session } = useSession()
  const [held, setHeld] = useState<Record<RoleKey, boolean>>({
    ORGANISER: false,
    ARTIST: false,
    VENUE_OWNER: false,
  })

  useEffect(() => {
    if (!session?.user) return
    let cancelled = false
    Promise.all([
      fetch('/api/organisers/status').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/artists/status').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/venue-owners/status').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([org, artist, venue]) => {
      if (cancelled) return
      setHeld({
        ORGANISER: !!org?.hasProfile,
        ARTIST: !!artist?.hasProfile,
        VENUE_OWNER: !!venue?.hasProfile,
      })
    })
    return () => {
      cancelled = true
    }
  }, [session?.user])

  return held
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
function useBadgeCounts(): { pendingCount: number; unreadCount: number; pendingCompanionCount: number; venueBookingsPending: number; flexRequestsPending: number } {
  const { data: session } = useSession()
  const user = session?.user as { email?: string | null; role?: string } | undefined

  const [pendingCount, setPendingCount] = useState(0)
  useEffect(() => {
    if (user?.role !== 'VENUE_OWNER' && user?.role !== 'ORGANISER') return
    let cancelled = false
    fetch('/api/notifications/pending-count')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled && data) setPendingCount(data.count) })
      .catch(() => {})
    return () => { cancelled = true }
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

  const [flexRequestsPending, setFlexRequestsPending] = useState(0)
  useEffect(() => {
    if (user?.role !== 'VENUE_OWNER' && user?.role !== 'ORGANISER') return
    let cancelled = false
    fetch('/api/venue-booking-requests')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled && Array.isArray(data)) setFlexRequestsPending(data.filter((r: { status: string }) => r.status === 'PENDING').length) })
      .catch(() => {})
    return () => { cancelled = true }
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

  return { pendingCount, unreadCount, pendingCompanionCount, venueBookingsPending, flexRequestsPending }
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

function getShellDashboardLink(role?: string): string {
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
        background: active ? 'rgba(201,151,58,0.12)' : 'transparent',
        color: active ? 'var(--afa-amber)' : 'var(--afa-text-primary)',
        opacity: active ? 1 : 0.75,
        fontWeight: active ? 600 : 400,
        ...(compact ? { fontSize: 12.5, paddingTop: 8, paddingBottom: 8 } : {}),
      }}
    >
      <Icon name={icon} size={compact ? 14 : 16} />
      {label}
      {badge && badge > 0 ? (
        <span
          className="ml-auto"
          style={{ fontSize: 11, fontWeight: 700, color: 'var(--afa-on-fill-solid)', background: 'var(--afa-amber)', borderRadius: 999, padding: '2px 7px', lineHeight: 1.3 }}
        >
          {badge}
        </span>
      ) : (
        active && <span className="ml-auto h-1 w-1 rounded-full" style={{ background: 'var(--afa-amber)' }} />
      )}
    </Link>
  )
}

function RoleSectionBlock({ section, roleLabel, isActive, badgeFor, dense, onNavigate }: { section: RoleSectionDef; roleLabel: string; isActive: (id: string) => boolean; badgeFor: (key?: BadgeKey) => number | undefined; dense?: boolean; onNavigate?: () => void }) {
  return (
    <div className={dense ? undefined : 'pt-3 mt-1'} style={dense ? undefined : { borderTop: SIDEBAR_BORDER }}>
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
            label={item.label}
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
  const { pendingCount, unreadCount, pendingCompanionCount, venueBookingsPending, flexRequestsPending } = useBadgeCounts()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const badgeFor = (key?: BadgeKey): number | undefined =>
    key === 'venueBookings' ? venueBookingsPending : key === 'flexRequests' ? flexRequestsPending : undefined

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
  }
  const roleSections = ROLE_SECTIONS.filter((s) => held[s.role])

  // Every entry registered for this session, across all 3 nav surfaces
  // below (desktop sidebar, mobile drawer, mobile bottom bar share this
  // one resolution) - see resolveActiveId above.
  const allEntries: NavEntry[] = [
    ...topNav.map((i) => ({ id: `top:${i.href}`, href: i.href })),
    ...roleSections.flatMap((s) => s.items.map((i) => ({ id: `role:${s.role}:${i.href}`, href: i.href }))),
  ]
  const activeId = resolveActiveId(pathname, allEntries)
  const isActive = (id: string) => id === activeId

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
            <RoleSectionBlock key={section.role} section={section} roleLabel={roleLabelFor[section.role]} isActive={isActive} badgeFor={badgeFor} />
          ))}
        </div>
      </aside>

      <div className="flex-1 min-w-0 pb-20 lg:pb-0">{children}</div>

      {/* Mobile bottom tab bar. paddingRight reserves space for
          SupportWidget's floating chat bubble (fixed, right:20/bottom:20,
          56px, zIndex 45 - above this bar's zIndex 40) so the last tab
          isn't rendered underneath it and doesn't eat its taps. */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 flex items-center justify-around px-2 py-2"
        style={{ background: 'var(--afa-surface-inverse)', borderTop: SIDEBAR_BORDER, zIndex: 40, paddingRight: 88, paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }}
      >
        {topNav.map((item) => {
          const active = isActive(`top:${item.href}`)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 rounded-lg px-3 py-1.5"
              style={{ color: active ? 'var(--afa-amber)' : 'var(--afa-text-primary)', opacity: active ? 1 : 0.7 }}
            >
              <span style={{ position: 'relative', display: 'inline-flex' }}>
                <Icon name={item.icon} size={20} />
                {/* was `item.badge && item.badge > 0 &&` - the classic JSX
                    footgun where a falsy-but-not-nullish 0 still renders as
                    a literal "0" text node next to the icon, visible for
                    every user whose count is genuinely zero. */}
                {!!item.badge && item.badge > 0 && (
                  <span
                    style={{ position: 'absolute', top: -4, right: -6, fontSize: 10, fontWeight: 700, color: 'var(--afa-on-fill-solid)', background: 'var(--afa-amber)', borderRadius: 999, padding: '1px 5px', minWidth: 15, textAlign: 'center', lineHeight: 1.4 }}
                  >
                    {item.badge}
                  </span>
                )}
              </span>
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{item.label}</span>
            </Link>
          )
        })}
        {roleSections.length > 0 && (
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="More"
            className="flex flex-col items-center gap-1 rounded-lg px-3 py-1.5"
            style={{ color: 'var(--afa-text-primary)', opacity: 0.7, background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <Icon name="more" size={20} />
            <span style={{ fontSize: 10 }}>More</span>
          </button>
        )}
      </nav>

      {/* Mobile "More" drawer - role sections only, matches desktop grouping */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0" style={{ zIndex: 50 }}>
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setDrawerOpen(false)} />
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-2xl overflow-y-auto"
            style={{ background: 'var(--afa-surface-inverse)', maxHeight: '75vh', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: SIDEBAR_BORDER }}>
              <span style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: 'var(--afa-text-primary)' }}>My Roles</span>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close"
                style={{ color: 'var(--afa-text-primary)', opacity: 0.7, background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <Icon name="x" size={20} />
              </button>
            </div>
            <div className="p-4 space-y-5">
              {roleSections.map((section) => (
                <RoleSectionBlock
                  key={section.role}
                  section={section}
                  roleLabel={roleLabelFor[section.role]}
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
