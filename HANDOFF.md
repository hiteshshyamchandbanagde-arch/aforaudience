# Session Handoff — 12 Sept 2026 (page-title font decision → 4 audit-correction dispatches → Step 5 built)

## qa HEAD: `42111ec` — GEN-2609-032/033/035/037 and BUG-2609-025/023 all merged and verified, plus 2 docs-only correction commits. This replaces the earlier 12 Sept "UI/UX audit → 4 shipped features + full font migration" handoff (`7dd5ddb`) — supersedes, does not delete, per this project's "fold in rather than discard" convention. That handoff's open items are folded forward below, unchanged except where explicitly resolved or corrected this session.

## Session narrative — why things are structured this way

Picked up exactly where the prior handoff left off: its own "most natural next call" was the page-title tier font decision (Section 8.4, 17 dashboard files, Georgia vs Young Serif vs Schibsted Grotesk). That single decision cascaded into six real dispatches, because verifying each one honestly kept surfacing more of the same class of problem — **the original 12-Sept font-migration audit undercounted its own scope repeatedly**, and each fix's own verification pass found the next gap:

1. Font-family decision made via live side-by-side mockup (not a written description) — Georgia vs Schibsted Grotesk first (Georgia's serif warmth won), then Georgia vs Young Serif (Young Serif won, to retire Georgia as the last pre-migration holdout). **Decision: `--afa-text-page-title` = `var(--font-display)` (Young Serif) / 28px / 700**, resolving the prior 28-vs-30 near-tie toward 28px.
2. Building the 17-hit rollout (`GEN-2609-032`) surfaced that `RatePromptClientPage.tsx` was never actually Georgia — already compliant since a Sep-3 commit, the original audit had simply miscounted it.
3. A follow-up sweep for "is font really done" (`GEN-2609-033`) found 4 more real hits the same audit missed: `my-feedback/page.tsx`'s h1 had **no** `fontFamily` at all (not "still Georgia" — never had one), `dashboard/audience/page.tsx` had both an unaudited 32px h1 and a 30px stat value, and `admin/artists/page.tsx`'s stat value was still Georgia. Resolved via the existing personal-account-vs-admin-tool context rule rather than inventing a "5th tier." Also disproved the "5th tier" candidate at `VenueDetailClient.tsx` — its hits were already compliant, never broken.
4. A full-repo Georgia sweep found **97 more raw hits across 39 files** (`GEN-2609-034`, logged then immediately superseded once scoped). Scoping it found 27 genuine `<h1>` misses across 4 size clusters (`GEN-2609-035`): 32px (12 hits, a brand-new tier — bigger than the original 28/30px tier, structurally distinct, no `BackLink`, top-level "your own account" pages), 28px (5 hits, all in `checkout/[bookingId]/page.tsx`, never previously audited), 26px (4 hits, folded up into the 28px tier since they share its nested-page structure), 24px (6 hits, already matched the existing `--afa-text-heading` token). The other 70 of the 97 were confirmed legitimately excluded (h2 modal/settings headings, one-off labels) — not misses.
5. Separately corrected the italic-caveat's documented scope: the font migration's "2 preserved taglines" claim was accurate only for its own narrow Phase-3 scope — a full sweep found **14 locations across 9 files** using `fontStyle: italic` + `var(--font-display)`, all rendering as browser-faux-italic (no true italic cut in `next/font/google`). Documentation correction only, no code change — accepted as the permanent state.
6. When asked to fix the `#68D391` login banner (believed open, from `GEN-2609-001`'s own stale ticket text, carried forward uncritically when logging `BUG-2609-025` earlier this session), direct grep proved it had **already been fixed back on 5 Sept** — a second, independent stale-claim correction, this time in `docs/design.md` itself rather than a ticket. `GEN-2609-001`'s ticket text was simply never updated after that fix landed.

Separately: two real, unrelated bugs got shipped mid-session at Hitesh's direction — `BUG-2609-025` (4 login banners on legacy light-theme tokens) and `BUG-2609-023` (mobile top-bar search was a dead no-op off `/events`; now redirects to `/events?search=` on Enter). Both required real diagnostic work beyond their literal spec (the exact rgba error/idle/notice patterns cross-checked against existing usages before applying; a required `<Suspense>` boundary for `useSearchParams()` that neither `tsc` nor dev mode would have caught, only a real production build did).

Finally, the original UI/UX audit's **Step 5** (`docs/afa-uiux-design-audit.md` Section 09, the "booking-confirmation ticket stamp" moment) — flagged as never-built in the prior handoff — was picked back up and shipped (`GEN-2609-037`). Verified first that the shipped seal already matched the Figma spec (no drift); the actual gap was purely the missing entrance animation. Presented 3 concrete animation concepts via a live interactive comparison, not a written description — Hitesh picked "Stamp impact" (overshoot + twist + settle + amber ring pulse).

**Net: Steps 1–5 of the original 6-step sequence are now fully done. Only Step 6 (accessibility/motion-guidelines/icons/notifications/onboarding, one-page specs each, opportunistic) remains untouched.**

## New standing rules established this session (now in ways-of-working.md)

1. **Docs updated immediately after merge + confirmed working** — not deferred to session end. Applied consistently all session: every one of the 6 shipped tickets below got its `docs/design.md` + (where relevant) `docs/afa-design-tokens-reference.md` entry written in the same turn as the merge verification, not batched.
2. **`HANDOFF.md` must cover every design decision taken**, not just shipped code — this handoff follows that (see the font-family/size/tier/animation decisions spelled out above and below).
3. **Coding always goes through Claude Code** — no direct-chat commits, no exceptions (the old "mobile, small edit" exception is gone).
4. **Every session opens by actively asking Hitesh for a fresh PAT** — not just accepting one if offered.

## What shipped this session, in full

**`GEN-2609-032` (`5bab75e`, #605) — page-title tier rollout, 16 hits/14 files.** `Georgia, serif` → `var(--font-display)` (Young Serif), size normalized to 28px, weight to 700, across the original 17-hit set (minus `RatePromptClientPage.tsx`, already compliant). Verified via Contents API against real `qa` content post-merge — both the changed lines and the deliberately-excluded same-file lines (`admin/settings` 20px h2s, `tours` 19px h3, `bookings` 24px h1, `artists` 17px stat div).

**`GEN-2609-033` (`e74699a`, #606) — 4-hit cleanup the original audit missed.** `my-feedback/page.tsx:324` (no fontFamily → Young Serif), `dashboard/audience/page.tsx:40` (stat, → Young Serif) and `:106` (h1, 32px, Georgia → Young Serif, **not** resized — this became the seed for the 32px tier discovered in `GEN-2609-035`), `admin/artists/page.tsx:344` (stat, → Schibsted Grotesk, admin-tool context). `VenueDetailClient.tsx`'s previously-flagged hits confirmed already compliant.

**`GEN-2609-035` (`5b6c2b4`, #607) — second-wave sweep, 27 hits/20 files, new `--afa-text-page-title-lg` token.** Full breakdown and the reasoning for each cluster's tier assignment is in the narrative above and in `docs/afa-design-tokens-reference.md` Section 8.5. The 32px tier is the single biggest addition from this session — bigger than the entire original page-title tier it sits beside.

**Documentation corrections (no code, 2 separate commits, `816032e` + earlier in the `-032`/`-033`/`-035` doc updates) — the italic-caveat scope (2→14 locations) and the `#68D391` login banner (already fixed 5 Sept, not open).** Both caught by directly grepping/checking code rather than trusting prior ticket text or handoff summaries. This is now the third and fourth time this exact failure mode has appeared this session (`RatePromptClientPage.tsx`, `my-feedback.tsx`, italic count, `#68D391`) — **treat any inherited "still open" or "N locations" claim as unverified until grepped**, this session's single strongest lesson.

**`BUG-2609-025` (`5f1f14e`, #608) — login page, 4 banners off legacy tokens.** `wasSuspended`/`error` → the `AuthPromptSheet.tsx`/`CorporateInquiryModal.tsx` error pattern (`rgba(179,38,30,0.1)`/`var(--afa-error)`); `wasIdle` → the `verify-phone`/`RegisterForm.tsx` neutral-card pattern; `devOtp` → the `FeeSheet.tsx:102` info-box pattern. All three patterns copied from real existing usages, not invented. `devOtp`'s live-render verification was blocked by `MSG91_AUTH_KEY`/`MSG91_TEMPLATE_ID` being unset in the dev environment (real env-config gap, unrelated to this change) — verified instead via direct diff comparison + hex-to-rgb cross-check.

**`BUG-2609-023` (`db41f20`, #609) — mobile top-bar search redirect.** Enter-key submit on any non-`/events` route now pushes to `/events?search=<query>`; `events/page.tsx` reads it via a lazy `useState` initializer. CC caught and fixed a real build-breaking gap outside the ticket's literal diff: `useSearchParams()` requires a `<Suspense>` boundary in production builds (neither `tsc` nor dev mode surfaces this — only `next build`/a real Vercel deploy does). Diff reviewed line-by-line before merging, not taken on CC's summary alone.

**`GEN-2609-037` (`aa80ff7`, #610) — the audit's Step 5, finally built.** Seal stamp-in animation on `ContributionMoment.tsx`. 3 concepts compared live (Stamp impact / Drop and flash / Simple pop); **Stamp impact** chosen. New `afa-seal-stamp-in`/`afa-seal-ring-pulse` keyframes and `.afa-seal-stamp-mount`/`.afa-seal-ring-mount` classes added to `globals.css` following the exact `.afa-sheet-in`/`.afa-backdrop-in` convention, extending the existing `prefers-reduced-motion` selector list rather than duplicating it. **New environment gotcha found during verification, worth keeping:** `pkill -f "next dev"` doesn't reliably kill the process in CC's environment — a stale server kept serving old CSS across two restarts and a full cache clear, which looked exactly like a build failure. Root-caused by checking served CSS bytes directly rather than trusting the dev-server logs; fixed via `taskkill //PID` on the actual PID from a port-conflict error message.

**Paused, not built — `GEN-2609-036` (logged, `NEW`).** Follow-up to `BUG-2609-023`: Hitesh wants the "Filter events" bottom sheet itself openable from any page (Discover/Artists/Venues/Dashboard), not just reachable after a redirect to `/events`. Architecture scoped but explicitly not dispatched: `MobileEventFilterSheet.tsx` is fully-controlled (all state + the `cities` list live in `events/page.tsx`, passed as props) — lifting it globally needs filter state moved to URL search params as the shared source of truth (same pattern `?search=` already established) and a UX decision on what happens when a filter is applied from a non-events page. `cities` is already independently fetchable via `/api/venues/cities`, no new endpoint needed — that was the one piece of the puzzle that turned out easier than expected.

**Verification pattern held all session, same discipline as every prior handoff — arguably tested harder this session than any before it.** Every PR's diff pulled and checked line-by-line before merging (not summary-trusted) — this specifically caught nothing wrong in any of the 6 shipped PRs, but the discipline is what surfaced the required `<Suspense>` addition being reasonable rather than suspicious, and confirmed the `GEN-2609-037` diff extended the reduced-motion list rather than duplicating it. Every merge went through the full chain: PR opened → CI/Vercel-preview green → head SHA re-fetched immediately before squash-merge → branch deleted → real file content verified via Contents API (not the diff view) → `qa`'s own Vercel deployment confirmed READY → runtime errors checked via Vercel MCP. Zero runtime errors across every deploy this session except one pre-existing, unrelated `url.parse()` NextAuth deprecation warning (dated back to 14 July, ruled out as a regression).

All work this session (`GEN-2609-032/033/035/037`, `BUG-2609-025/023`) marked `RESOLVED`/`deployStage: DEPLOYED_QA` in the Feedback table and logged to `docs/design.md`. `GEN-2609-034` closed as `REJECTED` (superseded by `-035`, with a note). `GEN-2609-001` was already correctly `RESOLVED` — only its ticket *text* was stale, now flagged in `docs/design.md` rather than the ticket itself (ticket left as-is, since the actual resolution status was already right).

## Open items for next session

**New from this session:**
- **`GEN-2609-036`** — global filter-tray lift (Option B). Scoped, not dispatched. Real design decision still open: what happens when a filter is applied from a non-events page (open-in-place then navigate-on-apply is the leading idea, not decided).
- **Step 6 of the audit's sequence** — accessibility (contrast/focus-state pass), motion guidelines (catalogue + write the usage rule — note this technically should have preceded Step 5's animation work per the audit's own sequencing note in Section 09, but Step 5 shipped first anyway; worth deciding whether to retroactively write the motion-guidelines spec now, informed by the one animation that already exists, or before the *next* one), icon system audit, notifications visual/content system, onboarding as one designed sequence. None started. Each is meant to get "its own one-page spec, same discipline as Step 1" — this is 5 separate pieces of work, not one dispatch.
- **The stale-claim pattern itself** — 4 separate instances this session (`RatePromptClientPage.tsx`, `my-feedback.tsx`, italic-caveat count, `#68D391`) where an inherited "still open"/"N locations" claim from a prior audit or ticket turned out wrong on direct inspection. Worth treating as a standing session-start habit, not just this session's specific findings: **grep before trusting any carried-forward "still open" claim**, especially anything sourced from a ticket's own possibly-stale message text rather than a fresh code check.
- **One-off `<h1>` sizes never tiered** — `messages/[id]/page.tsx` (22px), `(public)/tours/[slug]/page.tsx` (34px), `ComingSoon.tsx` (36px). Deliberately deferred during `GEN-2609-035` — each is a sample of 1, not enough to justify a tier decision alone.

**Carried forward, unchanged from before this session:**
- 🔴 **Razorpay + Google Maps/Places QA key rotation** — outstanding since 25 Aug, flagged again this session, still not done. This is the single oldest item on the whole board and the sole blocker on `GEN-2609-005`'s live verification. Needs Hitesh directly — dashboard access, not something dispatchable.
- `GEN-2609-005` (Checkout + Fee Sheet dark restyle) — `IN_TEST`, code built and pushed, blocked purely on the item above.
- `GEN-2609-009` — misleading "Supports the artist ecosystem" booking-fee copy (11 locales + email). Replacement copy already drafted, never shipped. Ready to dispatch, no open questions.
- `GEN-2609-016` — `SeatLayoutPreview.tsx` deprecated `--afa-white` usages. Low priority, ready to dispatch.
- `GEN-2609-022` — live click-through still not confirmed/`RESOLVED` (status: `BUILD_COMPLETE`).
- `--afa-black` broken reference (6 hits in `my-feedback/page.tsx`) — logged, not fixed. Not re-verified this session; worth a quick grep-check next time given the stale-claim pattern above, before assuming it's still accurate.
- Type-scale (Section 8.1) and grid-spacing rollout beyond the booking flow — spec exists, never dispatched.
- `Button.tsx`/`Input.tsx` component library — still only in the original 11 files, not rolled out further.
- RLS disabled on 22 QA-project tables (confirmed via direct query this session, still accurate) — flagged, no policy pass done.
- IA question (hamburger drawer duplicating tab-bar items) — still waiting on Hitesh's go-ahead to dispatch the analysis.
- `GEN-2608-039` (pg pool `max:1` connection-contention warnings) — not urgent, flagged for before any high-concurrency event.
- `GEN-2608-034` (Navarasa event filter) — deferred pending real event volume.
- `GEN-2608-031` ("Choose file should be in Tab and color") — genuinely unclear, needs clarification from whoever filed it (corrupted screenshot at submission time).
- Assorted smaller carried-forward notes, not re-verified this session: chat button's ~2px gap above the tab bar, 360px search placeholder clipping, unconfirmed label wrap risk, stale Admin session cache suspicion, unconfirmed `/events` stuck-loading thread, filter-badge missing active-count, `LocationChip` "Pune (IN)" vs "Pune" duplicate-city data quality (visible again in a filter-sheet screenshot this session — still not fixed).

## Credential/tooling notes

**GitHub PAT path corrected this session:** stored at `/home/claude/afa/token.txt` (chmod 600) — the prior handoff said `/home/claude/afa_token/token.txt`; that was itself a typo/drift from the session before it. This session's path is the one actually used successfully throughout (repo cloned to `/home/claude/afa/repo`). Worth locking this in as the real standing path.

No `gh` CLI/`GITHUB_TOKEN` in the Claude Code environment — still true, still fully settled, zero friction this session. Chat opens/merges every PR via the PAT; CC only ever pushes branches.

**New gotcha this session (`GEN-2609-037`):** `pkill -f "next dev"` is unreliable for killing the dev server in CC's environment — verify via served-asset bytes, not just "the kill command ran," before trusting a live-render check that looks wrong. `taskkill //PID <real-pid-from-port-conflict-error>` is the reliable fallback.

## Testing gotchas (carried forward, still valid, no changes this session)

- Next.js dev-mode's `<nextjs-portal>` overlay intercepts Playwright clicks on the bottom nav's first item — use `dispatchEvent('click')`, not `.click()`.
- `trailingSlash: true` — always include the trailing slash in Playwright URL globs.
- Login form's identifier field isn't `input.first()` — target `input[placeholder*="AFA code"]` directly.
- `useSearchParams()` requires a `<Suspense>` boundary for `next build` to succeed — `tsc --noEmit` and dev mode both stay silent about this; only a real production build (or a live Vercel deploy) catches it. (New this session, from `BUG-2609-023`.)
- Locked-palette color checks: grep the actual token *values* in `globals.css`, not just trust a variable name.

## Confirmed working QA credentials (all `QaPass!2026`)

`omkar.organiser@aforaudience.qa` (Organiser + Venue Owner), `hrithik.artist@aforaudience.qa` (Artist), `vinayak.venue@aforaudience.qa` (Venue Owner), `atul.audience@aforaudience.qa` (Audience). Admin is Hitesh's own real Google account, protected from reseeds. **Local dev-only limitation found this session:** the QA `devOtp` bypass can't be exercised locally because `MSG91_AUTH_KEY`/`MSG91_TEMPLATE_ID` are unset in CC's dev environment — the OTP-request endpoint 429s before reaching the bypass. Not a blocker for anything shipped so far, but will block any future ticket needing a real local OTP flow test.

## Session-start checklist

1. `git fetch && git reset --hard origin/qa` — HEAD should be `42111ec`.
2. Ask Hitesh for a fresh GitHub PAT (doesn't persist between sessions) — store at `/home/claude/afa/token.txt`, chmod 600.
3. Read this file, then `docs/design.md` for anything logged since, then `docs/afa-design-tokens-reference.md` Sections 8.4/8.5 if touching anything font/type-related.
4. Read `CC_HANDOFF.md` for CC's own local/session-state notes.
5. Check Razorpay/Google Maps billing dashboards — this is now the single oldest open item on the board.
6. Query the Feedback table (NEW/REVIEWED, category=BUG) and cross-check each against real code via `grep`, not just the ticket's own message text — this session found 4 separate stale claims by skipping that step once and catching it, then deliberately doing it every time after.
7. Decide with Hitesh: `GEN-2609-036` (global filter tray), Step 6's five sub-specs, one of the two ready-to-dispatch quick fixes (`GEN-2609-009`/`-016`), or the Razorpay rotation (needs Hitesh directly, not a dispatch).
