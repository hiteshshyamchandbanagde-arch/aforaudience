"use client"

import Link from "next/link"
import { useLocale, type Dictionary } from "@/lib/i18n/translate"

type Room = {
  n: string
  personaKey: keyof Dictionary["roles"]
  name: string
  promise: string
  steps: string[]
  cta: string
  href: string
}

function RoomIcon({ persona }: { persona: keyof Dictionary["roles"] }) {
  const common = { width: 40, height: 40, viewBox: "0 0 24 24", fill: "none", stroke: "var(--afa-amber)", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  switch (persona) {
    case "AUDIENCE":
      return (
        <svg {...common}>
          <circle cx="12" cy="8.3" r="3.4" />
          <path d="M5 20c0-3.7 3.1-6.3 7-6.3s7 2.6 7 6.3" />
        </svg>
      )
    case "ARTIST":
      return (
        <svg {...common}>
          <rect x="9.3" y="3" width="5.4" height="10" rx="2.7" />
          <path d="M6 11a6 6 0 0 0 12 0" />
          <line x1="12" y1="17" x2="12" y2="21" />
          <line x1="8.5" y1="21" x2="15.5" y2="21" />
        </svg>
      )
    case "ORGANISER":
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
    default:
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

function RoomRow({ room, personaLabel, flip }: { room: Room; personaLabel: string; flip: boolean }) {
  return (
    <div className={`four-rooms-row${flip ? " four-rooms-row-flip" : ""}`} style={{ borderBottom: "1px solid rgba(245,245,240,0.08)" }}>
      <div className="four-rooms-visual" style={{ position: "relative", minHeight: "280px", background: "radial-gradient(120% 120% at 18% 15%, var(--afa-ink) 0%, var(--afa-surface-inverse) 60%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ position: "absolute", left: "24px", top: "20px", fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "56px", color: "rgba(245,245,240,0.15)" }}>
          {room.n}
        </span>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "84px", height: "84px", borderRadius: "50%", border: "1px solid rgba(201,151,58,0.35)" }}>
          <RoomIcon persona={room.personaKey} />
        </div>
      </div>

      <div className="four-rooms-copy" style={{ background: "var(--afa-surface-inverse)", padding: "56px 28px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--afa-amber)", marginBottom: "16px" }}>
          {personaLabel}
        </div>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 500, lineHeight: 1, letterSpacing: "-0.01em", color: "var(--afa-text-inverse)", margin: 0 }}>
          {room.name}
        </h3>
        <p style={{ marginTop: "20px", maxWidth: "440px", fontFamily: "var(--font-sans)", fontSize: "17px", lineHeight: 1.65, color: "var(--afa-text-inverse)", opacity: 0.75 }}>
          {room.promise}
        </p>

        <ol style={{ listStyle: "none", margin: "32px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
          {room.steps.map((step, i) => (
            <li key={step} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", flexShrink: 0, borderRadius: "50%", border: "1px solid rgba(201,151,58,0.4)", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--afa-amber)" }}>
                {i + 1}
              </span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "15px", color: "rgba(245,245,240,0.85)" }}>{step}</span>
            </li>
          ))}
        </ol>

        <Link
          href={room.href}
          style={{ marginTop: "36px", alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: "8px", background: "var(--afa-fill-solid)", color: "var(--afa-on-fill-solid)", padding: "12px 24px", borderRadius: "999px", fontFamily: "var(--font-sans)", fontSize: "14px", fontWeight: 700, textDecoration: "none" }}
        >
          {room.cta}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </div>
  )
}

/**
 * "Four rooms, one house" persona section, per design.md (17 Aug) -
 * replaces HowItWorksSection + RolesSection wholesale (both confirmed
 * broken: invisible text on the former, a 4-way off-palette color
 * violation on the latter - not patched, this section pays off the same
 * ground with the four-rooms metaphor the hero headline sets up). Each
 * room gets its own promise + real 4-step journey instead of one shared
 * generic list. Deliberately restrained to the same ink/cream/orange/amber
 * palette everywhere (no per-role rainbow), per design.md's confirmed
 * 4-color-only decision - the exact thing RolesSection got wrong.
 *
 * The Figma reference gives each room a real photo (Unsplash placeholder
 * URLs). Not ported here: design.md's own "Photography" note scopes real
 * curated/licensed photography as its own separate asset-library
 * workstream, not yet wired up - same reasoning Hero.tsx used to refuse
 * the reference's hardcoded photo URLs. Visual panel is a duotone-style
 * gradient + persona icon instead, using the same palette-only gradient
 * technique already shipped in Hero.tsx's empty-state fallback.
 */
export default function FourRooms() {
  const { t: tr } = useLocale()

  const rooms: Room[] = [
    {
      n: "I",
      personaKey: "AUDIENCE",
      name: tr.homePage.fourRoomsHouseName,
      promise: tr.homePage.fourRoomsHousePromise,
      steps: [tr.homePage.fourRoomsHouseStep1, tr.homePage.fourRoomsHouseStep2, tr.homePage.fourRoomsHouseStep3, tr.homePage.fourRoomsHouseStep4],
      cta: tr.homePage.fourRoomsHouseCta,
      href: "/events",
    },
    {
      n: "II",
      personaKey: "ARTIST",
      name: tr.homePage.fourRoomsStageName,
      promise: tr.homePage.fourRoomsStagePromise,
      steps: [tr.homePage.fourRoomsStageStep1, tr.homePage.fourRoomsStageStep2, tr.homePage.fourRoomsStageStep3, tr.homePage.fourRoomsStageStep4],
      cta: tr.homePage.fourRoomsStageCta,
      href: "/register?role=artist",
    },
    {
      n: "III",
      personaKey: "ORGANISER",
      name: tr.homePage.fourRoomsBoothName,
      promise: tr.homePage.fourRoomsBoothPromise,
      steps: [tr.homePage.fourRoomsBoothStep1, tr.homePage.fourRoomsBoothStep2, tr.homePage.fourRoomsBoothStep3, tr.homePage.fourRoomsBoothStep4],
      cta: tr.homePage.fourRoomsBoothCta,
      href: "/register?role=organiser",
    },
    {
      n: "IV",
      personaKey: "VENUE_OWNER",
      name: tr.homePage.fourRoomsVenueName,
      promise: tr.homePage.fourRoomsVenuePromise,
      steps: [tr.homePage.fourRoomsVenueStep1, tr.homePage.fourRoomsVenueStep2, tr.homePage.fourRoomsVenueStep3, tr.homePage.fourRoomsVenueStep4],
      cta: tr.homePage.fourRoomsVenueCta,
      href: "/register?role=venue",
    },
  ]

  return (
    <section style={{ background: "var(--afa-surface-inverse)", borderTop: "1px solid rgba(245,245,240,0.08)" }}>
      <div style={{ maxWidth: "1360px", margin: "0 auto", padding: "88px 36px 40px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--afa-amber)", marginBottom: "24px" }}>
          {tr.homePage.fourRoomsEyebrow}
        </div>
        <div className="four-rooms-intro">
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(34px, 5vw, 60px)", fontWeight: 500, lineHeight: 0.98, letterSpacing: "-0.01em", color: "var(--afa-text-inverse)", margin: 0 }}>
            {tr.homePage.fourRoomsHeadingLine1}<br />
            <em style={{ fontStyle: "italic", color: "var(--afa-amber)" }}>{tr.homePage.fourRoomsHeadingEmphasis}</em>{tr.homePage.fourRoomsHeadingSuffix}
          </h2>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: "17px", lineHeight: 1.65, color: "rgba(245,245,240,0.75)", margin: 0 }}>
            {tr.homePage.fourRoomsSubtitle}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: "1360px", margin: "0 auto", borderTop: "1px solid rgba(245,245,240,0.08)" }}>
        <RoomRow room={rooms[0]} personaLabel={tr.roles.AUDIENCE} flip={false} />
        <RoomRow room={rooms[1]} personaLabel={tr.roles.ARTIST} flip={true} />
        <RoomRow room={rooms[2]} personaLabel={tr.roles.ORGANISER} flip={false} />
        <RoomRow room={rooms[3]} personaLabel={tr.roles.VENUE_OWNER} flip={true} />
      </div>

      <style>{`
        .four-rooms-intro {
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          gap: 32px;
          align-items: end;
        }
        .four-rooms-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
        }
        .four-rooms-row-flip .four-rooms-visual { order: 2; }
        .four-rooms-row-flip .four-rooms-copy { order: 1; }
        @media (max-width: 700px) {
          .four-rooms-intro { grid-template-columns: 1fr; }
        }
        @media (max-width: 900px) {
          .four-rooms-row { grid-template-columns: 1fr; }
          .four-rooms-row-flip .four-rooms-visual { order: 0; }
          .four-rooms-row-flip .four-rooms-copy { order: 0; }
        }
      `}</style>
    </section>
  )
}
