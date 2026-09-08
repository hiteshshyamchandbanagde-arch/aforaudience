# Chat handoff addendum — 8 Sept 2026 (on top of CC's entry immediately below)

## What chat did after CC's report above

CC's handoff (directly below) was accurate at the time it was written, but had gone stale by the time chat reviewed it in the same conversation - GEN-2609-015 had already been reviewed line-by-line and merged as PR #573 minutes earlier, before CC's local session could know. Rather than merge the stale claim into `qa` as-is, chat corrected it in place (see the top section below - "qa HEAD" line, "What's NOT merged" section, standing-items bullets, and the session-start checklist were all edited) before writing this file to `qa` directly.

**Branch cleanup done:** both `docs/session-handoff-0908` (superseded, content already folded into the entry below by CC) and `docs/session-handoff-0908c` (this session's own handoff branch, now consolidated directly into `qa`'s real `HANDOFF.md` instead of staying as a fourth competing unmerged docs branch) were deleted after their content was confirmed captured here. This is the same recurring "handoff-branch collision" pattern noted in CC's own entry below - the fix going forward is what happened this time: write directly to `qa`'s real `HANDOFF.md` (docs-only changes push directly per standing practice), don't leave handoff content stranded on its own unmerged branch for a future session to discover, ignore, or collide with.

**Real corrections made to CC's entry, not just a stale-branch note:**
- "qa HEAD" now correctly reads `e544577` (post-merge), not `aa8e940` (pre-merge, CC's number was already correct at the time it was written for what *had* merged before CC's session started, but didn't yet include CC's own PR #573).
- "What's NOT merged" section removed entirely (was listing the now-merged `feat/gen-2609-015-seatpicker-fix`) and replaced with a plain "nothing outstanding" statement plus a mention of GEN-2609-016.
- Added the **GEN-2609-016** ticket reference (SeatLayoutPreview.tsx's own `--afa-white` usages) to standing items - this was logged in the Feedback table by chat after CC's handoff draft was already written, so CC's version couldn't have included it.
- Session-start checklist's "review and merge GEN-2609-015" step removed (already done); replaced with a note about the branch cleanup instead.

## Full session summary, both CC's work and chat's review/merge work

1. CC diagnosed the recurring "local DB returns empty" report as non-reproducing (likely a stale pre-fix dev process), found and fixed a real, separate `VAPID_SUBJECT`/`VAPID_PUBLIC_KEY` bug blocking local dev entirely, then ran the first-ever real-browser/real-data fidelity pass against the whole GEN-2609-010→013 batch - confirming it all actually renders correctly, and finding two new real bugs in `SeatPicker.tsx` (illegible legend, squished seat grid) plus one out-of-scope seed-data bug (duplicate "Pune" city).
2. Chat reviewed both screenshot rounds from the fidelity pass, independently confirmed the GEN-2609-013 "More" drawer gap was already mitigated by GEN-2609-013's own Profile-hub Dashboard link (one extra tap, confirmed acceptable by Hitesh, closed with no new code), and got Hitesh's sign-off before dispatching GEN-2609-015 back to CC.
3. CC fixed both SeatPicker bugs, verified the legend/canvas-fit math by hand-traceable reasoning (bounding-box technique reused from two existing precedents in the codebase, not invented fresh), and closed the regression-check gap (no second NUMBERED venue exists in QA seed data) using a `page.route()`-mocked API response against the real component - avoiding an unnecessary DB write chat had pre-approved as a fallback but wasn't needed.
4. Chat reviewed the GEN-2609-015 diff in full (every hunk, not just the summary), confirmed CI green, and squash-merged as PR #573 - now live on `qa.aforaudience.com`.
5. Chat logged **GEN-2609-016** (the incidental `SeatLayoutPreview.tsx` finding) as a new low-priority backlog ticket.
6. This handoff reconciliation - correcting CC's now-stale merge status and consolidating three competing docs branches into one clean `HANDOFF.md` on `qa`.

## Everything below this line is CC's original handoff entry, corrections applied inline as noted above

# Session Handoff — 8 Sept 2026 (local DB/VAPID fix, mobile-v2 fidelity pass, GEN-2609-015 built and merged - chat-reviewed)

## qa HEAD: `e544577` — GEN-2609-010→013 (#569-572) and the GEN-2609-013 "More"-drawer decision (`aa8e940`) were already merged/closed before this session started. This session's own work, GEN-2609-015 (SeatPicker legend + squished seat-map fix), was chat-reviewed line-by-line and merged as **PR #573** (`e544577`), live on `qa.aforaudience.com`. **Nothing from this session is outstanding.** CC's own handoff draft (this section) originally reported GEN-2609-015 as "pushed, not merged" - that was accurate at the moment CC wrote it, but stale by the time chat picked this up, since chat merged it in the same conversation shortly after. Corrected here so the next session doesn't re-review a branch that no longer exists.

## Note on a stale, unmerged handoff branch: `docs/session-handoff-0908`

An earlier handoff attempt this same calendar day (commit `85f79e0`, "GEN-2609-010/011/012/013 all merged") was written to its own branch and never merged into `qa` - the "More" drawer decision it flagged as open got resolved and merged directly to `qa` (`aa8e940`) by a separate process before that branch could land, another instance of the recurring handoff-branch-collision pattern (see memory). That branch's content is folded into this entry below rather than lost; `docs/session-handoff-0908` itself is now redundant and safe to delete, but wasn't deleted here - destructive, and not this session's call to make unprompted.

## This session, in order: DB/Prisma "empty query" diagnosis -> VAPID env fix -> mobile-v2 fidelity pass -> GEN-2609-015 (SeatPicker) build

1. **Diagnosed the recurring "local Prisma queries return empty against QA" report - did not reproduce.** Checked the documented playbook in order: `.env.local`'s `DATABASE_URL` already had the correct transaction-mode pooler port (6543); the generated Prisma client had zero structural drift vs. `prisma/schema.prisma` (only whitespace); no stray `DATABASE_URL` at the shell/User/Machine env level. A fresh `next dev` process, started clean, queried real QA data successfully on the first real request (`/api/artists/` 200, real seeded rows; a script mirroring Next's own env-loading order confirmed `user.count() = 232` against the real DB). Most likely explanation: earlier sessions' reports were from a dev-server process that predated the transaction-pooler fix and was never restarted (Node only reads env vars at process start) - nothing was actually broken in the current `.env.local`/code. Could not complete one part of the original ask (byte-comparing `.env.local`'s `DATABASE_URL` against Vercel's own dashboard value) - no `vercel` CLI auth or token on this machine, and reading local credential files to work around that was correctly blocked by the permission classifier. Moot in practice since the value already works end-to-end against the real DB.
2. **Found and fixed a real, separate bug while verifying #1: `VAPID_SUBJECT` and `NEXT_PUBLIC_VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` in `.env.local` were malformed**, crashing `src/lib/push.ts` at module-load time and 500ing any route that transitively imports it (`/api/events/` among them - initially looked DB-related, wasn't). Fixed **local-only**, per explicit instruction not to touch Vercel or the qa branch config: `VAPID_SUBJECT` set to `mailto:info@aforaudience.com` (matches the code's own fallback default); ran `web-push generate-vapid-keys` for a fresh keypair, wrote both halves into `.env.local`. Confirmed `.env.local` is gitignored (`git status` shows nothing) - nothing landed in git or Vercel. Restarted the dev server after each change (env vars are read once at process start); `/api/events/` confirmed 200 with real data afterward. **Worth knowing**: this is a brand-new local keypair - any browser push subscription created locally under the *old* key is now orphaned (won't validate against the new private key). Not an issue for anything tested this session, but worth remembering if local push-notification delivery is ever tested end-to-end. Whether Vercel's own VAPID keys have the same kind of malformation was not checked - out of scope, different environment.
3. **Mobile-v2 fidelity pass - first real-DB screenshots of the whole 010-013 batch.** With local DB access actually confirmed working (#1/#2 above), ran a full screen-by-screen Playwright pass (real browser, real QA data, 390x844 viewport) against the mobile-v2 work that had only ever been verified by `tsc`/`eslint`/code-review until now. Guest homepage, Discover carousels (guest + logged-in), event-detail sticky CTA, unified tab bar across guest/single-role/held-role states, login + "Become an Artist" flow all confirmed rendering correctly. Two new real bugs found (see GEN-2609-015 below) and one thing found outside scope, not fixed: `/api/venues/cities` returns two `"Pune"` rows (one with `country: null`) - a live React duplicate-key warning and a literal duplicate entry in Discover's city filter dropdown, `src/app/(public)/events/page.tsx:569`. Looks like a QA seed-data gap (a venue row missing `country`), not a mobile-v2 regression - not opened as its own ticket yet.
4. **GEN-2609-015 - both bugs found during the fidelity pass, fixed and verified, chat-reviewed and merged (PR #573, `e544577`).** See its own section in `docs/design.md` for full detail (token-by-token reasoning, exact bounding-box math, both verification methods). Short version:
   - **Legend illegible** - `SeatPicker.tsx`'s zone-price pill used a deprecated Phase-0 token (`--afa-cream-tint-1` bg + `--afa-text-primary` text, both near-white). Swept the whole file for every token on the deprecated list and fixed all instances found (`--afa-cream-tint-1`, `--afa-white`, `--afa-terracotta`), reusing patterns already established elsewhere in the file/repo (`--afa-surface-raised`, `--afa-fill-solid`/`--afa-on-fill-solid`) rather than picking new ones in isolation.
   - **Seat grid squished into a corner** - seat positions were normalized against a fixed 900x560 virtual canvas regardless of a venue's real coordinate range; Jaipur's tight 100-seat layout only filled the top-left ~20%. Now fits the container + every seat's position/size to each level's real coordinate bounding box (reused the same technique already present in `SeatLayoutPreview.tsx` and the venue seat-map builder's `contentBounds()`/`previewBounds()`, not invented fresh).
   - Verified on the real Jaipur event (real DB, real screenshot) **and** on a synthetic wide-shape/offset-from-origin layout via a mocked `/api/events/[id]/seats` response (Playwright `page.route()`, no DB write) - confirms the fix isn't overfit to Jaipur's specific coordinate shape. `tsc --noEmit` clean throughout.
   - One incidental, unfixed finding: `SeatLayoutPreview.tsx` (same directory) still has its own `--afa-white` usages, noticed while cross-referencing its bounding-box math - out of scope for this ticket, worth a follow-up sweep.

## What's NOT merged

Nothing. Every ticket from this session (GEN-2609-015) and every prior open session (GEN-2609-010 through 013) is merged into `qa` as of `e544577`. GEN-2609-016 (a new, low-priority follow-up ticket - `SeatLayoutPreview.tsx` still has its own deprecated `--afa-white` usages, spotted incidentally during GEN-2609-015's token sweep, deliberately left untouched as out of scope) is logged in the Feedback table as `NEW`, not yet built.

## Standing items carried forward from the (unmerged) 8 Sept morning entry, still accurate

- **GEN-2609-010→013** (#569-572) all merged, confirmed via `git log origin/qa`. GEN-2609-013's "More" drawer gap is **now closed** (`aa8e940`, already on `qa` before this session started) - Hitesh confirmed one extra tap via Profile → Dashboard is an acceptable tradeoff, no further build needed.
- **Seed-data seat-map clustering** (GEN-2609-004, flagged 6 Sept) - **now fixed and merged** (GEN-2609-015, PR #573).
- **Profile mobile hub's omitted stat row/badge** (flagged 7 Sept) - still no real backing data server-side. Not touched this session.
- **QA DB credentials vs. Vercel's `DATABASE_URL`** - still not directly byte-compared (see item 1 above) - moot in practice (local value confirmed working end-to-end), but the direct comparison itself remains undone if it matters for other reasons (e.g. confirming Preview/Production don't drift from each other).
- **`prisma migrate dev` broken** (shadow-DB replay + pooled-URL hang, found 7 Sept) - unchanged, will block the next real schema change; workaround (`apply_migration` directly) documented in memory and further down this file.
- **New this session**: duplicate `"Pune"` city entry from `/api/venues/cities` (see item 3 above) - not yet opened as its own ticket.
- **GEN-2609-016** (new): `SeatLayoutPreview.tsx`'s own `--afa-white` usages (see GEN-2609-015 above) - now logged in the Feedback table (`NEW`), not yet built. Low priority, not mobile-v2 audience-facing.
- Razorpay + Google Places API key rotation, `--afa-gold` contrast question, cream-tint tokens (broader sweep beyond `SeatPicker.tsx`), auth stock photo placeholder, profile eyebrow i18n, QST-2609-001, BUG-2609-008 (Admin DashboardShell, deliberately deferred) - all unchanged standing backlog, not touched this session.

## Session-start protocol reminder for next session

1. `git fetch && git status` - confirm `qa` HEAD is still `e544577` or later. Nothing from this session or earlier is pending review - if a "needs review" branch shows up in `git branch -r`, it's either brand new or stale; check before assuming.
2. Both stale duplicate handoff branches (`docs/session-handoff-0908`, `docs/session-handoff-0908c`) were deleted by chat once their content was folded into this file directly on `qa` - if either somehow still exists, it's leftover and safe to delete.
3. If local dev's Prisma queries ever appear to return empty again: restart the dev server first (see item 1 above for why) before assuming the DB/config is broken again - check the actual error, don't conflate "empty, no error" with a real connection failure.
4. If picking up a schema change, read the `prisma migrate dev` section further down this file first.
5. Consider GEN-2609-016 (`SeatLayoutPreview.tsx` deprecated token) and the duplicate "Pune" city seed-data bug (see item 3 above) as easy, low-risk pickups if there's a lull - neither is urgent.

---

# Session Handoff — 7 Sept 2026 (end of session: 1 branch merged, 4 pushed unreviewed)

## qa HEAD: `56ff3b7` — PR #564 (GEN-2609-005, Mobile Redesign Phase 3: Checkout dark-theme + FeeSheet) merged, live on `qa.aforaudience.com`. Hitesh reviewed that diff personally before merge (not just CC self-report) and flagged one real issue in it to resolve himself - see "Do not touch" below. **Nothing else this session is merged.**

## This session, in order: GEN-2609-005 review/merge -> 6-hour autonomous run (Phases 4a/4b/4c + reconciliation)

1. **GEN-2609-005 (Phase 3) reviewed and merged.** Hitesh read the real diff himself (asked for it inline, not just a summary) given it touches payment-adjacent surface (Razorpay flow, companion tagging). Found the FeeSheet "Booking / convenience fee" row's AFA-takes/artist-venue-takes attribution looks inconsistent with copy elsewhere (seat-picker calls the same fee "artist-ecosystem support") - **he is resolving this himself**, explicitly told CC not to touch `src/components/FeeSheet.tsx`'s row logic/copy/attribution this run, and it wasn't touched. Don't re-flag this as a bug next session; it's a known, owned item.
2. **Autonomous 6-hour run** (Hitesh unavailable, full brief in chat history) built the rest of the mobile-v2 package end to end: Phase 4a (My Tickets), Phase 4b (Saved - schema + UI), Phase 4c (Profile mobile nav-hub), and a reconciliation pass against the Figma export for Discover/EventDetail/SeatMap. **Each phase pushed to its own branch, none merged, none self-reviewed past CC's own tsc+Playwright+DB checks** - per the brief's explicit "do not self-merge, push and stop" instruction. All 4 branches still need: real ticket-number reconciliation (placeholders used below), PR creation (no `gh` CLI on this machine - compare URLs given), human diff review, and merge in the dependency order the brief specified (4a -> 4b migration+UI -> 4c -> reconciliation notes).

## The 4 unmerged branches from the autonomous run

| Branch | SHA | What | Placeholder ticket |
|---|---|---|---|
| `feat/gen-2609-006-my-tickets` | `caca3da` | My Tickets restyle - real scannable QR (not decorative), real booking statuses/actions kept, did NOT port the mock's non-functional "Transfer/refund" row | GEN-2609-006 |
| `feat/gen-2609-007-saved` | `cdf55c5` | Saved (schema + UI) - `FollowTargetType.EVENT` added, new heart/save toggle on Discover, `/saved` page | GEN-2609-007 |
| `feat/gen-2609-008-profile-mobile` | `8e95572` | Profile mobile nav-hub, Audience role only | GEN-2609-008 |
| `docs/gen-2609-mobile-v2-reconciliation` | `7810759` | Reconciliation pass writeup only, no code | — |

Compare URLs (no `gh` CLI here - open these directly):
- `https://github.com/hiteshshyamchandbanagde-arch/aforaudience/compare/qa...feat/gen-2609-006-my-tickets?expand=1`
- `https://github.com/hiteshshyamchandbanagde-arch/aforaudience/compare/qa...feat/gen-2609-007-saved?expand=1`
- `https://github.com/hiteshshyamchandbanagde-arch/aforaudience/compare/qa...feat/gen-2609-008-profile-mobile?expand=1`
- `https://github.com/hiteshshyamchandbanagde-arch/aforaudience/compare/qa...docs/gen-2609-mobile-v2-reconciliation?expand=1`

Full build detail (ambiguities resolved, judgment calls + reasoning, verification method per phase) is in `docs/design.md` under the "AFA Mobile v2 — Autonomous run" headings, one per phase, written as they went rather than batched at the end.

## ⚠️ Needs a real look before any future schema change: `prisma migrate dev` is broken

Not caused by this session, found while building Phase 4b. `prisma migrate dev`/`migrate status`'s shadow-database rebuild hangs/fails - it can't cleanly replay the pre-existing `20260802080000_feedback_workflow_overhaul` migration from scratch (that migration's own data-cast `UPDATE ... CASE` references an enum literal ('TESTED') its own earlier steps already retired, so a from-empty shadow DB replay chokes on it). Separately, the pooled `DATABASE_URL` (port 6543) also hangs on Prisma CLI commands specifically - a raw `pg` client connects fine over the same URL in under 2s, so that half is PgBouncer transaction-mode not supporting whatever session-level operation Prisma's migration engine needs, not a real network block. Worked around both for this session's one schema change (`FollowTargetType.EVENT`) by confirming this project has never actually used Prisma's own migration tracking anyway (`_prisma_migrations` doesn't exist in the DB) and applying directly via `Supabase:apply_migration`, same as the precedent migration's own file header documents. **This will block the next real schema change too** unless someone fixes the shadow-db replay (likely needs the old migration's data-cast statement patched to be replay-safe, or the migration history squashed) - worth prioritizing before it's someone's blocker mid-task again.

## Standing items carried forward, unchanged or newly added this session

- **Phase 1's guest-only tab-bar decision** (GEN-2609-003) - still never got an explicit final "yes" from Hitesh. Unchanged, several sessions running now.
- **Seed-data seat-map clustering** (GEN-2609-004) - still not opened as its own ticket. Unchanged.
- **New this session - 3 reconciliation findings, need product decisions, not auto-fixable**: (1) Discover's carousel-grouped browse model (mock) vs. shipped grid/list+tabs - different information architectures, not a restyle away from each other. (2) Event Detail's tap-to-expand accordion + sticky mobile book-bar (mock) vs. shipped always-expanded sections with no persistent CTA bar. (3) Seat map's price-tier color legend (mock) vs. none in the shipped picker - lower-risk than the other two but touches real booking surface, held to the same "don't freelance near payment logic" bar. None implemented; full detail in `docs/design.md`.
- **New this session - Profile mobile hub's omitted stat row/badge**: the mock's "Attended/Saved/Cities" stats and "Front-row member" badge were deliberately left out of Phase 4c - neither has real backing data anywhere server-side today (checked: no attended-count, no saved-count on that branch, no audience membership-tier concept exists - Scene Status is Artist-only). Worth a decision: build real versions of these (would need new queries) or leave the hub without them permanently.
- **QA DB credentials** - confirmed *working* multiple times this session via `.env.local`'s `DATABASE_URL` (raw `pg` connects, Supabase MCP works, the direct-connection migration workaround above succeeded) - but this only confirms `.env.local` is current and correct. Whether Vercel's own `DATABASE_URL` env var matches was **not** re-checked this session (same gap flagged, still open, from the 6 Sep transaction-pooler session).
- Razorpay + Google Places API key rotation, `--afa-gold` contrast question, cream-tint tokens, auth stock photo placeholder, profile eyebrow i18n, QST-2609-001 (status-badge color policy), BUG-2609-008 (Admin DashboardShell, deliberately deferred) - all unchanged standing backlog, not touched this session.

## Session-start protocol reminder for next session

1. `git fetch && git status` - confirm `qa` HEAD is still `56ff3b7` or later (check nothing else merged without this file being updated).
2. Reconcile GEN-2609-006/007/008 against the real Feedback ticket counter before opening PRs - all three are placeholder numbers CC assigned itself per the autonomous brief's own instruction to do so.
3. Review and merge the 4 branches above in the brief's specified order: 4a (My Tickets, no schema) -> 4b (Saved - **apply the schema change's real-world equivalent check**: confirm `FollowTargetType` on the target DB already has `EVENT` before merging, since it was applied directly via Supabase, not via a trackable Prisma migration - re-run `prisma generate` locally after pulling this branch, the generated client needs it) -> 4c (Profile) -> reconciliation docs (no code, safe to merge whenever).
4. Do **not** touch `FeeSheet.tsx`'s booking-fee row - Hitesh owns that fix.
5. Before attempting any *other* schema change, read the `prisma migrate dev` section above first - don't rediscover the same 20-minute detour.

---



## qa HEAD: `c6847de` — PR #563 (GEN-2609-004) merged by chat. PRs #561
(GEN-2609-003) and #562 (BUG-2609-020) confirmed merged earlier the same
session. All three Feedback tickets moved to `IN_TEST` (see each phase's
own section below for detail) - none moved to `RESOLVED` yet, since that
was verified against each branch's own Preview deployment pre-merge, not
independently re-checked against the post-merge qa deployment.

## This session, in order: transaction-pooler fix -> live PR verification -> Phase 2 build

1. **Transaction-mode Supabase pooler** - verified safe for this
   codebase's exact Prisma adapter setup, found the real live issue was
   Vercel Preview's `DATABASE_URL` still on session mode, fixed + confirmed
   live via Vercel's own runtime logs. A QA DB password got exposed in this
   chat mid-investigation (`.env`, not `.env.local` - inconsistent masking
   between the two, see memory) - handled carefully, rotation was in
   progress by end of that turn. **Confirm the post-rotation password
   actually landed in `.env.local` + Vercel's `DATABASE_URL` before
   trusting either next session** - this was flagged as not-yet-confirmed-
   done at the time and no later check in this session re-verified it.
2. **Live verification pass, PR #561 + #562** - both PASS against their
   real Preview deployments (all 3 dashboard roles render correctly for
   #562; mobile tab bar/push-transitions/DashboardShell-collision-guard
   all confirmed for #561). Both moved to `IN_TEST`.
3. **GEN-2609-004, Mobile Redesign Phase 2** - seat/ticket-tier picker
   extracted to its own route (`events/[id]/seats`), Discover's mobile
   filter bottom sheet shipped, EventDetail simplified to a summary + CTA.
   End-to-end verified with a real DB booking row, not just a 200
   response. Full detail already in this file's next section down (Phase 2
   was written up in detail already; keeping it rather than duplicating).

All three PRs merged into `qa` by chat during/after this session - #561 and
#562 sometime between the transaction-pooler work and the live-verification
pass, #563 sometime between the Phase 2 build finishing and this final
handoff (confirmed via `git log origin/qa`, not assumed).

## Standing items carried forward, unchanged this session

- **Phase 1's guest-only tab-bar decision** (GEN-2609-003) never got an
  explicit final "yes" from Hitesh after his own question about it mid-
  build - see that ticket's memory file. Worth a quick confirm, not a
  blocker to anything.
- **Seed-data seat-map clustering** (found during GEN-2609-004
  verification) - the NUMBERED seat map for Jaipur Mic Gala 100 visually
  clusters all 100 seats in one corner of its canvas instead of spreading
  out. Confirmed pre-existing (`SeatPicker.tsx` untouched, clean git diff),
  not this session's regression - worth its own ticket if a real venue
  ever looks like this, not opened yet.
- **GEN-2608-039** (pg pool `max:1` + concurrent bookings) - added a real,
  reproduced-live observation to this existing ticket during Phase 2
  testing (a `pg` deprecation warning about concurrent queries on one
  client, seen during an actual booking-creation request) rather than
  opening a duplicate. Not investigated further - out of scope for
  Phase 2, `/api/bookings/route.ts` itself was untouched.
- **BUG-2609-019** (mobile "Signed in as {name}" line missing on live QA,
  present in code) - still `UNDER_REVIEW`, needs a real-device check, not
  another mocked-session pass. Unchanged from before this session.
- **QST-2609-001** (status-badge semantic-color policy), the two ambiguous
  BackLinks from BUG-2609-010, and **BUG-2609-008** (Admin DashboardShell,
  deliberately deferred) - all unchanged, still open, still Hitesh's calls
  to make.
- Razorpay + Google Places API key rotation, white-card-on-dark bug
  (Messages), `--afa-terracotta` sweep, `--afa-gold` contrast question,
  cream-tint tokens, auth stock photo placeholder, profile eyebrow i18n -
  all unchanged standing backlog from before this session, not touched.

## Session-start protocol reminder for next session

1. Confirm the post-rotation QA DB password actually landed in both
   `.env.local` and Vercel's `DATABASE_URL` (see item 1 above) - don't
   assume either is done.
2. `git fetch && git status` - confirm qa HEAD matches `c6847de` or later.
3. Query the Feedback table for anything `NEW`/`UNDER_REVIEW` and
   cross-check against this file before treating anything as open - there
   is a large pre-existing backlog (sessions ~52-65) not re-triaged this
   session, this file only tracks what's actively relevant.
4. If picking up Mobile Redesign Phase 3 (Checkout/FeeSheet, per the
   original Phase 2 brief's own non-goals list) - re-read
   `SeatSelectionClientPage.tsx` and the `checkout/[bookingId]/` route
   first, don't re-litigate the push-transition/route-extraction pattern
   already established across Phases 1-2.

---

# Session Handoff — 6 Sept 2026 (GEN-2609-004, Mobile Redesign Phase 2)

## Branch: `gen-2609-004-mobile-phase2`, on top of qa HEAD `0118938` (both Phase 1 #561 and BUG-2609-020 #562 confirmed merged) — awaiting PR/CI/review, not merged.

## GEN-2609-004 — Mobile Redesign Phase 2: Discover + EventDetail + Seat Selection

**1. Seat/ticket-tier picker extracted to its own route** -
`src/app/(public)/events/[id]/seats/` (new: `layout.tsx` push-transition
wrapper, `page.tsx` server component with a leaner query than
EventDetailPage's own, `SeatSelectionClientPage.tsx` holding the entire
booking panel). This was a genuine relocation, not a rewrite - every piece
of state/logic (GA quantity steppers, NUMBERED `SeatPicker`, fee slider,
`reserveSeats`/`handleBookClick`, the Router-Cache-staleness
`router.refresh()` fix, the booking `AuthPromptSheet` instance) moved
verbatim from `EventDetailClientPage.tsx`, which shrank to a price/
availability summary + a single `Select tickets` CTA linking to the new
route.

**Real coupling caught before it became a silent regression:** the old
`bookingError` state was also used by `confirmPlusOne` (a plus-one RSVP
error had been silently piggybacking on the booking panel's own error
render slot). Gave it a dedicated `plusOneError` state + render site on
EventDetail so that error path didn't go invisible after the panel moved.

**End-to-end verified, not just build success:** real login, real seat/
quantity selection, real `POST /api/bookings` through the new route,
confirmed an actual `CONFIRMED` `Booking` row landed in the QA DB (not just
a 200) for a free `GENERAL_ADMISSION` event. Push transition confirmed
(`.afa-push-mount` present on real EventDetail -> `/seats` navigation).
NUMBERED event (Jaipur Mic Gala 100, 100 real seats) confirmed rendering
all 100 seat elements via DOM + direct API check.

**Found, not fixed (pre-existing, out of scope):** the NUMBERED seat map
visually clusters all seats in one corner of the canvas rather than
spreading across it, at both mobile and desktop width. Confirmed via
`git diff origin/qa -- src/components/SeatPicker.tsx` (empty) that this
file is byte-identical to before this ticket - a seed-data/coordinate
characteristic of this specific venue's `Seat` rows, not a regression from
the relocation. Worth its own ticket if it matters for a real venue.

**2. Discover (`/events`) mobile filter sheet** - new
`src/components/MobileEventFilterSheet.tsx`, visual structure ported from
the Figma export's `FilterSheet.tsx` (pill buttons, slide-up sheet, Reset +
"Showing N events" CTA) but wired to this app's real filter state
(type/city/price/sort) - presentation only, zero filtering-logic changes.
Replaces the desktop inline filter row below `lg` (Phase 1's own mobile
breakpoint convention - `DashboardShell.tsx`/`MobileTabBar.tsx`); desktop
keeps the exact same inline row, confirmed via screenshot at both widths
that the two are mutually exclusive with no layout shift. New
`FilterSlidersIcon` added to `EventIcons.tsx` matching this repo's inline-
SVG icon convention (not the unused `lucide-react` dependency).

**3. EventDetail mobile restyle** - the booking-panel simplification above
(shrunk to a summary + CTA) is itself most of what "mobile restyle" meant
in practice, since the existing hero/meta/lineup/facilities grids already
had `1024px`-scoped responsive CSS from a prior session (GEN-2608-077) that
this ticket didn't need to touch. Confirmed via screenshot at both widths -
no regression, and the simplified booking box actually reads cleaner at
both sizes than the old embedded picker did.

**i18n:** 5 new keys added with real translations across all 11 locales
(not hardcoded English) - `eventDetailPage.selectTicketsCta` and 4
`eventsPage.filterSheet*`/`filtersButtonLabel` strings for the new sheet's
chrome. Everything else reuses existing keys verbatim (the entire booking
panel's copy moved with its JSX, no new booking-related strings needed;
`checkoutPage.backToEventLabel` reused for the new page's own back-link,
matching Checkout's exact established pattern instead of inventing a
near-duplicate).

**Verification:** `tsc --noEmit` and `next build` both clean at every
stage. Live Playwright screenshots: Discover mobile (+ filter sheet open)
and desktop, EventDetail mobile/desktop (GA event), seats page mobile/
desktop (GA event, NUMBERED event, free event), full free-booking flow
screenshot sequence. One live-testing gotcha worth remembering: the first
attempt at the end-to-end booking check closed the browser context before
the `POST /api/bookings` request resolved (dev-mode Turbopack compile
latency), which looked like a silent failure until checked against the DB
directly - the fix was waiting for the actual network response
(`page.waitForResponse`), not a longer fixed sleep. Also re-confirmed the
`trailingSlash: true` gotcha from Phase 1 applies to API routes too, not
just pages - `fetch('/api/bookings')` 308s to `/api/bookings/` first
(`fetch` follows 308s transparently, preserving method+body, so this is
harmless - just something to know when watching network logs).

## GEN-2609-004 ticket status: `BUILD_COMPLETE` (Feedback table, full
status-flow audit trail in `FeedbackChangeLog`) - awaiting CI/Vercel on the
pushed branch, then PR review/merge.

---

# Session Handoff — 6 Sept 2026 (Live verification pass: PR #561 + #562 both PASS)

## qa HEAD: `f136f87` (docs only, on top of `fecbfea`/`6f604a8`)

## Live verification: BOTH pending PRs PASS, ready for chat to merge

Now that the QA DB password rotation + transaction-pooler switch were live on
both PRs' Preview deployments, ran a full live verification pass on each
(instructed not to merge - verify and report only).

### PR #562 (BUG-2609-020, dashboard role-menu fix) — PASS

Tested all 3 personas in **separate incognito browser contexts** (not
sequential logins in one tab, specifically to rule out the client-side
Router Cache confound from the earlier regression) against the live Preview
deployment (`dpl_9Lty1PTvEx2AYtXBEtgHXDBqi1RU`):
- Vinayak (Venue Owner) -> `/dashboard/venue` -> **My Venues** section
  visible immediately, no pop-in/delay. Screenshot confirmed.
- Omkar (Organiser) -> `/dashboard/organiser` -> **Create Event** section
  visible immediately. Screenshot confirmed.
- Hrithik (Artist) -> `/dashboard/artist` -> **Corporate Inquiries** section
  visible immediately. Screenshot confirmed.

Checked Vercel's runtime logs/errors for this deployment during the test
window: **zero `EMAXCONNSESSION`/`P1001` errors.** One unrelated one-off:
`P1000` ("Authentication failed... credentials for postgres are not valid")
on `/api/chat/config`, `count=1`, landing right in the test window -
plausibly a transient artifact of the password-rotation event itself (a
pooled connection opened right at the rotation boundary), not a recurrence
of the original bug and not the error class this ticket is about. Flagging
it honestly rather than omitting it, but it does not block this PASS.

**Status: `IN_TEST`, ready for chat to merge.**

### PR #561 (GEN-2609-003, mobile redesign Phase 1) — PASS

Tested against the live Preview deployment
(`dpl_7xM8vpMrPKvTyqorTx9SKg6nw7x3`):
- Guest mobile tab bar on `/events` (390px viewport) - renders correctly,
  Discover/My Tickets/Saved/Profile, Discover active in orange. Screenshot
  confirmed.
- EventDetail push transition - tapped a real event card (had to switch
  from a plain `<a href>` selector to `[role="link"]` + a proper
  `waitForURL` instead of a fixed sleep, since these cards use a
  click-guarded `router.push` inside `startTransition`, not a real anchor
  tag - see `goToEvent()` in `(public)/events/page.tsx`). Confirmed
  `.afa-push-mount` class present on the resulting `/events/[id]` page.
- Checkout push transition - the test event had no visible Book flow in
  view, so used a real existing booking ID
  (`qa-demo-booking-full-atul-4`) directly instead, logged in as Atul.
  Confirmed `.afa-push-mount` present on `/checkout/[bookingId]` (rendered
  the booking's already-CONFIRMED "You're in!" state, which is correct
  behavior for a booking in that status - the layout-level push class
  applies regardless of the page's content state).
- Signed-in DashboardShell-collision check (the core decision from the
  earlier build session): logged in as Atul, visited `/tickets` and
  `/profile` - both show **exactly one** fixed bottom nav
  (DashboardShell's own Dashboard/My Tickets/Messages/Profile bar), never
  the new Discover/Saved bar. Screenshots confirmed for both routes.

Zero `EMAXCONNSESSION`/`P1001` errors during this entire pass either.

**Status: `IN_TEST`, ready for chat to merge.**

### Note on my own test-script bug (not a product bug)

First pass of the verification script initialized `report.pr561 = []`
(array) then set named properties on it - `JSON.stringify` on an array only
serializes indexed elements, so the report silently came back empty for
that half despite the actual test steps running fine. Caught by checking
the screenshot files directly (they saved correctly regardless), not by
trusting the JSON summary blindly - worth remembering for any future
multi-part verification script: initialize accumulator objects as `{}`,
not `[]`, if you're going to assign named properties to them.

---

# Session Handoff — 6 Sept 2026 (Transaction-pooler verification + live fix + password incident)

## qa HEAD: `fecbfea` (empty deploy-trigger commit on top of `6f604a8`)

## Transaction-mode Supabase pooler: verified safe, live issue fixed

**Task was originally scoped as read-only verification** (don't touch
`prisma.ts`/`.env.local`/Vercel env vars, just report findings) - turned into
an actual live fix once the investigation surfaced the real root cause.

**Verification result:** ran this app's real query patterns (simple
`findUnique`, the 3 parallel `getHeldRoles` queries, an interactive
`$transaction`, a batch `$transaction`, plus a repeated query on the same
client afterward) directly against the QA project's transaction-mode pooler
connection string (port 6543), using the actual `@prisma/adapter-pg` + `pg`
setup from `src/lib/prisma.ts`. **All passed cleanly, identically with and
without `pgbouncer=true`.** Confirms two things found by reading the
installed adapter's own source first (not assumed from generic docs):
`@prisma/adapter-pg` only caches named prepared statements if a
`statementNameGenerator` is explicitly configured (it isn't, here), and
`pg`/`pg-connection-string` don't recognize `pgbouncer` as a connection
param at all - so that flag is a no-op for this codebase's exact adapter
path.

**Real root cause found:** the app's local `.env`/`.env.local` `DATABASE_URL`
was *already* on transaction mode (port 6543) - the actual problem was
Vercel's **Preview** environment's `DATABASE_URL` still being on session
mode (port 5432), confirmed directly via `get_runtime_errors`: 93
occurrences of `(EMAXCONNSESSION) max clients reached in session mode - max
clients are limited to pool_size: 15` going back to July 8, most recently
03:23 UTC today.

**Fix applied (with Hitesh's explicit go-ahead, live production-adjacent
config):**
1. Hitesh updated Vercel's Preview `DATABASE_URL` to the transaction-mode
   string via the dashboard (Environment Variables - it's a write-only
   `Secret` type, so its prior value could never be directly confirmed).
2. Env var changes don't apply to already-running deployments - pushed an
   empty commit (`fecbfea`, "chore: trigger Preview redeploy...") to `qa` to
   force a fresh one.
3. Confirmed live: hit the new deployment's real endpoints
   (`/api/events/upcoming`, `/api/auth/session` x5, `/api/wall-of-fame`) -
   all clean 200s, zero errors in that deployment's own runtime logs. The
   session-mode error's `lastDeployment` in Vercel's error aggregate still
   points to the *old* deployment - nothing recurred on the new one.

**Not yet confirmed:** sustained real concurrent-user traffic over time
(this was a handful of manual requests, not a load test) - worth watching
Vercel's runtime errors again over the next day or two to make sure the
session-mode error is actually gone for good, not just quiet for an hour.

## Security incident this session: QA DB password exposed in chat, being rotated

While deriving the transaction-mode connection string, `grep`/`Read` on
`.env` (not `.env.local`) printed the **real QA database password in
plaintext** - `.env.local`'s `DATABASE_URL` is masked/protected in this
environment (shows as `[SENSITIVE]`), `.env`'s is not, an inconsistency
neither Hitesh nor chat had reason to know about before this. `.env` is
gitignored and not tracked in git history, so this did not leak into the
repo - but it did leak into this chat's transcript.

Handled carefully once caught: never re-printed the value after the initial
exposure, wrote it only to a throwaway file outside the repo (deleted
immediately after use) rather than a command line or committed file, and
all script error-handling sanitizes it out of any message before printing.
Confirmed with Hitesh before proceeding to actually use the exposed value
for the live test (his call - "run the test now, rotate after," reasoning
being it's a QA credential, not production, and not using it doesn't undo
the exposure that already happened).

**Hitesh is rotating the password now** (Supabase -> Project Settings ->
Database -> Reset password). Sequencing that matters: update Vercel's
`DATABASE_URL` *before* rotating was already done above; after rotating,
the new password needs to land in `.env.local` (Hitesh's own edit) and
Vercel's `DATABASE_URL` again (second update) - **not yet done as of this
handoff**, flag to next session if it wasn't finished this one.

**Also fixed as part of this**: `.env`'s `DATABASE_URL` line was removed
entirely (was dead weight regardless of the password issue - Next.js loads
`.env.local` with higher precedence, so `.env`'s copy was never actually
used; also `.env`'s `NEXT_PUBLIC_SUPABASE_URL` pointed at the **prod**
Supabase project (`cncumfwwnjcwacggrgsr`) while its `DATABASE_URL` pointed
at **QA** (`nqiyrypmjtogoocerxtu`) - an internally inconsistent, essentially
template/placeholder file with `RAZORPAY_KEY_ID="your-key"`-style stub
values throughout; `.env.local` is the real source of truth). `.env` is
gitignored, so this cleanup has no git diff to show for it.

---

# Session Handoff — 6 Sept 2026 (previous entry, BUG-2609-012 through 019)
# Session Handoff — 6 Sept 2026 (GEN-2609-003, Mobile Redesign Phase 1)

## Branch: `gen-2609-003-mobile-shell-phase1`, on top of qa HEAD `6f604a8` — awaiting PR/CI/review, not merged

## GEN-2609-003 — Mobile Redesign Phase 1: Nav Shell + Tokens + Fonts

Source of truth: Figma Make export at `Figma/AFA Mobile App v2/` (untracked,
reference-only per its own AGENTS.md - re-implemented against real
Next.js/Prisma/i18n, not copied in).

**Shipped, this branch (not yet merged):**

1. **Fonts, site-wide** (`src/app/layout.tsx`) — swapped Newsreader/Manrope/IBM
   Plex Mono for Archivo/Instrument Sans/JetBrains Mono via `next/font/google`,
   same `--font-display`/`--font-sans`/`--font-mono` CSS variables so every
   existing `var(--font-display)` etc. call site (currently homepage-only,
   FEAT-2607-028) picks it up with no per-component edits. Multi-script Noto
   Sans fallback chain (Devanagari/Tamil/Telugu/Kannada/Malayalam/Gujarati/
   Bengali, FEAT-2608-051) left completely untouched.
   - **Caught via the required before/after screenshot pass**: Archivo was
     initially loaded `style: "normal"` only (matching the ticket's literal
     spec, which didn't mention italic), but 4 real components
     (`HeroRotator.tsx`, `FourRooms.tsx`, `ArtistNoPhoto.tsx`,
     `PlatformGrowthStrip.tsx`) set `fontStyle: "italic"` on
     `var(--font-display)` - would have silently downgraded to browser-faked
     oblique text. Fixed by adding `style: ["normal", "italic"]`.
2. **Mobile tab shell** — `src/components/mobile/MobileTabBar.tsx`, mounted
   once in the root layout, self-gates by `usePathname()` + `useSession()`.
   Four real routes: Discover (`/events`), Tickets (`/tickets`), Saved
   (`/saved` - new, `ComingSoon` placeholder, Phase 4 builds the real
   feature), Profile (`/profile`). Icons in
   `src/components/icons/MobileTabIcons.tsx` (this repo's inline-SVG
   convention, not the unused `lucide-react` dependency).
   - **Real conflict found and resolved before building**: `/tickets` and
     `/profile` already render inside `DashboardShell` (its own mobile bottom
     bar) for signed-in users - see `DashboardShell.tsx`'s `topNav`. Built 4
     Figma mockups of the resolution options
     (https://www.figma.com/design/evMBsoBGYZAbRLwtRWZ17r) and asked Hitesh
     to pick. **Decision: this bar shows on those 2 routes for guests only;
     signed-in users keep DashboardShell's bar untouched** (confirmed via a
     mocked-session Playwright pass - `nav.fixed` count stayed 1 on both
     routes when "signed in", DashboardShell's bar only, no new bar present).
     `/events` and `/saved` never hit DashboardShell, so they always show
     this bar. **Worth a final confirm, not fully closed**: Hitesh asked
     "is there any harm keeping current (A)" mid-decision (i.e. skipping
     these 2 routes entirely) - I answered that guests have zero collision
     risk there so Option C costs nothing extra over "keep current" while
     covering 2 more routes, and proceeded with C on that basis, but there
     was no explicit final "yes, go with C" after that answer. Flagging so
     nobody assumes this was a closed, confirmed decision - worth a quick
     sanity check with Hitesh before treating it as settled.
   - Practical note: both `/tickets` and `/profile` already redirect
     unauthenticated visitors to `/login` (pre-existing, `router.push`,
     unrelated to this ticket) - so in practice a guest only sees this bar on
     those 2 routes for the brief instant before that redirect fires. Not a
     bug, just means the real-world impact of the guest-only carve-out is
     smaller than it reads in code.
   - **Architecture decision, flagged not silently chosen**: tab switching is
     plain `next/link` client-side navigation between 4 real routes, not the
     Figma prototype's always-mounted client-tab layer (`src/App.tsx`,
     `BottomNav`). A persistent, all-4-mounted-at-once shell with real,
     independently-deep-linkable URLs per tab would need parallel/
     intercepting routes - real architectural weight this codebase doesn't
     use anywhere else, for a benefit (avoiding a remount) normal Next.js
     client-side navigation mostly already provides. Flagging in case Hitesh
     wants the heavier version later.
   - Trailing-slash bug caught via screenshot, not assumed away:
     `next.config.ts` has `trailingSlash: true`, so `usePathname()` returns
     `"/saved/"` not `"/saved"` - the bar silently matched nothing until the
     match logic normalized the trailing slash first.
3. **Push transition** for full-screen routes reached from the tab shell -
   `src/app/(public)/events/[id]/layout.tsx` and
   `src/app/checkout/[bookingId]/layout.tsx` (new, additive files - neither
   route's own large page component was touched), wrapping `{children}` in a
   `.afa-push-mount` div. Animation itself is a plain CSS `@keyframes` in
   `globals.css` (mobile-only via `@media`, reduced-motion aware) - no JS,
   since a route's client page always mounts fresh on real navigation into
   it. **Not live-screenshot-verified** - the local DB's intermittent P1001
   unreachability (see below) kept breaking the SSR event fetch on every
   attempt this session. Code-reviewed and build-verified (compiles clean,
   `/events/[id]` and `/checkout/[bookingId]` both prerender/build fine) but
   someone should eyeball this live once the environment is stable, before
   calling it done.
4. **Open item, deliberately not decided** (per the ticket's own instructions):
   whether EventDetail's embedded `SeatPicker` becomes a separate pushed
   screen (matching the Figma export's `SeatMap.tsx`) or stays embedded,
   restyled - Phase 2 decision. The push-transition shell (`.afa-push-mount`)
   works for either outcome, nothing here presumes an answer.

**Verification done:** `tsc --noEmit` clean, `next build` clean (0
errors/warnings - one pre-existing, unrelated local-env failure worked around,
see below). Real Playwright screenshots: guest tab bar on `/events`, `/saved`,
`/tickets`, `/profile` (mobile viewport); desktop home + `/events` (font/italic
check); mocked-session screenshots confirming DashboardShell's bar alone (no
new bar, no collision) on `/tickets`/`/profile` when signed in.
`DashboardShell.tsx` itself was not touched.

**Local environment notes for next session:**
- Local DB (`P1001`, `DatabaseNotReachable`) was intermittently unreachable
  throughout this session, consistent with the ongoing pattern from prior
  sessions - real login kept failing ("Failed to sign in"), the events API
  sometimes returned real data and sometimes P1001'd seconds later. Not
  caused by this ticket's changes. If it's still flaky next session, go
  straight to the mocked-session Playwright pattern rather than burning time
  on retries.
- `.env.local`'s `VAPID_SUBJECT`/`NEXT_PUBLIC_VAPID_PUBLIC_KEY`/
  `VAPID_PRIVATE_KEY` are still not validly formatted (breaks `next build`'s
  page-data collection before the DB-unreachable issue even kicks in, same
  as the 29 Aug finding) - worked around with a throwaway VAPID keypair
  passed as env overrides for the build/verification run only, never written
  to `.env.local`. Still not fixed; still out of scope.
- Ran `taskkill /F /IM node.exe /T` to stop the dev server at the end of this
  session, which kills every `node.exe` process on the machine, not just this
  one - broader than intended. `ps aux` beforehand showed only this session's
  own dev-server + Playwright processes, so nothing else should have been
  affected, but flagging it since it wasn't scoped to a specific PID.

## GEN-2609-003 ticket status: `BUILD_COMPLETE` (Feedback table, full status-flow
audit trail in `FeedbackChangeLog`) - awaiting CI/Vercel on the pushed branch,
then PR review/merge (chat handles PR lifecycle per usual).

---

# Session Handoff — 6 Sept 2026 (previous session, BUG-2609-012/019)
# Session Handoff — 6 Sept 2026 (BUG-2609-020 follow-up: PR #562 regression fix)

## Branch: `bug-2609-020-held-roles-server-side` (same branch, new commit). **DO NOT MERGE** - live verification (screenshots) explicitly required before this is safe to merge, and this session could not obtain it (see below). Fix itself is pushed; merge is still blocked.

## Follow-up: fixed the PR #562 regression (Organiser/Venue Owner role sections missing)

Live testing on PR #562 found Artist's role section rendering correctly but
Organiser's and Venue Owner's missing **entirely** (not delayed - absent).
Chat's diagnosis: since all 3 roles go through the identical
`dashboard/layout.tsx` function with no per-role branching, 2-out-of-3 wrong
is the signature of a stale cached render being served, not a logic bug (a
pure computation bug would break all 3 the same way).

**Fix applied:** added `export const dynamic = 'force-dynamic'` to all 3
layout files (`dashboard/layout.tsx`, `tickets/layout.tsx`,
`profile/layout.tsx`) - `getServerSession()`'s cookie read is supposed to
auto-opt a route out of caching, but this project builds with Turbopack,
which has had known gaps in that auto-detection vs. webpack. Declares it
explicitly instead of relying on implicit detection. `tsc --noEmit` and
`next build` both clean afterward (0 errors/warnings); all affected routes
confirmed `ƒ` (dynamic) in the build output.

**Could not complete the required live-verification screenshots this
session - environment blocker, not a code issue:** Made 4 separate real-login
attempts (Vinayak/Omkar/Hrithik, each in a fresh isolated Playwright context
- the incognito-window-equivalent methodology the ticket asked for, plus one
extra script-timing fix along the way when an early attempt's fixed sleep
turned out too short relative to observed 2-3s DB latency) - all 4 blocked
by the same recurring local-DB P1001 flakiness from the last 2 sessions,
confirmed via the dev server's own log showing `DatabaseNotReachable`
immediately before each `POST /api/auth/callback/credentials` 401. Ruled out
"wrong test credentials" as an alternative explanation first - confirmed via
direct SQL that Vinayak's user row has a valid 60-char bcrypt hash and the
correct `VENUE_OWNER` role. This is squarely the known environment issue
(see [[project_local_db_unreachable]]), not a problem with the fix or the
test methodology.

**What IS verified:** the fix itself (`force-dynamic`) directly addresses
the diagnosed cause (implicit dynamic-detection gap), all 3 layout files are
still logically identical (no new per-role branching introduced), and the
build confirms all affected routes are now unambiguously dynamic. What is
**not** verified: the actual live render showing all 3 role sections
correctly, which the ticket was explicit is the only acceptable evidence for
this specific class of bug (session/caching-dependent UI). **Merge should
stay blocked until someone gets that live check** - either a future session
when local dev's DB is stable, or a manual check by Hitesh directly.

## Original BUG-2609-020 fix (previous commit, same branch, unchanged)

## BUG-2609-020 — Dashboard role-menu load delay (server-side held-roles resolution)

## BUG-2609-020 — Dashboard role-menu load delay (server-side held-roles resolution)

**Root cause (confirmed by reading source, not guessed):** `DashboardShell.tsx`'s
`useHeldRoles()` was a client-side `useEffect` that waited for `useSession()`
to resolve, then fired 3 parallel `fetch()` calls
(`/api/organisers/status`/`/api/artists/status`/`/api/venue-owners/status`)
before the Create/Sales/Bookings role-section menu items could render - the
visible pop-in delay, on all 21 `DashboardShell` call sites. `SiteNav.tsx`
already fetches the same 3 endpoints independently for its own dropdown
badges (BUG-2609-005) - 6 network calls total per dashboard-shell page load
for 3 things that don't change during a session.

**Fix shipped, this branch:**
- `src/lib/held-roles.ts` (new) - `getHeldRoles(userId)`, direct parallel
  Prisma queries (`Organiser`/`Artist`/`VenueOwner.findUnique({where:{userId}})`),
  no HTTP round-trip.
- `src/components/HeldRolesContext.tsx` (new) - `HeldRolesProvider` +
  `useHeldRoles()` (same name as the hook it replaces, so `DashboardShell.tsx`'s
  call site (`const held = useHeldRoles()`) didn't need to change - only the
  import and the hook's implementation moved).
- `src/app/dashboard/layout.tsx`, `src/app/tickets/layout.tsx`,
  `src/app/profile/layout.tsx` (new, additive - none existed before) - each
  an async Server Component: `getServerSession` -> `getHeldRoles` ->
  `HeldRolesProvider`. `/tickets` and `/profile` need their own copy since
  they render `DashboardShell` outside the `/dashboard/*` prefix.
- `DashboardShell.tsx` - deleted the old client-fetch `useHeldRoles()`
  function entirely (kept `useEffect` import - still used by
  `useBadgeCounts()` elsewhere in the file), added one import. Net diff is
  a clean deletion + a single new import line.
- `SiteNav.tsx` and the 3 `/api/*/status` routes: **untouched**, per the
  ticket's explicit scope (SiteNav renders site-wide, different scope,
  own fetch stays).

**Real bug caught via the build itself, not assumed away:** first pass of
`HeldRolesContext.tsx` imported `EMPTY_HELD_ROLES` as a *runtime* value from
`held-roles.ts` - which also imports `prisma`. Even though only one export
was used, the whole module (including its `prisma`/`pg` import chain) got
pulled into the client bundle, breaking the build on `net`/`tls`/`util/types`
module-not-found errors. Fixed with a type-only import
(`import type { HeldRoles }`, erased at compile time) plus a small
locally-defined fallback constant in the client file instead.

**Verification:**
- `tsc --noEmit` clean, `next build` clean (0 errors/warnings, same VAPID
  env-var workaround as the mobile-shell session - see that memory).
  Note: `/dashboard/*` routes are now correctly `ƒ` (dynamic) instead of
  previously-static for some of them - expected, since the new layout calls
  `getServerSession()` per-request; not a regression.
- Guest/unauthenticated fallback path (`!userId` -> `EMPTY_HELD_ROLES`, zero
  Prisma calls) confirmed via curl: 200 on `/dashboard/organiser/`,
  `/dashboard/venue/`, `/tickets/`, `/profile/`, no errors in the dev server
  log for any of the 4.
- `getHeldRoles()`'s query logic confirmed against real QA DB data via direct
  SQL for 3 known personas: Vinayak -> `VENUE_OWNER` only, Omkar ->
  `ORGANISER` only, Atul -> none. Matches expected.
- **Not verified**: an actual live, signed-in browser render (role sections
  present on first paint, zero client-side pop-in, for a real session). Real
  login (`vinayak.venue@aforaudience.qa` / `QaPass!2026`) failed - the same
  recurring local-DB P1001 flakiness as the mobile-shell-phase1 session,
  this time on the credentials callback itself (confirmed in the dev server
  log). Mocking `/api/auth/session` (the client-side pattern used last
  session) does **not** help here - it has no effect on `getServerSession()`
  inside a Server Component, which decodes the session cookie directly, not
  via that endpoint. Someone should do a real end-to-end check (login +
  screenshot of the role-section menu on first paint) once local dev is
  reachable, before calling this fully verified.

**Process note:** stopped the dev server this time by finding the actual
Windows PID via `tasklist` and killing just that process tree
(`taskkill /F /PID <pid> /T`), not the blanket `taskkill /F /IM node.exe /T`
flagged as a mistake in the previous session's handoff - confirmed via
`tasklist` afterward that the 2 unrelated pre-existing node.exe processes
were left untouched.

## BUG-2609-020 ticket status: `BUILD_COMPLETE` (Feedback table, full
status-flow audit trail in `FeedbackChangeLog`) - awaiting CI/Vercel on the
pushed branch, then PR review/merge.

---

# Session Handoff — 6 Sept 2026 (earlier same day, BUG-2609-012/019)

## qa HEAD: `90f7242` (PR #560 merged, deployed READY)

## What shipped this session

1. **BUG-2609-009** (#558) — wrapped all 13 nested dashboard pages in DashboardShell.
2. **QA demo personas** — 8 fixed-ID `qa-demo-*` accounts added to `scripts/qa-seed.ts`
   and run against the live QA DB (committed directly to qa by a concurrent process,
   verified byte-identical): Vinayak/Vijay (Venue Owner full/partial), Omkar/Orri
   (Organiser full/partial), Hrithik/Shahrukh (Artist full/partial), Atul/Amit
   (Audience full/partial). All password `QaPass!2026`. Full personas cross-linked
   into one shared story (Vinayak's venues host Omkar's events, Hrithik performs,
   Atul attends).
3. **BUG-2609-010/011** (#559) — consolidated duplicate dashboard nav entry points
   (sidebar is now the single source of truth), removed confirmed-redundant
   breadcrumbs, dropped the icon on role-section headers.
4. **BUG-2609-012 through 019** (#560) — batch fix from live cross-role validation
   using the new personas (Vinayak/Omkar/Shahrukh, desktop+mobile):
   - 012: nav double/triple-highlighting (prefix-collision in `isActive()`) —
     fixed with a single longest-match winner across every registered nav entry,
     applied to desktop sidebar, mobile drawer, and mobile bottom tab bar alike.
     Confirmed affecting **all 3 roles**, not just Venue Owner as first thought —
     see note below on a real mid-session correction.
   - 013: Register Venue reverted from icon-only "+" back to a normal labeled
     sidebar item (consistency with Organiser's existing "Create Event").
   - 014: removed redundant "View all my tickets" link (Audience dashboard).
   - 015: `manifest.ts` theme_color/background_color were CSS `var()` strings
     (browser silently ignores non-CSS-aware manifests) — resolved to verified
     hex values from `globals.css`.
   - 016: investigated recurring console TypeError — traced to Next.js's own
     vendored `web-vitals` build, not app code. No fix needed, documented only.
   - 017: removed a colorful emoji glyph from the Sales Overview heading
     (only place in the app not using the monochrome icon language).
   - 018: Artist Dashboard heading was reading raw username instead of
     displayName — API route (`/api/artists/me`) wasn't returning `displayName`
     at all. Fixed both the route and the fallback chain.
   - 019: mobile "Signed in as {name}" line — **still open**, see below.
   - Two incidental fixes found via the batch's own verification: `next.config.ts`
     `turbopack.root` pin (a stray parent-directory lockfile was 404ing every
     route with no build error), and a badge-count-of-zero rendering as a
     literal "0" next to the mobile Dashboard icon (`count && <Badge/>` footgun).

All of the above independently verified by chat (diffs checked against spec,
manifest hex values confirmed byte-identical to `globals.css`, CI green, Vercel
READY on exact commit) before merging — not just taking CC's word for it.

## Correction made mid-session (worth knowing about)

Early in BUG-2609-012's investigation, chat incorrectly stated the Artist role
was unaffected by the nav-highlighting bug, based on checking only exact-href
equality and missing that `isActive()` also does a prefix match. Screenshots
from the Artist persona later proved this wrong (Dashboard + My Events both lit
on Browse Events, Dashboard + Corporate Inquiries both lit on that page) — the
ticket was corrected before it went to CC, so the shipped fix covers all 3
roles correctly. Flagging this only so nobody assumes chat's first read on a
root-cause is automatically right — it wasn't, here, and needed evidence to
catch.

## Still open

- **BUG-2609-019** — mobile "Signed in as {name}" line. CC's mocked-session
  Playwright pass couldn't reproduce it missing (rendered fine every time,
  all 3 personas, desktop+mobile) — but it was visibly absent across every
  real screenshot taken this session. Left `UNDER_REVIEW`, not `RESOLVED`.
  **Needs a real-device/real-browser check**, not another mocked pass, before
  anyone calls this closed either way.
- **QST-2609-001** — status badge semantic-color exception (Published=sage,
  Draft=gold). Chat's recommendation as UX collaborator: allow it, but only
  for non-interactive badges, one canonical token per meaning, documented
  explicitly, each token independently passing WCAG AA. Tied to the
  pre-existing `--afa-gold` contrast question (3.27–3.65:1, below AA) — that
  token can't be grandfathered into a status role while still failing
  contrast, regardless of the broader policy answer. Decision still Hitesh's
  to make.
- **Two ambiguous BackLinks from BUG-2609-010**, deliberately left alone rather
  than decided unilaterally:
  1. `organiser/events/[id]` and `venue/[id]` detail pages' "back to list" link
     (arguably redundant with sidebar, arguably legitimate list-context nav).
  2. `organiser/page.tsx`/`venue/page.tsx` dashboard roots' "Back to Home" link
     (sidebar has no Home entry at all today, so this might be the only
     non-logo way out of the dashboard shell).
- **BUG-2609-008** (Admin DashboardShell) — still deliberately deferred,
  needs a design decision before any code, unchanged from prior sessions.

## Validation coverage so far (this session's new personas)

Clicked through, desktop + mobile, with real findings logged for each:
- **Vinayak** (Venue Owner full)
- **Omkar** (Organiser full)
- **Shahrukh** (Artist partial)
- **Atul** (Audience full) — desktop only, no dedicated mobile pass yet

**Not yet validated**: Vijay (Venue Owner partial), Orri (Organiser partial),
Hrithik (Artist full), Amit (Audience partial). Next session's natural first
move is finishing this pass — the partial personas in particular are the ones
that will show whether the empty-state / sparse-content UX work (the original
reason these personas were built) actually needs the background-texture
Figma round we scoped earlier, or whether nav consolidation alone fixed the
"floating in a large black space" feeling enough to reassess.

## Standing backlog, unchanged

- Razorpay + Google Places API key rotation (dead keys confirmed, Hitesh must
  rotate via dashboards + update `.env.local`/Vercel Preview env)
- White-card-on-dark bug (Messages read-thread rows)
- `--afa-terracotta` sweep across Dashboard/Messages/Tickets — the manifest.ts
  instance (BUG-2609-015) is fixed, but this was only one file; the broader
  component-level sweep is still open
- `--afa-gold` contrast question (tied to QST-2609-001 above)
- Cream-tint tokens
- Auth stock photo placeholder
- Profile eyebrow i18n

## Session-start protocol reminder for next session

1. 🔴 Check Razorpay + Google Maps/Places billing dashboards
2. Query Feedback table (NEW/UNDER_REVIEW) and cross-check against this file
   before treating anything as open
3. Verify qa HEAD against `90f7242`
4. Fresh GitHub PAT into `/home/claude/afa/token.txt`
5. Confirm priority: finish persona validation pass, or move to something else
