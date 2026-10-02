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
    <main style={{ minHeight: "100vh", background: "var(--afa-surface-page)", fontFamily: "var(--font-sans)" }}>
      <SiteNav />

      <div style={{ background: "var(--afa-surface-inverse)", padding: "56px var(--afa-space-48px)" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 900, color: "var(--afa-text-primary)", marginBottom: "var(--afa-space-2)", lineHeight: 1.1 }}>
            {tr.venueOwnersPage.heroPrefix}<em style={{ color: "var(--afa-amber)", fontStyle: "italic" }}>{tr.venueOwnersPage.heroEmphasis}</em>{tr.venueOwnersPage.heroSuffix}
          </div>
          <p style={{ fontSize: "var(--afa-text-title)", color: "var(--afa-text-on-image)", marginBottom: "var(--afa-space-32px)" }}>
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
              style={{ width: "100%", padding: "var(--afa-space-18px) 56px var(--afa-space-18px) var(--afa-space-5)", borderRadius: "var(--afa-radius-lg)", border: "none", fontSize: "var(--afa-text-title)", background: "var(--afa-surface-raised)", color: "var(--afa-text-primary)", outline: "none", boxSizing: "border-box" }}
            />
            <span style={{ position: "absolute", right: "20px", top: "50%", transform: "translateY(-50%)", fontSize: "var(--afa-text-subtitle)" }}>🔍</span>
          </BrowseSearchDropdown>
        </div>
      </div>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "var(--afa-space-32px) var(--afa-space-6)" }}>
        {error && (
          <ErrorBanner style={{ marginBottom: "var(--afa-space-6)" }}>{error}</ErrorBanner>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px var(--afa-space-5)", color: "var(--afa-text-primary)", opacity: 0.5 }}>{tr.venueOwnersPage.loading}</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px var(--afa-space-5)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--afa-text-heading)", fontWeight: 700, color: "var(--afa-text-primary)", marginBottom: "var(--afa-space-2)" }}>
              {owners.length === 0 ? tr.venueOwnersPage.emptyNoneYetTitle : tr.venueOwnersPage.emptyNoneFoundTitle}
            </div>
            <p style={{ fontSize: "var(--afa-text-body)", color: "var(--afa-text-primary)", opacity: 0.5 }}>
              {owners.length === 0 ? tr.venueOwnersPage.emptyNoneYetSub : tr.venueOwnersPage.emptyNoneFoundSub}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "var(--afa-space-5)" }}>
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
                  className="hover-lift-card afa-focusable"
                  style={{
                    background: "var(--afa-surface-raised)",
                    borderRadius: "var(--afa-radius-xs)",
                    overflow: "hidden",
                    border: "1px solid var(--afa-tint-10)",
                    position: "relative",
                    cursor: navigatingId ? "default" : "pointer",
                    opacity: navigatingId && !isNavigatingThis ? 0.5 : 1,
                    transition: "opacity 0.15s ease",
                  }}
                >
                  {isNavigatingThis && (
                    <div style={{ position: "absolute", inset: 0, zIndex: 2, background: "var(--afa-scrim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: "28px", height: "28px", borderRadius: "50%", border: "3px solid var(--afa-border-resting)", borderTopColor: "var(--afa-fill-solid)", animation: "afa-spin 0.7s linear infinite" }} />
                    </div>
                  )}
                  <div style={{ padding: "var(--afa-space-6)", display: "flex", gap: "var(--afa-space-4)", alignItems: "center", borderBottom: "1px solid var(--afa-tint-10)" }}>
                    <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "var(--afa-tint-10)", border: "3px solid var(--afa-tint-20)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "var(--afa-text-subheading)", fontWeight: 700, color: "var(--afa-text-primary)", flexShrink: 0, overflow: "hidden" }}>
                      {owner.user.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={owner.user.avatar} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        displayName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--afa-text-lead)", fontWeight: 700, color: "var(--afa-text-primary)" }}>{displayName}</div>
                  </div>
                  <div style={{ padding: "var(--afa-space-4) var(--afa-space-5)" }}>
                    <p style={{ fontSize: "var(--afa-text-ui)", color: "var(--afa-text-secondary)", opacity: owner.bio ? 0.7 : 0.4, marginBottom: "var(--afa-space-3)", lineHeight: 1.5, minHeight: "36px", fontStyle: owner.bio ? "normal" : "italic" }}>
                      {owner.bio || tr.venueOwnersPage.noBioYet}
                    </p>
                    <div style={{ fontSize: "var(--afa-text-small)", color: "var(--afa-text-secondary)", opacity: 0.5 }}>
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
