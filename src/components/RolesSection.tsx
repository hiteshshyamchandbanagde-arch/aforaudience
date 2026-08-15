"use client"
import Link from "next/link"
import { useLocale } from "@/lib/i18n/translate"

// GEN-2608-015 follow-up: this used to render as 4 visually-identical
// white bordered cards, same treatment as the Steps section above it -
// two structurally different kinds of content (an ordered sequence vs.
// four parallel, mutually-exclusive audiences) reading as the same
// pattern is part of what made the page feel flat. These four roles
// aren't a sequence, so no rail/numbering here - instead each gets its
// own full-bleed color panel with real weight, using existing --afa-*
// tokens (not new hex values). Colors are dedicated per role and
// deliberately avoid the theme accent (var(--afa-terracotta), whichever
// theme has it active) for Artist/Organiser/Venue Owner, so the four
// panels read as genuinely distinct doors rather than one accent color
// repeated four times with different icons - Audience keeps the theme
// accent since it's the platform's own "default" facing role.
const ROLE_COLOR = ["var(--afa-terracotta)", "var(--afa-plum)", "var(--afa-green-mid)", "var(--afa-blue-dark)"]

function RoleIcon({ index }: { index: number }) {
  const common = { width: 30, height: 30, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  switch (index) {
    case 0: // Audience - person
      return (
        <svg {...common}>
          <circle cx="12" cy="8.3" r="3.4" />
          <path d="M5 20c0-3.7 3.1-6.3 7-6.3s7 2.6 7 6.3" />
        </svg>
      )
    case 1: // Artist - microphone
      return (
        <svg {...common}>
          <rect x="9.3" y="3" width="5.4" height="10" rx="2.7" />
          <path d="M6 11a6 6 0 0 0 12 0" />
          <line x1="12" y1="17" x2="12" y2="21" />
          <line x1="8.5" y1="21" x2="15.5" y2="21" />
        </svg>
      )
    case 2: // Organiser - calendar / lineup
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="17" height="15" rx="2" />
          <line x1="3.5" y1="9.5" x2="20.5" y2="9.5" />
          <line x1="8" y1="3" x2="8" y2="6.5" />
          <line x1="16" y1="3" x2="16" y2="6.5" />
          <line x1="7.5" y1="13.5" x2="12.5" y2="13.5" />
          <line x1="7.5" y1="17" x2="16" y2="17" />
        </svg>
      )
    default: // Venue Owner - building
      return (
        <svg {...common}>
          <path d="M4 21V9.5L12 4l8 5.5V21" />
          <line x1="2.5" y1="21" x2="21.5" y2="21" />
          <line x1="9.5" y1="21" x2="9.5" y2="13.5" />
          <line x1="14.5" y1="21" x2="14.5" y2="13.5" />
          <line x1="9.5" y1="13.5" x2="14.5" y2="13.5" />
        </svg>
      )
  }
}

export default function RolesSection() {
  const { t: tr } = useLocale()
  const roles = [
    {
      name: tr.roles.AUDIENCE, tag: tr.homePage.audienceTag, pitch: tr.homePage.audiencePitch,
      benefits: [tr.homePage.audienceBenefit1, tr.homePage.audienceBenefit2, tr.homePage.audienceBenefit3],
      cta: tr.homePage.audienceCta, href: "/events",
    },
    {
      name: tr.roles.ARTIST, tag: tr.homePage.artistTag, pitch: tr.homePage.artistPitch,
      benefits: [tr.homePage.artistBenefit1, tr.homePage.artistBenefit2, tr.homePage.artistBenefit3],
      cta: tr.homePage.artistCta, href: "/profile",
    },
    {
      name: tr.roles.ORGANISER, tag: tr.homePage.organiserTag, pitch: tr.homePage.organiserPitch,
      benefits: [tr.homePage.organiserBenefit1, tr.homePage.organiserBenefit2, tr.homePage.organiserBenefit3],
      cta: tr.homePage.organiserCta, href: "/profile",
    },
    {
      name: tr.roles.VENUE_OWNER, tag: tr.homePage.venueOwnerTag, pitch: tr.homePage.venueOwnerPitch,
      benefits: [tr.homePage.venueOwnerBenefit1, tr.homePage.venueOwnerBenefit2, tr.homePage.venueOwnerBenefit3],
      cta: tr.homePage.venueOwnerCta, href: "/profile",
    },
  ]

  return (
    <section style={{ padding: "96px 48px 108px", background: "var(--afa-surface-raised)" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--afa-terracotta)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ width: "24px", height: "1px", background: "var(--afa-terracotta)", display: "inline-block" }}></span>
        {tr.homePage.rolesEyebrow}
      </div>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(32px, 3.5vw, 52px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-1px", color: "var(--afa-text-primary)", marginBottom: "16px" }}>
        {tr.homePage.rolesHeadingLine1}<br /><em style={{ color: "var(--afa-terracotta)" }}>{tr.homePage.rolesHeadingLine2Emphasis}</em>
      </h2>
      <p style={{ fontFamily: "var(--font-sans)", fontSize: "17px", fontWeight: 300, color: "var(--afa-text-primary)", opacity: 0.6, maxWidth: "560px", lineHeight: 1.7, marginBottom: "56px" }}>
        {tr.homePage.rolesSubtitle}
      </p>

      <div className="roles-grid">
        {roles.map((role, i) => (
          <div key={role.name} className="roles-panel hover-lift-card" style={{ background: ROLE_COLOR[i] }}>
            <div style={{ color: "rgba(255,255,255,0.92)", marginBottom: "20px" }}>
              <RoleIcon index={i} />
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "20px", fontWeight: 700, color: "white", marginBottom: "5px" }}>
              {role.name}
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", padding: "3px 9px", borderRadius: "4px", background: "rgba(255,255,255,0.16)", color: "white", alignSelf: "flex-start", marginBottom: "18px", display: "inline-block" }}>
              {role.tag}
            </span>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "15px", fontStyle: "italic", color: "rgba(255,255,255,0.92)", lineHeight: 1.5, marginBottom: "20px" }}>
              {role.pitch}
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 26px", display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
              {role.benefits.map((b) => (
                <li key={b} style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "rgba(255,255,255,0.8)", lineHeight: 1.5, display: "flex", gap: "8px" }}>
                  <span style={{ color: "white", flexShrink: 0, opacity: 0.85 }}>✓</span>{b}
                </li>
              ))}
            </ul>
            <Link href={role.href} style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 700, color: "white", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px", borderBottom: "1.5px solid rgba(255,255,255,0.4)", paddingBottom: "2px", alignSelf: "flex-start" }}>
              {role.cta} →
            </Link>
          </div>
        ))}
      </div>

      <style>{`
        .roles-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }
        .roles-panel {
          border-radius: 16px;
          padding: 36px 30px;
          display: flex;
          flex-direction: column;
        }
        @media (max-width: 1100px) {
          .roles-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 640px) {
          .roles-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  )
}
