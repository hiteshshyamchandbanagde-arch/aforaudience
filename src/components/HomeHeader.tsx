"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { signOut, useSession } from "next-auth/react"
import EnvBadge from "@/components/EnvBadge"
import SearchBox from "@/components/SearchBox"
import LocationChip from "@/components/LocationChip"
import { useLocale } from "@/lib/i18n/translate"
import { LOCALES } from "@/lib/i18n/locales"

type NavLinkKey = "events" | "artists" | "venues" | "wall-of-fame"

const NAV_LINKS: { key: NavLinkKey; href: string }[] = [
  { key: "events", href: "/events" },
  { key: "artists", href: "/artists" },
  { key: "venues", href: "/venues" },
  { key: "wall-of-fame", href: "/wall-of-fame" },
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

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("") || "?"
}

/**
 * Homepage-only lighter header, per design.md "Four rooms, one house"
 * (17 Aug) - distinct from the global SiteNav (untouched, still tracked
 * under GEN-2608-015). Collapses the account icon row + language +
 * location into a single profile-menu trigger, matching the approved
 * Figma Make reference's 5-icons -> 1-dropdown pattern. Signed-in users
 * still see this lighter header on "/"; SiteNav takes over once they
 * navigate deeper into the app.
 */
export default function HomeHeader() {
  const { data: session, status } = useSession()
  const { locale, setLocale, t } = useLocale()
  const user = session?.user as { name?: string | null; displayName?: string | null; email?: string | null; role?: string } | undefined
  const dashboardLink = user ? getDashboardLink(user.role) : null

  const [pendingCount, setPendingCount] = useState(0)
  useEffect(() => {
    if (user?.role !== "VENUE_OWNER" && user?.role !== "ORGANISER") return
    let cancelled = false
    fetch("/api/notifications/pending-count")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled && data) setPendingCount(data.count) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user?.role])

  const [unreadCount, setUnreadCount] = useState(0)
  useEffect(() => {
    if (!user?.email) return
    let cancelled = false
    fetch("/api/conversations/unread-count")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled && data) setUnreadCount(data.count) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user?.email])

  const [pendingCompanionCount, setPendingCompanionCount] = useState(0)
  useEffect(() => {
    if (!user?.email) return
    let cancelled = false
    fetch("/api/companions/pending-count")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled && data) setPendingCompanionCount(data.count) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user?.email])

  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [menuOpen])

  const navLabelFor: Record<NavLinkKey, string> = {
    events: t.nav.events,
    artists: t.nav.artists,
    venues: t.nav.venues,
    "wall-of-fame": t.nav.wallOfFame,
  }

  const accountLinks = user
    ? [
        ...(dashboardLink ? [{ key: "dashboard", href: dashboardLink, label: t.nav.dashboard, badge: pendingCount }] : []),
        { key: "messages", href: "/dashboard/messages", label: t.nav.messages, badge: unreadCount },
        { key: "myTickets", href: "/tickets", label: t.nav.myTickets, badge: pendingCompanionCount },
        { key: "profile", href: "/profile", label: t.nav.profile, badge: 0 },
      ]
    : []

  const initialsLabel = user ? initials(user.displayName || user.name || user.email || "?") : null

  return (
    <header style={{ position: "absolute", insetInline: 0, top: "var(--nudge-stack-height, 0px)", zIndex: 100 }}>
      <style>{`
        .home-header-desktop { display: flex; }
        .home-header-hamburger { display: none; }
        .home-header-mobile-panel { display: none; }
        @media (max-width: 900px) {
          .home-header-desktop { display: none; }
          .home-header-hamburger { display: flex; }
          .home-header-mobile-panel.open { display: flex; }
        }
      `}</style>

      <div style={{ maxWidth: "1400px", margin: "0 auto", display: "flex", alignItems: "center", gap: "24px", padding: "20px 24px" }}>
        <Link href="/" style={{ display: "flex", alignItems: "baseline", gap: "8px", textDecoration: "none", flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 700, color: "var(--afa-text-primary)" }}>
            <span style={{ color: "var(--afa-brand-mark)" }}>A</span>forAudience
          </span>
          <EnvBadge />
          <span className="home-header-desktop" style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--afa-amber)" }}>
            Where Art Finds Its Crowd
          </span>
        </Link>

        <nav className="home-header-desktop" style={{ gap: "28px", alignItems: "center" }}>
          {NAV_LINKS.map((l) => (
            <Link key={l.key} href={l.href} style={{ fontFamily: "var(--font-mono)", fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--afa-text-primary)", opacity: 0.7, textDecoration: "none" }}>
              {navLabelFor[l.key]}
            </Link>
          ))}
        </nav>

        <div className="home-header-desktop" style={{ marginLeft: "auto", alignItems: "center", gap: "10px" }}>
          <div style={{ overflow: "hidden", transition: "width 0.25s ease, opacity 0.25s ease", width: searchOpen ? "220px" : 0, opacity: searchOpen ? 1 : 0 }}>
            {searchOpen && <SearchBox />}
          </div>
          <button
            aria-label={t.search.placeholder}
            onClick={() => setSearchOpen((v) => !v)}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "36px", height: "36px", borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", color: "var(--afa-text-primary)", opacity: 0.7 }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.2-3.2" strokeLinecap="round" />
            </svg>
          </button>

          <div ref={menuRef} style={{ position: "relative" }}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              style={{ display: "flex", alignItems: "center", gap: "8px", padding: user ? "4px 10px 4px 4px" : "8px 10px", borderRadius: "999px", border: "1px solid rgba(245,245,240,0.15)", background: "transparent", cursor: "pointer" }}
            >
              {user ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "50%", background: "var(--afa-amber)", color: "var(--afa-surface-inverse)", fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 700 }}>
                  {initialsLabel}
                </span>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--afa-text-primary)" }}>
                  <circle cx="12" cy="8.5" r="3.2" />
                  <path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" />
                </svg>
              )}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" style={{ color: "var(--afa-text-primary)", opacity: 0.5 }}>
                <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {menuOpen && (
              <div role="menu" style={{ position: "absolute", right: 0, top: "calc(100% + 10px)", width: "230px", overflow: "hidden", borderRadius: "12px", border: "1px solid rgba(245,245,240,0.1)", background: "var(--afa-surface-inverse)", boxShadow: "0 12px 32px rgba(0,0,0,0.5)", padding: "8px 0", zIndex: 20 }}>
                {user ? (
                  <>
                    <div style={{ padding: "6px 16px 10px", fontSize: "12px", color: "var(--afa-text-primary)", opacity: 0.5 }}>
                      {t.nav.greeting} {(user.displayName || user.name || user.email || "there").split(" ")[0]}
                    </div>
                    {accountLinks.map((l) => (
                      <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 16px", fontSize: "14px", color: "var(--afa-text-primary)", textDecoration: "none" }}>
                        {l.label}
                        {l.badge > 0 && (
                          <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--afa-on-fill-solid)", background: "var(--afa-fill-solid)", borderRadius: "999px", padding: "1px 7px" }}>
                            {l.badge}
                          </span>
                        )}
                      </Link>
                    ))}
                    <div style={{ margin: "6px 0", height: "1px", background: "rgba(245,245,240,0.1)" }} />
                  </>
                ) : (
                  <>
                    <Link href="/login" onClick={() => setMenuOpen(false)} style={{ display: "block", padding: "9px 16px", fontSize: "14px", color: "var(--afa-text-primary)", textDecoration: "none" }}>
                      {t.nav.signIn}
                    </Link>
                    <div style={{ margin: "6px 0", height: "1px", background: "rgba(245,245,240,0.1)" }} />
                  </>
                )}
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px 6px", padding: "6px 16px 8px" }}>
                  {LOCALES.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setLocale(l.id)}
                      style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: locale === l.id ? 700 : 500, color: locale === l.id ? "var(--afa-amber)" : "var(--afa-text-primary)", opacity: locale === l.id ? 1 : 0.5, background: "transparent", border: "none", cursor: "pointer", padding: "2px 4px" }}
                    >
                      {l.id.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div style={{ padding: "0 12px 4px" }}>
                  <LocationChip />
                </div>
                {user && (
                  <>
                    <div style={{ margin: "6px 0", height: "1px", background: "rgba(245,245,240,0.1)" }} />
                    <button
                      onClick={() => { setMenuOpen(false); signOut({ callbackUrl: "/" }) }}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 16px", fontSize: "14px", color: "var(--afa-text-primary)", background: "transparent", border: "none", cursor: "pointer" }}
                    >
                      {t.nav.signOut}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {!user && status !== "loading" && (
            <Link href="/register" style={{ marginLeft: "4px", fontSize: "14px", fontWeight: 700, color: "var(--afa-on-fill-solid)", background: "var(--afa-fill-solid)", padding: "9px 20px", borderRadius: "999px", textDecoration: "none" }}>
              {t.nav.signUp}
            </Link>
          )}
        </div>

        {/* Mobile hamburger - everything moves into the dropdown panel below */}
        <button
          className="home-header-hamburger"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          style={{ marginLeft: "auto", alignItems: "center", justifyContent: "center", width: "36px", height: "36px", border: "none", background: "transparent", cursor: "pointer", flexDirection: "column", gap: "4px" }}
        >
          <span style={{ display: "block", width: "22px", height: "2px", background: "var(--afa-text-primary)", transition: "transform 0.15s", transform: mobileOpen ? "translateY(6px) rotate(45deg)" : "none" }} />
          <span style={{ display: "block", width: "22px", height: "2px", background: "var(--afa-text-primary)", opacity: mobileOpen ? 0 : 1, transition: "opacity 0.15s" }} />
          <span style={{ display: "block", width: "22px", height: "2px", background: "var(--afa-text-primary)", transition: "transform 0.15s", transform: mobileOpen ? "translateY(-6px) rotate(-45deg)" : "none" }} />
        </button>
      </div>

      {/* Mobile dropdown panel */}
      <div className={`home-header-mobile-panel${mobileOpen ? " open" : ""}`} style={{ flexDirection: "column", padding: "0 24px 20px", background: "var(--afa-surface-inverse)", borderTop: "1px solid rgba(245,245,240,0.08)", maxHeight: "80vh", overflowY: "auto" }}>
        {NAV_LINKS.map((l) => (
          <Link key={l.key} href={l.href} onClick={() => setMobileOpen(false)} style={{ fontSize: "15px", fontWeight: 500, color: "var(--afa-text-primary)", textDecoration: "none", padding: "12px 0", borderBottom: "1px solid rgba(245,245,240,0.06)" }}>
            {navLabelFor[l.key]}
          </Link>
        ))}
        <div style={{ padding: "14px 0" }}>
          <SearchBox />
        </div>
        <div style={{ padding: "0 0 14px" }}>
          <LocationChip variant="mobile" />
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", padding: "0 0 14px" }}>
          {LOCALES.map((l) => (
            <button
              key={l.id}
              onClick={() => setLocale(l.id)}
              style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: locale === l.id ? 700 : 500, color: locale === l.id ? "var(--afa-amber)" : "var(--afa-text-primary)", background: locale === l.id ? "rgba(201,151,58,0.08)" : "transparent", border: locale === l.id ? "1.5px solid var(--afa-amber)" : "1px solid rgba(245,245,240,0.15)", borderRadius: "999px", padding: "6px 12px", cursor: "pointer" }}
            >
              {l.nativeLabel}
            </button>
          ))}
        </div>

        {status === "loading" ? null : user ? (
          <>
            {accountLinks.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setMobileOpen(false)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "15px", fontWeight: 600, color: "var(--afa-text-primary)", textDecoration: "none", padding: "12px 0", borderBottom: "1px solid rgba(245,245,240,0.06)" }}>
                {l.label}
                {l.badge > 0 && (
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--afa-on-fill-solid)", background: "var(--afa-fill-solid)", borderRadius: "999px", padding: "2px 7px" }}>
                    {l.badge}
                  </span>
                )}
              </Link>
            ))}
            <button
              onClick={() => { setMobileOpen(false); signOut({ callbackUrl: "/" }) }}
              style={{ marginTop: "16px", fontSize: "14px", fontWeight: 600, color: "var(--afa-on-fill-solid)", background: "var(--afa-fill-solid)", border: "none", cursor: "pointer", padding: "12px 20px", borderRadius: "8px", width: "100%" }}
            >
              {t.nav.signOut}
            </button>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingTop: "6px" }}>
            <Link href="/login" onClick={() => setMobileOpen(false)} style={{ fontSize: "15px", fontWeight: 600, color: "var(--afa-text-primary)", textDecoration: "none", textAlign: "center", padding: "12px 20px", borderRadius: "8px", border: "1px solid rgba(245,245,240,0.15)" }}>
              {t.nav.signIn}
            </Link>
            <Link href="/register" onClick={() => setMobileOpen(false)} style={{ fontSize: "15px", fontWeight: 600, color: "var(--afa-on-fill-solid)", textDecoration: "none", textAlign: "center", background: "var(--afa-fill-solid)", padding: "12px 20px", borderRadius: "8px" }}>
              {t.nav.signUp}
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
