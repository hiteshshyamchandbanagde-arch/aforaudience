"use client"

import { useState } from "react"
import Link from "next/link"
import { signOut, useSession } from "next-auth/react"

type NavLinkKey = "events" | "artists" | "venues"

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
    default:
      return null
  }
}

export default function SiteNav({ active, variant = "page", backHref, backLabel }: SiteNavProps) {
  const isHome = variant === "home"
  const { data: session, status } = useSession()
  const user = session?.user as { name?: string | null; email?: string | null; role?: string } | undefined
  const dashboardLink = user ? getDashboardLink(user.role) : null
  const [mobileOpen, setMobileOpen] = useState(false)

  const primaryLinks = backHref
    ? [{ key: "back", href: backHref, label: backLabel ?? "← Back", isActive: false }]
    : NAV_LINKS.map((l) => ({ key: l.key as string, href: l.href, label: l.label, isActive: active === l.key }))

  const accountLinks = user
    ? [
        ...(dashboardLink ? [{ href: dashboardLink, label: "Dashboard", accent: true }] : []),
        { href: "/tickets", label: "My Tickets", accent: false },
        { href: "/profile", label: "Profile", accent: false },
      ]
    : []

  return (
    <nav
      style={{
        position: isHome ? "fixed" : "sticky",
        top: 0,
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
        @media (max-width: 780px) {
          .sitenav-desktop { display: none; }
          .sitenav-hamburger { display: flex; }
          .sitenav-mobile-panel.open { display: flex; }
        }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isHome ? "18px 24px" : "16px 24px" }}>
        <Link
          href="/"
          onClick={() => setMobileOpen(false)}
          style={{ fontFamily: "Georgia, serif", fontSize: isHome ? "22px" : "20px", fontWeight: 700, color: "#0E0C0A", textDecoration: "none" }}
        >
          <span style={{ color: "#C8441A" }}>A</span>forAudience
        </Link>

        {/* Desktop: full row, unchanged from before */}
        <div className="sitenav-desktop" style={{ gap: isHome ? "32px" : "24px", alignItems: "center", flexWrap: "wrap" }}>
          {primaryLinks.map((l) => (
            <Link key={l.key} href={l.href} style={{ fontSize: "14px", fontWeight: l.isActive ? 600 : 500, color: l.isActive ? "#C8441A" : "#0E0C0A", textDecoration: "none", opacity: l.isActive ? 1 : 0.6 }}>
              {l.label}
            </Link>
          ))}

          {status === "loading" ? null : user ? (
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <span style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.7 }}>
                Hi, {(user.name || user.email || "there").split(" ")[0]}
              </span>
              {accountLinks.map((l) => (
                <Link key={l.href} href={l.href} style={{ fontSize: "14px", fontWeight: 600, color: l.accent ? "#C8441A" : "#0E0C0A", textDecoration: "none" }}>
                  {l.label}
                </Link>
              ))}
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                style={{ fontSize: "14px", fontWeight: 600, color: "#F7F3EE", background: "#0E0C0A", border: "none", cursor: "pointer", padding: isHome ? "10px 22px" : "8px 20px", borderRadius: "6px" }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <Link href="/login" style={{ fontSize: "14px", fontWeight: 500, color: "#0E0C0A", textDecoration: "none", opacity: 0.7 }}>
                Sign in
              </Link>
              <Link href="/register" style={{ fontSize: "14px", fontWeight: 600, color: "#F7F3EE", textDecoration: "none", background: "#0E0C0A", padding: isHome ? "10px 22px" : "8px 20px", borderRadius: "6px" }}>
                Sign up
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
          <span style={{ display: "block", width: "22px", height: "2px", background: "#0E0C0A", transition: "transform 0.15s", transform: mobileOpen ? "translateY(6px) rotate(45deg)" : "none" }} />
          <span style={{ display: "block", width: "22px", height: "2px", background: "#0E0C0A", opacity: mobileOpen ? 0 : 1, transition: "opacity 0.15s" }} />
          <span style={{ display: "block", width: "22px", height: "2px", background: "#0E0C0A", transition: "transform 0.15s", transform: mobileOpen ? "translateY(-6px) rotate(-45deg)" : "none" }} />
        </button>
      </div>

      {/* Mobile dropdown panel */}
      <div className={`sitenav-mobile-panel${mobileOpen ? " open" : ""}`} style={{ flexDirection: "column", padding: "8px 24px 20px", borderTop: "1px solid rgba(14,12,10,0.08)" }}>
        {primaryLinks.map((l) => (
          <Link
            key={l.key}
            href={l.href}
            onClick={() => setMobileOpen(false)}
            style={{ fontSize: "15px", fontWeight: l.isActive ? 600 : 500, color: l.isActive ? "#C8441A" : "#0E0C0A", textDecoration: "none", padding: "12px 0", borderBottom: "1px solid rgba(14,12,10,0.06)" }}
          >
            {l.label}
          </Link>
        ))}

        {status === "loading" ? null : user ? (
          <>
            <div style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.6, padding: "12px 0 4px" }}>
              Signed in as {user.name || user.email}
            </div>
            {accountLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                style={{ fontSize: "15px", fontWeight: 600, color: l.accent ? "#C8441A" : "#0E0C0A", textDecoration: "none", padding: "12px 0", borderBottom: "1px solid rgba(14,12,10,0.06)" }}
              >
                {l.label}
              </Link>
            ))}
            <button
              onClick={() => { setMobileOpen(false); signOut({ callbackUrl: "/" }) }}
              style={{ marginTop: "16px", fontSize: "14px", fontWeight: 600, color: "#F7F3EE", background: "#0E0C0A", border: "none", cursor: "pointer", padding: "12px 20px", borderRadius: "8px", width: "100%" }}
            >
              Sign out
            </button>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingTop: "16px" }}>
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              style={{ fontSize: "15px", fontWeight: 600, color: "#0E0C0A", textDecoration: "none", textAlign: "center", padding: "12px 20px", borderRadius: "8px", border: "1px solid rgba(14,12,10,0.15)" }}
            >
              Sign in
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileOpen(false)}
              style={{ fontSize: "15px", fontWeight: 600, color: "#F7F3EE", textDecoration: "none", textAlign: "center", background: "#0E0C0A", padding: "12px 20px", borderRadius: "8px" }}
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}
