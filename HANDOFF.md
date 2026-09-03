# Session Handoff — 3 Sep 2026 (theme-migration audit → 6-PR fix chain, dark-theme + unstyled-form-control bugs)

`qa` HEAD: `2c9e5a0` (#544–#549 all merged since last handoff, plus one docs-only audit commit merged directly). Nothing pushed and awaiting review — everything from this session shipped.

## 🔴 Next session — priority order

1. **Rotate Razorpay + Google Places credentials** — still unresolved, only Hitesh can fix (needs dashboard/console access). Both keys confirmed dead (401/400 direct from the APIs) as of 25 Aug, not a plumbing bug. Standing reminder, unchanged for several sessions now.

2. **White-card-on-dark-shell — still fully open, do not assume this session touched it.** This session added `background: 'white', color: 'var(--afa-ink)'` to *form inputs* inside `dashboard/admin/settings/page.tsx` and `dashboard/admin/diary/page.tsx` so those inputs render legibly against their own still-white card backgrounds — it deliberately did **not** change the cards themselves to `var(--afa-surface-raised)`. The known 5-file list (`dashboard/admin/diary`, `dashboard/artist/edit`, `dashboard/artist/corporate-inquiries`, `dashboard/organiser/events/[id]/edit`, `dashboard/admin/settings`) is unchanged and still needs its own dedicated pass.
   **New this session:** found 2 more spots with the identical literal-`white`-card pattern, both **public-facing, not dashboard** — `src/components/AudienceChoiceVoting.tsx` and the companion-tagging card in `src/app/checkout/[bookingId]/page.tsx`. This bug class is bigger than "5 dashboard files" — worth a fresh full grep for `background: 'white'` / `background: "white"` across all of `src/` (not just dashboard) before scoping the fix pass.

3. **`--afa-terracotta` sweep — significant progress this session, not finished.** `docs/theme-migration-audit.md`'s "Prioritized fix sequence" is the live checklist:
   - ✅ Done: items 1–6 (`SiteNav.tsx`, `globals.css` focus-ring, `SupportWidget.tsx`, `Toast.tsx`, `organisers`/`venue-owners`(+detail)/`RatePromptClientPage.tsx`, and — added this session, not in the original list — `profile/page.tsx` + `GenrePicker.tsx`).
   - ⬜ Still open: item 7 (🔔/🔕 emoji bell toggle on `ArtistProfileClientPage.tsx:524` and `NotificationOptIn.tsx:133` — reuse `BellIcon`/`BellOffIcon` from `VenueIcons.tsx`, don't rebuild), item 8 (`AuthPromptSheet.tsx`, `CorporateInquiryModal.tsx`, `SeatPicker.tsx` — booking-critical, `SeatPicker.tsx` especially), item 9 (remaining shared components — homepage rails, `EnvBadge.tsx`, `LegalDocLayout.tsx`), item 10 (dashboard terracotta accent sweep, ~25 files — see next item, blocked on a design question first), item 11 (bare `monospace` fontFamily, 6 files, trivial), item 12 (auth pages — deliberately deferred, needs a full design pass not a token swap, unchanged).

4. **`--afa-gold` dark-on-dark contrast question — flagged in the audit (§4), still unresolved.** ~20 dashboard files use `var(--afa-gold)` (`#8A6A1F`, designed as text-on-cream) as text color directly on the new dark surfaces (`dashboard/organiser/page.tsx:139`, `dashboard/admin/page.tsx:369`, etc.) — same contrast-bug shape as the already-fixed BUG-2608-093 (Seat Map dark-on-dark). Worth a real WCAG contrast check before item 10 above touches these same files, so they're not fixed twice.

5. **`--afa-cream-tint-1/2`** — still live in `SeatPicker.tsx` and `LegalDocLayout.tsx`, unchanged, carried forward from before this session.

6. **Local dev env, two standing issues, unrelated to each other:**
   - DB unreachable (recurring Prisma P1001) — check freshly each session, has flipped reachable/unreachable before.
   - `.env.local`'s VAPID vars malformed — breaks `/api/events` with a 500 before the DB issue even kicks in. Standing workaround: throwaway keys via `npx web-push generate-vapid-keys`, passed as env overrides for the dev-server process only, never written to `.env.local`.

7. **Auth pages** (`login`/`register`/`reset-password`/`forgot-password`/`verify-email`) — still fully pre-dark-redesign (literal `bg-white rounded-[16px]` shells), deliberately deferred, same bucket as the Artists-directory visual-interest request (GEN-2608-073). Needs a real design pass, not a quick fix.

## Shipped this session

Started from a live-screenshot report of orange headers on `/profile` that turned out to be a **different** bug than reported (see PR #547 below) — that investigation led to commissioning a full repo-wide theme-migration audit, which then drove five sequential fix PRs.

### `docs/theme-migration-audit.md` (docs-only, merged directly — no PR review cycle, user pre-authorized)
Grepped all of `src/` for every Theme Phase 0 pattern (legacy color tokens, literal white/`#fff`, Georgia/monospace fontFamily, pre-migration 16px card radius, stray emoji), cross-checked against `docs/design.md` and the QA Feedback table so already-tracked items weren't re-reported as new. Found `/organisers`, `/venue-owners`(+detail), and the post-event rate page were still full Theme Phase 0 (same class as Wall of Fame pre-#544) — nobody had caught this because GEN-2608-073/074 only covered Artists/Venues. Also found `SiteNav.tsx` and `SupportWidget.tsx` (highest fan-out in the app) still on terracotta, and a genuine contrast bug candidate (`--afa-gold` on dark surfaces) outside the brief's own checklist.

### PR #544 — Wall of Fame full dark-theme migration
White cards → `var(--afa-surface-raised)`/3px/`rgba(245,245,240,0.1)` border; `--afa-plum-black` gradient headers → flat surface-raised + grid-texture (new `src/components/WallOfFameMarks.tsx`, `TrophyMark`/`StarMark`) for the true-empty "no winner" state, real photo via `Photo.tsx` or an amber initials chip otherwise; terracotta → amber (non-CTA) or `--afa-fill-solid` (money/booking actions only); 🏆 hero emoji removed. Also caught and fixed a leading-emoji issue baked into 4 i18n dictionary strings (stripped at render time, dictionaries themselves untouched — 11-locale edit was out of scope for that PR).

### PR #545 — global chrome terracotta → amber
`SiteNav.tsx` (13 occurrences — active nav-link, notification badges, locale picker), `globals.css`'s sitewide `.afa-focusable:focus-visible` outline, `SupportWidget.tsx` (9 occurrences — confirmed with the user that the feedback-submit button should match the other 8, not go CTA-orange, since it isn't a money action), `Toast.tsx`'s error accent (matched the adjacent `text` variable's existing `var(--afa-error)`, closing a gap BUG-2608-097's own fix had missed).

### PR #546 — organisers/venue-owners(+detail)/rate-prompt dark-theme migration
Same recipe as #544, explicitly reusing the established pattern rather than a new Figma round. `organisers/page.tsx` and `venue-owners/page.tsx` are near-identical twins, fixed together. Neither ever needs the illustrated-fallback treatment (unlike Wall of Fame) since both always show a real photo or initials, never a true-empty state — flattened `--afa-plum-black` → `surface-raised` with a border-bottom standing in for the lost color-contrast boundary. `RatePromptClientPage.tsx`'s ⭐ emoji star-rating swapped for the ★/☆ glyph convention; its `submitOverall` button went `--afa-fill-solid` specifically to match a sibling button in the same file already on fill-solid for the identical `POST /api/reviews` action (not a general rule — every other occurrence across all 3 files got amber).

### PR #547 — profile page + GenrePicker off Theme Phase 0
**The header-color investigation**: live-checked before touching anything — the reported "orange headers" did not reproduce; every `<h2>` correctly resolves to `var(--afa-text-primary)` (cream), both in source and on screen. The real issue was the *buttons*, which the original screenshot report had mis-described. 11 `--afa-terracotta` occurrences → amber (no money action on this page — Save-field edits and either-instant-or-approval-gated applications, confirmed against `site-knowledge.ts`; no fill-solid sibling existed to justify an exception the way #546's rate page had one). Also fixed a doubly-drifted active-card glow (`rgba(196,90,54,0.12)` didn't even match terracotta's real rgb) to the real amber rgb at the same opacity. Confirmed the page's 12px card radius against `afa-design-tokens-reference.md` §7 (dashboard-family convention) rather than assuming it needed to change — it's correct as-is. `GenrePicker.tsx`'s selected-pill fill moved from `--afa-fill-solid` to amber for the same non-CTA reasoning (genre selection isn't a commit action); checked its only other call site (`dashboard/artist/edit/page.tsx`) for a reason to keep it distinct — found none.

### PR #548 — profile currency `<select>`'s leftover white background
Missed in #547. Tested two candidate fixes directly in Chromium before picking one (per the brief's explicit instruction not to guess): removing `background` entirely (matching sibling inputs) renders the closed `<select>` with the browser's default light-gray control background and dark text — confirmed via screenshot to be a near-illegible dark-on-dark-gray combination on this page's dark card. Explicit `background: var(--afa-surface-raised)` + `color: var(--afa-text-primary)` was the only one that actually worked.

### PR #549 — repo-wide sweep, form controls with no background/color set at all
**This is the bug class that mattered most this session.** #547 and #548 each grepped for a specific wrong *value* (`afa-terracotta`, literal `'white'`) and both came back clean — which is exactly why this different failure mode (background/color simply absent, so the browser default renders instead) survived two "fixed" passes. A fresh live screenshot found 4 more broken spots on `/profile` alone after #548 shipped, which is what triggered this pass. Grepped every `<input>`/`<textarea>`/`<select>` tag across all of `src/` (57 files matched; 2 were comment-only false positives), checked each one's resolved style — inline, or via a shared `inputStyle`/`fieldStyle`/`INPUT_STYLE` object that many call sites in a file route through. Found 26 real hits across 18 files, all fixed; roughly 29 other files checked and confirmed already clean. Discovered mid-pass that 4 of the hits (`dashboard/admin/settings`, `dashboard/admin/diary`, `AudienceChoiceVoting.tsx`, the checkout companion-search input) sit inside cards that are still literally `background: 'white'` — used `white`/`var(--afa-ink)` there to match each file's real current surface instead of forcing dark tokens that would have made things visibly worse (a dark box on a white card). Verified with live screenshots using **real typed text**, not just placeholders, since the two render differently.

## Process notes worth remembering

- **"Grep came back clean" is not the same as "nothing's wrong."** The #549 bug class (missing keys) has the same visible symptom as the #547/#548 bug class (wrong-value keys) but requires checking for *absence*, not string-matching a known-bad value. Established as the correct check going forward for any future form-control sweep.
- **Always check the actual surrounding container's background before picking a fix color**, not just the app's nominal dark-theme default — several files (both dashboard and public-facing) still have genuinely unmigrated white cards, and applying dark tokens there blind would introduce a new, more visible bug than the one being fixed.
- **Screenshot verification needs real typed text, not just placeholder text** — the two are frequently styled differently (placeholder opacity, etc.), so a placeholder rendering fine doesn't confirm the actual value text will too.

## Tally

27 PRs merged total (#527–#549). Zero pushed-and-awaiting-review. Zero reverted.
