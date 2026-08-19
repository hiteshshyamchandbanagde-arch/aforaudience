"use client"
import SiteNav from "@/components/SiteNav"
import Photo from "@/components/Photo"
import VenueNoPhoto, { capacityTier } from "@/components/VenueNoPhoto"
import VenueFollowButton from "./VenueFollowButton"
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
// (verified 19 Aug, see docs/design.md). Two real bugs fixed as part of
// this build (not cosmetic-only, see page.tsx's comment): this page
// previously rendered zero photos despite venue.photos existing, and
// always showed "Not Rated Yet" regardless of a real acousticRating.
// Facilities move from pill-chips to icon+label rows. Fixes
// BUG-2608-074-class mobile clipping on the stat-pair grid (zero
// @media breakpoints previously). No-photo fallback uses the
// capacity-tier illustration (VenueNoPhoto) - see that component's
// comment for why (no genre-equivalent category field on Venue).
export default function VenueDetailClient({ venue }: { venue: VenueDetailData | null }) {
  const { t: tr } = useLocale()

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
  const realPhoto = venue.photos?.find((p) => !isPlaceholderImageUrl(p)) || null

  return (
    <main style={{ minHeight: "100vh", background: "var(--afa-surface-page)", fontFamily: "var(--font-sans)" }}>
      <style>{`
        .afa-venue-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .afa-venue-facilities { display: grid; grid-template-columns: 1fr; gap: 0; }
        @media (min-width: 640px) {
          .afa-venue-facilities { grid-template-columns: 1fr 1fr; column-gap: 40px; }
        }
      `}</style>
      <SiteNav backHref="/venues" backLabel={tr.nav.backToVenues} />
      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "48px 24px" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "32px", fontWeight: 700, color: "var(--afa-cream)", marginBottom: "6px" }}>
          {venue.name}
        </h1>
        <p style={{ fontSize: "14px", color: "var(--afa-text-primary)", opacity: 0.6, marginBottom: "8px" }}>
          {venue.address}, {venue.city}{venue.state ? `, ${venue.state}` : ""}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
          <VenueFollowButton venueId={venue.id} />
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

        <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", borderRadius: "12px", overflow: "hidden", marginBottom: "8px" }}>
          {realPhoto ? (
            <Photo src={realPhoto} alt={venue.name} />
          ) : (
            <VenueNoPhoto capacity={venue.capacity} tierLabel={tierLabel} size="hero" />
          )}
        </div>
        {!realPhoto && (
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.03em", color: "var(--afa-text-primary)", opacity: 0.4, textTransform: "uppercase", marginBottom: "24px" }}>
            {tr.venueDetailPage.noPhotosCaption}
          </p>
        )}

        <div style={{ background: "var(--afa-surface-raised)", borderRadius: "12px", padding: "28px", border: "1px solid rgba(245,245,240,0.1)", marginTop: realPhoto ? "24px" : 0 }}>
          <div className="afa-venue-stats" style={{ marginBottom: "24px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <CapacityIcon style={{ width: "18px", height: "18px", color: "var(--afa-amber)", marginTop: "2px", flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: "12px", color: "var(--afa-text-primary)", opacity: 0.5, marginBottom: "4px" }}>{tr.venueDetailPage.totalCapacity}</p>
                <p style={{ fontSize: "24px", fontWeight: 700, color: "var(--afa-cream)" }}>{venue.capacity} {tr.venuesPage.seatsLabel}</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <AcousticIcon style={{ width: "18px", height: "18px", color: "var(--afa-amber)", marginTop: "2px", flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: "12px", color: "var(--afa-text-primary)", opacity: 0.5, marginBottom: "4px" }}>{tr.venueDetailPage.acousticRating}</p>
                <p style={{ fontSize: "24px", fontWeight: 700, color: "var(--afa-cream)" }}>
                  {venue.acousticRating != null ? venue.acousticRating.toFixed(1) : tr.venueDetailPage.notRatedYet}
                </p>
              </div>
            </div>
          </div>

          {venue.facilities && venue.facilities.length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 700, color: "var(--afa-cream)", marginBottom: "4px", paddingBottom: "10px", borderBottom: "1px solid rgba(245,245,240,0.1)" }}>{tr.venueDetailPage.facilitiesHeading}</h2>
              <div className="afa-venue-facilities">
                {venue.facilities.map((facility) => (
                  <div key={facility} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 0", borderTop: "1px solid rgba(245,245,240,0.08)" }}>
                    <FacilityIcon label={facility} style={{ width: "16px", height: "16px", color: "var(--afa-amber)", flexShrink: 0 }} />
                    <span style={{ fontSize: "14px", color: "var(--afa-text-primary)" }}>{facility}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 700, color: "var(--afa-cream)", marginBottom: "10px" }}>{tr.venueDetailPage.seatingHeading}</h2>
            {venue.sections.length === 0 ? (
              <p style={{ fontSize: "14px", color: "var(--afa-text-primary)", opacity: 0.5 }}>{tr.venueDetailPage.seatingComingSoon}</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {venue.sections.map((s) => (
                  <div
                    key={s.id}
                    style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", background: "var(--afa-surface-page)", borderRadius: "8px", fontSize: "14px" }}
                  >
                    <span style={{ fontWeight: 600, color: "var(--afa-cream)" }}>{s.name}</span>
                    <span style={{ color: "var(--afa-text-primary)", opacity: 0.7 }}>{s.seats} {tr.venuesPage.seatsLabel}</span>
                    <span style={{ fontWeight: 700, color: "var(--afa-amber)" }}>₹{s.price}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
