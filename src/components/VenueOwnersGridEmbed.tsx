"use client"
import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

interface VenueOwnerItem {
  id: string
  bio: string | null
  user: { name: string; avatar: string | null }
  _count: { venues: number }
}

// Lean grid, no hero/search header - used inside the Venues↔Owners toggle
// (session 62, design.md §9.5 - toggle-based discovery entry point). The
// full standalone page at /venue-owners has its own hero/search version;
// this is the embeddable variant for a tab context.
export default function VenueOwnersGridEmbed() {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [navigatingId, setNavigatingId] = useState<string | null>(null)
  const [owners, setOwners] = useState<VenueOwnerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

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

  if (loading) return <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--afa-ink)", opacity: 0.5 }}>Loading venue owners...</div>
  if (error) return <div style={{ padding: "14px 16px", background: "var(--afa-error-bg)", border: "1px solid var(--afa-error-border)", borderRadius: "8px", color: "var(--afa-error)", fontSize: "14px" }}>{error}</div>
  if (owners.length === 0) return <p style={{ fontSize: "15px", color: "var(--afa-ink)", opacity: 0.6 }}>No venue owners found yet.</p>

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
      {owners.map((owner) => {
        const isNavigatingThis = navigatingId === owner.id
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
              <div style={{ position: "absolute", inset: 0, zIndex: 2, borderRadius: "12px", background: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: "24px", height: "24px", borderRadius: "50%", border: "3px solid rgba(14,12,10,0.15)", borderTopColor: "var(--afa-terracotta)", animation: "afa-spin 0.7s linear infinite" }} />
                <style>{`@keyframes afa-spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "var(--afa-plum-black)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 700, color: "white", flexShrink: 0, overflow: "hidden" }}>
                {owner.user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={owner.user.avatar} alt={owner.user.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  owner.user.name.charAt(0).toUpperCase()
                )}
              </div>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "17px", fontWeight: 700, color: "var(--afa-ink)" }}>{owner.user.name}</h2>
            </div>
            <p style={{ fontSize: "13px", color: "var(--afa-ink)", opacity: owner.bio ? 0.65 : 0.4, marginBottom: "10px", lineHeight: 1.5, fontStyle: owner.bio ? "normal" : "italic" }}>
              {owner.bio || "No bio yet"}
            </p>
            <div style={{ fontSize: "12px", color: "var(--afa-ink)", opacity: 0.5 }}>
              {owner._count.venues} venue{owner._count.venues === 1 ? "" : "s"}
            </div>
          </div>
        )
      })}
    </div>
  )
}
