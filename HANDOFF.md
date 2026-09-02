# Session Handoff — 2 Sep 2026 (admin/settings dark shell + Toast.tsx fix, homepage bento real photos)

`qa` HEAD: `6bc9b50` (#541, #542, #543 all merged since last handoff — the illustrated-fallback branch, the admin dark-shell sweep, and the real-photos branch from this session). Nothing pushed and awaiting review — everything from this session shipped.

## 🔴 Next session — priority order

1. **Rotate Razorpay + Google Places credentials** — root-caused 25 Aug, still unresolved, only Hitesh can fix (needs dashboard/console access). Both keys are confirmed dead (401/400 direct from the APIs), not a plumbing bug.
2. **White-card-on-dark-shell token issue** (found this session, deliberately not fixed): `dashboard/admin/diary/page.tsx`, `dashboard/artist/edit/page.tsx`, `dashboard/artist/corporate-inquiries/page.tsx`, `dashboard/organiser/events/[id]/edit/page.tsx`, and `dashboard/admin/settings/page.tsx` all use literal `background: 'white'` for content cards instead of `var(--afa-surface-raised)`, which `docs/afa-design-tokens-reference.md` documents as the correct dashboard card-fill token. Makes card section headers (styled for a dark card) hard to read. Same shape of problem as the `--afa-terracotta` sweep below — a real, pre-existing, multi-file convention bug, not introduced this session. Needs its own dedicated pass across all 5 files, not a piecemeal fix.
3. **`--afa-terracotta` repo-wide sweep still not done** — ~69 files as of 25 Aug. Still deliberately out of scope for every dispatch so far; needs to actually be scheduled as its own pass rather than fixed file-by-file forever.
4. **`--afa-cream-tint-1/2` repo-wide sweep** — same shape of problem. Fixed on the seat-map canvas (25 Aug) but still live in `SeatPicker.tsx` and `LegalDocLayout.tsx`.
5. **Local dev env has two standing issues, unrelated to each other, both out of scope every time they're hit:**
   - Local DB unreachable (recurring Prisma P1001) — confirmed recurring across many sessions since 22 Aug. Check freshly each session; it has flipped between reachable/unreachable before.
   - `.env.local`'s `VAPID_SUBJECT`/`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` are not validly formatted — breaks `/api/events` with a 500 even before the DB issue kicks in (found 29 Aug). Workaround used every session since: throwaway VAPID keys generated via `npx web-push generate-vapid-keys` and passed as env overrides for the dev-server process only, never written to `.env.local`.
6. **BUG-2608-091 / BUG-2608-090** — small, queued, not dispatched. Past Requests rows missing date/time; a stat-card subtitle sitting on the wrong card. Pick up whenever.
7. **SeatSectionEditor's running-total bar isn't sticky** — minor, non-blocking deviation from the Figma export. Only matters for venues with many sections.
8. **Remaining pages never reviewed against Figma**: Flexible Requests page, auth pages (login/register/forgot-password/reset-password/verify-email — still fully pre-dark-redesign, flagged as a separate full-page-redesign item, not a token bug).
9. *(Trivial, optional)* stale remote branches safe to delete from GitHub: `fix/homepage-bento-emoji-fallback`, `fix/homepage-bento-illustrated-fallback`, `fix/admin-settings-dark-shell`, `feat/homepage-bento-real-photos` — all merged (the last three via this session's PRs #541/#542/#543).
10. **`homePage.bentoIllustrativeLabel`** (the "Illustrative" chip on homepage bento fallback photos) shipped as identical English text in all 11 locale dictionaries rather than real translations — matches this file's own precedent (`happeningSoonAll: "All →"` is also unlocalized everywhere), but worth a real localization pass whenever one happens for the rest of the homepage.

## Shipped this session

### `dashboard/admin/settings/page.tsx` had no dark shell at all — fixed, plus a wider sweep (PR #542)

Root cause: this app never toggles a `.dark` class anywhere, so every dashboard page is individually responsible for setting `background: var(--afa-surface-raised)` on its own `<main>` — there's no shared layout doing it centrally. `admin/settings/page.tsx` simply never did this on any of its 3 states (loading/forbidden/main content), so the whole page rendered on the plain white body default, cards and all. Fixed by adding the same `minHeight:'100vh', background:'var(--afa-surface-raised)'` the sibling admin pages (`users`/`diary`/`revenue`/`artists`/`feedback`) already use; loading state swapped from a bare unstyled `<div>` to `<BrandLoader>` to match convention.

**Grepped all of `src/app/dashboard/**` for the same missing-`<main>`-background pattern and found 4 more instances**, none previously flagged: `dashboard/admin/page.tsx` (Command Center — the admin dashboard's own landing page, both its forbidden and main states) and all three `dashboard/organiser/tours/*` pages (list, detail, create). Fixed identically, same commit.

Also fixed `src/components/Toast.tsx` (the other item flagged this session): it was still on pre-dark-redesign light tokens (`--afa-error-bg` #FDECEA, `--afa-cream-tint-3`, `--afa-mint-tint-2` — all near-white), the same bug class `ErrorBanner.tsx`'s own code comment describes already being fixed there. Swapped to the identical translucent-rgba-on-dark treatment `ErrorBanner`/`SuccessBanner` use, extended to the `'info'` kind those two don't have.

Found but deliberately **not** fixed: several of the same admin pages use literal `background: 'white'` cards instead of the documented `--afa-surface-raised` token (see priority item #2 above) — out of scope for "fix the missing shell," left for a dedicated pass.

### Homepage bento tiles: illustrated fallback → real per-type photos (PRs #543, two rounds)

Scope: `src/app/page.tsx` / `BentoTile` only — `EventCard.tsx`'s `IllustratedEventFallback` (events listing, event detail hero) is untouched throughout.

**Round 1:** Sourced 5 Unsplash photos (one per `EventType`), each verified per-photo as the free Unsplash License (not Unsplash+ — one initial stand-up candidate was Unsplash+ and got swapped). Downloaded (not hotlinked — same failure mode as BUG-2608-079) to `public/images/event-fallbacks/`. Rendered through the existing `Photo` component (same duotone real posters use, not a new treatment) with a small "Illustrative" chip so a fallback never reads as the actual event's photo.

**A pixel-dimension check caught a real defect before it shipped:** `Photo.tsx` has no `srcset` and any of the 5 images can land in any of the 3 bento slots (large/medium/strip), so a single fixed file has to cover the worst case — the strip tile needs ~2576px width at 2x retina (`766×440` / `510×210` / `1288×220` are the three tiles' actual CSS sizes). First download pass was only 1200px wide; re-fetched all 5 at 2600px.

**Round 2 (a fixup after content/IP review, before merge):** Two of the five photos had real problems a resolution check doesn't catch:
- `theater.jpg` was the wrong content (an EDM/concert light show, reading as a music festival not a stage play) — replaced with a genuine opera-house proscenium arch + red curtain + gold gilding.
- `lineup.jpg` had a crowd member's shirt with legible third-party branding — a real IP/attribution risk distinct from the Unsplash license itself. Replaced with a fully out-of-focus stage-lights bokeh shot, chosen deliberately because it's safe *by construction* (nothing sharp enough to ever contain readable text or a face), not merely inspected-and-passed.

**Two process lessons worth remembering for next time an image gets sourced this way:**
1. **Don't trust an AI photo-description tool's claims about image content.** Every rejected lineup candidate came back from a description pass as "no readable text" / "true silhouettes" — and every one, on actual visual inspection, had a stray legible logo or an identifiable face. This happened repeatedly, not once.
2. **A candidate photo has to be checked against the real duotone in an actual rendered tile at every size it can land in, not just one.** The first theater.jpg replacement looked great in a strip-tile crop but crushed to near-flat black in the large-tile crop, because its rich detail sat in a narrow horizontal band with a lot of near-black space around it, and `Photo.tsx`'s `grayscale→contrast(1.25)→brightness(0.9)→amber-multiply` chain has no headroom for a crop that dilutes that band with darkness. Fixed by pre-cropping the *source file* tight around the good band before saving — the same fix `poetry.jpg` needed in round 1.

Both rounds verified via mocked-session Playwright (all 3 tile sizes × all 5 types, systematically rotated across slots) — local dev env issues (P1001, malformed VAPID vars) worked around per the standing pattern, not fixed.

## Explicitly parked / rejected (carried forward, unchanged)

- **GEN-2608-081** — QA seed data country distribution is deliberate multi-country test data (India 933, ~30 each across 7 others), not accidental Faker noise. Powers the country-flag feature. REJECTED as a bug.

## Tally

21 PRs merged total (#527–#543) as of this session. Zero pushed-and-awaiting-review. Zero reverted so far.
