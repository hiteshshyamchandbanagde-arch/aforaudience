"use client"
import { useState } from "react"
import VenuesGridClient from "./VenuesGridClient"
import VenueOwnersGridEmbed from "@/components/VenueOwnersGridEmbed"
import { useLocale } from "@/lib/i18n/translate"

interface VenueItem {
  id: string
  name: string
  city: string
  country: string | null
  capacity: number
  priceRangeLabel: string | null
  photos: string[]
}

// BUG-2608-072 (gap 3) - the original pill-button toggle didn't match the
// Figma Make export (VenuesDirectory.tsx lines ~34-48) at all: underline
// tabs, not pills, each with a small superscript count next to the label.
// ownerCount is fetched server-side (see page.tsx) rather than read off
// VenueOwnersGridEmbed's own client-side fetch, since the tab label needs
// a real count before the Owners tab has ever been opened.
export default function VenuesViewToggle({
  venues,
  ownerCount,
  defaultCity,
}: {
  venues: VenueItem[]
  ownerCount: number
  defaultCity?: string | null
}) {
  const { t: tr } = useLocale()
  const [view, setView] = useState<"venues" | "owners">("venues")

  const tabs: { key: "venues" | "owners"; label: string; count: number }[] = [
    { key: "venues", label: tr.venuesPage.tabVenues, count: venues.length },
    { key: "owners", label: tr.venuesPage.tabOwners, count: ownerCount },
  ]

  return (
    <div>
      <style>{`
        /* Export: inactive tab has hover:text-cream-dim - color set via
           inline style can't express :hover at all (same bug pattern as
           BUG-2608-072 gap 4 / BUG-2608-073 gap 4), so the class controls
           color instead and the inline style only sets layout. */
        .afa-view-tab { color: rgba(245,245,240,0.45); }
        .afa-view-tab:hover { color: rgba(245,245,240,0.7); }
        .afa-view-tab.afa-view-tab-active, .afa-view-tab.afa-view-tab-active:hover { color: var(--afa-cream); }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", gap: "32px", borderBottom: "1px solid rgba(245,245,240,0.15)", marginBottom: "32px" }}>
        {tabs.map((t) => {
          const active = view === t.key
          return (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              className={`afa-view-tab${active ? " afa-view-tab-active" : ""}`}
              style={{
                position: "relative",
                paddingBottom: "16px",
                marginBottom: "-1px",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-display)",
                fontSize: "20px",
                letterSpacing: "-0.01em",
                transition: "color 0.2s ease",
              }}
            >
              {t.label}
              <span style={{ marginLeft: "8px", verticalAlign: "super", fontSize: "11px", fontWeight: 400, fontFamily: "var(--font-mono)", color: "rgba(245,245,240,0.45)" }}>
                {t.count}
              </span>
              {active && (
                <span style={{ position: "absolute", left: 0, right: 0, bottom: "-1px", height: "2px", background: "var(--afa-fill-solid)" }} />
              )}
            </button>
          )
        })}
      </div>

      {view === "venues" ? (
        venues.length === 0 ? (
          <p style={{ fontSize: "15px", color: "var(--afa-text-primary)", opacity: 0.6 }}>{tr.venuesPage.emptyNoVenues}</p>
        ) : (
          <VenuesGridClient venues={venues} defaultCity={defaultCity} />
        )
      ) : (
        <VenueOwnersGridEmbed />
      )}
    </div>
  )
}
