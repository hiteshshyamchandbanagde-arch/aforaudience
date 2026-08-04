"use client"
import { useEffect, useState, use } from "react"
import Link from "next/link"
import SiteNav from "@/components/SiteNav"
import BrandLoader from "@/components/BrandLoader"
import { useLocale } from "@/lib/i18n/translate"

interface VenueOwnerDetail {
  id: string
  bio: string | null
  user: { name: string; displayName: string | null; avatar: string | null }
  venues: { id: string; name: string; city: string; capacity: number; photos: string[]; seatingMode: string }[]
}

export default function VenueOwnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { t: tr } = useLocale()
  const [owner, setOwner] = useState<VenueOwnerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch(`/api/venue-owners/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Venue owner not found")
        return res.json()
      })
      .then(setOwner)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (<><SiteNav /><BrandLoader /></>)

  if (error || !owner) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--afa-cream)" }}>
        <SiteNav />
        <div style={{ maxWidth: "600px", margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
          <div style={{ fontSize: "64px", marginBottom: "16px" }}>🏛️</div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "8px" }}>{tr.venueOwnerDetailPage.notFoundHeading}</div>
          <Link href="/venue-owners" style={{ color: "var(--afa-terracotta)", fontSize: "14px", fontWeight: 600 }}>{tr.venueOwnerDetailPage.backToOwners}</Link>
        </div>
      </main>
    )
  }

  const displayName = owner.user.displayName || owner.user.name

  return (
    <main style={{ minHeight: "100vh", background: "var(--afa-cream)", fontFamily: "system-ui, sans-serif" }}>
      <SiteNav />

      <div style={{ background: "var(--afa-plum-black)", padding: "48px 24px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", display: "flex", gap: "24px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ width: "96px", height: "96px", borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "3px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "36px", fontWeight: 700, color: "white", flexShrink: 0, overflow: "hidden" }}>
            {owner.user.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={owner.user.avatar} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: "32px", fontWeight: 700, color: "white", marginBottom: "6px" }}>{displayName}</div>
            <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)" }}>
              {owner.venues.length} {owner.venues.length === 1 ? tr.venueOwnerDetailPage.venueSingular : tr.venueOwnerDetailPage.venuePlural}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ background: "white", borderRadius: "12px", padding: "24px", marginBottom: "24px", border: "1px solid rgba(14,12,10,0.08)" }}>
          <p style={{ fontSize: "14px", color: "var(--afa-ink)", opacity: owner.bio ? 0.8 : 0.4, lineHeight: 1.6, fontStyle: owner.bio ? "normal" : "italic" }}>
            {owner.bio || tr.venueOwnerDetailPage.noBioYet}
          </p>
        </div>

        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "20px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "16px" }}>{tr.venueOwnerDetailPage.venuesHeading}</h2>
        {owner.venues.length === 0 ? (
          <p style={{ fontSize: "14px", color: "var(--afa-ink)", opacity: 0.5 }}>{tr.venueOwnerDetailPage.noPublishedVenuesYet}</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "16px" }}>
            {owner.venues.map((v) => (
              <Link
                key={v.id}
                href={`/venues/${v.id}`}
                style={{ display: "block", background: "white", borderRadius: "12px", overflow: "hidden", border: "1px solid rgba(14,12,10,0.08)", textDecoration: "none" }}
              >
                <div style={{ height: "120px", background: "var(--afa-cream)" }}>
                  {v.photos?.[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.photos[0]} alt={v.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  )}
                </div>
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--afa-ink)" }}>{v.name}</div>
                  <div style={{ fontSize: "12px", color: "var(--afa-ink)", opacity: 0.5 }}>{v.city} · {v.capacity} {tr.venueOwnerDetailPage.seatsLabel}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
