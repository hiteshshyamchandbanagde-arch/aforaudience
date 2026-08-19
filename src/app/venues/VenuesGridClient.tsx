"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import BrowseSearchDropdown from "@/components/BrowseSearchDropdown"
import Photo from "@/components/Photo"
import VenueNoPhoto, { capacityTier } from "@/components/VenueNoPhoto"
import { cityLabel } from "@/lib/country-codes"
import { isPlaceholderImageUrl } from "@/lib/placeholder-image"
import { useLocale } from "@/lib/i18n/translate"
import { SearchIcon } from "@/components/icons/ArtistIcons"
import { ArrowUpRightIcon } from "@/components/icons/VenueIcons"

interface VenueItem {
  id: string
  name: string
  city: string
  country: string | null
  capacity: number
  priceRangeLabel: string | null
  photos: string[]
}

// GEN-2608-074 - migrated off Theme Phase 0 tokens (--afa-plum-black/
// --afa-terracotta/--afa-gold, literal white cards) onto the locked
// ink/cream/amber/orange system, per the approved Figma Make export
// ("Venues Directory + Detail", verified against real schema 19 Aug -
// see docs/design.md). Replaces the old circular-monogram fallback
// (monogramTone) with the capacity-tier illustrated panel (VenueNoPhoto)
// since Venue has no genre-equivalent category field. Also fixes
// BUG-2608-074-class mobile clipping - the grid previously had zero
// @media breakpoints.
export default function VenuesGridClient({ venues, defaultCity }: { venues: VenueItem[]; defaultCity?: string | null }) {
  const { t: tr } = useLocale()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [navigatingId, setNavigatingId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const cityOptions = Array.from(new Map(venues.map((v) => [v.city, v.country])).entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([city, country]) => ({ city, label: cityLabel(city, country) }))
  const cities = cityOptions.map((c) => c.city)
  const [selectedCity, setSelectedCity] = useState(
    defaultCity && cities.includes(defaultCity) ? defaultCity : "All Cities"
  )

  const goToVenue = (id: string) => {
    if (navigatingId) return
    setNavigatingId(id)
    startTransition(() => {
      router.push(`/venues/${id}`)
    })
  }

  const filtered = venues.filter((v) => {
    const matchSearch =
      v.name.toLowerCase().includes(search.toLowerCase()) || v.city.toLowerCase().includes(search.toLowerCase())
    const matchCity = selectedCity === "All Cities" || v.city === selectedCity
    return matchSearch && matchCity
  })

  const tierLabel = (capacity: number) => {
    const tier = capacityTier(capacity)
    return tier === "intimate" ? tr.venuesPage.tierIntimate : tier === "mid" ? tr.venuesPage.tierMidSize : tr.venuesPage.tierLarge
  }

  return (
    <div>
      <style>{`
        .afa-venues-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px; }
        @media (max-width: 700px) {
          .afa-venues-grid { grid-template-columns: 1fr; gap: 20px; }
        }
        /* BUG-2608-072 (gap 4) - export uses group-hover:border-amber/60
           on the card border and group-hover:text-amber on the title,
           plus a fade-in arrow button - none of that was wired up.
           Border set here (not inline) so the :hover rule can actually
           win - an inline style's border would always beat a stylesheet
           :hover rule regardless of specificity tricks. */
        .afa-venue-card { border: 1px solid rgba(245,245,240,0.1); transition: border-color 0.3s ease; }
        .afa-venue-card:hover { border-color: rgba(201,151,58,0.6); }
        .afa-venue-card-title { color: var(--afa-cream); transition: color 0.3s ease; }
        .afa-venue-card:hover .afa-venue-card-title { color: var(--afa-amber); }
        .afa-venue-card-arrow { opacity: 0; }
        .afa-venue-card:hover .afa-venue-card-arrow { opacity: 1; }
      `}</style>

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", marginBottom: "20px" }}>
        <BrowseSearchDropdown
          query={search}
          items={filtered}
          getId={(v) => v.id}
          emptyLabel={tr.common.nounVenues}
          translate
          onSelect={(v) => goToVenue(v.id)}
          renderRow={(v) => (
            <>
              <span style={{ fontWeight: 600 }}>{v.name}</span>
              <span style={{ opacity: 0.5, marginLeft: "8px" }}>{v.city}</span>
            </>
          )}
        >
          <div className="afa-search-box" style={{ display: "flex", alignItems: "center", width: "100%", maxWidth: "360px", background: "var(--afa-surface-page)", border: "1px solid rgba(245,245,240,0.15)", borderRadius: "8px", boxSizing: "border-box" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr.venuesPage.searchPlaceholder}
              style={{ flex: 1, padding: "10px 4px 10px 14px", border: "none", background: "transparent", fontSize: "14px", fontFamily: "var(--font-sans)", color: "var(--afa-text-primary)", outline: "none" }}
            />
            <SearchIcon style={{ width: "16px", height: "16px", marginRight: "14px", color: "rgba(245,245,240,0.45)", flexShrink: 0 }} />
          </div>
        </BrowseSearchDropdown>

        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          style={{ padding: "10px 14px", borderRadius: "8px", border: "1.5px solid rgba(245,245,240,0.15)", fontSize: "13px", fontFamily: "var(--font-sans)", color: "var(--afa-text-primary)", background: "var(--afa-surface-page)", cursor: "pointer", outline: "none" }}
        >
          <option value="All Cities">{tr.venuesPage.filterAllCities}</option>
          {cityOptions.map((c) => (
            <option key={c.city} value={c.city}>{c.label}</option>
          ))}
        </select>
      </div>

      <div className="afa-venues-grid">
      {filtered.map((v) => {
        const isNavigatingThis = navigatingId === v.id
        const photo = v.photos?.find((p) => !isPlaceholderImageUrl(p)) || null
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
            className="hover-lift-card afa-focusable afa-venue-card"
            style={{
              position: "relative",
              display: "block",
              background: "var(--afa-surface-raised)",
              overflow: "hidden",
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
                  background: "rgba(20,20,20,0.7)",
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
                    border: "3px solid rgba(245,245,240,0.15)",
                    borderTopColor: "var(--afa-fill-solid)",
                    animation: "afa-spin 0.7s linear infinite",
                  }}
                />
                <style>{`@keyframes afa-spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3", overflow: "hidden" }}>
              {photo ? (
                <Photo src={photo} alt={v.name} />
              ) : (
                <VenueNoPhoto capacity={v.capacity} tierLabel={tierLabel(v.capacity)} />
              )}
              <span
                className="afa-venue-card-arrow"
                style={{
                  position: "absolute",
                  top: "12px",
                  right: "12px",
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid rgba(245,245,240,0.2)",
                  background: "rgba(10,10,10,0.4)",
                  backdropFilter: "blur(4px)",
                  color: "var(--afa-cream)",
                  transition: "opacity 0.3s ease",
                }}
              >
                <ArrowUpRightIcon style={{ width: "16px", height: "16px" }} />
              </span>
            </div>

            <div style={{ padding: "14px 18px 20px" }}>
              <h2 className="afa-venue-card-title" style={{ fontFamily: "var(--font-display)", fontSize: "26px", lineHeight: 1.05, letterSpacing: "-0.01em", marginBottom: "6px" }}>
                {v.name}
              </h2>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", fontSize: "13px", color: "rgba(245,245,240,0.6)" }}>
                <span>{cityLabel(v.city, v.country)}</span>
                <span style={{ opacity: 0.5 }}>·</span>
                <span>{v.capacity.toLocaleString("en-IN")} {tr.venuesPage.seatsLabel}</span>
              </div>
              {v.priceRangeLabel && (
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--afa-text-primary)", opacity: 0.55, marginTop: "10px" }}>{v.priceRangeLabel}</div>
              )}
            </div>
          </div>
        )
      })}
      </div>
    </div>
  )
}
