"use client"

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

  return (
    <nav
      style={{
        position: isHome ? "fixed" : "sticky",
        top: 0,
        left: isHome ? 0 : undefined,
        right: isHome ? 0 : undefined,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: isHome ? "18px 48px" : "16px 48px",
        background: isHome ? "rgba(247,243,238,0.92)" : "rgba(247,243,238,0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(14,12,10,0.08)",
        flexWrap: "wrap",
        gap: "12px",
      }}
    >
      <Link
        href="/"
        style={{
          fontFamily: "Georgia, serif",
          fontSize: isHome ? "22px" : "20px",
          fontWeight: 700,
          color: "#0E0C0A",
          textDecoration: "none",
        }}
      >
        <span style={{ color: "#C8441A" }}>A</span>forAudience
      </Link>

      <div style={{ display: "flex", gap: isHome ? "32px" : "24px", alignItems: "center", flexWrap: "wrap" }}>
        {backHref ? (
          <Link href={backHref} style={{ fontSize: "14px", color: "#0E0C0A", textDecoration: "none", opacity: 0.6 }}>
            {backLabel ?? "← Back"}
          </Link>
        ) : (
          NAV_LINKS.map(({ key, href, label }) => (
            <Link
              key={key}
              href={href}
              style={{
                fontSize: "14px",
                fontWeight: active === key ? 600 : 500,
                color: active === key ? "#C8441A" : "#0E0C0A",
                textDecoration: "none",
                opacity: active === key ? 1 : 0.6,
              }}
            >
              {label}
            </Link>
          ))
        )}

        {status === "loading" ? null : user ? (
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <span style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.7 }}>
              Hi, {(user.name || user.email || "there").split(" ")[0]}
            </span>
            {dashboardLink ? (
              <Link href={dashboardLink} style={{ fontSize: "14px", fontWeight: 600, color: "#C8441A", textDecoration: "none" }}>
                Dashboard
              </Link>
            ) : (
              <Link href="/profile" style={{ fontSize: "14px", fontWeight: 600, color: "#C8441A", textDecoration: "none" }}>
                Profile
              </Link>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "#F7F3EE",
                background: "#0E0C0A",
                border: "none",
                cursor: "pointer",
                padding: isHome ? "10px 22px" : "8px 20px",
                borderRadius: "6px",
              }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <Link href="/login" style={{ fontSize: "14px", fontWeight: 500, color: "#0E0C0A", textDecoration: "none", opacity: 0.7 }}>
              Sign in
            </Link>
            <Link
              href="/register"
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "#F7F3EE",
                textDecoration: "none",
                background: "#0E0C0A",
                padding: isHome ? "10px 22px" : "8px 20px",
                borderRadius: "6px",
              }}
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}
