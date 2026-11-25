# Fix brief — Venue Owner card, Figma fidelity gap (BUG-2608-073)

**Scope:** small and contained - one component, `src/components/VenueOwnersGridEmbed.tsx`. Do not touch `VenuesGridClient.tsx`, `VenueDetailClient.tsx`, or anything already fixed under BUG-2608-072.

**Why this is a separate ticket, not a reopen of BUG-2608-072:** that ticket's 8-gap audit diffed `VenuesGridClient.tsx`/`VenuesHero.tsx`/`VenuesViewToggle.tsx`/`VenueDetailClient.tsx` against the export. `VenueOwnersGridEmbed.tsx` was never actually diffed against the export's Owners-tab section - it was scoped as "reskin only, different semantic context" back in the original GEN-2608-074 build (PR #502) and that call was never re-checked. It should have been. This is the same failure pattern as BUG-2608-072 (a scope call made without verifying against the real export), just caught later and in a smaller place.

**Source of truth:** `C:\Users\hites\AforA\aforaudience\Figma\Redesign Venues Directory Pages\src\pages\VenuesDirectory.tsx`, lines ~119-132 (the Owners-tab branch, same file as the main directory grid).

```tsx
<div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
  {owners.map((o) => (
    <div key={o.name} className="border border-ink-600 bg-ink-800 p-6 transition-colors hover:border-amber/40">
      <span className="eyebrow text-amber">Owner</span>
      <h3 className="mt-4 font-display text-2xl leading-tight text-cream">{o.name}</h3>
      <div className="mt-3 flex items-center gap-2 text-cream-dim">
        <IconPin className="h-4 w-4 text-cream-faint" />
        <span className="text-sm">{o.city}</span>
      </div>
      <p className="eyebrow mt-6 text-cream-faint">{o.venues} venues managed</p>
    </div>
  ))}
</div>
```

## Gaps, live vs. export

1. **No avatar in the real design at all.** Live code renders a 40px circular avatar (real photo or an initial-letter monogram fallback). Remove it entirely - replace with the `Owner` eyebrow label (amber, mono, uppercase) that sits above the name instead. Note: the initial-letter monogram is the same pattern already rejected on the Artist pages (`ArtistNoPhoto` replaced exactly this) - it should not have been reintroduced here.
2. **Bio is shown on the card; the export doesn't show it at all.** Remove the bio paragraph from the card. (Bio can still exist on the owner's own detail page if it does today - this is about the card only.)
3. **Sharp corners, not rounded.** Live: `borderRadius: "12px"`. Export: no radius anywhere. Remove it, matching the sharp-corner signature already applied to the venue cards and detail page under BUG-2608-072.
4. **Border/hover treatment.** Export: plain `border-ink-600` at rest, shifts to a subtle `amber/40` on hover only - a real `:hover` rule, not an inline style (inline styles can't express `:hover` at all, which is part of why BUG-2608-072 also had to fix dead hover states elsewhere - use a scoped `<style>` block with a real class + `:hover` selector, same pattern used for `.hover-lift-card`/`.afa-focusable` elsewhere in this codebase). Live code has no hover-border styling defined at all currently.
5. **Copy: "N venues managed" vs the live "N venues" / "N venue".** Update the `venueOwnersEmbed` i18n keys (all 11 locales) to match - real translations, not English placeholders, same discipline as every other copy change this round.
6. **Card padding/typography** - match the export's `p-6` padding, `text-2xl` name size, and the `eyebrow` mono-caps treatment for both the "Owner" label and the "N venues managed" line (both should be the same quiet, dimmed, uppercase mono style - not the bolder amber treatment currently on the venue-count line).

## Not a gap, no action needed

The grid breakpoint strategy differs (export uses explicit `sm:grid-cols-2 lg:grid-cols-3`; live uses continuous `auto-fill, minmax(280px, 1fr)` reflow) - both are valid responsive approaches, this is not a fidelity miss worth changing.

## Verification

Same discipline as BUG-2608-072: compare the built result side-by-side against the actual export screenshots (or a live Figma Make render) before opening a PR, not just a read-through of this brief. `tsc` clean against baseline. Confirm zero off-palette hex / emoji in the touched file.
