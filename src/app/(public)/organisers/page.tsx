"use client"
import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import SiteNav from "@/components/SiteNav"
import BrowseSearchDropdown from "@/components/BrowseSearchDropdown"
import { ErrorBanner } from "@/components/ErrorBanner"
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
    <main style={{ minHeight: "100vh", background: "var(--afa-surface-page)", fontFamily: "var(--font-sans)" }}>
      <SiteNav />

      <div style={{ background: "var(--afa-surface-inverse)", padding: "var(--afa-space-56px) var(--afa-space-48px)" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 900, color: "var(--afa-text-primary)", marginBottom: "var(--afa-space-2)", lineHeight: 1.1 }}>
            {tr.organisersPage.heroPrefix}<em style={{ color: "var(--afa-amber)", fontStyle: "italic" }}>{tr.organisersPage.heroEmphasis}</em>{tr.organisersPage.heroSuffix}
          </div>
          <p style={{ fontSize: "var(--afa-text-title)", color: "var(--afa-text-on-image)", marginBottom: "var(--afa-space-32px)" }}>
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
              style={{ width: "100%", padding: "var(--afa-space-18px) var(--afa-space-56px) var(--afa-space-18px) var(--afa-space-5)", borderRadius: "var(--afa-radius-lg)", border: "none", fontSize: "var(--afa-text-title)", background: "var(--afa-surface-raised)", color: "var(--afa-text-primary)", outline: "none", boxSizing: "border-box" }}
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
          <div style={{ textAlign: "center", padding: "var(--afa-space-80px) var(--afa-space-5)", color: "var(--afa-text-primary)", opacity: 0.5 }}>{tr.organisersPage.loading}</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "var(--afa-space-80px) var(--afa-space-5)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--afa-text-heading)", fontWeight: 700, color: "var(--afa-text-primary)", marginBottom: "var(--afa-space-2)" }}>
              {organisers.length === 0 ? tr.organisersPage.emptyNoneYetTitle : tr.organisersPage.emptyNoneFoundTitle}
            </div>
            <p style={{ fontSize: "var(--afa-text-body)", color: "var(--afa-text-primary)", opacity: 0.5 }}>
              {organisers.length === 0 ? tr.organisersPage.emptyNoneYetSub : tr.organisersPage.emptyNoneFoundSub}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "var(--afa-space-5)" }}>
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
                      {org.user.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={org.user.avatar} alt={org.orgName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        org.orgName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--afa-text-lead)", fontWeight: 700, color: "var(--afa-text-primary)" }}>{org.orgName}</div>
                  </div>
                  <div style={{ padding: "var(--afa-space-4) var(--afa-space-5)" }}>
                    <p style={{ fontSize: "var(--afa-text-ui)", color: "var(--afa-text-secondary)", opacity: org.bio ? 0.7 : 0.4, marginBottom: "var(--afa-space-3)", lineHeight: 1.5, minHeight: "36px", fontStyle: org.bio ? "normal" : "italic" }}>
                      {org.bio || tr.organisersPage.noBioYet}
                    </p>
                    <div style={{ fontSize: "var(--afa-text-small)", color: "var(--afa-text-secondary)", opacity: 0.5 }}>
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
