"use client"
import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import BrowseSearchDropdown from "@/components/BrowseSearchDropdown"
import { useLocale } from "@/lib/i18n/translate"

interface OrganiserItem {
  id: string
  orgName: string
  bio: string | null
  user: { name: string; avatar: string | null }
  _count: { events: number }
}

// Session 65 - added search + BrowseSearchDropdown here (was a lean grid
// with none at all - see history below). This embed is what the
// Events↔Organisers toggle actually renders; the standalone /organisers
// page's search never reached anyone using the real nav flow.
//
// Session 65 follow-up: the events/page.tsx hero now owns a single
// shared search box (same position/styling for both Events and
// Organisers modes - see Hitesh feedback that two differently-styled
// search boxes in different spots on the same page read as broken).
// This embed still owns the fetch (simplest place for it) but accepts
// `search` as a controlled prop + `hideSearchBar` to suppress its own
// input when a parent is driving search, and reports the fetched list
// back up via `onItemsLoaded` so the parent's hero dropdown doesn't need
// a second fetch. Falls back to fully self-contained behavior (own
// input, own state) if used anywhere without those props - e.g. if this
// embed is ever reused in a context without a shared hero search.
//
// Originally: "Lean grid, no hero/search header - used inside the
// Events↔Organisers toggle (session 62, design.md §9.5 - toggle-based
// discovery entry point). The full standalone page at /organisers has
// its own hero/search version; this is the embeddable variant for a tab
// context."
interface OrganisersGridEmbedProps {
  search?: string
  hideSearchBar?: boolean
  onItemsLoaded?: (items: OrganiserItem[]) => void
}

export default function OrganisersGridEmbed({ search: controlledSearch, hideSearchBar = false, onItemsLoaded }: OrganisersGridEmbedProps = {}) {
  const { t: tr } = useLocale()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [navigatingId, setNavigatingId] = useState<string | null>(null)
  const [organisers, setOrganisers] = useState<OrganiserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [internalSearch, setInternalSearch] = useState("")
  const search = controlledSearch !== undefined ? controlledSearch : internalSearch

  useEffect(() => {
    fetch("/api/organisers")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load organisers")
        return res.json()
      })
      .then(setOrganisers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (onItemsLoaded) onItemsLoaded(organisers)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisers])

  const goToOrganiser = (id: string) => {
    if (navigatingId) return
    setNavigatingId(id)
    startTransition(() => {
      router.push(`/organisers/${id}`)
    })
  }

  if (loading) return <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--afa-text-primary)", opacity: 0.5 }}>{tr.organisersEmbed.loading}</div>
  if (error) return <div style={{ padding: "14px 16px", background: "var(--afa-error-bg)", border: "1px solid var(--afa-error-border)", borderRadius: "8px", color: "var(--afa-error)", fontSize: "14px" }}>{error}</div>
  if (organisers.length === 0) return <p style={{ fontSize: "15px", color: "var(--afa-text-primary)", opacity: 0.6 }}>{tr.organisersEmbed.emptyNoneFound}</p>

  const filtered = organisers.filter((o) => o.orgName.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      {!hideSearchBar && (
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
          value={internalSearch}
          onChange={(e) => setInternalSearch(e.target.value)}
          placeholder={tr.organisersEmbed.searchPlaceholder}
          style={{ width: "100%", maxWidth: "360px", padding: "10px 14px", borderRadius: "8px", border: "1px solid rgba(14,12,10,0.15)", fontSize: "14px", marginBottom: "20px", boxSizing: "border-box", background: "white", color: "var(--afa-text-primary)", outline: "none" }}
        />
      </BrowseSearchDropdown>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
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
                {org.user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={org.user.avatar} alt={org.orgName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  org.orgName.charAt(0).toUpperCase()
                )}
              </div>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "17px", fontWeight: 700, color: "var(--afa-text-primary)" }}>{org.orgName}</h2>
            </div>
            <p style={{ fontSize: "13px", color: "var(--afa-text-primary)", opacity: org.bio ? 0.65 : 0.4, marginBottom: "10px", lineHeight: 1.5, fontStyle: org.bio ? "normal" : "italic" }}>
              {org.bio || tr.organisersEmbed.noBioYet}
            </p>
            <div style={{ fontSize: "12px", color: "var(--afa-text-primary)", opacity: 0.5 }}>
              {org._count.events} {org._count.events === 1 ? tr.organisersEmbed.eventSingular : tr.organisersEmbed.eventPlural}
            </div>
          </div>
        )
      })}
      </div>
    </div>
  )
}
