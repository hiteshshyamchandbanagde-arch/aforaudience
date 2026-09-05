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
// Role sections are gated on but NOT wired to anything yet - their items
// are inert placeholders (no href/onClick) since the target pages either
// don't exist yet or haven't had this shell applied. Do not add links
// here until those pages exist.
const SIDEBAR_BORDER = '1px solid rgba(245,245,240,0.08)'

type IconName =
  | 'dashboard' | 'ticket' | 'message' | 'user' | 'calendar' | 'plus'
  | 'map' | 'trendUp' | 'dollarSign' | 'briefcase' | 'building' | 'music'
  | 'grid' | 'more' | 'x'

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
    default:
      return null
  }
}

type RoleKey = 'ORGANISER' | 'ARTIST' | 'VENUE_OWNER'

type RoleSectionDef = {
  role: RoleKey
  icon: IconName
  items: { label: string; icon: IconName }[]
}

// Item labels are hardcoded English on purpose - these are inert
// placeholders (no working links yet, see module comment above) and this
// repo's i18n Dictionary type requires real, hand-written translations
// across all 11 locale files for any new key (no partial/fallback
// mechanism - see src/lib/i18n/translate.tsx). Same call as the profile
// page's skipped column-eyebrow labels (PR #554): guessing translations
// into languages with no real linguistic basis is worse than a flagged
// gap. Revisit with real copy once these items get real destinations.
const ROLE_SECTIONS: RoleSectionDef[] = [
  {
    role: 'ORGANISER',
    icon: 'briefcase',
    items: [
      { label: 'My Events', icon: 'calendar' },
      { label: 'Create Event', icon: 'plus' },
      { label: 'Tours', icon: 'map' },
      { label: 'Sales', icon: 'trendUp' },
      { label: 'Payouts', icon: 'dollarSign' },
    ],
  },
  {
    role: 'ARTIST',
    icon: 'music',
    items: [
      { label: 'Edit Profile', icon: 'user' },
      { label: 'My Events', icon: 'calendar' },
      { label: 'Corporate Inquiries', icon: 'briefcase' },
    ],
  },
  {
    role: 'VENUE_OWNER',
    icon: 'building',
    items: [
      { label: 'My Venues', icon: 'building' },
      { label: 'Bookings', icon: 'grid' },
      { label: 'Sales', icon: 'trendUp' },
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

function SidebarLink({ href, label, icon, active }: { href: string; label: string; icon: IconName; active: boolean }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors"
      style={{
        background: active ? 'rgba(201,151,58,0.12)' : 'transparent',
        color: active ? 'var(--afa-amber)' : 'var(--afa-text-primary)',
        opacity: active ? 1 : 0.75,
        fontWeight: active ? 600 : 400,
      }}
    >
      <Icon name={icon} size={16} />
      {label}
      {active && <span className="ml-auto h-1 w-1 rounded-full" style={{ background: 'var(--afa-amber)' }} />}
    </Link>
  )
}

function RoleSectionBlock({ section, roleLabel, dense }: { section: RoleSectionDef; roleLabel: string; dense?: boolean }) {
  return (
    <div className={dense ? undefined : 'pt-3 mt-1'} style={dense ? undefined : { borderTop: SIDEBAR_BORDER }}>
      <div className="flex items-center gap-2 px-3 mb-1.5" style={dense ? { paddingLeft: 0 } : undefined}>
        <span style={{ color: 'var(--afa-amber)' }}><Icon name={section.icon} size={dense ? 13 : 12} /></span>
        <span style={{ color: 'var(--afa-amber)', fontSize: dense ? 11 : 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {roleLabel}
        </span>
      </div>
      <div className={dense ? 'space-y-0.5' : undefined}>
        {section.items.map((item) => (
          // Inert on purpose - see module comment above.
          <span
            key={item.label}
            aria-disabled="true"
            className="flex items-center gap-3 rounded-lg px-3 text-left"
            style={{
              color: 'var(--afa-text-primary)',
              opacity: 0.45,
              fontSize: dense ? 14 : 12.5,
              cursor: 'default',
              paddingTop: dense ? 12 : 8,
              paddingBottom: dense ? 12 : 8,
            }}
          >
            <Icon name={item.icon} size={dense ? 16 : 14} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { t } = useLocale()
  const held = useHeldRoles()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const topNav: { href: string; label: string; icon: IconName }[] = [
    { href: '/dashboard/audience', label: t.nav.dashboard, icon: 'dashboard' },
    { href: '/tickets', label: t.nav.myTickets, icon: 'ticket' },
    { href: '/dashboard/messages', label: t.nav.messages, icon: 'message' },
    { href: '/profile', label: t.nav.profile, icon: 'user' },
  ]

  const roleLabelFor: Record<RoleKey, string> = {
    ORGANISER: t.roles.ORGANISER,
    ARTIST: t.roles.ARTIST,
    VENUE_OWNER: t.roles.VENUE_OWNER,
  }
  const roleSections = ROLE_SECTIONS.filter((s) => held[s.role])

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/') || false

  return (
    <div className="lg:flex" style={{ background: 'var(--afa-surface-page)' }}>
      <aside
        className="hidden lg:flex flex-col flex-shrink-0"
        style={{ width: 220, borderRight: SIDEBAR_BORDER, background: 'var(--afa-surface-inverse)' }}
      >
        <div className="flex-1 p-3">
          <div className="mb-4 space-y-1">
            {topNav.map((item) => (
              <SidebarLink key={item.href} href={item.href} label={item.label} icon={item.icon} active={isActive(item.href)} />
            ))}
          </div>
          {roleSections.map((section) => (
            <RoleSectionBlock key={section.role} section={section} roleLabel={roleLabelFor[section.role]} />
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
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 rounded-lg px-3 py-1.5"
              style={{ color: active ? 'var(--afa-amber)' : 'var(--afa-text-primary)', opacity: active ? 1 : 0.7 }}
            >
              <Icon name={item.icon} size={20} />
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
                <RoleSectionBlock key={section.role} section={section} roleLabel={roleLabelFor[section.role]} dense />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
