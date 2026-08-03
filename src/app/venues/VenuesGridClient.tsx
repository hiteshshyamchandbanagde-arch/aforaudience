"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import BrowseSearchDropdown from "@/components/BrowseSearchDropdown"
import { cityLabel } from "@/lib/country-codes"
import { useLocale } from "@/lib/i18n/translate"

interface VenueItem {
  id: string
  name: string
  city: string
  country: string | null
  capacity: number
  priceRangeLabel: string | null
}

export default function VenuesGridClient({ venues, defaultCity }: { venues: VenueItem[]; defaultCity?: string | null }) {
  const { t: tr } = useLocale()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [navigatingId, setNavigatingId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  // FEAT-2608-036 - pre-fill with the resolved location if it's actually
  // one of the cities we have venues in, same "pre-filled, removable"
  // pattern as the Events page filter. "All Cities" always available.
  // Filter value stays the bare city string (not city+country) - see
  // comment in api/venues/cities/route.ts on why a genuine city-name
  // collision across countries isn't fully disambiguated yet.
  const cityOptions = Array.from(new Map(venues.map((v) => [v.city, v.country])).entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([city, country]) => ({ city, label: cityLabel(city, country) }))
  const cities = cityOptions.map((c) => c.city)
  const [selectedCity, setSelectedCity] = useState(
    defaultCity && cities.includes(defaultCity) ? defaultCity : "All Cities"
  )

  // Same click-guard as /events (PR #261) and /artists (PR #312) - a
  // plain Link gives no click feedback, so a click that doesn't render
  // anything right away reads as "nothing happened" and invites repeat
  // clicks, each firing a fresh un-deduped navigation. Standing rule (1
  // Aug): every tile/card must open in a single click - this closes the
  // same gap here proactively rather than waiting for a live report.
  const goToVenue = (id: string) => {
    if (navigatingId) return
    setNavigatingId(id)
    startTransition(() => {
      router.push(`/venues/${id}`)
    })
  }

  // Session 65 - this embed had no search at all (only the standalone
  // /venue-owners-style full pages did). Adding it here too so the tab
  // reached via the actual nav link behaves the same as /events /
  // /artists, not just the orphaned standalone route.
  const filtered = venues.filter((v) => {
    const matchSearch =
      v.name.toLowerCase().includes(search.toLowerCase()) || v.city.toLowerCase().includes(search.toLowerCase())
    const matchCity = selectedCity === "All Cities" || v.city === selectedCity
    return matchSearch && matchCity
  })

  return (
    <div>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", marginBottom: "20px" }}>
        <BrowseSearchDropdown
          query={search}
          items={filtered}
          getId={(v) => v.id}
          emptyLabel="venues"
          onSelect={(v) => goToVenue(v.id)}
          renderRow={(v) => (
            <>
              <span style={{ fontWeight: 600 }}>{v.name}</span>
              <span style={{ opacity: 0.5, marginLeft: "8px" }}>{v.city}</span>
            </>
          )}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr.venuesPage.searchPlaceholder}
            style={{ width: "100%", maxWidth: "360px", padding: "10px 14px", borderRadius: "8px", border: "1px solid rgba(14,12,10,0.15)", fontSize: "14px", boxSizing: "border-box", background: "white", color: "var(--afa-ink)", outline: "none" }}
          />
        </BrowseSearchDropdown>

        {/* FEAT-2608-036 - this select existed only as state/filter logic
            with no way to actually change it until now; adding the
            control itself alongside the city+country label work. */}
        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          style={{ padding: "10px 14px", borderRadius: "8px", border: "1.5px solid rgba(14,12,10,0.12)", fontSize: "13px", color: "var(--afa-ink)", background: "white", cursor: "pointer", outline: "none" }}
        >
          <option value="All Cities">{tr.venuesPage.filterAllCities}</option>
          {cityOptions.map((c) => (
            <option key={c.city} value={c.city}>{c.label}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
      {filtered.map((v) => {
        const isNavigatingThis = navigatingId === v.id
        return (
          <div
            key={v.id}
            role="link"
            tabIndex={0}
            aria-busy={isNavigatingThis}
            onClick={() => goToVenue(v.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                goToVenue(v.id)
              }
            }}
            style={{
              position: "relative",
              display: "block",
              background: "var(--afa-white)",
              borderRadius: "12px",
              padding: "22px",
              border: "1px solid rgba(14,12,10,0.08)",
              cursor: navigatingId ? "default" : "pointer",
              opacity: navigatingId && !isNavigatingThis ? 0.5 : 1,
              transition: "opacity 0.15s ease",
            }}
          >
            {isNavigatingThis && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 2,
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.7)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    border: "3px solid rgba(14,12,10,0.15)",
                    borderTopColor: "var(--afa-terracotta)",
                    animation: "afa-spin 0.7s linear infinite",
                  }}
                />
                <style>{`@keyframes afa-spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "19px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "4px" }}>
              {v.name}
            </h2>
            <p style={{ fontSize: "13px", color: "var(--afa-ink)", opacity: 0.6, marginBottom: "14px" }}>{cityLabel(v.city, v.country)}</p>
            <div style={{ display: "flex", gap: "18px", fontSize: "13px", color: "var(--afa-ink)" }}>
              <span><strong>{v.capacity}</strong> {tr.venuesPage.seatsLabel}</span>
              {v.priceRangeLabel && <span style={{ color: "var(--afa-terracotta)", fontWeight: 700 }}>{v.priceRangeLabel}</span>}
            </div>
          </div>
        )
      })}
      </div>
    </div>
  )
}
