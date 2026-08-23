# Search Input Styling Audit — Events / Artists / Venues (public pages)

Sourced from `src/` as of qa @ 1524eab. Dashboard search inputs out of scope. No changes made — findings only.

## 1. Venues vs Artists search input

**Not shared.** Both use the class name `.afa-search-box`, but neither page defines that class in a shared stylesheet/component — each hand-authors its own inline `style={}` object on the wrapper, and the class name is reused only for a shared `:focus-within` hover rule pattern, not shared layout rules. There is no `SearchBox`/`SearchInput` component backing either (there is a `src/components/SearchBox.tsx` in the repo, but neither Venues nor Artists imports it for this input — both hand-roll their own `<label>`/`<div>` + `<input>` locally).

**Venues** — [`VenuesGridClient.tsx:125-133`](../src/app/venues/VenuesGridClient.tsx#L125):
```tsx
<div className="afa-search-box" style={{ display: "flex", alignItems: "center", width: "100%", background: "var(--afa-surface-page)", border: "1px solid rgba(245,245,240,0.15)", boxSizing: "border-box" }}>
  <input style={{ flex: 1, padding: "14px 4px 14px 16px", border: "none", background: "transparent", fontSize: "15px", fontFamily: "var(--font-sans)", color: "var(--afa-text-primary)", outline: "none" }} />
  <SearchIcon style={{ width: "18px", height: "18px", marginRight: "16px", color: "rgba(245,245,240,0.45)", flexShrink: 0 }} />
</div>
```
- Border: `1px solid rgba(245,245,240,0.15)` on the wrapper (not the input)
- Corner radius: **none set — sharp corners**, consistent with the house convention
- Padding: no padding on the wrapper; the input itself carries `14px 4px 14px 16px` (asymmetric — extra room on the left for text, tight on the right where the icon sits)
- Background: `var(--afa-surface-page)` (the page background color, not `--afa-surface-raised`)
- **Icon placement: right-aligned**, after the input, `marginRight: 16px`
- Focus state: `.afa-search-box:focus-within` is referenced in the Artists page (see below) but **not defined anywhere in `VenuesGridClient.tsx`** — Venues never declares its own `:focus-within` rule, so on the Venues page this input gets no visible focus-state change beyond the browser default, despite reusing the class name a focus rule exists for elsewhere.

**Artists** — [`artists/page.tsx:253-261`](../src/app/(public)/artists/page.tsx#L253):
```tsx
<label className="afa-search-box afa-artists-search-box" style={{ display: "flex", alignItems: "center", gap: "12px", background: "var(--afa-surface-page)", border: "1px solid rgba(245,245,240,0.15)", padding: "12px 16px", boxSizing: "border-box" }}>
  <SearchIcon style={{ width: "16px", height: "16px", color: "rgba(245,245,240,0.45)", flexShrink: 0 }} />
  <input style={{ flex: 1, border: "none", background: "transparent", fontSize: "14px", fontFamily: "var(--font-sans)", color: "var(--afa-cream)", outline: "none" }} />
</label>
```
- Border: identical value, `1px solid rgba(245,245,240,0.15)`, but on a `<label>` wrapper
- Corner radius: none set — sharp corners
- Padding: `12px 16px` on the wrapper itself (Venues instead pads the input); Artists' input has **no padding of its own**, spacing comes from the wrapper's `gap: 12px`
- Background: same `var(--afa-surface-page)`
- **Icon placement: left-aligned**, before the input — the opposite side from Venues
- Focus state: `.afa-search-box:focus-within { border-color: var(--afa-amber) !important; }` is defined at [`artists/page.tsx:158`](../src/app/(public)/artists/page.tsx#L158) — amber border on focus, `!important`-flagged (likely to beat the inline `border` style's specificity). This rule is scoped locally to the Artists page's own `<style>` block, not shared — it happens to apply to Venues too only if Venues' markup is ever rendered in the same DOM/stylesheet scope, which it isn't (separate route, separate `<style>` tag).

**Summary**: same class name, same border color/width, same background token, same "no radius" sharp corners — but two independently hand-built inputs with different padding models, opposite icon sides, and a focus-ring rule that only one of the two pages actually defines.

## 2. Events landing page hero search input

**Confirmed borderless — underline only**, visually matching what you'd see on screen.

[`events/page.tsx:213-214`](../src/app/(public)/events/page.tsx#L213):
```css
.afa-events-search-box { display: flex; align-items: center; gap: 12px; border-bottom: 1px solid rgba(245,245,240,0.2); padding-bottom: 8px; flex: 1; min-width: 220px; }
.afa-events-search-box:focus-within { border-color: var(--afa-amber); }
```
Markup ([events/page.tsx:295-303](../src/app/(public)/events/page.tsx#L295)):
```tsx
<label className="afa-events-search-box">
  <SearchIcon style={{ width: "16px", height: "16px", color: "rgba(245,245,240,0.4)", flexShrink: 0 }} />
  <input style={{ flex: 1, border: "none", background: "transparent", fontSize: "14px", color: "var(--afa-text-primary)", outline: "none" }} />
</label>
```
- Only `border-bottom` is set (`1px solid rgba(245,245,240,0.2)`) — top/left/right are unset, so this genuinely is underline-only, not a full box like Venues/Artists
- No background color at all (transparent, sits directly on the hero surface)
- No horizontal padding — only `padding-bottom: 8px` to separate text from the underline
- Icon: left-aligned, `16px`, `rgba(245,245,240,0.4)` (slightly more transparent than Venues/Artists' `0.45`)
- Focus state: `border-color: var(--afa-amber)` on `:focus-within` — same amber-on-focus intent as Artists, but here it recolors the one underline rather than a full border box, and (unlike Artists' rule) has no `!important`

This is a third, distinct visual treatment from both Venues and Artists — not a variant of `.afa-search-box`, a completely separate class (`.afa-events-search-box`) with its own rules. Confirmed used in **two places** on this page: the Events-mode hero search and the Organisers-mode hero search reuse the identical `.afa-events-search-box` class (see §3) — so within the Events page itself the underline treatment is at least consistent across its own two modes, even though it diverges from Venues/Artists.

## 3. "Events / Organisers" tab switcher in the Events hero

Located at [`events/page.tsx:268-275`](../src/app/(public)/events/page.tsx#L268), directly below the search box, driven by local state `contentMode: "events" | "organisers"` ([events/page.tsx:82](../src/app/(public)/events/page.tsx#L82)).

Tab chrome ([events/page.tsx:218-221](../src/app/(public)/events/page.tsx#L218)):
```css
.afa-events-mode-tab { font-family: var(--font-display); font-size: 18px; background: none; border: none; cursor: pointer; padding: 0 0 12px; position: relative; color: rgba(245,245,240,0.45); transition: color 0.2s ease; }
.afa-events-mode-tab:hover { color: rgba(245,245,240,0.7); }
.afa-events-mode-tab.active { color: var(--afa-cream); }
.afa-events-mode-tab.active::after { content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: var(--afa-fill-solid); }
```
Underline-tab treatment (active tab gets a `2px` `--afa-fill-solid` underline bar via `::after`), explicitly described in a code comment as *"matching the Venues/Owners toggle convention elsewhere in the app"* — i.e. this pattern is intentionally reused from another existing toggle, not invented fresh here.

**What the "Organisers" tab does**: switching `contentMode` to `"organisers"` swaps the entire section below the tabs to render [`<OrganisersGridEmbed search={search} hideSearchBar onItemsLoaded={setOrganisers} />`](../src/app/(public)/events/page.tsx#L331) instead of the events grid — plus its own copy of the shared `.afa-events-search-box` hero input, now filtering organisers instead of events, feeding a `BrowseSearchDropdown` that links out to `/organisers/[id]` on selection.

**Is it a separate surface from `/organisers`, or related?** Both — it's a **separate, embedded surface that talks to the same backend and links to the same profile pages**, not an iframe/redirect of the standalone directory:
- `OrganisersGridEmbed` ([`src/components/OrganisersGridEmbed.tsx`](../src/components/OrganisersGridEmbed.tsx)) is a distinct component from [`src/app/(public)/organisers/page.tsx`](../src/app/(public)/organisers/page.tsx) — separate file, separate JSX, separate styling — built specifically to be embeddable inside this tab (`hideSearchBar`, `search` controlled prop, `onItemsLoaded` callback to feed the shared hero search).
- Its own code comment is explicit about the relationship: *"This embed is what the Events↔Organisers toggle actually renders; the standalone `/organisers` page's search never reached anyone using the real nav flow."* — implying the toggle, not the dedicated `/organisers` page, is the primary discovery path most users actually hit.
- Both fetch from the same `/api/organisers` endpoint and both route individual results to the same `/organisers/[id]` profile page — so the underlying data and destination are shared even though the listing UI itself is duplicated across two independently-styled components.
- Per the [Organiser tab audit](event-detail-organiser-tab-audit.md), `/organisers/[id]` and the standalone `/organisers` page are both still on pre-redesign (`system-ui`/Georgia/`--afa-terracotta`) styling — so a user who lands on an organiser profile via this embedded tab flow immediately hits that unmigrated styling, same as a user coming from the standalone directory.
