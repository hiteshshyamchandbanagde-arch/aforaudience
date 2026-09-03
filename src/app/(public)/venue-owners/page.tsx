"use client"
import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import SiteNav from "@/components/SiteNav"
import BrowseSearchDropdown from "@/components/BrowseSearchDropdown"
import { ErrorBanner } from "@/components/ErrorBanner"
import { useLocale } from "@/lib/i18n/translate"

interface VenueOwnerItem {
  id: string
  bio: string | null
  user: { name: string; displayName: string | null; avatar: string | null }
  _count: { venues: number }
}

// Session 62, design.md §9.5 - net-new public page, mirrors /organisers.
export default function VenueOwnersPage() {
  const { t: tr } = useLocale()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [navigatingId, setNavigatingId] = useState<string | null>(null)

  const goToOwner = (id: string) => {
    if (navigatingId) return
    setNavigatingId(id)
    startTransition(() => {
      router.push(`/venue-owners/${id}`)
    })
  }

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

  const filtered = owners.filter((o) => (o.user.displayName || o.user.name).toLowerCase().includes(search.toLowerCase()))

  return (
    <main style={{ minHeight: "100vh", background: "var(--afa-surface-page)", fontFamily: "system-ui, sans-serif" }}>
      <SiteNav />

      <div style={{ background: "var(--afa-surface-inverse)", padding: "56px 48px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 900, color: "var(--afa-text-primary)", marginBottom: "8px", lineHeight: 1.1 }}>
            {tr.venueOwnersPage.heroPrefix}<em style={{ color: "var(--afa-amber)", fontStyle: "italic" }}>{tr.venueOwnersPage.heroEmphasis}</em>{tr.venueOwnersPage.heroSuffix}
          </div>
          <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.5)", marginBottom: "32px" }}>
            {loading ? tr.venueOwnersPage.loading : tr.venueOwnersPage.countHosting.replace("{n}", String(filtered.length))}
          </p>
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
              placeholder={tr.venueOwnersPage.searchPlaceholder}
              style={{ width: "100%", padding: "18px 56px 18px 20px", borderRadius: "10px", border: "none", fontSize: "16px", background: "white", color: "var(--afa-ink)", outline: "none", boxSizing: "border-box" }}
            />
            <span style={{ position: "absolute", right: "20px", top: "50%", transform: "translateY(-50%)", fontSize: "20px" }}>🔍</span>
          </BrowseSearchDropdown>
        </div>
      </div>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>
        {error && (
          <ErrorBanner style={{ marginBottom: "24px" }}>{error}</ErrorBanner>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--afa-text-primary)", opacity: 0.5 }}>{tr.venueOwnersPage.loading}</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 700, color: "var(--afa-text-primary)", marginBottom: "8px" }}>
              {owners.length === 0 ? tr.venueOwnersPage.emptyNoneYetTitle : tr.venueOwnersPage.emptyNoneFoundTitle}
            </div>
            <p style={{ fontSize: "14px", color: "var(--afa-text-primary)", opacity: 0.5 }}>
              {owners.length === 0 ? tr.venueOwnersPage.emptyNoneYetSub : tr.venueOwnersPage.emptyNoneFoundSub}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
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
                  className="hover-lift-card"
                  style={{
                    background: "var(--afa-surface-raised)",
                    borderRadius: "3px",
                    overflow: "hidden",
                    border: "1px solid rgba(245,245,240,0.1)",
                    position: "relative",
                    cursor: navigatingId ? "default" : "pointer",
                    opacity: navigatingId && !isNavigatingThis ? 0.5 : 1,
                    transition: "opacity 0.15s ease",
                  }}
                >
                  {isNavigatingThis && (
                    <div style={{ position: "absolute", inset: 0, zIndex: 2, background: "rgba(10,10,10,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: "28px", height: "28px", borderRadius: "50%", border: "3px solid rgba(245,245,240,0.15)", borderTopColor: "var(--afa-fill-solid)", animation: "afa-spin 0.7s linear infinite" }} />
                      <style>{`@keyframes afa-spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                  )}
                  <div style={{ padding: "24px", display: "flex", gap: "16px", alignItems: "center", borderBottom: "1px solid rgba(245,245,240,0.1)" }}>
                    <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "rgba(245,245,240,0.1)", border: "3px solid rgba(245,245,240,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", fontWeight: 700, color: "var(--afa-text-primary)", flexShrink: 0, overflow: "hidden" }}>
                      {owner.user.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={owner.user.avatar} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        displayName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 700, color: "var(--afa-text-primary)" }}>{displayName}</div>
                  </div>
                  <div style={{ padding: "16px 20px" }}>
                    <p style={{ fontSize: "13px", color: "var(--afa-text-secondary)", opacity: owner.bio ? 0.7 : 0.4, marginBottom: "12px", lineHeight: 1.5, minHeight: "36px", fontStyle: owner.bio ? "normal" : "italic" }}>
                      {owner.bio || tr.venueOwnersPage.noBioYet}
                    </p>
                    <div style={{ fontSize: "12px", color: "var(--afa-text-secondary)", opacity: 0.5 }}>
                      {owner._count.venues} {owner._count.venues === 1 ? tr.venueOwnersPage.venueSingular : tr.venueOwnersPage.venuePlural}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
