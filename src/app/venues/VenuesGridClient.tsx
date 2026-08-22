"use client"
import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import BrowseSearchDropdown from "@/components/BrowseSearchDropdown"
import Photo from "@/components/Photo"
import VenueNoPhoto, { capacityTier } from "@/components/VenueNoPhoto"
import { cityLabel } from "@/lib/country-codes"
import { isPlaceholderImageUrl } from "@/lib/placeholder-image"
import { useLocale } from "@/lib/i18n/translate"
import { ArrowUpRightIcon, ChevronDownIcon } from "@/components/icons/VenueIcons"
import SearchInputBox from "@/components/SearchInputBox"

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
  // BUG-2608-079 - a dead venue.photos[0] URL previously left Photo
  // rendering a broken card image. Cards are rendered inline in this
  // .map() rather than as their own component, so failures are tracked
  // per venue id in one Set here instead of per-card local state.
  const [failedPhotoIds, setFailedPhotoIds] = useState<Set<string>>(new Set())
  const cityOptions = Array.from(new Map(venues.map((v) => [v.city, v.country])).entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([city, country]) => ({ city, label: cityLabel(city, country) }))
  const cities = cityOptions.map((c) => c.city)
  const [selectedCity, setSelectedCity] = useState(
    defaultCity && cities.includes(defaultCity) ? defaultCity : "All Cities"
  )
  const [cityOpen, setCityOpen] = useState(false)
  const cityRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) setCityOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

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
        /* City filter (Gap 7, full-fidelity audit) - export's custom
           listbox trigger/option hover states, same inline-style-can't-
           :hover reasoning as the card border above. */
        .afa-city-filter-trigger { border-color: rgba(245,245,240,0.15); }
        .afa-city-filter-trigger:hover { border-color: rgba(201,151,58,0.4); }
        .afa-city-filter-option { background: transparent; }
        .afa-city-filter-option:hover { background: rgba(245,245,240,0.06); }
      `}</style>

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 280px" }}>
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
            <SearchInputBox
              value={search}
              onChange={setSearch}
              placeholder={tr.venuesPage.searchPlaceholder}
              style={{ width: "100%" }}
            />
          </BrowseSearchDropdown>
        </div>

        <div ref={cityRef} style={{ position: "relative", width: "256px", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setCityOpen((o) => !o)}
            className="afa-city-filter-trigger"
            style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "14px 16px", borderWidth: "1px", borderStyle: "solid", background: "var(--afa-surface-page)", color: "var(--afa-text-primary)", fontSize: "15px", fontFamily: "var(--font-sans)", cursor: "pointer", textAlign: "left" }}
          >
            <span style={{ opacity: selectedCity === "All Cities" ? 0.65 : 1 }}>
              {selectedCity === "All Cities" ? tr.venuesPage.filterAllCities : cityOptions.find((c) => c.city === selectedCity)?.label ?? selectedCity}
            </span>
            <ChevronDownIcon style={{ width: "16px", height: "16px", color: "rgba(245,245,240,0.45)", flexShrink: 0, transition: "transform 0.2s ease", transform: cityOpen ? "rotate(180deg)" : "none" }} />
          </button>
          {cityOpen && (
            <ul style={{ position: "absolute", zIndex: 20, top: "calc(100% + 4px)", left: 0, right: 0, margin: 0, padding: "4px 0", listStyle: "none", background: "var(--afa-surface-page)", border: "1px solid rgba(245,245,240,0.15)", boxShadow: "0 12px 40px rgba(0,0,0,0.4)" }}>
              <li>
                <button
                  type="button"
                  onClick={() => { setSelectedCity("All Cities"); setCityOpen(false) }}
                  className="afa-city-filter-option"
                  style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", border: "none", cursor: "pointer", fontSize: "14px", fontFamily: "var(--font-sans)", textAlign: "left", color: selectedCity === "All Cities" ? "var(--afa-amber)" : "var(--afa-text-primary)" }}
                >
                  {tr.venuesPage.filterAllCities}
                </button>
              </li>
              {cityOptions.map((c) => (
                <li key={c.city}>
                  <button
                    type="button"
                    onClick={() => { setSelectedCity(c.city); setCityOpen(false) }}
                    className="afa-city-filter-option"
                    style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", border: "none", cursor: "pointer", fontSize: "14px", fontFamily: "var(--font-sans)", textAlign: "left", color: c.city === selectedCity ? "var(--afa-amber)" : "var(--afa-text-primary)" }}
                  >
                    {c.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Export (VenuesDirectory.tsx line 99-102) shows a live results
          count between the controls and the grid - missing entirely from
          the live build until this audit. */}
      <div style={{ marginTop: "24px", marginBottom: "24px", fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--afa-text-primary)", opacity: 0.5 }}>
        {filtered.length} {filtered.length === 1 ? tr.venuesPage.resultsCountSingular : tr.venuesPage.resultsCountPlural}
        {selectedCity !== "All Cities" && tr.venuesPage.resultsCountInCity.replace("{city}", cityOptions.find((c) => c.city === selectedCity)?.label ?? selectedCity)}
      </div>

      <div className="afa-venues-grid">
      {filtered.map((v) => {
        const isNavigatingThis = navigatingId === v.id
        const photo = failedPhotoIds.has(v.id) ? null : v.photos?.find((p) => !isPlaceholderImageUrl(p)) || null
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
                <Photo src={photo} alt={v.name} onError={() => setFailedPhotoIds((prev) => new Set(prev).add(v.id))} />
              ) : (
                <VenueNoPhoto capacity={v.capacity} seed={v.id} />
              )}
              {/* BUG-2608-072 gap 4 baked this badge into VenueNoPhoto,
                  so it only ever showed on no-photo fallback cards -
                  export (VenueCard.tsx) overlays it on the media wrapper
                  regardless of whether a real photo or the fallback is
                  showing underneath. */}
              <span style={{ position: "absolute", top: "10px", left: "10px", fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--afa-cream)", opacity: 0.6 }}>
                {tierLabel(v.capacity)}
              </span>
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
