"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { signOut, useSession } from "next-auth/react"
import EnvBadge from "@/components/EnvBadge"
import SearchBox from "@/components/SearchBox"
import LocationChip from "@/components/LocationChip"
import { useLocale, type Dictionary } from "@/lib/i18n/translate"
import { LOCALES } from "@/lib/i18n/locales"

type NavLinkKey = "events" | "artists" | "venues" | "wall-of-fame"

type SiteNavProps = {
  /** Highlights the matching link as the current section. */
  active?: NavLinkKey
  /** "home" = fixed overlay nav used on the landing page hero. "page" = sticky nav used everywhere else. */
  variant?: "home" | "page"
  /** If set, replaces the Events/Artists/Venues links with a single "back" link (used on detail pages). */
  backHref?: string
  backLabel?: string
}

const NAV_LINKS: { key: NavLinkKey; href: string; label: string }[] = [
  { key: "events", href: "/events", label: "Events" },
  { key: "artists", href: "/artists", label: "Artists" },
  { key: "venues", href: "/venues", label: "Venues" },
  { key: "wall-of-fame", href: "/wall-of-fame", label: "Wall of Fame" },
]

function getDashboardLink(role?: string) {
  switch (role) {
    case "VENUE_OWNER":
      return "/dashboard/venue"
    case "ARTIST":
      return "/dashboard/artist"
    case "ORGANISER":
      return "/dashboard/organiser"
    case "ADMIN":
      return "/dashboard/admin"
    case "AUDIENCE":
      return "/dashboard/audience"
    default:
      return null
  }
}

// Feedback cmrxou0f6 (23 Jul): a user with more than one role (e.g.
// Artist + Venue Owner) wasn't sure which one was currently active just
// from the header - had to check the dashboard content itself. Small
// badge next to the greeting makes it explicit at a glance.
// Takes the translated roles dict (t.roles) rather than hardcoding English
// - Multi-language Phase 1 deepening.
function getRoleLabel(role: string | undefined, roles: Dictionary["roles"]) {
  switch (role) {
    case "VENUE_OWNER":
      return roles.VENUE_OWNER
    case "ARTIST":
      return roles.ARTIST
    case "ORGANISER":
      return roles.ORGANISER
    case "ADMIN":
      return roles.ADMIN
    case "AUDIENCE":
      return roles.AUDIENCE
    default:
      return null
  }
}

/**
 * Small env-label pill shown next to the logo.
 * Reads NEXT_PUBLIC_ENV_LABEL:
 *   - "Beta v1" on prod → muted grey pill
 *   - "QA" on preview   → ember-red pill
 *   - unset/empty       → renders nothing (safe fallback)
 * Any label containing "QA" (case-insensitive) gets the ember styling —
 * so future environments like "QA-staging" would still show as clearly non-prod.
 */


// Small line icons for the desktop account row (18x18, one stroke weight,
// no fill) - keeps the row visually light even with a label hidden.
// Labels aren't lost: aria-label carries them for assistive tech, and a
// custom hover tooltip (below) shows them on desktop pointer devices.
// The mobile dropdown panel keeps full text labels unchanged - hover
// doesn't exist on touch, and that panel has the full width to spare.
// navKey is a stable identifier ('dashboard' | 'messages' | 'myTickets' |
// 'profile'), separate from the display label - Multi-language Phase 1
// made accountLinks' labels translatable, so icon lookup can no longer
// switch on the (now locale-dependent) English label text.
function NavIcon({ navKey }: { navKey: string }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (navKey) {
    case 'dashboard':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" />
        </svg>
      )
    case 'messages':
      return (
        <svg {...common}>
          <path d="M4 5h16v11H9l-4 4V5z" />
        </svg>
      )
    case 'myTickets':
      return (
        <svg {...common}>
          <path d="M4 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.2a2 2 0 0 0 0 3.6V15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.2a2 2 0 0 0 0-3.6V9z" />
          <line x1="12.5" y1="7.5" x2="12.5" y2="16.5" strokeDasharray="2.2 2.2" />
        </svg>
      )
    case 'profile':
      return (
        <svg {...common}>
          <circle cx="12" cy="8.5" r="3.2" />
          <path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" />
        </svg>
      )
    default:
      return null
  }
}

export default function SiteNav({ active, variant = "page", backHref, backLabel }: SiteNavProps) {
  const isHome = variant === "home"
  const { data: session, status } = useSession()
  const user = session?.user as { name?: string | null; displayName?: string | null; email?: string | null; role?: string } | undefined
  const dashboardLink = user ? getDashboardLink(user.role) : null

  // Feedback cms1ibqtf - Venue Owner/Organiser dashboards already show
  // per-page pending-request badges, but only once you're already on that
  // page. This surfaces the same count from anywhere via the nav.
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
  // Feedback 45ac402a (29 Jul) - Messages had no nav entry point for
  // ANY role (confirmed via code - SiteNav's accountLinks never included
  // it, not an organiser-specific gap as first reported). Unlike
  // pendingCount above, this runs for every logged-in user since
  // conversations span Audience<->Organiser, Artist<->Organiser, and
  // Organiser<->Venue Owner - not role-restricted.
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
  const [mobileOpen, setMobileOpen] = useState(false)
  const mobilePanelRef = useRef<HTMLDivElement | null>(null)
  // BUG (3 Aug, live report): panel had no bounded height/scroll container
  // at all - fine while its content fit one screen, but Multi-language
  // Phase 1's Language section pushed it past the fold and the extra
  // content (Profile, Sign out) became permanently unreachable, with no
  // page-scroll fallback on the home-page variant since that nav is
  // position:fixed (taken out of normal document flow, so there's no
  // page height left to scroll into). Measures available viewport space
  // below the panel's own top edge and caps it there with overflow-y
  // auto, instead of guessing a fixed header-height pixel value that
  // would drift out of sync with real header content changes.
  const [panelMaxHeight, setPanelMaxHeight] = useState<number | undefined>(undefined)
  useEffect(() => {
    if (!mobileOpen) return
    const update = () => {
      if (mobilePanelRef.current) {
        setPanelMaxHeight(window.innerHeight - mobilePanelRef.current.getBoundingClientRect().top)
      }
    }
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [mobileOpen])
  // Swipe-up-to-close for the mobile dropdown panel (Feedback f1c26af4) -
  // previously only the X/hamburger button dismissed it; a swipe on the
  // panel just scrolled the page behind it instead. Simple vertical-delta
  // threshold, no gesture library needed for a single-direction dismiss.
  const touchStartY = useRef<number | null>(null)
  const SWIPE_CLOSE_THRESHOLD_PX = 40
  const handlePanelTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }
  const handlePanelTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return
    // Same fix as above, other half: an upward drag to scroll down through
    // overflowing content is physically identical to the swipe-up-to-close
    // gesture. When the panel actually needs to scroll, don't intercept it
    // as a close - let native scroll (now that it has somewhere to scroll
    // within, see panelMaxHeight above) and the X button handle it instead.
    const el = mobilePanelRef.current
    if (el && el.scrollHeight > el.clientHeight + 1) return
    const deltaY = touchStartY.current - e.touches[0].clientY
    if (deltaY > SWIPE_CLOSE_THRESHOLD_PX) {
      setMobileOpen(false)
      touchStartY.current = null
    }
  }
  // Theme Phase 2 - was a binary default<->indigo toggle button (Phase 1).
  // Widened to a picker backed by this array because 4 more themes are
  // planned this batch (Vermilion, Royal Purple, Midnight Sapphire,
  // Noir) - a toggle only ever handles 2 states, so it would have needed
  // rebuilding into a picker anyway on the very next theme. Doing that
  // rebuild now, on theme #3, means every theme after this one is just a
  // CSS block in globals.css plus one entry in this array - no further
  // SiteNav changes. Order here is also menu display order.
  const THEMES = [
    { id: 'default', label: 'Default', emoji: '🌙' },
    { id: 'indigo', label: 'Indigo', emoji: '🪔' },
    { id: 'peacock', label: 'Peacock', emoji: '🦚' },
    { id: 'vermilion', label: 'Vermilion', emoji: '🔥' },
    { id: 'royal-purple', label: 'Royal Purple', emoji: '👑' },
    { id: 'midnight-sapphire', label: 'Midnight Sapphire', emoji: '🌌' },
    { id: 'noir', label: 'Noir', emoji: '🎩' },
  ] as const
  type ThemeId = typeof THEMES[number]['id']

  // Mirrors what layout.tsx's pre-paint script already applied to <html>,
  // so this just reads it back for the picker's own state (never causes
  // a flash - the attribute is already set by the time this hydrates).
  const [theme, setThemeState] = useState<ThemeId>('default')
  useEffect(() => {
    if (typeof document === 'undefined') return
    const current = document.documentElement.getAttribute('data-theme')
    const match = THEMES.find((th) => th.id === current)
    if (match) setThemeState(match.id)
  }, [])

  const [themeMenuOpen, setThemeMenuOpen] = useState(false)
  const themeMenuRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!themeMenuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [themeMenuOpen])

  // Multi-language Phase 1 - same picker shape as the theme menu above
  // (dropdown desktop, pill row mobile), backed by useLocale()'s
  // localStorage-persisted state instead of a data- attribute.
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const langMenuRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!langMenuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [langMenuOpen])

  const applyTheme = (id: ThemeId) => {
    setThemeState(id)
    if (id === 'default') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', id)
    }
    try { localStorage.setItem('afa-theme', id) } catch (e) {}
    setThemeMenuOpen(false)
  }

  const { locale, setLocale, t } = useLocale()

  const navLabelFor: Record<NavLinkKey, string> = {
    events: t.nav.events,
    artists: t.nav.artists,
    venues: t.nav.venues,
    "wall-of-fame": t.nav.wallOfFame,
  }

  // Mobile Theme/Language sections used to always render every option as
  // a full pill grid - fine for one 7-theme grid, but stacking a second
  // (soon 6-language) grid on top of it visibly bloated the panel (live
  // report, 3 Aug) and would only get worse once Telugu/Tamil/Kannada/
  // Malayalam are added. Collapsed-by-default summary row (current
  // selection + chevron) that expands to the pill grid on tap, same
  // information/options as before, just not force-displayed every time
  // the menu opens - mirrors the desktop icon-button-opens-dropdown
  // pattern instead of always-open.
  const [mobileThemeExpanded, setMobileThemeExpanded] = useState(false)
  const [mobileLangExpanded, setMobileLangExpanded] = useState(false)

  const primaryLinks = backHref
    ? [{ key: "back", href: backHref, label: backLabel ?? t.nav.back, isActive: false }]
    : NAV_LINKS.map((l) => ({ key: l.key as string, href: l.href, label: navLabelFor[l.key], isActive: active === l.key }))

  // key is the stable icon/badge lookup id (see NavIcon); label is the
  // translated display text - kept separate since Multi-language Phase 1.
  const accountLinks = user
    ? [
        ...(dashboardLink ? [{ key: "dashboard", href: dashboardLink, label: t.nav.dashboard, accent: true }] : []),
        { key: "messages", href: "/dashboard/messages", label: t.nav.messages, accent: false },
        { key: "myTickets", href: "/tickets", label: t.nav.myTickets, accent: false },
        { key: "profile", href: "/profile", label: t.nav.profile, accent: false },
      ]
    : []

  return (
    <nav
      style={{
        position: isHome ? "fixed" : "sticky",
        top: "var(--nudge-stack-height, 0px)",
        left: isHome ? 0 : undefined,
        right: isHome ? 0 : undefined,
        zIndex: 100,
        background: isHome ? "rgba(247,243,238,0.92)" : "rgba(247,243,238,0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(14,12,10,0.08)",
      }}
    >
      <style>{`
        .sitenav-desktop { display: flex; }
        .sitenav-hamburger { display: none; }
        .sitenav-mobile-panel { display: none; }
        @media (max-width: 900px) {
          .sitenav-desktop { display: none; }
          .sitenav-hamburger { display: flex; }
          .sitenav-mobile-panel.open { display: flex; }
        }
        /* Header nav wrapped to a second line when logged in. Root cause
           (confirmed 29 Jul): the account row (Hi, name + role badge +
           Dashboard + Messages + My Tickets + Profile + Sign out) plus the
           public nav links + search all share one flex row with no
           priority ordering - adding the Messages link (same session,
           Feedback 45ac402a) pushed total content width past what a
           common laptop window has at 100% zoom, even for the "page"
           variant that wasn't affected before. Two-part fix instead of
           another spacing-only patch:
             1. Hamburger cutover raised 780px -> 900px, so the whole
                heavy row falls back to the already-solid mobile panel
                well before it would be forced to wrap.
             2. Inside the still-desktop 901-1500px band, tighten every
                gap/width further (this replaces the old 781-1300 patch).
           Belt-and-braces on top of both: .sitenav-desktop is nowrap (was
           wrap) and the greeting name is hard max-width + ellipsis - so a
           long display name or in-between zoom level can never reintroduce
           a second line; worst case is a tighter row, never a wrap. */
        @media (min-width: 901px) and (max-width: 1500px) {
          .sitenav-row { padding: 16px 20px !important; }
          .sitenav-logo { font-size: 20px !important; }
          .sitenav-desktop { gap: 14px !important; }
          .sitenav-account-row { gap: 8px !important; }
          .afa-search-input { max-width: 110px !important; }
          .sitenav-greeting { max-width: 70px !important; }
        }
        .sitenav-icon-link { position: relative; }
        .sitenav-icon-link .sitenav-tooltip {
          position: absolute;
          top: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%) translateY(-4px);
          background: var(--afa-ink);
          color: var(--afa-cream);
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          padding: 4px 9px;
          border-radius: 6px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.12s ease, transform 0.12s ease;
          z-index: 10;
        }
        .sitenav-icon-link:hover .sitenav-tooltip,
        .sitenav-icon-link:focus-visible .sitenav-tooltip {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      `}</style>

      <div className="sitenav-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isHome ? "18px 24px" : "16px 24px" }}>
        <Link
          href="/"
          onClick={() => setMobileOpen(false)}
          className="sitenav-logo"
          style={{ fontFamily: "Georgia, serif", fontSize: isHome ? "22px" : "20px", fontWeight: 700, color: "var(--afa-ink)", textDecoration: "none" }}
        >
          <span style={{ color: "var(--afa-brand-mark)" }}>A</span>forAudience
          <EnvBadge />
        </Link>

        {/* Desktop: full row, unchanged from before */}
        <div className="sitenav-desktop" style={{ gap: isHome ? "32px" : "24px", alignItems: "center", flexWrap: "nowrap" }}>
          {primaryLinks.map((l) => (
            <Link key={l.key} href={l.href} style={{ fontSize: "14px", fontWeight: l.isActive ? 600 : 500, color: l.isActive ? "var(--afa-terracotta)" : "var(--afa-ink)", textDecoration: "none", opacity: l.isActive ? 1 : 0.6 }}>
              {l.label}
            </Link>
          ))}

          {!backHref && <SearchBox />}
          {!backHref && <LocationChip />}

          <div ref={themeMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setThemeMenuOpen((v) => !v)}
              title="Change theme"
              aria-label="Change theme"
              aria-expanded={themeMenuOpen}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', border: '1px solid rgba(14,12,10,0.15)', background: 'transparent', cursor: 'pointer', fontSize: '15px', padding: 0 }}
            >
              {THEMES.find((th) => th.id === theme)?.emoji}
            </button>
            {themeMenuOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: 'var(--afa-cream)', border: '1px solid rgba(14,12,10,0.1)', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.14)', padding: '6px', minWidth: '160px', zIndex: 20 }}>
                {THEMES.map((th) => (
                  <button
                    key={th.id}
                    onClick={() => applyTheme(th.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: '6px', border: 'none', background: theme === th.id ? 'rgba(200,68,26,0.08)' : 'transparent', color: 'var(--afa-ink)', fontSize: '13px', fontWeight: theme === th.id ? 700 : 500, cursor: 'pointer' }}
                  >
                    <span>{th.emoji}</span>
                    <span>{th.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div ref={langMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setLangMenuOpen((v) => !v)}
              title={t.languagePicker.label}
              aria-label={t.languagePicker.label}
              aria-expanded={langMenuOpen}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', border: '1px solid rgba(14,12,10,0.15)', background: 'transparent', cursor: 'pointer', fontSize: '11px', fontWeight: 700, padding: 0, color: 'var(--afa-ink)' }}
            >
              {locale.toUpperCase()}
            </button>
            {langMenuOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: 'var(--afa-cream)', border: '1px solid rgba(14,12,10,0.1)', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.14)', padding: '6px', minWidth: '160px', zIndex: 20 }}>
                {LOCALES.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => { setLocale(l.id); setLangMenuOpen(false) }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: '6px', border: 'none', background: locale === l.id ? 'rgba(200,68,26,0.08)' : 'transparent', color: 'var(--afa-ink)', fontSize: '13px', fontWeight: locale === l.id ? 700 : 500, cursor: 'pointer' }}
                  >
                    {l.nativeLabel}
                  </button>
                ))}
              </div>
            )}
          </div>

          {status === "loading" ? null : user ? (
            <div className="sitenav-account-row" style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <span
                className="sitenav-greeting"
                style={{ fontSize: "13px", color: "var(--afa-ink)", opacity: 0.7, maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block", verticalAlign: "middle" }}
              >
                {t.nav.greeting} {(user.displayName || user.name || user.email || "there").split(" ")[0]}
              </span>
              {getRoleLabel(user.role, t.roles) && (
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--afa-terracotta)", background: "rgba(200,68,26,0.08)", padding: "3px 9px", borderRadius: "999px" }}>
                  {getRoleLabel(user.role, t.roles)}
                </span>
              )}
              {accountLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-label={l.label}
                  className="sitenav-icon-link"
                  style={{ color: l.accent ? "var(--afa-terracotta)" : "var(--afa-ink)", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", width: "36px", height: "36px", borderRadius: "8px" }}
                >
                  <NavIcon navKey={l.key} />
                  {l.key === "dashboard" && pendingCount > 0 && (
                    <span style={{ position: "absolute", top: "-4px", right: "-6px", fontSize: "10px", fontWeight: 700, color: "var(--afa-cream)", background: "var(--afa-terracotta)", borderRadius: "999px", padding: "1px 5px", minWidth: "15px", textAlign: "center", lineHeight: 1.4 }}>
                      {pendingCount}
                    </span>
                  )}
                  {l.key === "messages" && unreadCount > 0 && (
                    <span style={{ position: "absolute", top: "-4px", right: "-6px", fontSize: "10px", fontWeight: 700, color: "var(--afa-cream)", background: "var(--afa-terracotta)", borderRadius: "999px", padding: "1px 5px", minWidth: "15px", textAlign: "center", lineHeight: 1.4 }}>
                      {unreadCount}
                    </span>
                  )}
                  <span className="sitenav-tooltip">{l.label}</span>
                </Link>
              ))}
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                style={{ fontSize: "14px", fontWeight: 600, color: "var(--afa-cream)", background: "var(--afa-ink)", border: "none", cursor: "pointer", padding: isHome ? "10px 22px" : "8px 20px", borderRadius: "6px" }}
              >
                {t.nav.signOut}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <Link href="/login" style={{ fontSize: "14px", fontWeight: 500, color: "var(--afa-ink)", textDecoration: "none", opacity: 0.7 }}>
                {t.nav.signIn}
              </Link>
              <Link href="/register" style={{ fontSize: "14px", fontWeight: 600, color: "var(--afa-cream)", textDecoration: "none", background: "var(--afa-ink)", padding: isHome ? "10px 22px" : "8px 20px", borderRadius: "6px" }}>
                {t.nav.signUp}
              </Link>
            </div>
          )}
        </div>

        {/* Mobile: hamburger toggle, everything moves into the dropdown panel below */}
        <button
          className="sitenav-hamburger"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          style={{ alignItems: "center", justifyContent: "center", width: "36px", height: "36px", border: "none", background: "transparent", cursor: "pointer", flexDirection: "column", gap: "4px" }}
        >
          <span style={{ display: "block", width: "22px", height: "2px", background: "var(--afa-ink)", transition: "transform 0.15s", transform: mobileOpen ? "translateY(6px) rotate(45deg)" : "none" }} />
          <span style={{ display: "block", width: "22px", height: "2px", background: "var(--afa-ink)", opacity: mobileOpen ? 0 : 1, transition: "opacity 0.15s" }} />
          <span style={{ display: "block", width: "22px", height: "2px", background: "var(--afa-ink)", transition: "transform 0.15s", transform: mobileOpen ? "translateY(-6px) rotate(-45deg)" : "none" }} />
        </button>
      </div>

      {/* Mobile dropdown panel */}
      <div
        ref={mobilePanelRef}
        className={`sitenav-mobile-panel${mobileOpen ? " open" : ""}`}
        style={{
          flexDirection: "column",
          padding: "8px 24px 20px",
          borderTop: "1px solid rgba(14,12,10,0.08)",
          maxHeight: panelMaxHeight ? `${panelMaxHeight}px` : "80vh",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
        onTouchStart={handlePanelTouchStart}
        onTouchMove={handlePanelTouchMove}
      >
        <div style={{ padding: '10px 0', borderBottom: '1px solid rgba(14,12,10,0.06)' }}>
          <button
            onClick={() => setMobileThemeExpanded((v) => !v)}
            aria-expanded={mobileThemeExpanded}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
          >
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--afa-ink)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.themePicker.label}</span>
              <span>{THEMES.find((th) => th.id === theme)?.emoji} {THEMES.find((th) => th.id === theme)?.label}</span>
            </span>
            <span style={{ opacity: 0.5, fontSize: '12px', transform: mobileThemeExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
          </button>
          {mobileThemeExpanded && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
              {THEMES.map((th) => (
                <button
                  key={th.id}
                  onClick={() => { applyTheme(th.id); setMobileThemeExpanded(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '999px', border: theme === th.id ? '1.5px solid var(--afa-terracotta)' : '1px solid rgba(14,12,10,0.15)', background: theme === th.id ? 'rgba(200,68,26,0.08)' : 'transparent', color: 'var(--afa-ink)', fontSize: '13px', fontWeight: theme === th.id ? 700 : 500, cursor: 'pointer' }}
                >
                  <span>{th.emoji}</span>
                  {th.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding: '10px 0', borderBottom: '1px solid rgba(14,12,10,0.06)' }}>
          <button
            onClick={() => setMobileLangExpanded((v) => !v)}
            aria-expanded={mobileLangExpanded}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
          >
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--afa-ink)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.languagePicker.label}</span>
              <span>{LOCALES.find((l) => l.id === locale)?.nativeLabel}</span>
            </span>
            <span style={{ opacity: 0.5, fontSize: '12px', transform: mobileLangExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
          </button>
          {mobileLangExpanded && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
              {LOCALES.map((l) => (
                <button
                  key={l.id}
                  onClick={() => { setLocale(l.id); setMobileLangExpanded(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '999px', border: locale === l.id ? '1.5px solid var(--afa-terracotta)' : '1px solid rgba(14,12,10,0.15)', background: locale === l.id ? 'rgba(200,68,26,0.08)' : 'transparent', color: 'var(--afa-ink)', fontSize: '13px', fontWeight: locale === l.id ? 700 : 500, cursor: 'pointer' }}
                >
                  {l.nativeLabel}
                </button>
              ))}
            </div>
          )}
        </div>
        {primaryLinks.map((l) => (
          <Link
            key={l.key}
            href={l.href}
            onClick={() => setMobileOpen(false)}
            style={{ fontSize: "15px", fontWeight: l.isActive ? 600 : 500, color: l.isActive ? "var(--afa-terracotta)" : "var(--afa-ink)", textDecoration: "none", padding: "12px 0", borderBottom: "1px solid rgba(14,12,10,0.06)" }}
          >
            {l.label}
          </Link>
        ))}

        {!backHref && (
          <div style={{ padding: "14px 0" }}>
            <SearchBox />
          </div>
        )}
        {!backHref && <LocationChip variant="mobile" />}

        {status === "loading" ? null : user ? (
          <>
            <div style={{ fontSize: "13px", color: "var(--afa-ink)", opacity: 0.6, padding: "12px 0 4px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span>{t.nav.signedInAs} {user.displayName || user.name || user.email}</span>
              {getRoleLabel(user.role, t.roles) && (
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--afa-terracotta)", background: "rgba(200,68,26,0.08)", padding: "3px 9px", borderRadius: "999px" }}>
                  {getRoleLabel(user.role, t.roles)}
                </span>
              )}
            </div>
            {accountLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                style={{ fontSize: "15px", fontWeight: 600, color: l.accent ? "var(--afa-terracotta)" : "var(--afa-ink)", textDecoration: "none", padding: "12px 0", borderBottom: "1px solid rgba(14,12,10,0.06)", display: "flex", alignItems: "center", gap: "6px" }}
              >
                {l.label}
                {l.key === "dashboard" && pendingCount > 0 && (
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--afa-cream)", background: "var(--afa-terracotta)", borderRadius: "999px", padding: "2px 7px" }}>
                    {pendingCount}
                  </span>
                )}
                {l.key === "messages" && unreadCount > 0 && (
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--afa-cream)", background: "var(--afa-terracotta)", borderRadius: "999px", padding: "2px 7px" }}>
                    {unreadCount}
                  </span>
                )}
              </Link>
            ))}
            <button
              onClick={() => { setMobileOpen(false); signOut({ callbackUrl: "/" }) }}
              style={{ marginTop: "16px", fontSize: "14px", fontWeight: 600, color: "var(--afa-cream)", background: "var(--afa-ink)", border: "none", cursor: "pointer", padding: "12px 20px", borderRadius: "8px", width: "100%" }}
            >
              {t.nav.signOut}
            </button>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingTop: "16px" }}>
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              style={{ fontSize: "15px", fontWeight: 600, color: "var(--afa-ink)", textDecoration: "none", textAlign: "center", padding: "12px 20px", borderRadius: "8px", border: "1px solid rgba(14,12,10,0.15)" }}
            >
              {t.nav.signIn}
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileOpen(false)}
              style={{ fontSize: "15px", fontWeight: 600, color: "var(--afa-cream)", textDecoration: "none", textAlign: "center", background: "var(--afa-ink)", padding: "12px 20px", borderRadius: "8px" }}
            >
              {t.nav.signUp}
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}