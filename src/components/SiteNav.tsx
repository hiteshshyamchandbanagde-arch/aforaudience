import Link from "next/link"

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

export default function SiteNav({ active, variant = "page", backHref, backLabel }: SiteNavProps) {
  const isHome = variant === "home"

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

      <div style={{ display: "flex", gap: isHome ? "32px" : "24px", alignItems: "center" }}>
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

        <Link
          href={isHome ? "/register" : "/login"}
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
          {isHome ? "Get Started" : "Sign In"}
        </Link>
      </div>
    </nav>
  )
}
