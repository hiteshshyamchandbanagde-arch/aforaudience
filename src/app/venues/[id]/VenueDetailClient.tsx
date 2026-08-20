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
  // Gap 10, full-fidelity audit (20 Aug) - the export renders a real
  // multi-photo gallery (VenueDetail.tsx line 67-78) - one large photo
  // plus up to 4 square thumbnails - when the venue has real photos, not
  // just the first one.
  const realPhotos = (venue.photos || []).filter((p) => !isPlaceholderImageUrl(p))
  const hasRealPhoto = realPhotos.length > 0

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
        .afa-venue-page-container { max-width: 1240px; margin: 0 auto; padding: 48px 24px; }
        @media (min-width: 768px) { .afa-venue-page-container { padding: 48px 40px; } }
        .afa-venue-content-grid { display: grid; grid-template-columns: 1fr; gap: 40px; }
        .afa-venue-facilities { display: grid; grid-template-columns: 1fr; gap: 0; }
        @media (min-width: 1024px) {
          .afa-venue-content-grid { grid-template-columns: 1fr 320px; gap: 64px; align-items: start; }
          .afa-venue-sidebar { position: sticky; top: 40px; }
        }
        @media (min-width: 640px) {
          .afa-venue-facilities { grid-template-columns: 1fr 1fr; column-gap: 40px; }
        }
        /* Gap 10, full-fidelity audit - export's real multi-photo grid
           (VenueDetail.tsx line 67-78): main photo spans 2 cols/2 rows
           always, up to 4 square thumbnails fill the rest. 2 cols on
           mobile, 4 cols x 2 rows once the extra thumbnail columns fit. */
        .afa-venue-gallery { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .afa-venue-gallery-main { position: relative; grid-column: span 2; grid-row: span 2; aspect-ratio: 4 / 3; overflow: hidden; }
        .afa-venue-gallery-thumb { position: relative; aspect-ratio: 1 / 1; overflow: hidden; }
        @media (min-width: 768px) {
          .afa-venue-gallery { grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(2, 1fr); }
          .afa-venue-gallery-main { aspect-ratio: auto; }
        }
      `}</style>
      <SiteNav backHref="/venues" backLabel={tr.nav.backToVenues} />
      <div className="afa-venue-page-container">
        {/* BUG-2608-075 - title/address and the Follow/Get Directions actions
            were stacked in one left-aligned column. Figma export puts the
            actions on the right, level with the title block, not stacked
            below the address. flex-wrap so it still stacks cleanly on
            narrow viewports instead of forcing the row. */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "20px", marginBottom: "28px" }}>
          <div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--afa-amber)" }}>
              {venue.city}{venue.state ? `, ${venue.state}` : ""} · {tierLabel}
            </span>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(40px, 6vw, 72px)", fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 0.95, color: "var(--afa-cream)", marginTop: "16px", marginBottom: "6px" }}>
              {venue.name}
            </h1>
            <p style={{ maxWidth: "448px", fontSize: "17px", lineHeight: 1.4, color: "var(--afa-text-primary)", opacity: 0.6 }}>
              {venue.address}, {venue.city}{venue.state ? `, ${venue.state}` : ""}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
            <VenueFollowHeaderButton state={follow} />
            {/* BUG-2608-076 - this was a bare text link (no border/padding/
                button shape at all). Figma export gives Get Directions the
                same button chrome as Follow - bordered box, same padding,
                sharp corners - sitting next to it, not a plain inline link. */}
            <a
              href={venue.directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 20px", border: "1.5px solid rgba(201,151,58,0.5)", fontSize: "13px", fontWeight: 600, color: "var(--afa-amber)", textDecoration: "none" }}
            >
              <DirectionsIcon style={{ width: "14px", height: "14px" }} />
              {tr.venueDetailPage.getDirections}
            </a>
          </div>
        </div>

        {hasRealPhoto ? (
          <div className="afa-venue-gallery" style={{ marginBottom: "8px" }}>
            <div className="afa-venue-gallery-main">
              <Photo src={realPhotos[0]} alt={venue.name} />
            </div>
            {realPhotos.slice(1, 5).map((p, i) => (
              <div key={i} className="afa-venue-gallery-thumb">
                <Photo src={p} alt={venue.name} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 7", overflow: "hidden", marginBottom: "8px" }}>
            <VenueNoPhoto capacity={venue.capacity} seed={venue.id} size="hero" />
          </div>
        )}
        {!hasRealPhoto && (
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.03em", color: "var(--afa-text-primary)", opacity: 0.4, textTransform: "uppercase", marginBottom: "24px" }}>
            {noPhotosCaption}
          </p>
        )}

        <div className="afa-venue-content-grid" style={{ marginTop: hasRealPhoto ? "40px" : "16px" }}>
          {/* main column */}
          <div>
            <section>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderBottom: "1px solid rgba(245,245,240,0.15)", paddingBottom: "12px" }}>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 700, color: "var(--afa-cream)" }}>{tr.venueDetailPage.seatingHeading}</h2>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--afa-text-primary)", opacity: 0.5 }}>
                  {venue.sections.length} {tr.venueDetailPage.sectionsLabel}
                </span>
              </div>
              {venue.sections.length === 0 ? (
                <p style={{ fontSize: "14px", color: "var(--afa-text-primary)", opacity: 0.5, marginTop: "16px" }}>{tr.venueDetailPage.seatingComingSoon}</p>
              ) : (
                <table style={{ width: "100%", marginTop: "8px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "12px 0", textAlign: "left", fontWeight: 400, fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--afa-text-primary)", opacity: 0.5 }}>{tr.venueDetailPage.sectionColumnLabel}</th>
                      <th style={{ padding: "12px 0", textAlign: "right", fontWeight: 400, fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--afa-text-primary)", opacity: 0.5 }}>{tr.venueDetailPage.seatsColumnLabel}</th>
                      <th style={{ padding: "12px 0", textAlign: "right", fontWeight: 400, fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--afa-text-primary)", opacity: 0.5 }}>{tr.venueDetailPage.priceColumnLabel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {venue.sections.map((s) => (
                      <tr key={s.id} style={{ borderTop: "1px solid rgba(245,245,240,0.08)" }}>
                        <td style={{ padding: "14px 0", fontFamily: "var(--font-display)", fontSize: "16px", color: "var(--afa-cream)" }}>{s.name}</td>
                        <td style={{ padding: "14px 0", textAlign: "right", color: "var(--afa-text-primary)", opacity: 0.7, fontSize: "14px", fontVariantNumeric: "tabular-nums" }}>{s.seats.toLocaleString("en-IN")}</td>
                        <td style={{ padding: "14px 0", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--afa-cream)", fontSize: "14px" }}>₹{s.price.toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: "1px solid rgba(245,245,240,0.15)" }}>
                      <td style={{ paddingTop: "14px", fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--afa-text-primary)", opacity: 0.5 }}>{tr.venueDetailPage.totalLabel}</td>
                      <td style={{ paddingTop: "14px", textAlign: "right", fontWeight: 700, color: "var(--afa-cream)", fontSize: "14px", fontVariantNumeric: "tabular-nums" }}>
                        {venue.sections.reduce((sum, s) => sum + s.seats, 0).toLocaleString("en-IN")}
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
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 700, color: "var(--afa-cream)", borderBottom: "1px solid rgba(245,245,240,0.15)", paddingBottom: "12px" }}>{tr.venueDetailPage.facilitiesHeading}</h2>
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
