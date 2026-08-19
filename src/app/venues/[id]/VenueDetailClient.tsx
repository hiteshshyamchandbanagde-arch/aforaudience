"use client"
import SiteNav from "@/components/SiteNav"
import Photo from "@/components/Photo"
import VenueNoPhoto, { capacityTier } from "@/components/VenueNoPhoto"
import { VenueFollowHeaderButton, VenueFollowSidebarCta, useVenueFollow } from "./VenueFollowButton"
import { FacilityIcon, CapacityIcon, AcousticIcon, DirectionsIcon } from "@/components/icons/VenueIcons"
import { isPlaceholderImageUrl } from "@/lib/placeholder-image"
import { useLocale } from "@/lib/i18n/translate"

interface SeatSection {
  id: string
  name: string
  seats: number
  price: number
}

// Plain, JSON-serializable shape - deliberately not the full
// Prisma Venue (Date fields etc.) passed straight through from the
// server component, to keep the server/client prop boundary clean.
export interface VenueDetailData {
  id: string
  name: string
  address: string
  city: string
  state: string | null
  capacity: number
  facilities: string[]
  sections: SeatSection[]
  directionsUrl: string
  photos: string[]
  acousticRating: number | null
}

// GEN-2608-074 - migrated off Theme Phase 0 tokens onto the locked
// ink/cream/amber/orange system, per the approved Figma Make export
// (verified 19 Aug, see docs/design.md).
//
// BUG-2608-072 - GEN-2608-074's build flattened the export's real
// information architecture into one stacked, boxed card on every screen
// size. The export (VenueDetail.tsx line ~92) is a two-column desktop
// layout - main content column + a distinct sticky sidebar carrying the
// key-facts stats and a second "Follow this venue" CTA - only collapsing
// to one column below `lg` (1024px). Rebuilt around that real grid here;
// see useVenueFollow in VenueFollowButton.tsx for why the header and
// sidebar Follow buttons share one state instance instead of each
// managing their own.
export default function VenueDetailClient({ venue }: { venue: VenueDetailData | null }) {
  const { t: tr } = useLocale()
  const follow = useVenueFollow(venue?.id ?? null)

  if (!venue) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--afa-surface-page)", fontFamily: "var(--font-sans)" }}>
        <SiteNav backHref="/venues" backLabel={tr.nav.backToVenues} />
        <div style={{ maxWidth: "760px", margin: "0 auto", padding: "48px 24px", color: "var(--afa-text-primary)" }}>{tr.venueDetailPage.notFound}</div>
      </main>
    )
  }

  const tier = capacityTier(venue.capacity)
  const tierLabel = tier === "intimate" ? tr.venuesPage.tierIntimate : tier === "mid" ? tr.venuesPage.tierMidSize : tr.venuesPage.tierLarge
  const noPhotosCaption =
    tier === "intimate" ? tr.venueDetailPage.noPhotosCaptionIntimate : tier === "mid" ? tr.venueDetailPage.noPhotosCaptionMid : tr.venueDetailPage.noPhotosCaptionLarge
  const realPhoto = venue.photos?.find((p) => !isPlaceholderImageUrl(p)) || null

  // BUG-2608-072 (gap 5) - the export's Total row (VenueDetail.tsx line
  // ~122) shows the venue's overall price RANGE (min-max across sections),
  // not a sum of every section's price - summing ₹800+₹500+₹1500 into a
  // single "₹2,800" is a different, wrong number from what a "Total" price
  // column should mean here.
  const sectionPrices = venue.sections.map((s) => s.price).filter((p) => p > 0)
  const totalPriceRange =
    sectionPrices.length === 0
      ? null
      : Math.min(...sectionPrices) === Math.max(...sectionPrices)
        ? `₹${Math.min(...sectionPrices).toLocaleString("en-IN")}`
        : `₹${Math.min(...sectionPrices).toLocaleString("en-IN")}–₹${Math.max(...sectionPrices).toLocaleString("en-IN")}`

  return (
    <main style={{ minHeight: "100vh", background: "var(--afa-surface-page)", fontFamily: "var(--font-sans)" }}>
      <style>{`
        /* BUG-2608-072 (gap 5) - single column below 1024px, sidebar
           content appearing after main content, matching the export's
           lg:grid-cols-[1fr_320px] breakpoint exactly. */
        .afa-venue-content-grid { display: grid; grid-template-columns: 1fr; gap: 40px; }
        .afa-venue-facilities { display: grid; grid-template-columns: 1fr; gap: 0; }
        @media (min-width: 1024px) {
          .afa-venue-content-grid { grid-template-columns: 1fr 320px; gap: 64px; align-items: start; }
          .afa-venue-sidebar { position: sticky; top: 40px; }
        }
        @media (min-width: 640px) {
          .afa-venue-facilities { grid-template-columns: 1fr 1fr; column-gap: 40px; }
        }
      `}</style>
      <SiteNav backHref="/venues" backLabel={tr.nav.backToVenues} />
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "48px 24px" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--afa-amber)" }}>
          {venue.city}{venue.state ? `, ${venue.state}` : ""} · {tierLabel}
        </span>
        <h1 style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "32px", fontWeight: 700, color: "var(--afa-cream)", marginTop: "10px", marginBottom: "6px" }}>
          {venue.name}
        </h1>
        <p style={{ fontSize: "14px", color: "var(--afa-text-primary)", opacity: 0.6, marginBottom: "8px" }}>
          {venue.address}, {venue.city}{venue.state ? `, ${venue.state}` : ""}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
          <VenueFollowHeaderButton state={follow} />
          <a
            href={venue.directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600, color: "var(--afa-amber)", textDecoration: "none" }}
          >
            <DirectionsIcon style={{ width: "14px", height: "14px" }} />
            {tr.venueDetailPage.getDirections}
          </a>
        </div>

        <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", overflow: "hidden", marginBottom: "8px" }}>
          {realPhoto ? (
            <Photo src={realPhoto} alt={venue.name} />
          ) : (
            <VenueNoPhoto capacity={venue.capacity} tierLabel={tierLabel} size="hero" />
          )}
        </div>
        {!realPhoto && (
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.03em", color: "var(--afa-text-primary)", opacity: 0.4, textTransform: "uppercase", marginBottom: "24px" }}>
            {noPhotosCaption}
          </p>
        )}

        <div className="afa-venue-content-grid" style={{ marginTop: realPhoto ? "40px" : "16px" }}>
          {/* main column */}
          <div>
            <section>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderBottom: "1px solid rgba(245,245,240,0.15)", paddingBottom: "12px" }}>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: "20px", fontWeight: 700, color: "var(--afa-cream)" }}>{tr.venueDetailPage.seatingHeading}</h2>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--afa-text-primary)", opacity: 0.5 }}>
                  {venue.sections.length} {tr.venueDetailPage.sectionsLabel}
                </span>
              </div>
              {venue.sections.length === 0 ? (
                <p style={{ fontSize: "14px", color: "var(--afa-text-primary)", opacity: 0.5, marginTop: "16px" }}>{tr.venueDetailPage.seatingComingSoon}</p>
              ) : (
                <table style={{ width: "100%", marginTop: "8px", borderCollapse: "collapse" }}>
                  <tbody>
                    {venue.sections.map((s) => (
                      <tr key={s.id} style={{ borderTop: "1px solid rgba(245,245,240,0.08)" }}>
                        <td style={{ padding: "14px 0", fontFamily: "var(--font-display)", fontSize: "16px", color: "var(--afa-cream)" }}>{s.name}</td>
                        <td style={{ padding: "14px 0", textAlign: "right", color: "var(--afa-text-primary)", opacity: 0.7, fontSize: "14px" }}>{s.seats} {tr.venuesPage.seatsLabel}</td>
                        <td style={{ padding: "14px 0", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--afa-cream)", fontSize: "14px" }}>₹{s.price.toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: "1px solid rgba(245,245,240,0.15)" }}>
                      <td style={{ paddingTop: "14px", fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--afa-text-primary)", opacity: 0.5 }}>{tr.venueDetailPage.totalLabel}</td>
                      <td style={{ paddingTop: "14px", textAlign: "right", fontWeight: 700, color: "var(--afa-cream)", fontSize: "14px" }}>
                        {venue.sections.reduce((sum, s) => sum + s.seats, 0)} {tr.venuesPage.seatsLabel}
                      </td>
                      <td style={{ paddingTop: "14px", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--afa-amber)", fontSize: "14px" }}>
                        {totalPriceRange}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </section>

            {venue.facilities && venue.facilities.length > 0 && (
              <section style={{ marginTop: "56px" }}>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: "20px", fontWeight: 700, color: "var(--afa-cream)", borderBottom: "1px solid rgba(245,245,240,0.15)", paddingBottom: "12px" }}>{tr.venueDetailPage.facilitiesHeading}</h2>
                <div className="afa-venue-facilities">
                  {venue.facilities.map((facility) => (
                    <div key={facility} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 0", borderTop: "1px solid rgba(245,245,240,0.08)" }}>
                      <FacilityIcon label={facility} style={{ width: "18px", height: "18px", color: "var(--afa-amber)", flexShrink: 0 }} />
                      <span style={{ fontSize: "15px", color: "var(--afa-text-primary)" }}>{facility}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* sidebar */}
          <aside className="afa-venue-sidebar">
            <div style={{ borderTop: "1px solid rgba(245,245,240,0.15)", borderBottom: "1px solid rgba(245,245,240,0.15)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "18px 0", borderBottom: "1px solid rgba(245,245,240,0.08)" }}>
                <CapacityIcon style={{ width: "18px", height: "18px", color: "var(--afa-text-primary)", opacity: 0.6, marginTop: "2px", flexShrink: 0 }} />
                <div>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--afa-text-primary)", opacity: 0.5, marginBottom: "4px" }}>{tr.venueDetailPage.totalCapacity}</p>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: "28px", lineHeight: 1, color: "var(--afa-cream)" }}>{venue.capacity.toLocaleString("en-IN")}</p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "18px 0" }}>
                <AcousticIcon style={{ width: "18px", height: "18px", color: "var(--afa-text-primary)", opacity: 0.6, marginTop: "2px", flexShrink: 0 }} />
                <div>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--afa-text-primary)", opacity: 0.5, marginBottom: "4px" }}>{tr.venueDetailPage.acousticRating}</p>
                  {venue.acousticRating != null ? (
                    <p style={{ fontFamily: "var(--font-display)", fontSize: "28px", lineHeight: 1, color: "var(--afa-cream)" }}>
                      {venue.acousticRating.toFixed(1)}
                      <span style={{ marginLeft: "4px", fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--afa-text-primary)", opacity: 0.5, verticalAlign: "top" }}>/5</span>
                    </p>
                  ) : (
                    <p style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "18px", color: "var(--afa-text-primary)", opacity: 0.6 }}>{tr.venueDetailPage.notRatedYet}</p>
                  )}
                </div>
              </div>
            </div>

            <VenueFollowSidebarCta state={follow} />
          </aside>
        </div>
      </div>
    </main>
  )
}
