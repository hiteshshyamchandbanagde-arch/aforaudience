"use client"
import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import BrowseSearchDropdown from "@/components/BrowseSearchDropdown"
import Photo from "@/components/Photo"
import { isPlaceholderImageUrl } from "@/lib/placeholder-image"
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
//
// Fidelity rebuild (docs/organisers-grid-embed-brief.md, this session) -
// card shell/typography/avatar were still on the pre-Phase-2c stale
// token family (docs/organisers-grid-embed-audit.md documented every
// divergence). Restyled onto the same dark/sharp-corner convention and
// `.afa-venue-card` hover pattern already shipped on VenuesGridClient -
// values copied verbatim from there, not reinvented. The internal
// search <input>/BrowseSearchDropdown branch below is left unstyled on
// purpose: it's dead code at the one real call site (hideSearchBar is
// always true from events/page.tsx) and the brief explicitly scopes
// out un-hiding or restyling it.
//
// Placeholder-avatar fallback fix (this session) - 10/15 approved QA
// organisers seed avatarUrl to avatars.githubusercontent.com filler
// (confirmed live via Supabase), the same placeholder host
// isPlaceholderImageUrl() already exists to catch (see its own comment -
// this is the identical Artists "Sai Jain / GitHub mascot" problem).
// This component never imported that guard, so those placeholder URLs
// were treated as real photos and run through Photo's duotone filter,
// rendering as a muddy amber-on-black texture instead of the clean
// letter fallback null avatars already get correctly. Gate on the same
// util Venues/Artists use rather than inventing a second check.
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
      {/* Card shell hover state (border-color, amber on hover) has to live
          in a stylesheet rule, not inline styles - an inline border always
          wins over a stylesheet :hover rule regardless of specificity.
          Values copied verbatim from VenuesGridClient's .afa-venue-card. */}
      <style>{`
        .afa-organisers-embed-card { border: 1px solid rgba(245,245,240,0.1); transition: border-color 0.3s ease; }
        .afa-organisers-embed-card:hover { border-color: rgba(201,151,58,0.6); }
      `}</style>

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
          style={{ width: "100%", maxWidth: "360px", padding: "10px 14px", borderRadius: "8px", border: "1px solid rgba(14,12,10,0.15)", fontSize: "14px", marginBottom: "20px", boxSizing: "border-box", background: "white", color: "var(--afa-ink)", outline: "none" }}
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
            className="hover-lift-card afa-focusable afa-organisers-embed-card"
            style={{
              position: "relative",
              background: "var(--afa-surface-raised)",
              padding: "22px",
              cursor: navigatingId ? "default" : "pointer",
              opacity: navigatingId && !isNavigatingThis ? 0.5 : 1,
              transition: "opacity 0.15s ease",
            }}
          >
            {isNavigatingThis && (
              <div style={{ position: "absolute", inset: 0, zIndex: 2, background: "rgba(20,20,20,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: "24px", height: "24px", borderRadius: "50%", border: "3px solid rgba(245,245,240,0.15)", borderTopColor: "var(--afa-fill-solid)", animation: "afa-spin 0.7s linear infinite" }} />
                <style>{`@keyframes afa-spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
              <div style={{ position: "relative", width: "40px", height: "40px", borderRadius: "50%", background: "var(--afa-surface-inverse)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 700, color: "var(--afa-text-primary)", flexShrink: 0, overflow: "hidden" }}>
                {org.user.avatar && !isPlaceholderImageUrl(org.user.avatar) ? (
                  <Photo src={org.user.avatar} alt={org.orgName} />
                ) : (
                  org.orgName.charAt(0).toUpperCase()
                )}
              </div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "17px", fontWeight: 600, color: "var(--afa-text-primary)" }}>{org.orgName}</h2>
            </div>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: org.bio ? "var(--afa-text-secondary)" : "var(--afa-text-muted)", marginBottom: "10px", lineHeight: 1.5, fontStyle: org.bio ? "normal" : "italic" }}>
              {org.bio || tr.organisersEmbed.noBioYet}
            </p>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "rgba(245,245,240,0.6)" }}>
              {org._count.events} {org._count.events === 1 ? tr.organisersEmbed.eventSingular : tr.organisersEmbed.eventPlural}
            </div>
          </div>
        )
      })}
      </div>
    </div>
  )
}
