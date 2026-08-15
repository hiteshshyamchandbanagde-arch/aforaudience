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

const tabStyle = (active: boolean) => ({
  padding: "8px 18px",
  borderRadius: "999px",
  border: `1.5px solid ${active ? "var(--afa-terracotta)" : "rgba(245,245,240,0.15)"}`,
  background: active ? "var(--afa-terracotta)" : "transparent",
  color: active ? "white" : "var(--afa-text-primary)",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer" as const,
})

// Toggle-based discovery entry point (session 62, design.md §9.5) -
// deliberately not a new top-level nav route. Venues stay server-fetched
// (unchanged default view); Owners is fetched client-side on demand only
// when that tab is actually opened.
export default function VenuesViewToggle({ venues, defaultCity }: { venues: VenueItem[]; defaultCity?: string | null }) {
  const { t: tr } = useLocale()
  const [view, setView] = useState<"venues" | "owners">("venues")

  return (
    <div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
        <button style={tabStyle(view === "venues")} onClick={() => setView("venues")}>{tr.venuesPage.tabVenues}</button>
        <button style={tabStyle(view === "owners")} onClick={() => setView("owners")}>{tr.venuesPage.tabOwners}</button>
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
