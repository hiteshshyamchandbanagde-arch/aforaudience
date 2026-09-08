'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useLocale } from '@/lib/i18n/translate'
import { DiscoverTabIcon, TicketsTabIcon, SavedTabIcon, ProfileTabIcon } from '@/components/icons/MobileTabIcons'

// Mobile Redesign Phase 1 (GEN-2609-003) - persistent bottom tab bar for
// the 4 public tab roots (Discover/events, Tickets, Saved, Profile),
// ported from the Figma Make export's nav.tsx (BottomNav). Deliberately
// NOT the prototype's always-mounted client-tab pattern (src/App.tsx):
// this app needs real, deep-linkable URLs per tab, so each tab is a real
// Next.js route and switching is a normal client-side navigation
// (already fast/flash-free via next/link prefetching) rather than a
// parallel-routes-based persistent shell - the latter would need
// non-trivial architecture this codebase doesn't use anywhere else, for
// a benefit (avoiding a remount) the existing routes don't need.
//
// Mounted once in the root layout (see layout.tsx) rather than per-page,
// so it never has to be wired into new pages by hand - it self-gates by
// pathname below. Visibility below the `lg` breakpoint mirrors
// DashboardShell.tsx's own mobile/desktop split (the only other
// `lg:hidden` usage in this codebase), not a new breakpoint convention.
//
// GEN-2609-013 (7 Sep) - this bar now shows on all 4 tab roots for
// everyone, signed in or not. /tickets and /profile used to be
// guest-only: DashboardShell wraps those two routes (and only those two,
// outside /dashboard/*) with its own mobile bottom bar for signed-in
// users, and showing both at once would stack two fixed bottom bars. That
// guest-only carve-out was flagged open since GEN-2609-003 and never
// signed off - Hitesh + chat closed it 7 Sep in favor of one consistent
// bar everywhere. DashboardShell.tsx now suppresses its own bar on
// exactly these 2 routes instead (see that file's own comment), and
// profile/page.tsx recovers the Dashboard/Messages links signed-in users
// would otherwise lose from DashboardShell's bar. /events and /saved
// never hit DashboardShell, so they were never part of this exception.
//
// GEN-2609-017 (8 Sep) - '/' added per Hitesh's explicit instruction:
// homepage stays the default landing page on mobile (reverses
// GEN-2609-014's same-day redirect-to-/events) and now carries this same
// bar for nav consistency with the other 4 routes. None of the 4 tab
// hrefs equal '/', so isActive below naturally leaves every tab
// unhighlighted on the homepage - exactly the "no tab highlighted"
// behavior Hitesh asked for, no extra logic needed.
const GLOBAL_TAB_ROOTS = ['/', '/events', '/tickets', '/saved', '/profile'] as const

type TabDef = {
  href: string
  label: string
  Icon: typeof DiscoverTabIcon
}

export default function MobileTabBar() {
  const rawPathname = usePathname()
  const { status } = useSession()
  const { t } = useLocale()

  // next.config.ts sets trailingSlash: true, so usePathname() returns
  // "/saved/" not "/saved" - normalize before matching against the exact
  // 4 tab roots below (and against each Link's own href, for the active
  // tab). DashboardShell.tsx's isActive() doesn't need this - its
  // prefix-match (`pathname.startsWith(e.href + '/')`) happens to catch
  // the trailing-slash case as a side effect; this bar's exact-match
  // approach needs it explicit.
  const pathname = rawPathname && rawPathname !== '/' ? rawPathname.replace(/\/$/, '') : rawPathname

  const isGlobalRoot = (GLOBAL_TAB_ROOTS as readonly string[]).includes(pathname ?? '')
  const shouldRender = status !== 'loading' && isGlobalRoot

  // Reserves body scroll space so this bar's fixed position never covers
  // page content - see the `.afa-mobile-tab-bar-active` rule in
  // globals.css (mobile-only via @media, so desktop pages are untouched).
  // A body-level class rather than per-page padding since these 4 routes
  // have no shared layout.tsx to inject it from without also touching
  // /events/[id] (a pushed screen, not a tab root - see that route's own
  // layout.tsx for the separate push-transition treatment).
  useEffect(() => {
    document.body.classList.toggle('afa-mobile-tab-bar-active', shouldRender)
    return () => {
      document.body.classList.remove('afa-mobile-tab-bar-active')
    }
  }, [shouldRender])

  if (!shouldRender) return null

  // "Discover" and "Saved" have no existing i18n dictionary key (flagged
  // gap, not guessed - same call as DashboardShell's ROLE_SECTIONS labels
  // BUG-2609-006). Tickets/Profile reuse the real, already-translated
  // nav.myTickets/nav.profile strings rather than inventing new shorter
  // labels, even though the Figma export's own labels ("Tickets") read
  // more tersely - correctness across all 11 locales wins over matching
  // a disconnected prototype's exact text.
  const tabs: TabDef[] = [
    { href: '/events', label: 'Discover', Icon: DiscoverTabIcon },
    { href: '/tickets', label: t.nav.myTickets, Icon: TicketsTabIcon },
    { href: '/saved', label: 'Saved', Icon: SavedTabIcon },
    { href: '/profile', label: t.nav.profile, Icon: ProfileTabIcon },
  ]

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 flex items-stretch justify-around"
      style={{
        background: 'rgba(10,10,10,0.92)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(245,245,240,0.08)',
        zIndex: 40,
        paddingLeft: 8,
        paddingRight: 88, // reserves space for SupportWidget's floating bubble, same convention as DashboardShell's bar
        paddingTop: 8,
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
      }}
    >
      {tabs.map(({ href, label, Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-1 flex-col items-center gap-1 py-1.5"
            style={{ color: active ? 'var(--afa-fill-solid)' : 'var(--afa-text-primary)', opacity: active ? 1 : 0.55 }}
          >
            <Icon style={{ width: 22, height: 22 }} filled={href === '/saved' && active} />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: active ? 600 : 500,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
