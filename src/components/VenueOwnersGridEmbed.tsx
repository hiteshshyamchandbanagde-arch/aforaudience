"use client"
import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import BrowseSearchDropdown from "@/components/BrowseSearchDropdown"
import { useLocale } from "@/lib/i18n/translate"

interface VenueOwnerItem {
  id: string
  bio: string | null
  user: { name: string; displayName: string | null; avatar: string | null }
  _count: { venues: number }
}

// Session 65 - this used to be a lean grid with no search at all (see
// history below); added search + BrowseSearchDropdown to match /events
// and /artists, since this embed is what the Venues↔Owners toggle
// actually renders (the standalone /venue-owners page's search doesn't
// reach users through normal nav).
//
// Originally: "Lean grid, no hero/search header - used inside the
// Venues↔Owners toggle (session 62, design.md §9.5 - toggle-based
// discovery entry point). The full standalone page at /venue-owners has
// its own hero/search version; this is the embeddable variant for a tab
// context." - that split turned out to mean the search never actually
// reached anyone using the real nav flow.
export default function VenueOwnersGridEmbed() {
  const { t: tr } = useLocale()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [navigatingId, setNavigatingId] = useState<string | null>(null)
  const [owners, setOwners] = useState<VenueOwnerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")

  useEffect(() => {
    fetch("/api/venue-owners")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load venue owners")
        return res.json()
      })
      .then(setOwners)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const goToOwner = (id: string) => {
    if (navigatingId) return
    setNavigatingId(id)
    startTransition(() => {
      router.push(`/venue-owners/${id}`)
    })
  }

  if (loading) return <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--afa-text-primary)", opacity: 0.5 }}>{tr.venueOwnersEmbed.loading}</div>
  if (error) return <div style={{ padding: "14px 16px", background: "var(--afa-error-bg)", border: "1px solid var(--afa-error-border)", borderRadius: "8px", color: "var(--afa-error)", fontSize: "14px" }}>{error}</div>
  if (owners.length === 0) return <p style={{ fontSize: "15px", color: "var(--afa-text-primary)", opacity: 0.6 }}>{tr.venueOwnersEmbed.emptyNone}</p>

  const filtered = owners.filter((o) => (o.user.displayName || o.user.name).toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <BrowseSearchDropdown
        query={search}
        items={filtered}
        getId={(o) => o.id}
        emptyLabel={tr.common.nounVenueOwners}
        translate
        onSelect={(o) => goToOwner(o.id)}
        renderRow={(o) => (
          <span style={{ fontWeight: 600 }}>{o.user.displayName || o.user.name}</span>
        )}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tr.venueOwnersEmbed.searchPlaceholder}
          style={{ width: "100%", maxWidth: "360px", padding: "10px 14px", borderRadius: "8px", border: "1px solid rgba(245,245,240,0.15)", fontSize: "14px", marginBottom: "20px", boxSizing: "border-box", background: "var(--afa-surface-page)", color: "var(--afa-text-primary)", outline: "none" }}
        />
      </BrowseSearchDropdown>

      <style>{`
        .afa-owners-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
        @media (max-width: 700px) {
          .afa-owners-grid { grid-template-columns: 1fr; gap: 16px; }
        }
      `}</style>
      <div className="afa-owners-grid">
      {filtered.map((owner) => {
        const isNavigatingThis = navigatingId === owner.id
        const displayName = owner.user.displayName || owner.user.name
        return (
          <div
            key={owner.id}
            role="link"
            tabIndex={0}
            aria-busy={isNavigatingThis}
            onClick={() => goToOwner(owner.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                goToOwner(owner.id)
              }
            }}
            style={{
              position: "relative",
              background: "var(--afa-surface-raised)",
              borderRadius: "12px",
              padding: "22px",
              border: "1px solid rgba(245,245,240,0.1)",
              cursor: navigatingId ? "default" : "pointer",
              opacity: navigatingId && !isNavigatingThis ? 0.5 : 1,
              transition: "opacity 0.15s ease",
            }}
          >
            {isNavigatingThis && (
              <div style={{ position: "absolute", inset: 0, zIndex: 2, borderRadius: "12px", background: "rgba(20,20,20,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: "24px", height: "24px", borderRadius: "50%", border: "3px solid rgba(245,245,240,0.15)", borderTopColor: "var(--afa-fill-solid)", animation: "afa-spin 0.7s linear infinite" }} />
                <style>{`@keyframes afa-spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "var(--afa-fill-solid)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 700, color: "var(--afa-on-fill-solid)", flexShrink: 0, overflow: "hidden" }}>
                {owner.user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={owner.user.avatar} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  displayName.charAt(0).toUpperCase()
                )}
              </div>
              <h2 style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "17px", fontWeight: 600, color: "var(--afa-cream)" }}>{displayName}</h2>
            </div>
            <p style={{ fontSize: "13px", color: "var(--afa-text-primary)", opacity: owner.bio ? 0.65 : 0.4, marginBottom: "10px", lineHeight: 1.5, fontStyle: owner.bio ? "normal" : "italic" }}>
              {owner.bio || tr.venueOwnersEmbed.noBioYet}
            </p>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.04em", color: "var(--afa-amber)", opacity: 0.8 }}>
              {owner._count.venues} {owner._count.venues === 1 ? tr.venueOwnersEmbed.venueSingular : tr.venueOwnersEmbed.venuePlural}
            </div>
          </div>
        )
      })}
      </div>
    </div>
  )
}
