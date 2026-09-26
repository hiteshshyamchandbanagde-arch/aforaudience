"use client"
import { useState } from "react"
import Button from "@/components/ui/Button"
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
        .afa-view-tab { color: var(--afa-text-muted); }
        .afa-view-tab:hover { color: var(--afa-text-secondary); }
        .afa-view-tab.afa-view-tab-active, .afa-view-tab.afa-view-tab-active:hover { color: var(--afa-text-primary); }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", gap: "32px", borderBottom: "1px solid var(--afa-border-resting)", marginBottom: "32px" }}>
        {tabs.map((t) => {
          const active = view === t.key
          return (
            <Button
              key={t.key}
              variant="bare"
              onClick={() => setView(t.key)}
              className={`afa-view-tab${active ? " afa-view-tab-active" : ""}`}
              style={{
                position: "relative",
                paddingBottom: "16px",
                marginBottom: "-1px",
                fontFamily: "var(--font-ui)",
                fontSize: "var(--afa-text-subtitle)",
                letterSpacing: "-0.01em",
                transition: "color 0.2s ease",
                color: undefined,
              }}
            >
              {t.label}
              <span style={{ marginLeft: "8px", verticalAlign: "super", fontSize: "var(--afa-text-micro)", fontWeight: 400, fontFamily: "var(--font-mono)", color: "var(--afa-text-muted)" }}>
                {t.count}
              </span>
              {active && (
                <span style={{ position: "absolute", left: 0, right: 0, bottom: "-1px", height: "2px", background: "var(--afa-fill-solid)" }} />
              )}
            </Button>
          )
        })}
      </div>

      {view === "venues" ? (
        venues.length === 0 ? (
          <p style={{ fontSize: "var(--afa-text-body-lg)", color: "var(--afa-text-primary)", opacity: 0.6 }}>{tr.venuesPage.emptyNoVenues}</p>
        ) : (
          <VenuesGridClient venues={venues} defaultCity={defaultCity} />
        )
      ) : (
        <VenueOwnersGridEmbed />
      )}
    </div>
  )
}
