# Figma Make Brief — Organisers Grid Embed Fidelity Rebuild

**Status:** Ready to run in Figma Make
**Scope decision date:** 2026-08-22 (this session)

## Scope

Target: `OrganisersGridEmbed`, rendered inside the Events page "Organisers" hero tab.

This is the **only confirmed in-app entry point** to organiser browsing (2 clicks from Events: Events → Organisers toggle). The standalone `/organisers` directory page is **explicitly out of scope for this round** — audit confirmed zero in-app click path (no nav link, no footer link, not reachable from `SiteNav`, homepage footer, or `Hero.tsx`). Fidelity work follows usage; deprioritized until a separate product decision is made on whether `/organisers` needs a nav entry point.

## Real content set — design only these fields

Per `docs/organisers-grid-embed-audit.md` (Claude Code audit, this session):

- Avatar (image or initial fallback)
- Org name
- Bio, or fallback copy when bio is absent
- Event count (`_count.events` from `/api/organisers`)
- Click-to-navigate card with loading/nav spinner state

**Do NOT design:**
- Follower count — not wired, and the API (`/api/organisers`) never returns it
- Status badge — not wired
- Filter UI — not wired
- Working search — search UI exists in code but is dead (`hideSearchBar` is always `true` at the one real call site). Do not design functional search unless a separate decision is made to un-hide it.

## Target design system — Phase 2c dark, sharp-corner convention

Per `docs/afa-design-tokens-reference.md`, current embed fails every axis checked:

| Aspect | Current (stale) | Target (Phase 2c) |
|---|---|---|
| Corner radius | `12px` rounded | Sharp corners |
| Font | `Georgia, serif` | `--font-display` |
| Color tokens | Legacy: `--afa-white`, `--afa-ink`, `--afa-plum-black`, `--afa-terracotta` | Current semantic token set |
| Border | Light-on-dark rgba base | Match shipped Venues/Events/Artists convention |
| Hover state | None | Amber hover state |

The embed is on the **same stale token family as the standalone `/organisers` page** — not a third treatment — just a leaner variant.

## Grid mechanics — preserve as deliberate compact variant

- Grid: `280px` minmax (leaner than standalone's `320px`) — keep, this is a reasonable embed-context choice (nested in a tab, not a full page)
- Avatar: smaller than standalone page's — keep
- No `.hover-lift-card` currently — decide during build whether Phase 2c hover convention (amber) supersedes this

Do not inflate sizing to match the standalone page. This is a compact embed, not a directory page.

## Explicitly out of scope

- Standalone `/organisers` directory rebuild
- Any nav/footer link addition for `/organisers`
- Follower count or filter functionality (would require API changes first)
- Un-hiding the dead search UI

## Source docs referenced

- `docs/afa-design-tokens-reference.md`
- `docs/event-detail-organiser-tab-audit.md`
- `docs/organisers-grid-embed-audit.md`
