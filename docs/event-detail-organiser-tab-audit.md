# Event Detail — "Organiser Tab" Audit (current state only)

Sourced from `src/` as of qa @ 1524eab. No recommendations — findings only.

## 1. Location

**There is no Organiser tab on the Event Detail page.** The page is
[`src/app/(public)/events/[id]/EventDetailClientPage.tsx`](../src/app/(public)/events/[id]/EventDetailClientPage.tsx), rendered by [`src/app/(public)/events/[id]/page.tsx`](../src/app/(public)/events/[id]/page.tsx).

A code comment at [EventDetailClientPage.tsx:382-399](../src/app/(public)/events/[id]/EventDetailClientPage.tsx#L382) explains why:

> *"GEN-2608-077 — full rebuild against the approved Figma Make export (EventDetail.tsx). The export is a single flowing scroll (hero → fine print → lineup → prizes → facilities), not the old tabbed Overview/Lineup/Venue layout — removed the tab switcher entirely to match. The real content the tabs used to hold (description + organiser link, event terms/refund policy/special note, competition voting, reviews, plus-ones) is real functionality beyond the export's own mockup scope, folded into the section it thematically belongs to instead of dropped."*

So the "Organiser tab" was explicitly removed during the Events rebuild (GEN-2608-077) and its content folded into the hero section as a one-line credit, not a tab or panel.

## 2. What currently renders

The entire organiser-related UI on this page is one conditional block, [EventDetailClientPage.tsx:438-445](../src/app/(public)/events/[id]/EventDetailClientPage.tsx#L438):

```tsx
{event.organiser && (
  <p style={{ marginTop: "12px", fontSize: "13px", color: "rgba(245,245,240,0.5)" }}>
    {tr.eventDetailPage.organisedBy}{" "}
    <Link href={`/organisers/${event.organiser.id}`} style={{ color: "var(--afa-amber)", fontWeight: 600, textDecoration: "none" }}>
      {event.organiser.orgName}
    </Link>
  </p>
)}
```

The `event.organiser` type fetched for this page is just `{ id: string; orgName: string } | null` ([EventDetailClientPage.tsx:73](../src/app/(public)/events/[id]/EventDetailClientPage.tsx#L73)).

Rendered: **organiser name only, as an inline link to `/organisers/[id]`.**

Not rendered anywhere on the Event Detail page: bio, avatar, contact info, org code, other events by this organiser, follower count, a follow action, or any card/panel treatment. It's a single sentence ("Organised by **{name}**") sitting under the description, above the when/where block.

## 3. Styling as implemented

The one line of organiser content uses:
```css
font-size: 13px;
color: rgba(245,245,240,0.5);
```
with the link styled `color: var(--afa-amber); font-weight: 600; text-decoration: none`.

No card, no border, no padding, no background — it's plain inline text, not a component with its own chrome. There is nothing to compare against the sharp-corner card convention because **there is no card here** — this is bare text inline in the hero copy block, styled consistently with the rest of the Event Detail page's dark tokens (`--afa-amber`, `rgba(245,245,240,…)`) but with no structural treatment of its own.

## 4. Unstyled / placeholder / skipped signals

The Event Detail page's organiser credit line itself is small but consistent with the current design system (uses `--afa-amber`, correct rgba pattern, no legacy fonts). The real gap is **one hop away**, on the page that link points to:

**`/organisers/[id]`** — [`src/app/organisers/[id]/page.tsx`](../src/app/organisers/[id]/page.tsx) — is visibly unmigrated:
- `fontFamily: "system-ui, sans-serif"` on the page's `<main>` ([page.tsx:52](../src/app/organisers/[id]/page.tsx#L52)) — the exact generic system-font fallback that `layout.tsx`'s own comment calls out as *"a big part of why the site read as generic/templated (BUG-2607-036)"* — but never fixed here.
- `fontFamily: "Georgia, serif"` on the H1 ([page.tsx:55](../src/app/organisers/[id]/page.tsx#L55)) instead of `var(--font-display)` (Newsreader).
- Events-list card panel uses `background: var(--afa-white)`, `color: var(--afa-ink)`, `border: 1px solid rgba(14,12,10,0.08)` — the **light-theme Phase-0 palette**, not the dark Phase 2c tokens (`--afa-surface-raised`, `--afa-text-primary`) used everywhere else audited so far.
- `borderRadius: "12px"` on that panel and `borderRadius: "8px"` on each event row link — rounded, not sharp-corner.
- [`OrganiserFollowButton.tsx`](../src/app/organisers/[id]/OrganiserFollowButton.tsx) uses `var(--afa-terracotta)` (a pre-Phase-2c legacy color, not `--afa-fill-solid`), `borderRadius: "999px"` (pill, not sharp), and raw 🔔/🔕 emoji for the notify toggle — the same emoji pattern `VenueFollowButton.tsx` explicitly replaced with real icons elsewhere ("replaced the 🔔/🔕 emoji notify-toggle icon with real line-art").

The organiser **directory** page, [`src/app/(public)/organisers/page.tsx`](../src/app/(public)/organisers/page.tsx), has the identical signature: `fontFamily: "system-ui, sans-serif"` on `<main>`, `fontFamily: "Georgia, serif"` on the hero headline, `var(--afa-terracotta)` accent color. Same unmigrated family as the profile page.

**Conclusion**: the Event Detail page's organiser credit line is fine as far as it goes, but everything it links to — the Organiser profile page and the Organiser directory — was skipped by the Venues/Events/Artists redesign passes (GEN-2608-074/077/078 etc.) and still runs on the pre-redesign light-theme/system-font/terracotta/rounded-corner styling.

## 5. Organiser schema fields not currently rendered anywhere

Full model: [`prisma/schema.prisma:738`](../prisma/schema.prisma#L738). The public API route ([`src/app/api/organisers/[id]/route.ts`](../src/app/api/organisers/[id]/route.ts)) explicitly projects a safe subset — its own comment: *"Never expose payout/tax-compliance internals on a public route — explicit projection, not the raw Prisma object."* Fields it fetches but the page still doesn't render, plus fields excluded from the API entirely:

**Fetched by the API but not rendered on the profile page:**
- `user.avatar` — included in the `OrganiserDetail` TypeScript interface ([organisers/[id]/page.tsx:14](../src/app/organisers/[id]/page.tsx#L14)) but never used in the JSX. No avatar/logo renders anywhere on the page.
- `followerCount` — computed server-side in the route (`prisma.follow.count(...)`, [route.ts:26](../src/app/api/organisers/[id]/route.ts#L26)) and returned in the JSON, but not part of the page's `OrganiserDetail` interface at all — dropped before it reaches the component.

**In the schema, deliberately excluded from the public API (payout/tax-compliance — correctly private):**
- `walletBalance`, `razorpayAccountId`, `razorpayAccountStatus`, `entityType`, `panNumber`, `gstRegistered`, `gstin`

**In the schema, not exposed and not obviously private (candidates worth a look, not a recommendation):**
- `createdAt` — no "member since" or tenure signal anywhere on the profile
- `isApproved` — used only as a gate (404s if false), never surfaced as a status
- `tours` relation (`Tour[]`) — an Organiser's tours exist in the schema but the profile page only lists `events`, not tours

## 6. Existing Organiser directory/profile pages

Yes — both exist, both predate the redesign:

- **Directory**: [`src/app/(public)/organisers/page.tsx`](../src/app/(public)/organisers/page.tsx) — lists all approved organisers, client-side name search, links to each profile. Its own comment dates it: *"Session 62, design.md §9.5 — net-new public page."*
- **Profile**: [`src/app/organisers/[id]/page.tsx`](../src/app/organisers/[id]/page.tsx) — org name, code, bio, follow button, and an upcoming/past events list grouped and linked back to `/events/[id]`.

Both are the pages the Event Detail organiser credit link (`/organisers/[id]`) already points to — so the "link out to an existing profile page" behavior described in the task is already wired up end-to-end. What's not consistent is styling: this Organiser page family is the one directory/profile pair in the app that the Venues/Events/Artists redesign passes did not touch (compare the Artist profile page, `src/app/(public)/artists/[id]/ArtistProfileClientPage.tsx`, which is fully on `--font-display`/`--afa-surface-raised`/`--afa-fill-solid`/sharp-corner conventions per `docs/afa-design-tokens-reference.md`).
