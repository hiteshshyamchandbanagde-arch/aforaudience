# `OrganisersGridEmbed` Audit (current state only)

Sourced from `src/` as of qa @ 2915649. No recommendations — findings only.

## 1. Location and full component

**File**: [`src/components/OrganisersGridEmbed.tsx`](../src/components/OrganisersGridEmbed.tsx)

```tsx
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
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "17px", fontWeight: 700, color: "var(--afa-ink)" }}>{org.orgName}</h2>
            </div>
            <p style={{ fontSize: "13px", color: "var(--afa-ink)", opacity: org.bio ? 0.65 : 0.4, marginBottom: "10px", lineHeight: 1.5, fontStyle: org.bio ? "normal" : "italic" }}>
              {org.bio || tr.organisersEmbed.noBioYet}
            </p>
            <div style={{ fontSize: "12px", color: "var(--afa-ink)", opacity: 0.5 }}>
              {org._count.events} {org._count.events === 1 ? tr.organisersEmbed.eventSingular : tr.organisersEmbed.eventPlural}
            </div>
          </div>
        )
      })}
      </div>
    </div>
  )
}
```

Used by exactly one caller, [`src/app/(public)/events/page.tsx:325`](../src/app/(public)/events/page.tsx#L325):
```tsx
<OrganisersGridEmbed search={search} hideSearchBar onItemsLoaded={setOrganisers} />
```
Always invoked with `hideSearchBar` set — the embed's own internal `<input>`/`BrowseSearchDropdown` branch (lines 86–105) is dead in the one real call site; the page's separate `SearchInputBox` + `BrowseSearchDropdown` pair immediately above it (page.tsx:308–324) drives `search` instead and feeds the embed a controlled string.

## 2. What it actually renders

Per-organiser card, in an `auto-fill, minmax(280px, 1fr)` grid:
- **Avatar**: 40px circle — `org.user.avatar` image if present, else a single-letter initial fallback (`org.orgName.charAt(0)`) on a solid fill
- **Org name** (`org.orgName`), as an `<h2>`
- **Bio** (`org.bio`), or an italic "no bio yet" fallback string if null
- **Event count** (`org._count.events`), pluralized via i18n singular/plural keys
- Whole card is a click/Enter/Space target that navigates to `/organisers/{id}`, with a per-card spinner overlay and other-card dimming while a navigation is in flight (`navigatingId` state)
- Loading / error / empty-list states as plain text/box, no skeleton

**Not rendered, and not fetched to render**: follower count, an approval/status badge, a category or role filter, a sort control. The `OrganiserItem` interface (lines 7–13) never includes `followerCount` — it isn't a "wired but hidden" case, it's simply absent from the type and the fetch. Search is a single substring match on `orgName` only (line 82), no other filter axis exists.

## 3. Styling vs. the two reference conventions

Full inline style values, from the component above:
- **Card**: `background: var(--afa-white)`, `borderRadius: "12px"`, `border: "1px solid rgba(14,12,10,0.08)"`, padding `22px`
- **Org name**: `fontFamily: "Georgia, serif"`, `17px / 700`, `color: var(--afa-ink)`
- **Bio / count text**: no `fontFamily` override (inherits page default), `color: var(--afa-ink)`
- **Avatar fallback fill**: `var(--afa-plum-black)`
- **Spinner accent**: `var(--afa-terracotta)`
- **Internal `<input>`** (dead in the real call site, but present in source): `background: "white"`, `border: "1px solid rgba(14,12,10,0.15)"`, `borderRadius: "8px"`, `color: var(--afa-ink)`

**(a) Against `docs/afa-design-tokens-reference.md`'s Phase 2c convention:**
- **Corner radius**: fails. Cards use `borderRadius: "12px"`; §3 of the tokens doc states sharp (zero-radius) corners are "the explicit, enforced house convention" for card grids.
- **Fonts**: fails. Org name uses `Georgia, serif`; the token doc's §2 assigns headline roles (names/titles) to `var(--font-display)` (Newsreader). Georgia is not one of the three wired typefaces (`--font-display`/`--font-sans`/`--font-mono`) at all.
- **Color tokens**: fails. `--afa-white`, `--afa-ink`, `--afa-plum-black`, `--afa-terracotta` are none of the Phase 2c tokens listed in §1 (`--afa-surface-page/-raised/-inverse`, `--afa-cream`, `--afa-amber`, `--afa-fill-solid`, `--afa-text-primary/-secondary/-muted`). Confirmed in `globals.css`: these four are defined in the original "Phase 0" flat palette block (`globals.css:82,97,106,108`), superseded but not deleted when Phase 2c's semantic layer was added (`globals.css:121–136`, comment explicitly documents Phase 0 tokens are being migrated away from, not removed outright).
- **Border**: fails. `rgba(14,12,10,0.08)` is a dark-ink-on-light-surface border (matches the tokens doc's own description of pre-2c styling); the documented Phase 2c convention (§1) is the inverse — cream-on-dark, `rgba(245,245,240, α)`.
- **Hover state**: fails/absent. No `.hover-lift-card` class, no amber border-on-hover — the embed's only interactive-state styling is the opacity dim during in-flight navigation (lines 130). §3's documented card hover (`translateY(-4px)`, amber border transition, title color shift) is not present here at all.

**(b) Against the standalone `/organisers` page** (`docs/event-detail-organiser-tab-audit.md`, confirmed stale/light-theme):
The embed is not a distinct third treatment — it shares the same token family, fonts, and card idiom as the standalone directory page, just a leaner variant of it:
- Same `OrganiserItem` shape, same fetch target, same fallback-initial avatar pattern, same `Georgia, serif` org-name heading, same `var(--afa-ink)` body text, same `var(--afa-terracotta)` spinner accent, same `rgba(14,12,10, α)` border family.
- Differences are sizing/polish only: embed avatar is 40px vs. standalone's 56px-with-header-band; embed card radius is `12px` vs. standalone's `16px` (+ `overflow: hidden` and a `var(--afa-plum-black)` header strip behind the avatar/name); embed grid uses `minmax(280px, …)` vs. standalone's `minmax(320px, …)`; standalone applies the `.hover-lift-card` class, the embed does not.

**Verdict**: the embed is on neither the current Phase 2c dark/sharp-corner system nor a novel third treatment — it is the same stale, pre-2c light-theme/Georgia/terracotta token family as the standalone `/organisers` page (`docs/event-detail-organiser-tab-audit.md` §3–4), reproduced independently in this file rather than shared via a common component.

## 4. Is the embed genuinely the primary nav-flow entry point?

The code comment (lines 15–18) claims: *"This embed is what the Events↔Organisers toggle actually renders; the standalone /organisers page's search never reached anyone using the real nav flow."* Checked against the app's actual nav/footer/homepage wiring — the claim holds, it is not aspirational:

- **`SiteNav.tsx`** (`NAV_LINKS`, lines 25–30): only `events`, `artists`, `venues`, `wall-of-fame`. No `organisers` entry, desktop or mobile.
- **Homepage footer** (`src/app/page.tsx:156–182`): "Platform" column links to `/events`, `/artists`, `/venues`, `/livestreams` only. "Join As" column's Organiser link goes to `/register?role=organiser` (signup), not the directory. No `/organisers` link anywhere on the homepage.
- **`Hero.tsx`**: no `/organisers` reference at all.
- **Event Detail page's "Organised by" credit** (`docs/event-detail-organiser-tab-audit.md` §2): links to `/organisers/[id]` — a specific organiser's *profile* — never to `/organisers` (the directory/list page).

Net click path from the homepage:
- **`OrganisersGridEmbed`**: Home → click "Events" (nav, 1 click, always visible) → click the "Organisers" toggle button on `/events` (`contentMode` state, `events/page.tsx:271`, 1 click, always visible) = **2 clicks, both via persistently-rendered UI**.
- **Standalone `/organisers` directory**: zero inbound links found anywhere in `SiteNav`, the homepage footer, or `Hero.tsx`. Reachable only by typing the URL directly — there is no in-app click path to it at all.

So the comment is accurate: the embed is the only version of "browse organisers" reachable through the app's actual navigation, and the standalone directory page is currently orphaned from real nav flow, not just less-discoverable.

## 5. Shared `/api/organisers` endpoint — confirmed, no data divergence

Both consumers fetch the identical route:
- Embed: `fetch("/api/organisers")` (line 55)
- Standalone page: `fetch("/api/organisers")` ([`organisers/page.tsx:39`](../src/app/(public)/organisers/page.tsx#L39))

`GET /api/organisers` ([`src/app/api/organisers/route.ts`](../src/app/api/organisers/route.ts)) explicitly `select`s: `id`, `orgName`, `bio`, `user.name`, `user.avatar`, and `_count.events` (filtered to `APPROVED`/`COMPLETED` events only). It does not query or return a follower count at all at this route (unlike the separate `/api/organisers/[id]` detail route, which does compute one server-side per `docs/event-detail-organiser-tab-audit.md` §5).

Both the embed and the standalone page declare the same local `OrganiserItem` interface (`id`, `orgName`, `bio`, `user.name`/`avatar`, `_count.events`) and both render exactly that same field set — avatar/initial, name, bio-or-fallback, event count — nothing more, nothing less. **No divergence** in what data each surfaces from the shared endpoint: both consumers use 100% of the fields the endpoint returns, and neither adds a field the other omits. The only differences between the two are presentational (sizes, radii, hover state — see §3), not data-shape differences.

Both link card clicks to the same destination: `router.push(\`/organisers/${id}\`)` — identical in both files.
