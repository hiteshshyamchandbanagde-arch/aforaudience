"use client"
import SiteNav from "@/components/SiteNav"
import VenueFollowButton from "./VenueFollowButton"
import { useLocale } from "@/lib/i18n/translate"

interface SeatSection {
  id: string
  name: string
  seats: number
  price: number
}

// Plain, minimal, JSON-serializable shape - deliberately not the full
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
}

// Split out of page.tsx (server component - direct prisma access, can't
// call the client-only useLocale hook itself) so every string on this
// page can pick up the active locale, same pattern as VenuesHero.tsx.
// Facility names and seat-section names are venue-owner-entered content
// (like genre names on /artists) - deliberately left untranslated.
export default function VenueDetailClient({ venue }: { venue: VenueDetailData | null }) {
  const { t: tr } = useLocale()

  if (!venue) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--afa-cream)", fontFamily: "system-ui, sans-serif" }}>
        <SiteNav backHref="/venues" backLabel={tr.nav.backToVenues} />
        <div style={{ maxWidth: "760px", margin: "0 auto", padding: "48px 24px" }}>{tr.venueDetailPage.notFound}</div>
      </main>
    )
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--afa-cream)", fontFamily: "system-ui, sans-serif" }}>
      <SiteNav backHref="/venues" backLabel={tr.nav.backToVenues} />
      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "48px 24px" }}>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: "32px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "6px" }}>
          {venue.name}
        </h1>
        <p style={{ fontSize: "14px", color: "var(--afa-ink)", opacity: 0.6, marginBottom: "8px" }}>
          {venue.address}, {venue.city}{venue.state ? `, ${venue.state}` : ""}
        </p>
        <VenueFollowButton venueId={venue.id} /><br />
        <a
          href={venue.directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600, color: "var(--afa-terracotta)", textDecoration: "none", marginBottom: "28px" }}
        >
          📍 {tr.venueDetailPage.getDirections}
        </a>

        <div style={{ background: "var(--afa-white)", borderRadius: "12px", padding: "28px", border: "1px solid rgba(14,12,10,0.08)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
            <div>
              <p style={{ fontSize: "12px", color: "var(--afa-ink)", opacity: 0.5, marginBottom: "4px" }}>{tr.venueDetailPage.totalCapacity}</p>
              <p style={{ fontSize: "24px", fontWeight: 700, color: "var(--afa-ink)" }}>{venue.capacity} {tr.venuesPage.seatsLabel}</p>
            </div>
            <div>
              <p style={{ fontSize: "12px", color: "var(--afa-ink)", opacity: 0.5, marginBottom: "4px" }}>{tr.venueDetailPage.acousticRating}</p>
              <p style={{ fontSize: "24px", fontWeight: 700, color: "var(--afa-ink)" }}>{tr.venueDetailPage.notRatedYet}</p>
            </div>
          </div>

          {venue.facilities && venue.facilities.length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <h2 style={{ fontSize: "14px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "10px" }}>{tr.venueDetailPage.facilitiesHeading}</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {venue.facilities.map((facility) => (
                  <span key={facility} style={{ fontSize: "13px", padding: "5px 12px", background: "var(--afa-cream)", borderRadius: "999px", color: "var(--afa-ink)" }}>
                    {facility}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 style={{ fontSize: "14px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "10px" }}>{tr.venueDetailPage.seatingHeading}</h2>
            {venue.sections.length === 0 ? (
              <p style={{ fontSize: "14px", color: "var(--afa-ink)", opacity: 0.5 }}>{tr.venueDetailPage.seatingComingSoon}</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {venue.sections.map((s) => (
                  <div
                    key={s.id}
                    style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", background: "var(--afa-cream)", borderRadius: "8px", fontSize: "14px" }}
                  >
                    <span style={{ fontWeight: 600, color: "var(--afa-ink)" }}>{s.name}</span>
                    <span style={{ color: "var(--afa-ink)", opacity: 0.7 }}>{s.seats} {tr.venuesPage.seatsLabel}</span>
                    <span style={{ fontWeight: 700, color: "var(--afa-terracotta)" }}>₹{s.price}</span>
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
