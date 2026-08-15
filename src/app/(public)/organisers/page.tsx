"use client"
import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import SiteNav from "@/components/SiteNav"
import BrowseSearchDropdown from "@/components/BrowseSearchDropdown"
import { useLocale } from "@/lib/i18n/translate"

interface OrganiserItem {
  id: string
  orgName: string
  bio: string | null
  user: { name: string; avatar: string | null }
  _count: { events: number }
}

// Session 62, design.md §9.5 - net-new public page. Same click-guard
// pattern as /artists (PR #312) and /events (PR #261) - a plain Link with
// no click feedback reads as "nothing happened" on a slow render.
export default function OrganisersPage() {
  const { t: tr } = useLocale()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [navigatingId, setNavigatingId] = useState<string | null>(null)

  const goToOrganiser = (id: string) => {
    if (navigatingId) return
    setNavigatingId(id)
    startTransition(() => {
      router.push(`/organisers/${id}`)
    })
  }

  const [organisers, setOrganisers] = useState<OrganiserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")

  useEffect(() => {
    fetch("/api/organisers")
      .then((res) => {
        if (!res.ok) throw new Error(tr.organisersPage.failedToLoad)
        return res.json()
      })
      .then(setOrganisers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = organisers.filter((o) => o.orgName.toLowerCase().includes(search.toLowerCase()))

  return (
    <main style={{ minHeight: "100vh", background: "var(--afa-surface-raised)", fontFamily: "system-ui, sans-serif" }}>
      <SiteNav />

      <div style={{ background: "var(--afa-surface-inverse)", padding: "56px 48px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 900, color: "white", marginBottom: "8px", lineHeight: 1.1 }}>
            {tr.organisersPage.heroPrefix}<em style={{ color: "var(--afa-terracotta)", fontStyle: "italic" }}>{tr.organisersPage.heroEmphasis}</em>{tr.organisersPage.heroSuffix}
          </div>
          <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.5)", marginBottom: "32px" }}>
            {loading ? tr.organisersPage.loading : tr.organisersPage.countTemplate.replace("{n}", String(filtered.length))}
          </p>
          <BrowseSearchDropdown
            query={search}
            items={filtered}
            getId={(o) => o.id}
            emptyLabel={tr.common.nounOrganisers}
            translate
            onSelect={(o) => goToOrganiser(o.id)}
            renderRow={(o) => (
              <span style={{ fontWeight: 600 }}>{o.orgName}</span>
            )}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr.organisersPage.searchPlaceholder}
              style={{ width: "100%", padding: "18px 56px 18px 20px", borderRadius: "10px", border: "none", fontSize: "16px", background: "white", color: "var(--afa-text-primary)", outline: "none", boxSizing: "border-box" }}
            />
            <span style={{ position: "absolute", right: "20px", top: "50%", transform: "translateY(-50%)", fontSize: "20px" }}>🔍</span>
          </BrowseSearchDropdown>
        </div>
      </div>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>
        {error && (
          <div style={{ padding: "14px 16px", background: "var(--afa-error-bg)", border: "1px solid var(--afa-error-border)", borderRadius: "8px", color: "var(--afa-error)", fontSize: "14px", marginBottom: "24px" }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--afa-text-primary)", opacity: 0.5 }}>{tr.organisersPage.loading}</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div style={{ fontSize: "64px", marginBottom: "16px" }}>🎭</div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", fontWeight: 700, color: "var(--afa-text-primary)", marginBottom: "8px" }}>
              {organisers.length === 0 ? tr.organisersPage.emptyNoneYetTitle : tr.organisersPage.emptyNoneFoundTitle}
            </div>
            <p style={{ fontSize: "14px", color: "var(--afa-text-primary)", opacity: 0.5 }}>
              {organisers.length === 0 ? tr.organisersPage.emptyNoneYetSub : tr.organisersPage.emptyNoneFoundSub}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
            {filtered.map((org) => {
              const isNavigatingThis = navigatingId === org.id
              return (
                <div
                  key={org.id}
                  role="link"
                  tabIndex={0}
                  aria-busy={isNavigatingThis}
                  onClick={() => goToOrganiser(org.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      goToOrganiser(org.id)
                    }
                  }}
                  className="hover-lift-card"
                  style={{
                    background: "white",
                    borderRadius: "16px",
                    overflow: "hidden",
                    border: "1px solid rgba(14,12,10,0.08)",
                    position: "relative",
                    cursor: navigatingId ? "default" : "pointer",
                    opacity: navigatingId && !isNavigatingThis ? 0.5 : 1,
                    transition: "opacity 0.15s ease",
                  }}
                >
                  {isNavigatingThis && (
                    <div style={{ position: "absolute", inset: 0, zIndex: 2, background: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: "28px", height: "28px", borderRadius: "50%", border: "3px solid rgba(14,12,10,0.15)", borderTopColor: "var(--afa-terracotta)", animation: "afa-spin 0.7s linear infinite" }} />
                      <style>{`@keyframes afa-spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                  )}
                  <div style={{ padding: "24px", display: "flex", gap: "16px", alignItems: "center", background: "var(--afa-plum-black)" }}>
                    <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "3px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", fontWeight: 700, color: "white", flexShrink: 0, overflow: "hidden" }}>
                      {org.user.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={org.user.avatar} alt={org.orgName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        org.orgName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div style={{ fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: 700, color: "white" }}>{org.orgName}</div>
                  </div>
                  <div style={{ padding: "16px 20px" }}>
                    <p style={{ fontSize: "13px", color: "var(--afa-text-primary)", opacity: org.bio ? 0.7 : 0.4, marginBottom: "12px", lineHeight: 1.5, minHeight: "36px", fontStyle: org.bio ? "normal" : "italic" }}>
                      {org.bio || tr.organisersPage.noBioYet}
                    </p>
                    <div style={{ fontSize: "12px", color: "var(--afa-text-primary)", opacity: 0.5 }}>
                      {org._count.events} {org._count.events === 1 ? tr.organisersPage.eventSingular : tr.organisersPage.eventPlural}
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
