# Session Handoff — 19 Sept 2026, closeout (chat — GEN-2609 backfill, numbering collisions, UI/UX centralization audit + fixes)

Template: `docs/HANDOFF_TEMPLATE.md`.

## 1. Last 5 sessions summary

| Session / date | Goal | Status | Remarks | Branches |
|---|---|---|---|---|
| 18-19 Sept 2026 (chat) | GEN-2609 backfill, numbering collisions, UI/UX centralization audit + fixes | Complete | Audit (`GEN-2609-072`) → 4-ticket fix chain, PRs #650-653, all merged (API-verified). Ticket span 070-074: `069`→`071` renumber (2nd collision on 069, found mid-backfill) absorbs 071; `072` is the audit log itself, no code. | `feat/gen-2609-070-amber-chip-family-collapse`, `feat/gen-2609-073-artist-pages-migration`, `feat/gen-2609-073-phase2-remaining-pages`, `feat/gen-2609-074-text-on-image-token` |
| 17 Sept 2026 (chat) | `BUG-2609-049` fix + counter-gap investigation | Partial | PR #649 merged. Found 14-ticket `Feedback` backfill gap, left decision open (resolved this session). | `fix/bug-2609-049-events-tab-underline-fillsolid` |
| 17 Sept 2026 (CC) | Button consolidation phase 2 batch 1 + `toggle-pill` variant | Complete | PR #647 (`BUG-2609-048`) + PR #648 (`GEN-2609-069`) merged. Found amber-accent 2nd-convention question + `CodeCounter` drift, both left open (resolved this session). | PR #647, `feat/gen-2609-069-toggle-pill-button-variant` (PR #648) |
| 15 Sept 2026 (chat) | `BUG-2609-047` merge + Step 1 (type-scale/spacing tokens) | Complete | PR #645 + PR #646 merged. Found + fixed a real `GEN-2609-054` numbering collision. PAT expired mid-session (first time mid- not between-session). | PR #645, PR #646 |
| 14-15 Sept 2026 (CC) | Audit tail, token fixes, button consolidation, font-family centralization | Partial | `BUG-2609-041`-`046` merged; `047` pushed, not yet merged at handoff. Found the 12-step audit doc had gone unread — real sequencing violation. | PR #645 (merged next session) |

(Oldest row from the prior table dropped to hold at 5.)

## 2. Activity in progress

None. All session tickets (070-074) merged, `RESOLVED`/`DEPLOYED_QA` in `Feedback`.

## 3. Open PRs awaiting action

None. Verified via GitHub API (`GET /pulls?state=open`), not assumed: repo has exactly **1** open PR total (`#450`, CI-config-only, targets `main`, unrelated, dated 14 Aug - predates this ticket chain). `#650`/`#651`/`#652`/`#653` individually confirmed `merged: true` via API.

## 4. Decisions sitting with Hitesh

None open. Resolved this session (recorded as outcomes, not carried forward as open):

| Question | Options | Status | Resolution |
|---|---|---|---|
| `GEN-2609-069` 2nd collision (`ee9e47c`/PR #637 also self-labeled `069`) | keep existing `069`, renumber the other / renumber existing `069` | resolved | Existing `069` (`Feedback`-logged) stays; `ee9e47c`/PR #637 → `GEN-2609-071` (no prior refs to break). |
| Amber-accent selected-chip family (4 sites) vs `toggle-pill` orange convention | keep as 2nd legitimate convention / collapse onto `toggle-pill` | resolved | Collapse (`GEN-2609-070`). 3 sites via `Button variant="toggle-pill"`; `MobileEventFilterSheet.tsx` token-swap only (shape differs). |
| `events/page.tsx` view-toggle active color (flagged `--afa-cream` bg, no locked-4 fit) | flag only / pick a token | resolved | `--afa-surface-raised` bg + `--afa-text-primary` text (the paired `--afa-surface-inverse` text would've been 1.20:1 contrast - real bug caught applying this). |
| Merge order, `070` vs `073` | either order | resolved | `070` first (PR #650), then `073` rebased onto updated `qa`, docs conflicts reconciled by keeping both sides. |
| `rgba(255,255,255,0.5)` hero-subtitle color (3 confirmed sites after scope correction from 6) | collapse onto `--afa-text-secondary` / lock as new token | resolved | Locked as new token - different role (photo-hero text vs flat-surface text), not a duplicate. |
| New token's name | `--afa-text-secondary-cold` / `--afa-text-on-image` / other | resolved | `--afa-text-on-image` - named for role, not value. |

## 5. `CodeCounter` state

- `GEN/2609`: **74**. `BUG/2609`: **49**. Live-queried this task, immediately before writing this section (not carried from memory).
- Guard pattern: `SELECT` the real row immediately before any write; condition every `UPDATE ... currentSeq` on the value just read; never advance from a cached/remembered number.

## 6. Known GEN-numbering collisions/gaps ledger

Confirmed present in `docs/HANDOFF_TEMPLATE.md` (source of truth for this ledger): `054` ✅, `069→071` ✅. No new collisions this session.

## 7. Docs-conflict watchlist

None open. Checked via GitHub API, not assumed: the repo's only open PR (`#450`) is CI-config-only and doesn't touch `docs/`.

## 8. Verification standard checklist

✅ `tsc --noEmit` / ✅ `check-design-tokens.js` / ✅ `next build` - all clean, all 4 merges this session (`070`, `073`×2, `074`), every `next build` run foreground and checked via `$PIPESTATUS` (never a backgrounded result - see the `GEN-2609-073` false-positive incident this session found and fixed).

## 9. Production-freeze reminder

**Freeze is active until "company registered." No exceptions. No production Supabase access. No `qa` → `main` merge.**

## 10. UI/UX Design System Debt Ledger

| Metric | Value | Method | As of |
|---|---|---|---|
| `--afa-*` token definitions in `globals.css` | **82** | `grep -oE -- '--afa-[a-z0-9-]+:' globals.css \| sort -u \| wc -l`, freshly measured this task | `GEN-2609-074` |
| Orphaned tokens (defined, zero usage) | 17 | **Not re-measured this task** - carried forward from `GEN-2609-072`'s original audit, unchanged this session | `GEN-2609-072` (18 Sep) |
| Public content pages migrated (Sep 18 audit's 11) | **11 of 11** | Direct count: Artist×2, Event×3, Venue×2 (`073` Phase 1) + Wall of Fame, Organisers, Venue-owners×2 (`073` Phase 2) | `GEN-2609-073` |
| Raw `<button>` elements, repo-wide | **~229** (73 files) | `grep -roE '<button' src --include="*.tsx" \| wc -l` this task - a simple grep, NOT `BUG-2609-048`'s balanced-brace scanner (which found 239/75 on 17 Sept); the two methods aren't directly comparable, both included for context | this task |
| `Button`-component imports, repo-wide | 44 files | `grep -rl` for the import statement, this task - a file count, not an instance count, so not a strict ratio partner to the row above | this task |
| Raw-button → `Button` conversions, Sep 18 audit's 11 pages | **2 of 37** | `073`'s own count within its 7 migrated pages (Phase 2's 4 pages had 0 raw buttons) | `GEN-2609-073` |
| `DesignToken` DB rows (admin-controlled runtime layer) | **93** (68 color / 4 font / 8 size / 6 spacing / 4 radius / 3 button, 5 locked) | Direct `information_schema`/`GROUP BY` query against `aforaudience-qa` post-migration - 82 mirror `globals.css` 1:1, 11 are new (`--afa-radius-*` ×4, `--afa-btn-padding-*` ×3, the 4 `--font-*` role names, newly DB-managed) | `GEN-2609-075` |
| Components whose radius/size actually read from a token (vs. hardcoded) | `Button.tsx` only (`SIZE_CHROME` sm/md/lg + all 999px/8px-radius variants) | `--afa-text-*`/`--afa-space-*` still have **zero** adoption elsewhere (per `GEN-2609-072`'s original finding, unchanged) - editing those in the admin panel has no visible effect outside this one retrofit | `GEN-2609-075` |

**Flag: the repo-wide raw-button count (~229/239) is still-open work outside this session's actually-fixed scope (2/37, page-scoped) - future scope, NOT resolved.** No ticket assigned.

**Discrepancy noted, not chased down:** the audit's own original count was "84" `--afa-*` tokens; this task's fresh count is 82. Difference unexplained (not caused by this session, which only added 1 token, `--afa-text-on-image`) - possibly a counting-method difference in the original audit. Flagging rather than silently reconciling. Unaffected by `GEN-2609-075`'s 93-row DB count above (82 existing + 11 genuinely new, not a re-measurement of the 82).

## 11. Locked-tokens source of truth

**`docs/afa-design-tokens-reference.md`.** The `--afa-text-inverse` gap flagged here 19 Sep — defined in `globals.css`, 3 real consumers, never in this reference doc's Section 1 table — is **fixed** by `GEN-2609-075`: added as its own row, verified before writing (Section 1 now genuinely lists 5 `--afa-text-*` role tokens: `primary`/`secondary`/`muted`/`inverse`/`on-image`). Any PR introducing a new `--afa-*` token must still update this file's Section 1 table in the same PR.

**A second, different "5 locked tokens" now exists — don't conflate the two.** `GEN-2609-075` built an admin-editable runtime layer (`DesignToken` DB table, `/dashboard/admin/design-system`) and needed to decide which tokens require its own confirm-dialog gate before an admin can change them. No such list existed anywhere in the docs before this — asked Hitesh rather than guessing; Hitesh's answer redirected toward broad category coverage (Font/Size/Color/Button/Action/Toast, all now covered — see `docs/design.md`'s `GEN-2609-075` entry) rather than naming the 5 directly, so the originally-proposed set was kept: `--afa-surface-page`, `--afa-surface-raised`, `--afa-amber`, `--afa-fill-solid`, `--afa-on-fill-solid`. This is unrelated to `check-design-tokens.js`'s own locked-palette CI rule (which blocks raw literals in application *code*, unconditionally, regardless of what the DB holds) — two different mechanisms that happen to share the word "locked."

## 12. Immediate next action

**No hard blocker. Suggested, unticketed:** scope the Sep 18 audit's remaining shared-layer items into real tickets - `Toast.tsx`/`DashboardShell.tsx`/`SiteNav.tsx` (audit item #10), the seat-map builder's 29 raw buttons (item #7), and Admin's raw-button residue (item #9) - none started, no `GEN`/`BUG` numbers assigned yet.

## 13. Chat vs. CC ownership note

**Standing model, decided (not an open question, not a one-off exception to re-flag each time):** **chat** owns all PR-open/merge and git-write operations (pushing branches, opening PRs, merging), gated on a session-scoped GitHub PAT Hitesh provides that session; **CC** owns all coding — branching, editing, committing, verifying locally, and pushing its own feature branches. Neither lane crosses into the other's job. This is exactly the split observed across the `GEN-2609-070` through `-074` sessions once the PAT was provided (before that, chat had read-only access — clone-and-read but no write, confirmed directly rather than assumed); that pattern is the standing model going forward, not something to log as a deviation each time it recurs. Per-item in sections 2/3, note which lane each open item belongs to.

**Forward-looking note, not yet acted on:** chat's half of this depends on Hitesh manually re-pasting a short-lived PAT each session — real friction, and a bare token in a chat transcript even briefly is worth removing on its own. Hitesh is considering moving chat's git-write auth to a proper GitHub connector (already configured for this project, not yet given repo-scoped write permissions) instead. If/when that changes, update this section again - the ownership split itself won't change, only *how* chat authenticates to exercise its half of it.

---

# Session Handoff — 19 Sept 2026, GEN-2609-074 built (chat — new --afa-text-on-image token, Hitesh's decision applied)

## qa HEAD: `fa6a8c2` (PR #652, `GEN-2609-073` Phase 2, merged) - confirmed via `git fetch` before branching. New branch `feat/gen-2609-074-text-on-image-token`. Supersedes, does not delete, the sections below.

## `GEN-2609-074` - decided and built: `--afa-text-on-image` locked as its own token

Hitesh's call: don't collapse the `rgba(255,255,255,0.5)` hero-subtitle color onto `--afa-text-secondary` - it's a genuinely different role (text over a *photograph*, not a flat surface), and more photo-hero pages are expected as this app leans further into imagery. Added `--afa-text-on-image: rgba(255, 255, 255, 0.5)` to `globals.css`, migrated the 3 confirmed sites (`wall-of-fame/page.tsx:184`, `organisers/page.tsx:61`, `venue-owners/page.tsx:58`) off the hand-typed literal, documented in `docs/afa-design-tokens-reference.md`'s Section 1 token table. The 3 false-lead files from this finding's own earlier scope correction stayed untouched, re-confirmed via grep after the change.

**Verify.** `tsc --noEmit` clean. `check-design-tokens.js` against `origin/qa`: clean (the new literal lives only in `globals.css`, which is exempt). Real `next build`: clean, confirmed via a foreground run's `$PIPESTATUS`, all 3 touched routes present.

`Feedback` row moved `NEW` -> `IN_TEST` (PR open, not merged). `docs/design.md`'s `GEN-2609-074` entry updated with the decision and build.

## Next session starts by

Merging `feat/gen-2609-074-text-on-image-token`'s PR once reviewed, then updating the `Feedback` row to `RESOLVED`/`DEPLOYED_QA` - same two-step pattern as `GEN-2609-073`.

## `GEN-2609-073` - fully closed, both phases merged

`Feedback` row moved `IN_TEST` -> `RESOLVED`/`DEPLOYED_QA`. **The full 11-page public-content migration scope from the 18 Sep audit (`GEN-2609-072`) is now closed**: Artist detail/list, Event detail/list/seat-select, Venue grid/detail (Phase 1, PR #651), plus Wall of Fame, Organisers directory, Venue-owners list/detail (Phase 2, PR #652). `docs/design.md`'s two `GEN-2609-073` entries both annotated MERGED with their real PR/commit refs.

## `GEN-2609-074` - new tracked finding, NOT part of `GEN-2609-073`'s closed scope

The `rgba(255,255,255,0.5)` hero-subtitle color Phase 2 flagged. **Scope corrected before logging, narrower than Phase 2's own writeup first suggested:** re-grepping the *exact* literal (not just any `rgba(255,255,255,X)`) found it genuinely live in only 3 sites - `wall-of-fame/page.tsx:184`, `organisers/page.tsx:61`, `venue-owners/page.tsx:58` (all three the identical hero-subtitle text). The 3 other files named in Phase 2's writeup (`src/app/page.tsx`, `dashboard/artist/page.tsx`, `NotificationOptIn.tsx`) turned out to use `rgba(255,255,255,X)`-family literals at *different* alphas and *different* CSS roles (a border, a background, a border - not this text-color pattern) - not the same finding, not bundled in. Needs Hitesh's call: collapse onto `--afa-text-secondary` (a real, visible brightness/warmth change - different alpha and a colder white than the token) or lock the current value as its own new token. Logged as `GEN-2609-074`, `Feedback` row `NEW`, `CodeCounter.GEN/2609` advanced `73` -> `74` (guarded on the read value). Not built - a value decision, not this session's call to make.

## Next session starts by

Taking the `GEN-2609-074` color decision to Hitesh. No `GEN-2609-073` follow-up work outstanding - that ticket is done.

## `GEN-2609-073` Phase 2 - the last 4 of the audit's 11 pages, same treatment as Phase 1

Wall of Fame, Organisers directory, Venue-owners list, Venue-owners detail. Full reasoning in `docs/design.md`'s own `GEN-2609-073` Phase 2 entry; headline points here:

- **Only 1 `--afa-cream` usage across all 4 files** - `wall-of-fame/page.tsx`'s local `GridTexture` component (a decorative gradient-line color, not text) -> `--afa-text-primary`. No terracotta, no hex literals anywhere in this batch.
- **One color pattern flagged, not guessed - and it's a real, recurring one.** 3 of the 4 pages use a raw `rgba(255,255,255,0.5)` hero-subtitle color that doesn't match `--afa-text-secondary`'s actual value (`rgba(245,245,240,0.65)` - different alpha *and* a colder white). Also found the identical literal in `dashboard/artist/page.tsx`, `NotificationOptIn.tsx`, and the homepage - real and recurring, but normalizing it repo-wide is out of this ticket's page-scoped remit. Needs Hitesh's call.
- **Typography:** exact scale matches only (11/12/13/14/16/24/32px); non-matches (18/20/22/36px, `clamp()`) left alone and flagged.
- **Buttons: zero raw `<button>` elements in any of the 4 files** - every card/row is a `role="link"` div or a plain `Link`. Nothing to migrate or flag, unlike Phase 1's 37-button haul.
- Shared-component sweep confirmed `VenueNoPhoto.tsx` carries the identical `--afa-cream` grid-texture pattern `wall-of-fame/page.tsx`'s own copy duplicates (same code comment cross-references it) - left untouched, consistent with Phase 1's call on `ArtistNoPhoto.tsx`/`VenueNoPhoto.tsx` being separate shared-layer work.

**Verify.** `tsc --noEmit` clean. `check-design-tokens.js` against `origin/qa`: clean, 0 offenses. Real `next build`: clean, checked via a **foreground** run's `$PIPESTATUS` (not backgrounded - see the Phase 1 session's own false-positive lesson above/below), all 4 routes present.

**This closes the full `GEN-2609-073` scope from the 18 Sep audit - all 11 originally-flagged pages migrated (7 in Phase 1, 4 here).** No further phases planned unless something new surfaces.

## Next session starts by

Merging `feat/gen-2609-073-phase2-remaining-pages`'s PR once reviewed. Two open decisions carried forward for Hitesh: (1) the `rgba(255,255,255,0.5)` hero-subtitle color question above (Wall of Fame/Organisers/Venue-owners, plus the 3 out-of-scope files it also appears in), and (2) whatever comes next now that the full `GEN-2609-073` migration scope is closed - no automatic Phase 3.

---

# Session Handoff — 19 Sept 2026, later same day (chat — GEN-2609-073 closeout: color decision applied, real bug caught via visual verification, merge order at time of writing)

**UPDATE, same day, after this section was written:** `feat/gen-2609-070-amber-chip-family-collapse` merged (PR #650, `fc0421f`) shortly after this section's "still blocked" framing below was written. This branch was rebased onto the updated `qa` and re-verified clean - see the top of this file for that outcome. The "still NOT merged"/"still waiting" statements in this section describe the state *at the time*, not the current state - left as-is rather than rewritten, per this doc's own history-preserving convention.

## qa HEAD unchanged (at the time) - `feat/gen-2609-070-amber-chip-family-collapse` still has not merged as of this update (re-checked via `git merge-base --is-ancestor` against `origin/qa`, not assumed). Supersedes, does not delete, the section immediately below (same-day, earlier).

## `GEN-2609-073`'s flagged color, resolved

Hitesh's call: `events/page.tsx`'s `.afa-events-view-btn.active` background moves to `--afa-surface-raised`. Applying only that (leaving the paired `color: var(--afa-surface-inverse)` as-is) would have shipped a real bug - computed to 1.20:1 contrast against the new background (real WCAG luminance math), an effectively invisible active icon. Moved `color` to `--afa-text-primary` in the same fix (15.07:1) - a necessary consequence of the background change, not scope creep, and documented as such rather than silently bundled in.

## A real bug caught only because visual verification actually happened this time

The first version of the fix's own explanatory code comment wrote `` `color` `` (backtick-quoted) inside `events/page.tsx`'s `<style>{\`...\`}</style>` template literal - backticks aren't escaped there, so it prematurely closed the literal and broke the build. **This session's own prior backgrounded `next build` run reported a clean exit (0) against that broken commit - a false pass**, cause unclear (a stale Turbopack cache is the leading guess, not confirmed). Only surfaced because this session went on to actually start the dev server and drive it with Playwright (no `chromium-cli` available; fell back to a direct script per the `/run` skill's own guidance) instead of stopping at the earlier "clean" build result. Fixed in a follow-up commit, re-verified for real: `tsc` clean, `next build` clean (confirmed via `$PIPESTATUS` on a **foreground**, not backgrounded, run - worth doing whenever a backgrounded build result feeds a real decision), `check-design-tokens.js` clean. Visually confirmed: computed styles `background: rgb(31,31,31)` / `color: rgb(245,245,240)` (exactly the intended tokens) and screenshots of both grid-active and list-active states, both clearly legible. Unrelated pre-existing console noise observed and left alone (a hydration-mismatch warning from the intro-splash script, and duplicate-`Pune`-key React warnings likely from duplicate city rows in seed data) - neither caused by this change, neither this ticket's scope.

**Takeaway worth keeping:** a backgrounded shell command's reported exit code is not automatically trustworthy for a build - re-check with a foreground run and `$PIPESTATUS` before treating a background result as the real verdict on anything that gates a merge decision.

Both fixes pushed to `feat/gen-2609-073-artist-pages-migration` (commits `bcbd27e`, `aba52a2`). `docs/design.md`'s `GEN-2609-073` entry updated with both.

## Merge order - still waiting on step 1

`feat/gen-2609-070-amber-chip-family-collapse` has **not** merged to `origin/qa` yet (re-confirmed this update). The rebase-`073`-onto-updated-`qa` step Hitesh asked for is blocked until that lands - not something to force early. Once it merges: rebase `feat/gen-2609-073-artist-pages-migration` onto the new `qa`, resolve the `docs/design.md`/`HANDOFF.md` conflict by keeping *both* sessions' entries (append, don't overwrite either), then re-run `tsc`/`check-design-tokens.js`/`next build` before treating it as merge-ready.

## Phase 2 - still not started, per Hitesh's explicit hold

Wall of Fame, Organisers directory, Venue-owners list/detail. Hold until `073` is fully merged and clean - do not start early even if idle.

---

# Session Handoff — 19 Sept 2026 (chat — GEN-2609-073, Phase 1 public-pages token/typography/Button migration)

## qa HEAD unchanged this session - PR open, not yet merged. Branch `feat/gen-2609-073-artist-pages-migration`, synced fresh from `origin/qa` (`38c1e43`) before branching, per the standing rule. Supersedes, does not delete, the 18 Sept section below - its still-open items (the `CodeCounter`/`GEN` drift investigation, the amber-accent decision) were resolved in a *separate* branch (`feat/gen-2609-070-amber-chip-family-collapse`), merged first per the merge-order note below.

## `GEN-2609-073` - Phase 1 of the 18 Sep audit's page-migration work, shipped as 3 commits

Migrated the 7 highest-traffic pages `GEN-2609-072`'s audit flagged as never touched by the design-token migration: Artist detail/list, Event detail/list/seat-select, Venue grid/detail. Sequenced smallest-to-largest per the dispatch (Artist pair -> Event trio -> Venue pair), one PR, 3 logical commits - not 3 separate PRs, matching this codebase's existing multi-commit-ticket convention. Full per-page reasoning in `docs/design.md`'s own `GEN-2609-073` entry; headline points only here:

- **~60 `--afa-cream` text-color usages -> `--afa-text-primary`** across all 7 pages - one safe mapping, `Button.tsx`'s own `form-submit` variant already documents the two hex values as visually indistinguishable.
- **One color flagged, then resolved once Hitesh made the call:** `events/page.tsx`'s view-toggle active state originally used a light cream *background* (not text) with no locked-4 equivalent. Hitesh's decision: `--afa-surface-raised`. Applying just that would have shipped a real bug though - the paired `color: var(--afa-surface-inverse)` computes to 1.20:1 contrast against the new background (real WCAG math), an essentially invisible icon. Moved `color` to `--afa-text-primary` (15.07:1) in the same fix. Caught a second, unrelated real bug along the way: the fix's own first-draft code comment had a stray backtick inside a `<style>{\`...\`}</style>` template literal that broke the build - and this session's own prior *backgrounded* `next build` had wrongly reported that broken commit as clean. Only surfaced because this session went on to actually start the dev server and drive it with Playwright (no `chromium-cli` available, fell back to a direct script) per Hitesh's explicit "verify it visually" ask. Fixed, re-verified for real (foreground `next build`, checked via `$PIPESTATUS`), confirmed visually via computed styles and screenshots.
- **Two of the audit's own findings corrected on re-verification:** the "2 hex colors" in Event detail were 1 value (`#241a10`) at 3 sites, migrated to `--afa-surface-inverse` (real precedent: `OrganisersGridEmbed.tsx:172`); the "stray `--afa-terracotta`" in Venue grid doesn't exist live at all - only in a comment documenting an *earlier* migration.
- **Typography:** exact scale matches only, non-matching values (10/15/17/18/20/22/26px, `clamp()`, `em`-relative) left as literals and flagged rather than rounded.
- **Buttons: 2 of 37 migrated** (`artists/page.tsx`'s rising-star CTA -> `primary`/`pill-md`; `ArtistProfileClientPage.tsx`'s "Invite to Lineup" -> `form-submit`). The other 35 are genuine shape mismatches (underline tabs, circular icon toggles, 3px-radius controls, explicitly sharp-cornered Follow buttons per `VenueFollowButton.tsx`'s own comment) - not forced.
- Confirmed `ArtistNoPhoto.tsx`/`VenueNoPhoto.tsx` are used beyond these 7 pages (also Wall of Fame, `layout.tsx`) before deciding not to touch them - real shared-layer work, `GEN-2609-072` finding #10's territory, not this ticket's.
- Repo-wide `--afa-cream` re-check after the migration: 18 files still reference it legitimately, none orphaned, token itself untouched in `globals.css`.

**Verify (post-rebase).** `tsc --noEmit` clean. `check-design-tokens.js` against `origin/qa` (now at `fc0421f`, post-`GEN-2609-070` merge): clean, 0 offenses. Real `next build`: clean, confirmed via a foreground run's `$PIPESTATUS`, all 7 routes present. Visually verified for the one resolved color decision (see above) - the rest reasoned/precedent-matched, not screenshotted, per the standing no-browser-tool convention elsewhere in this ticket.

Logged as `GEN-2609-073`, `Feedback` row `IN_TEST` (PR open, not merged). `CodeCounter.GEN/2609` advanced `72` -> `73` (guarded on the read value).

## Merge-order note, resolved

`feat/gen-2609-070-amber-chip-family-collapse` (`GEN-2609-070`/`-071`/`-072`) merged first, as planned - PR #650, `qa` now at `fc0421f`. This branch (`feat/gen-2609-073-artist-pages-migration`) was then rebased onto the updated `qa`; the predicted `docs/design.md`/`HANDOFF.md` conflicts materialized exactly as flagged and were resolved by keeping both sessions' entries, reordered chronologically (this section now sits above the 18 Sept section below, matching when each was actually written) - neither side dropped.

## Phase 2 candidates, still not started

Wall of Fame, Organisers directory, Venue-owners list/detail - the remaining 4 of the audit's original 11 flagged pages. Hold until `GEN-2609-073` is fully merged and clean, per Hitesh's explicit instruction - not started early even though this rebase leaves it idle-ready.

## Next session starts by

Merging `feat/gen-2609-073-artist-pages-migration`'s PR (rebased, re-verified clean post-rebase) once reviewed, then getting Hitesh's go-ahead on Phase 2.

---

# Session Handoff — 18 Sept 2026 (chat — Supabase reconnected: GEN backfill, counter fix, GEN-2609-070/-071)

## qa HEAD unchanged this session — this was a docs/DB reconciliation session, no app code merged. Feature branch `feat/gen-2609-070-amber-chip-family-collapse` (PR open, not yet merged) gained one more commit (`bb30c58`, docs-only). Supersedes, does not delete, the 17 Sept section below — its still-open items are folded forward, resolved where noted.

## `CodeCounter`/`GEN` drift — RESOLVED, and the 17 Sept section's own count was wrong

Supabase reconnected mid-session, unblocking the backfill the 17 Sept section below put to Hitesh as options (a)/(b)/(c). Hitesh chose (a). Before writing anything, re-verified the 17 Sept section's claim directly against the DB rather than trusting it: **`GEN-2609-052`/`-053` already had real `Feedback` rows** (matches `design.md`'s own write-ups, matches memory from 13 Sept) — that section's "052, 053, and 055 through 068" framing was itself stale/wrong. The real gap was exactly **`GEN-2609-055` through `-068` (14 tickets, confirmed by direct query)**. Backfilled all 14 from `design.md`'s existing write-ups, each cross-checked against its own merge commit in `git log` before writing (all 14 confirmed merged to `qa`, all logged `RESOLVED`/`DEPLOYED_QA`). `CodeCounter.GEN/2609` moved `54` → `69` (conditioned on it still reading `54` at write time — it did).

`GEN-2609-070` (amber-chip family collapse, this branch's own ticket) was logged provisionally pending this exact backfill — now confirmed real, not provisional. `Feedback` row logged as `GEN-2609-070`, status `IN_TEST` (PR open, not merged yet).

## `GEN-2609-069` — a second, separate collision found and resolved

While re-checking the DB for the backfill above, found `ee9e47c` (PR #637, "confirmed-state action row wrapping", merged 14 Sept) also self-labeled `GEN-2609-069` in its own commit message/PR title — a completely different ticket from the toggle-pill-variant `GEN-2609-069` that's actually in the `Feedback` table (logged two days later, 16-17 Sept). Flagged to Hitesh rather than guessed at. **Decision: the existing `GEN-2609-069` `Feedback` entry stays untouched; `ee9e47c`/PR #637 is renumbered to `GEN-2609-071`** (it had no `design.md` entry and no `Feedback` row of its own, so nothing else references the old number). `Feedback` row logged as `GEN-2609-071`, `RESOLVED`/`DEPLOYED_QA` (already shipped). `CodeCounter.GEN/2609` moved `69` → `71` (conditioned on it still reading `69`).

**If you find PR #637 or commit `ee9e47c` referenced anywhere by "GEN-2609-069" (old PR title, an old branch name, a stale bookmark) — that's this ticket. The real, current number is `GEN-2609-071`.** `design.md` has a full entry under that number cross-referencing `ee9e47c`/PR #637 directly.

## `GEN-2609-038` through `-042` — RESOLVED, also backfilled this session (approved same-day, after this handoff was first drafted)

Same class of gap as the 14-ticket backfill above: Step 6 design specs (Motion Guidelines #611, Accessibility Guidelines #612, Icon System Guidelines #613, Notifications Guidelines #614, Onboarding Guidelines #615) were real, shipped, and fully documented in `design.md` (under Step-6-sub-spec headings that don't put the ticket number in the title, which is why the number search didn't catch them until a slower pass), but had zero `Feedback` rows. Hitesh approved the same treatment; row samples shown before writing per the standing bulk-write rule, then all 5 inserted (`RESOLVED`/`DEPLOYED_QA`). `-042`'s migration (`onboardedAt`/`intendedRole` on `User`) was independently confirmed actually applied in the live `aforaudience-qa` schema, not just staged in `schema.prisma`, before marking it `RESOLVED` rather than the "pending approval" state `design.md`'s own write-up described. **No `CodeCounter` move needed or made** — `038`-`042` were already-assigned, already-referenced numbers; only the missing `Feedback` rows were added.

**The `GEN-2609` `Feedback` table is now fully gapless, `001` through `071`** — confirmed by direct query, every number present exactly once. No other same-number-reused-for-different-work collisions found in a spot-check of `001` through `054`; `019`'s and `032`'s multi-commit spans are the same ticket's own phases, not collisions.

## Amber-accent selected-chip family — RESOLVED, was "still undecided" below

Hitesh's call, `GEN-2609-070`: collapse onto `toggle-pill`'s orange convention, don't keep as a second legitimate one. Built and pushed on `feat/gen-2609-070-amber-chip-family-collapse`, PR open — see that branch's own `design.md` entry for the per-site breakdown (3 sites through `Button variant="toggle-pill"`, 1 site — `MobileEventFilterSheet.tsx` — token-swap only, shape genuinely differs).

## `GEN-2609-072` — new UI/UX Centralization Audit logged, no fixes built, decision pending

Hitesh relayed a full-repo audit (69 page files + shared components — `SiteNav`/`DashboardShell`/`Toast`/`EventCard`/`Photo`/`Button`), verified by direct grep against `qa`. 10 findings, full detail in `design.md`'s `GEN-2609-072` entry — headline items: the type-scale/spacing tokens have **zero** live adoption anywhere including `Button.tsx` itself; 17 of 84 `--afa-*` color tokens are fully orphaned; `--afa-cream` (non-locked) leaks into `Toast.tsx`, a shared component, not just pages; 11 public content pages + static/marketing pages never migrated; the seat-map builder is the worst outlier in the repo (192 inline style blocks, 0 `Button` uses); checkout/tickets (the most business-critical flow) have mixed adoption; Admin has real raw-button residue despite clean colors; and `DashboardShell.tsx`/`SiteNav.tsx` — the shared layer — aren't clean either, which is *why* pages built on them look cleaner than they are. `CodeCounter.GEN/2609` advanced `71` → `72` (guarded on the read value, same pattern as every move this session). `Feedback` row logged `NEW` — audit only, nothing built. **No scope/sequencing decision made — this is next session's/Hitesh's call**, not something to start fixing unprompted.

## Next session starts by (superseded — see the 19 Sept section above: `feat/gen-2609-070-...` merged as PR #650, `GEN-2609-073` picked up its migration work, Phase 2 is still pending Hitesh's sequencing call)

`GEN-2609` numbering is fully reconciled (`001`-`072`, gapless) — no backfill/collision decisions outstanding.

## Standing open items, unchanged

`stash@{0}` (still nothing from Hitesh, spanning a very long number of sessions now), Razorpay/Maps key rotation (oldest item on the board), 22 RLS-disabled tables, `GEN-2609-015` (seat picker)/`BUG-2609-029` (i18n half)/icon-naming collision/reduced-motion DevTools verification — all still open, all still unverified visually. `artist/edit/page.tsx`'s dashed-outline button and the nudge-banner pill shapes (flagged across `GEN-2609-064`/`-066`) also still open.

---

# Session Handoff — 17 Sept 2026 (chat — BUG-2609-049 + counter-gap investigation)

## qa HEAD: `6ba4bb2` — `BUG-2609-049` (PR #649) merged, `RESOLVED`/`DEPLOYED_QA`, independently re-verified (qa HEAD, Vercel `READY`, zero runtime errors). Also independently re-confirmed `BUG-2609-048`/`GEN-2609-069`'s prior merge state (`5bc7cf9`) before this session's own work — no drift found, CC's confirmation-only pass and this session's checks agree. Supersedes, does not delete, the section below.

## `BUG-2609-049` — events/page.tsx tab-underline fillsolid fix

The second flagged-not-fixed item from `GEN-2609-069`'s entry below. Dispatched, built, and merged this session: `.afa-events-mode-tab.active::after` used `--afa-fill-solid` (reserved) for a plain tab underline — fixed to `--afa-amber`, matching `ArtistProfileClientPage.tsx`/`NearYouTabs.tsx`'s existing convention. Pre-fix grep confirmed, not assumed: only 2 files in `src/` use `::after`/`::before` at all, and the other (`artists/page.tsx`) was already correct. This really is the last instance of `-048`'s bug class.

## `CodeCounter`/`GEN` drift — bigger than the section below states, still unresolved

The `GEN-2609-069` entry below frames this as a stale counter (`54` vs `design.md`'s real max `69`). Investigation this session found it's worse: **`052`, `053`, and `055` through `068` — 14 real, shipped, PR-referenced tickets documented in full in `design.md` — have ZERO corresponding rows in the `Feedback` table.** Confirmed by direct query, not inferred: `Feedback` has rows for `043`–`054` and now `069`, nothing between. This is a genuine multi-session gap in the standing "~30min logging cadence" rule, not a simple off-by-N. Three options put to Hitesh, **still no answer as of this handoff**:
(a) backfill all 14 `Feedback` rows from `design.md`'s existing write-ups, then set counter to `69`
(b) move counter to `69` only, note the gap once in `design.md`, don't backfill
(c) backfill only `-063`/`-066`/`-067`/`-068` (the ones referenced/built on this session), leave the rest as noted drift

**Do not touch `CodeCounter.GEN/2609` or insert new `GEN`-prefixed `Feedback` rows until this is decided.** `BUG/2609` counter is unaffected and fine — currently `49`, stays in sync, keep incrementing normally.

## Amber-accent selected-chip family — still undecided, unchanged from below

4 sites (`admin/bookings` tab switcher, profile role-switcher, `GenrePicker.tsx`, `MobileEventFilterSheet.tsx`) use a second, different "selected" color language than the orange-tint convention `BUG-2609-048`/`GEN-2609-069` just established. Real design call — is this a legitimate second convention, or should it collapse onto the orange-tint pattern — not a mechanical fix. No dispatch should be written for these 4 sites until Hitesh weighs in.

## Next session starts by

Reading `docs/afa-uiux-design-audit.md` (unchanged, still load-bearing) — then resolving the `GEN` counter/backfill decision above before any further `GEN`-prefixed logging — then the amber-accent decision before touching any of those 4 sites.

## Standing open items, unchanged

`stash@{0}` (still nothing from Hitesh, spanning a very long number of sessions now), Razorpay/Maps key rotation (oldest item on the board), 22 RLS-disabled tables, `GEN-2609-015` (seat picker)/`BUG-2609-029` (i18n half)/icon-naming collision/reduced-motion DevTools verification — all still open, all still unverified visually.

---

# Session Handoff — 17 Sept 2026 (CC — button consolidation phase 2 batch 1 + toggle-pill Button variant)

## qa HEAD: `5bc7cf9` — `BUG-2609-048` (PR #647) and `GEN-2609-069` (PR #648) both merged, `RESOLVED`/`DEPLOYED_QA`, independently re-verified (qa HEAD, Vercel `READY`, zero runtime errors via Vercel MCP), not assumed. Supersedes, does not delete, the 15 Sept section below — its still-open items are folded forward unchanged except where resolved here.

## `BUG-2609-048` — button consolidation phase 2, batch 1: `--afa-fill-solid` reservation violations

Picked up the exact item the 15 Sept handoff flagged as next (line 27 below, now resolved). Built a fresh, exhaustive raw-`<button>` inventory (balanced-brace scanner, same class of tool `BUG-2609-045` used) rather than trusting the prior "~230" estimate: **239 across 75 files**, in line. Two real findings: zero legacy-token hits anywhere (the terracotta sweep really is done), and **21 raw toggle/filter/segmented-option buttons across 8 files misusing `--afa-fill-solid`** (reserved for booking/payment/commit) as a generic "selected" indicator — 11 of them in the seat-map builder alone. Fixed by completing an already-shipped pattern's adoption (`GEN-2609-063`/`-066`'s `FILL_SOLID_TINT`/`FILL_SOLID_BORDER_TINT`), not inventing a new one. Flagged, not touched: the Follow-button pattern (already-sanctioned CTA convention) and `ArtistProfileClientPage.tsx`'s prev/next-artist nav arrows (a genuine borderline case). Full detail: `docs/design.md`'s `BUG-2609-048` entry.

## `GEN-2609-069` — `Button` `toggle-pill` variant + 5-site retrofit

Direct follow-up dispatch: `BUG-2609-048`'s own finding was that most of the 239-button inventory is one repeated pill-shaped toggle shape `Button.tsx`'s 7 variants don't model. Design was locked before the dispatch (mockup reviewed). Built `variant="toggle-pill"` reusing the existing `pill-sm`/`pill-md` size tokens for shape, `FILL_SOLID_TINT`/`FILL_SOLID_BORDER_TINT` for selected state (deliberately a translucent border, not `-048`'s solid one — a locked, intentional difference, not an inconsistency). Added `selected`/`icon` props to `Button`, reusing `Badge.tsx`'s existing icon convention. Retrofitted the 5 sites that were both pill-shaped and already on the right color family from `-048`. Confirmed via repo-wide grep (including CSS-class-driven `.active` toggles, which a first pass missed) that no other pill-shaped toggle group exists — found and flagged two real things instead of forcing them in: a second "amber accent" selected-chip family at 4 sites (`admin/bookings` tab switcher, `profile`'s role-switcher, `GenrePicker.tsx`, `MobileEventFilterSheet.tsx`) using a different hue than the new variant's locked spec, and one more instance of `-048`'s own bug class on `(public)/events/page.tsx`'s `.afa-events-mode-tab.active::after` (CSS-class-driven, not a pill, out of this ticket's scope). Full detail: `docs/design.md`'s `GEN-2609-069` entry.

## Open item this session couldn't resolve: `CodeCounter`/`design.md` numbering drift

`CodeCounter`'s `GEN/2609` row reads `currentSeq: 54`, but `design.md` already uses `055` through `069` for real, already-shipped work (re-confirmed via grep, not assumed) — the same drift the 15 Sept section's `GEN-2609-054` collision note already flagged once, now confirmed wider than just that one entry. `GEN-2609-069` was assigned by reading `design.md`'s own real max + 1, not from the stale counter. **Not fixed here** — realigning `CodeCounter.GEN/2609` to 69 is a real, consequential write to shared state (not a simple "+1"), and this session's permission guard treats `CodeCounter` writes as sensitive (blocked once, then allowed on a retry — inconsistent, don't assume either behavior). Asked Hitesh whether to correct it; no answer yet as of this handoff. Whoever picks this up next: get an explicit yes before writing to `CodeCounter`, and note that `BUG/2609`'s counter (`48`) is currently in sync with `design.md`, only the `GEN` row has drifted.

## Where this leaves button consolidation

- **Phase 2, batch 1: done** (`BUG-2609-048`). **`toggle-pill` variant: done** (`GEN-2609-069`), 5 sites retrofitted.
- **Flagged, real, not yet dispatched:** the amber-accent selected-chip family (4 sites) and the `events/page.tsx` fill-solid tab-underline bug (1 site, 1-line fix) — see `GEN-2609-069`'s entry above for exact locations.
- **The other 11 `BUG-2609-048` sites** (seat-map's boxy 6-8px-radius selectors) are a genuinely different, non-pill shape — correctly out of `toggle-pill`'s scope, not a leftover.
- **The bulk of the 239-button inventory** (everything outside the toggle/segmented shape) still hasn't been triaged - a real phase 3, per-instance judgment call, not started.

# Session Handoff — 15 Sept 2026 (chat — BUG-2609-047 merged, Step 1 of the 12-step audit completed, a real numbering collision found and fixed)

## qa HEAD: `2edbcaf` — `BUG-2609-047` and `GEN-2609-054` both merged and verified. Supersedes, does not delete, the 14-15 Sept section below — its still-open items are folded forward unchanged except where resolved here.

## The one thing this session did that's new: found and read `docs/afa-uiux-design-audit.md`

This file exists — a comprehensive 12-Sep strategic UI/UX audit, 217 lines, with an explicit **6-step build sequence in its own Section 12**: Step 1 (type-scale + 8px grid spec) must ship *before* Step 4 (extract the component library from the worst legacy-token offenders), and Step 5 (bring in Figma Make) comes *after* Steps 1–4, not before. Neither chat nor CC had been reading this file — every session's work, including `BUG-2609-045`'s button consolidation and `-058`/`-066`'s earlier Button extractions, has been happening as the "simultaneous push" this document explicitly warns against. **Read this file at session start from now on, alongside `HANDOFF.md`/`docs/design.md`** — it's load-bearing for sequencing, not optional background reading.

Checked whether Step 1 was actually done (Hitesh's own instinct, correctly half-right): `docs/afa-design-tokens-reference.md` §8 has the full derived spec (real type scale + spacing grid, both page-title tiers) — but it says itself "spec only, nothing applied," and independent grep confirmed zero `--afa-text-*`/`--afa-space-*` tokens existed anywhere in `globals.css`. The two page-title tiers (`GEN-2609-032`/`-033`/`-035`) had real, verified, shipped work behind them — but as **repeated correct literal values at ~36 call sites, never actually promoted to a named token**. Real, if subtle, distinction: consistently-applied hardcoded values aren't the same as a single source of truth.

## `BUG-2609-047` (font-family centralization) — merged

Visually reviewed this time, not just build-checked — the one exception to this session's "no browser tool" pattern. Gave Hitesh a prioritized page list (homepage intro-splash, `/about`, `/login`+`/forgot-password`'s `AuthBrandPanel`, a legal page, `/dev/razorpay-test`, one page per dashboard role, `/checkout/[bookingId]`) via a live Vercel preview URL for the PR branch rather than merging on faith. Approved, merged (PR #645, sha `19eb1b2`), Vercel `READY`, zero runtime errors, `RESOLVED`/`DEPLOYED_QA`.

**Mid-merge, the GitHub PAT expired** (`401 Bad credentials` on the merge PUT, not on the first check earlier this session) — this is the first time a PAT has died *mid-session* rather than between sessions; don't assume a token that worked an hour ago still works for a long session. Hitesh supplied a fresh one, stored at the usual path, merge retried and succeeded.

## `GEN-2609-054` (type-scale + spacing tokens — Step 1 completion) — merged, with a real collision found and fixed

Per Hitesh's decision ("finish Step 1 first"), dispatched defining the 14 already-derived tokens for real in `globals.css`, zero component adoption. **CC had already started this independently** — resumed to find in-progress, uncommitted work on a matching branch (`GEN-2609-054` per its own commit), plus an unrelated stray `public/sw.js` `CACHE_VERSION` bump that CC correctly found and reverted before pushing (not part of this ticket). Re-verified everything fresh rather than trusting the leftover state: zero-adoption grep, `EXEMPT_FILES` status, `tsc`, `check-design-tokens.js`, `next build` all held. Diff-verified independently before merging (PR #646, sha `900d79e`) — all 14 tokens exact values, nothing else in `globals.css` touched. Vercel `READY`, zero runtime errors, `RESOLVED`/`DEPLOYED_QA`.

**Found while closing this out: a real `GEN-2609-054` numbering collision in `docs/design.md`.** An older entry (a terracotta-button-sweep investigation, written in a session without Supabase access) had self-guessed `GEN-2609-054` for its own work — colliding with this ticket's real, correctly-`CodeCounter`-issued `GEN-2609-054`. Investigated rather than assumed: the terracotta entry's own described work (migrating `forgot-password`/`reset-password` to `Button variant="form-submit"`) genuinely shipped (confirmed live in both files), and the wider terracotta sweep it recommended splitting off was properly finished and correctly renumbered as `GEN-2609-060` through `-066` in a later session (`git log` confirms "closes the terracotta sweep" commits under those numbers). Corrected via a direct docs-only commit to `qa` (`2edbcaf`) — added a correction note to the mislabeled historical entry rather than rewriting it, and closed out the type-scale entry's own stale "Supabase was disconnected, couldn't verify" caveat now that it's confirmed.

## Where this leaves the 12-step audit

- **Step 1: done for real now.** 14 tokens exist as genuine CSS custom properties. Zero adoption anywhere — that's deliberate, not a gap.
- **Step 4 (component library extraction): partially underway**, out of sequence relative to Step 1 until just now — `BUG-2609-045`'s button consolidation phase 1 (6 duplicate groups, 21 instances, 4 files) and the older `GEN-2609-058`/`-060`–`-066`/`-053`/`-060` Button/Badge extraction work all predate Step 1's completion. Not being unwound — just noting the sequence was violated in practice before this session caught it.
- **Button phase 2** (the ~230 non-duplicate raw `<button>` instances, judgment-heavy, not mechanically provable) was about to start this session when the Step 1 discovery interrupted it. **This is the next thing to pick up** — now correctly sequenced behind a completed Step 1.
- **Step 5 (Figma Make)** stays explicitly held per Hitesh's own standing instruction this session ("ignore Figma for now, I'll tell you explicitly") — which the audit doc's own sequence agrees with anyway.

## Carried forward, unchanged from before

- `GEN-2609-015` (seat picker legend/squished seats) — still unverified visually.
- `BUG-2609-029` (i18n half only on `PhoneVerifyNudge.tsx`) — still open.
- Icon-naming collision (`calendar`/`tag`/`map`) from the centralization audit — still undispatched.
- Reduced-motion DevTools click-through verification — still no browser tool, now spanning many sessions.
- Razorpay/Maps API key rotation — oldest standing item, Hitesh action required.
- 22 Supabase tables with RLS disabled — still open, never actioned.
- Font-size *scale adoption* (as opposed to definition, now done) — a real, separate, larger retrofit across ~36+ files, not started.

## No browser tool, again — except `BUG-2609-047`, which got a real one this time (see above)

# Session Handoff — 14-15 Sept 2026 (CC — audit tail, root-cause token fixes, button consolidation, font-family centralization)

## qa HEAD: `c9c4f80` — `BUG-2609-041` through `-046` all merged and verified (`RESOLVED`/`DEPLOYED_QA`, independently re-queried, not assumed). `BUG-2609-047` is pushed, **not merged** — see below, this is the one thing that needs doing first. Supersedes, does not delete, the 14 Sept section below — its still-open items are folded forward unchanged except where resolved here.

## Session narrative — seven dispatches, one continuous CC thread

All seven were dispatched to CC directly this session (no chat involvement noted in this thread), each its own branch, each re-verified fresh against live `qa` before editing per standing convention — several premises turned out stale or wrong and were corrected rather than built as specced. Full per-ticket technical detail lives in `docs/design.md` (`BUG-2609-041` through `-047` entries) — this section is the narrative summary, not a duplicate.

**`BUG-2609-026`/`-027`/`-028`** (audit tail, PR #638) — closed the last 3 items from the Step 6 UI/UX audit. `-026` (reduced-motion gaps) dropped from 3 sites to 2 on re-check: `ContributionMoment.tsx` turned out already fully covered by its own local block plus the consolidated one, not actually broken. `-027` (`--afa-text-muted` misused on real body copy) fixed exactly as specced, 5 sites. `-028` (bare bell emoji) — dispatch's premise was wrong: `BellIcon`/`BellOffIcon` already existed in `VenueIcons.tsx` (reused rather than duplicated), and a 3rd bare-emoji site turned up during re-grep (`ArtistProfileClientPage.tsx`'s follow-notify toggle) and got fixed in the same pass.

**`BUG-2609-041`** (PR #639) — `SupportWidget.tsx` was never touched by any prior centralization sweep because it used unnamed Phase-0 light tokens/raw hex instead of the named legacy tokens those sweeps grepped for. Full dark-theme migration: shared `inputStyle`, the `appearance:none`+chevron select pattern from `profile/page.tsx`, the label+`variantStyle`+hidden-input file-upload pattern, `CheckIcon` replacing a bare `✓`. One deliberate deviation from the dispatch's literal snippet: kept input backgrounds at `--afa-surface-page` (not the dispatch's `--afa-surface-raised`) since this panel is itself `--afa-surface-raised` — using the same token would have erased the input/panel contrast.

**`BUG-2609-042`** (PR #640) — dispatch claimed the seat-map builder's Guided Setup wizard had no mobile gate and rendered fully interactive on phones. **Wrong**, caught via `git blame`: it's been `isMobile`-gated with a read-only note since `GEN-2608-082` (31 Jul). The one real gap was the pre-canvas "Guided Setup vs. Draw It Myself" choice screen having zero mobile gating — fixed with a 2-condition change routing mobile visitors straight to the existing read-only view, rather than rebuilding something already done.

**`BUG-2609-043`** (PR #641) — the actual root cause behind `-041`'s bug: `globals.css`'s `body{@apply bg-background text-foreground}` is real, but `.dark` (holding correct dark values) is never applied to `<html>`/`<body>` anywhere in the app — `:root`'s shadcn-scaffold light-mode defaults were the live fallback every unstyled element inherited, invisible almost everywhere because page roots set their own explicit color. Repointed `:root`'s `--background`/`--foreground` to the real tokens (scoped narrowly, `.dark` and other properties untouched); added the missing root `color` to `SupportWidget`'s panel. **Caught the dispatch's own Fix 3 before shipping it**: swapping `Toast.tsx`'s badge `'white'` to `--afa-on-fill-solid` would have fixed the amber case (2.63→7.13:1) but broken error and success (6.54→2.87:1, 6.39→2.94:1) since the badge's background is dynamic per toast kind. Shipped a per-kind color instead.

**`BUG-2609-044`** (PR #642) — `my-feedback/page.tsx`'s `--afa-black` was undefined everywhere in the app, so 6 sites silently resolved to a hardcoded near-black fallback. Fixed to `--afa-text-primary`; re-ran the same exhaustive undefined-token grep repo-wide afterward (found 3 remaining fallback-guarded tokens, all genuinely defined — zero undefined tokens remain).

**`BUG-2609-045`** (PR #643) — button consolidation phase 1: an exhaustive balanced-brace parser (not a naive regex, which misses these past an arrow-function's own `>`) found 6 byte-identical duplicate-style button groups, 21 instances, 4 files. Extracted local shared components (`ApproveButton`/`RejectButton`, `RemoveRowButton`, `RemoveGuidedRowButton`/`AddDashedRowButton`, `SeatStepperButton`) rather than forcing them into `Button.tsx` — none of its 7 variants matched any group without a visible difference. ~230 remaining raw `<button>` instances flagged as phase 2 (a judgment call per instance, not mechanically provable), not built.

**`BUG-2609-046`** (PR #644) — `my-feedback/page.tsx` kept its own independent status-color map instead of drawing from `src/lib/statusStyle.ts`, plus a live bug (`NEW`'s badge text was near-invisible). Migrated onto `STATUS_TONE`, with 2 real judgment calls made rather than shipped mechanically: `REJECTED` kept its own dimmed text color rather than also taking `STATUS_TONE.muted`'s full opacity (would have made it visually identical to the now-fixed `NEW`, erasing an intentional distinction); the 6-status orange group's migration was verified via real computed contrast before treating it as safe (4.74:1 → 5.31:1, an improvement). Also caught a type mismatch in the dispatch's own suggested snippet.

**`BUG-2609-047`** (branch `refactor/font-family-centralization`, **pushed, not yet merged**) — repo-wide font-family centralization: `Georgia, serif`/`system-ui, sans-serif`/bare `monospace` → `var(--font-display/sans/mono)` across 61 files. Fresh counts differed slightly from the dispatch's own; investigated every discrepancy rather than assuming drift (2 were comments, correctly left alone). Found and fixed several sites beyond the dispatch's stated file list using the same principle — compound font stacks in `about/page.tsx`/`LegalDocLayout.tsx`/`EnvBadge.tsx`/`dev/razorpay-test/page.tsx` that evaded exact-string matching, plus one Tailwind `font-serif` utility class in `AuthBrandPanel.tsx` (fixed by extending that file's own existing inline-style pattern, not touching Tailwind's global theme config). **This is a real, visible typeface change on 116+ headings/labels/badges — flagged explicitly in the PR, needs actual eyes on the rendered app before merging, not just a green build.**

## The one thing next session should do first

**Merge `BUG-2609-047`** (compare link in `CC_HANDOFF.md`), but only after a real visual pass — this changes actual rendered typefaces across most of the app. If nobody has looked at it yet, that's the session's first job, not merging on faith that a clean `next build` means it looks right.

## No browser tool this session, again

Every visual claim across all seven tickets was reasoned from token values, computed contrast math (2 real contrast computations done from scratch this session — the Toast.tsx badge and the STATUS_TONE.orange migration — not eyeballed), or existing on-page precedent, and flagged as unverified rather than claimed done. This is now many sessions running with the same gap. If a browser tool ever becomes available, `BUG-2609-047`'s visual review is the single highest-value thing to point it at.

## Open items carried forward (unchanged from 14 Sept section below except where resolved above)

**Resolved this session, remove from any older list:** `BUG-2609-026` through `-046`.

**Still open:**
- **`BUG-2609-047` needs merge + real visual review** (new, see above) — the highest-priority item.
- Real product decision, still not made: cancelled/refunded ticket cards — stay non-interactive or tap through to the past event? (`GEN-2609-068`, unchanged since 14 Sept)
- 🔴 Razorpay + Google Maps/Places QA key rotation — still the single oldest item on the whole board, now many sessions running.
- 22 QA-project tables with RLS disabled — flagged repeatedly, no policy pass done.
- The unclaimed `stash@{0}` — still untouched, spanning many sessions now (see `CC_HANDOFF.md`).
- Everything else in the 14 Sept section below that isn't explicitly marked resolved above.

## Session-start checklist

1. `git checkout qa && git fetch origin && git reset --hard origin/qa` — HEAD should be `c9c4f80` until `BUG-2609-047` merges.
2. Read this file, then `docs/design.md` for the full per-ticket technical detail on everything above.
3. **Get real eyes on `BUG-2609-047`'s branch before merging it** — a live preview deploy or a local `next dev` look at a few of the 61 touched pages, not just trusting the clean build.
4. Check Razorpay/Google Maps billing dashboards — still the oldest open item.
5. Decide on `stash@{0}` — it's been carried forward unresolved for a very long time now.

---

# Session Handoff — 14 Sept 2026 (GEN-2609-067/068/069 — UI centralization audit, tickets-page v6 rebuild, live-bug fix)

## qa HEAD: `ee9e47c` — GEN-2609-067 (both PRs), -068, and -069 all merged and verified. Supersedes, does not delete, the 13 Sept handoff below — its still-open items are folded forward unchanged except where resolved here.

## Session narrative — how it ran

Chat-side session, but with a real capability change worth flagging up front: **chat had full git/GitHub-API/Vercel-MCP/Supabase-MCP access this session** (fresh PAT pasted into chat, stored at `/home/claude/afa/token.txt`) and did the entire dispatch → build → PR → CI → merge → deploy-verify → Feedback-log loop itself for two of the three tickets below, not just the merge step. This is beyond chat's usual "merge CC's finished PR" role — worth knowing so a future session doesn't assume all code changes in this history came from CC.

Three tickets, one continuous thread:
1. **`GEN-2609-067`** — dispatched to CC: full single-pass fix of an 8-item UI-centralization audit chat had run directly against the repo (cloned locally, real grep, not assumed).
2. **`GEN-2609-068`** — dispatched to CC: rebuild `/tickets/page.tsx` against a Figma Make "AFA Mobile App v6" export, used as visual/structural reference only.
3. **`GEN-2609-069`** — found and fixed by chat directly (not dispatched to CC) from a live screenshot Hitesh sent after `-068` shipped.

## `GEN-2609-067` — 8-item UI-centralization audit (PRs #635, #634)

Chat cloned the repo itself and ran real repo-wide greps rather than trusting the standing "locked 4-token palette" doc, which turned out to be stale (see item 8). Found and dispatched 8 items:

1. PWA `theme_color` in `layout.tsx`/`manifest.ts` still wired to legacy `--afa-terracotta` — this **was** the open "PWA theme_color coupling" decision from the terracotta sweep, not a separate item. Retargeted to `--afa-fill-solid`.
2. Dashed "+ Add tour stop" button (`dashboard/artist/edit/page.tsx`) — also a resolved open decision, same retarget.
3. `/tickets/page.tsx`'s "Download ticket (PDF)" button used `--afa-fill-solid` (CTA-only token) — same weight as "Pay Now". Demoted to an amber outline. **Note: this exact button was fully rebuilt again in `-068` below — the amber-outline fix here was superseded, not wasted; `-068`'s 3-button row reconciles it.**
4. Seat-map editor (`dashboard/venue/[id]/seat-map/page.tsx`) — 11 live hits of legacy `--afa-ink`/`--afa-white`, the single largest concentration in the repo. Full migration; **surfaced 3 real inverted-visibility bugs** (selected state was less visible than unselected) as a side effect.
5. 3 auth-page banners (`forgot-password`, `reset-password`, `RegisterForm`) still on `--afa-terracotta-tint`/`--afa-amber-tint`.
6. 14 files with light-mode leftovers (hardcoded `background: white` + `--afa-ink` text) — `SearchBox`, `OrganisersGridEmbed`, `VenueOwnersGridEmbed`, public organisers/venue-owners pages, `RatePromptClientPage`, `LegalDocLayout`, `EnvBadge`, `SeatLayoutPreview`, `SeatPicker`, `dev/razorpay-test`, `about/page.tsx`, `PhoneVerifyNudge`, `DisplayNameNudge`, others. **`FourRooms.tsx`/`PhotoCrossfadeBackdrop.tsx` confirmed false positives** (radial-gradient stop, not text/bg color) and correctly left untouched.
7. Shadow `--afa-red-alt` token (independent of `STATUS_TONE.error`) in `availability.ts` and `tickets/page.tsx` — folded into `--afa-error`.
8. **The standing "locked 4-token palette" doc was itself wrong/incomplete** — `src/lib/statusStyle.ts`'s `STATUS_TONE` (gold/sage/error/muted/orange) plus `Badge.tsx`'s 5 chrome variants are an equally-real, equally-governed second palette, exempt from `check-design-tokens.js` as the shared tone source, that the doc never mentioned. Added `docs/afa-design-tokens-reference.md` Section 5.1 documenting it from shipped code. **This is likely part of why deviations get missed** — Claude Code checks against the published spec, and the spec undersold reality.

Two PRs (items 1-7 in #635, item 8 in #634 per the dispatch's own sequencing) both opened, CI'd, and squash-merged **by chat**, `qa` confirmed, Vercel READY, 0 runtime errors both times. Both logged to Feedback (`BUG-2609-030` through `037`).

**Bonus, found during merge verification, not part of the original dispatch:** two pre-existing Feedback tickets (`GEN-2609-016` "SeatLayoutPreview deprecated --afa-white", `BUG-2609-029` "PhoneVerifyNudge legacy tokens") turned out to be resolved as a side effect of item 6's sweep — verified against live code, corrected their status to `RESOLVED` (the i18n half of `-029` is unrelated and still open).

## `GEN-2609-068` — `/tickets/page.tsx` rebuild against Figma Make v6 reference (PR #636 + 1 direct fixup)

Full UI/UX design loop this session, worth reading in order if picking this thread back up:

1. Hitesh asked for a better `/tickets/` presentation. Chat recommended against trusting Figma Make's *code* directly (per this project's own established finding that Figma Make output doesn't reliably match rendered reality) but recommended it for *visual* exploration, anchored to an **existing** Figma project rather than a fresh one (his "AFA Mobile App v5" already fed the current live font system — confirmed by grepping `layout.tsx`'s own comments).
2. Wrote a token/font-locked prompt for Figma Make. Hitesh duplicated v5 → renamed v6, uploaded the zip. Chat inspected the actual generated code (not just the rendered screenshot) before approving it as a reference: found 2 real deviations — invented colors `#7db873`/`#e05c55` for status-chip text (should trace to real tokens) and 3 near-duplicate micro-label sizes (8/9/10px, conceptually 2 roles).
3. Dispatched `-068` to CC with those 2 corrections baked into the brief (don't inherit the mockup's bugs). CC built it: new `StubRow` component, `Badge` `icon` prop, `Button` `outline-neutral` variant, `MessageButton` `icon` prop, 6 icons, 9 i18n keys × 11 locales, and (per the brief) new `--afa-sage-bright`/`--afa-error-bright` tokens wired into `STATUS_TONE`.
4. **Chat opened the PR itself and found `design-tokens` CI actually fails on this repo only on `pull_request`, not on push** — meaning CC's own pre-push local run of `check-design-tokens.js` can look clean (it diffs against `origin/qa`, same as CI does) but **CC never sees the PR-triggered run's result unless a PR is already open**. This is a real workflow gap worth internalizing: verifying green locally is necessary but not sufficient confirmation that CI will pass — a PR must actually be opened to know for sure. Real failure this time: `Button.tsx`'s new `outline-neutral` variant had a raw `rgba(245,245,240,0.15)` border literal (this exact alpha had **no** named token anywhere in the app despite being the de facto standard resting-border color — see `.afa-search-box` in `globals.css`). **Chat fixed it directly** (not re-dispatched): added `--afa-border-resting` to `globals.css`, routed the new variant through it. First attempt still failed — the *explanatory comment* itself quoted the same rgba string in backticks, and the checker's text-based match caught it even inside a comment; reworded the comment to reference the token by name instead (also just correct now that the token exists). Verified clean, pushed, CI green, merged.
5. **Live QA data notes from CC's session, worth knowing:** `ticketCode` is always null in the current QA data (handled gracefully, not a bug); no multi-tier/numbered-seat bookings exist yet to test that path against.
6. **Open product question, not decided yet:** should cancelled/refunded ticket cards stay non-interactive (current behavior, matches the v6 reference) or tap through to view the past event? Flagged by CC as a real product call, not a build decision. **Still unanswered as of this handoff.**

WCAG contrast for the 2 new bright tokens: ~5.4:1 against the translucent tinted backgrounds, comfortably over the 4.5:1 AA floor (full math should be in `docs/design.md`'s `GEN-2609-068` entry — verify it's actually there next session, chat did not independently re-derive the contrast math itself, only confirmed CC reported doing it).

## `GEN-2609-069` — live-bug fix, found by chat from a screenshot (PR #637)

Hitesh sent a live screenshot of `qa.aforaudience.com/tickets/` after `-068` deployed: the 3-button row (Download PDF/Message Organiser/Cancel) was rendering as 3 stacked full-width lines instead of a row, in the 2-up desktop grid specifically.

**Root cause, found by reading the actual shipped code, not guessing from the pixels:** all 3 buttons used `flex: '1 1 auto'`, which makes each button's flex-basis its own natural content width. In the 2-up desktop grid — narrower per-card than the mobile-first v6 mockup assumed — the 3 buttons' combined natural width exceeded the available row width, so `flexWrap: 'wrap'` dropped each onto its own line.

**Fix:** `flex: '1 1 0'` + `minWidth: 0` on all 3, so they split the row equally and wrap their own label text if genuinely constrained, instead of each claiming full width first. **Also found a second, unnoticed copy of the exact same `rgba(245,245,240,0.15)` border literal** sitting in `MessageButton`'s inline override in this same block — the `-068` CI fixup only tokenized `Button.tsx`'s copy, not this one. Routed through `--afa-border-resting` too.

Chat did the full branch → PR → CI-wait → merge → Vercel-wait → runtime-error-check → Feedback-log loop itself, same as `-067`/`-068`'s merge steps. Confirmed `design-tokens` clean, `qa` READY, 0 runtime errors. Logged `BUG-2609-040`.

**Not yet visually re-confirmed by a human** — chat has no browser/screenshot tool, so this fix is verified by code logic + CI, not by seeing the actual rendered result. Worth a real look next time anyone's on the live page.

## Feedback-table logging — process note

The "which Feedback table" ambiguity from prior sessions is resolved: it's `aforaudience-qa`'s (Supabase project `nqiyrypmjtogoocerxtu`) real `Feedback` table, `displayId` format `BUG-2609-0NN` per the `CodeCounter` table (`prefix='BUG', yearMonth='2609'`), currently at `currentSeq=40`. Chat logged all of `-067` (8 items, `030`-`037`), `-068`'s CI-fixup (`038`/`039` — logged by CC, note-appended by chat with merge details), and `-069` (`040`) directly via `execute_sql`, not left for a future session to backfill.

## Open items for next session

**Real product decision needed:**
- Cancelled/refunded ticket cards: stay non-interactive (current) or tap through to the past event? (`-068`)

**Verification debt (not failures, just unconfirmed):**
- `-069`'s button-row fix — no human/browser visual confirmation yet, only code-logic + CI. Re-read the actual diff this session (CC-side): `flex: '1 1 auto'` → `flex: '1 1 0'` + `minWidth: 0` is the correct, standard fix for the diagnosed bug (each button was sizing to its own content instead of splitting the row) - confirms the fix should work, but "should work" per code reading is still not the same as seeing it render. Still needs real eyes on `qa.aforaudience.com/tickets/` at desktop width.
- ~~`-068`'s WCAG contrast math for `--afa-sage-bright`/`--afa-error-bright` — chat trusted CC's reported ~5.4:1, didn't independently recompute.~~ **Resolved this session (CC-side):** independently recomputed via a fresh script (not reusing CC's original by-hand arithmetic), same WCAG relative-luminance formula, from scratch: sage @ real 0.12 alpha → **5.472:1**, sage @ hypothetical 0.20 alpha → **5.110:1**, error @ real 0.10 alpha → **5.444:1**, error @ hypothetical 0.20 alpha → **5.107:1** — all match the originally-reported ~5.4-5.5:1 range within rounding, all comfortably clear 4.5:1 AA. Cross-check reproduced too: `--afa-red-alt` (#EF4444) against the same error-tint background measures **4.170:1** (FAIL), confirming it genuinely wasn't fit for this role. Independent confirmation, not a re-trust of the original report.

**Still open from the audit, not touched this session (see `-067` for full detail):**
- `BUG-2609-026` — reduced-motion coverage gaps (seat-anim, path-card hover, `ContributionMoment`).
- `BUG-2609-027` — `--afa-text-muted` misused for real 13-14px body copy (AA contrast fail) in 5 places: `OrganisersGridEmbed.tsx`, `venue-requests/page.tsx`, `venue/sales/page.tsx` (×2), `venue/bookings/page.tsx`.
- `BUG-2609-028` — `NotificationOptIn.tsx` bare 🔔 emoji instead of registry icon.
- `BUG-2609-029` — PhoneVerifyNudge i18n half only (token half now resolved, see above).
- `GEN-2609-015` — seat picker illegible tier legend + squished seats, `IN_TEST`, token half looks resolved by `-067` item 6 (unverified this session — someone else may be mid-fix).

**New workflow knowledge worth internalizing (see `-068` step 4):** `design-tokens` CI only triggers on `pull_request`, not push. A local clean run of `check-design-tokens.js` before pushing is NOT proof CI will pass — the PR has to actually be open to see the real result. Consider whether this should become a standing rule in this file's "session-start protocol" (ways-of-working equivalent) rather than tribal knowledge from one incident.

**Carried forward, unchanged (see 13 Sept section below for full context):**
- 🔴 Razorpay + Google Maps/Places QA key rotation — still outstanding since 25 Aug.
- 22 QA-project tables with RLS disabled — flagged repeatedly, no policy pass done. Supabase's own advisor surfaces this on every `list_tables` call; remediation SQL is known but deliberately not auto-applied (would break access without real policies).
- Everything else in the 13 Sept "Open items" section below that isn't explicitly marked resolved above.

## Session-start checklist

1. `git checkout qa && git fetch origin && git reset --hard origin/qa` — HEAD should be `63c646e` (this handoff's own commit; `ee9e47c` is the last feature merge before it).
2. If working from chat: ask Hitesh for a fresh GitHub PAT directly in-conversation. If working from CC: read `CC_HANDOFF.md`.
3. Read this file, then `docs/design.md` for anything logged since.
4. Check Razorpay/Google Maps billing dashboards — still the oldest open item, now 7+ sessions running.
5. The one real product decision blocking nothing else: cancelled/refunded ticket cards, tappable or not (see above). Everything else this session flagged is either verification debt (get real eyes on `qa.aforaudience.com/tickets/`) or carried-forward items that need Hitesh directly (Razorpay/Maps, RLS policy pass).

---

# Session Handoff — 13 Sept 2026, later same day (two follow-up fix dispatches after Step 6 closed)

## qa HEAD: `6d03b48` — GEN-2609-043/047/050/051 all merged and verified. This replaces the earlier 13 Sept handoff (`5776e964`) — supersedes, does not delete, per this project's "fold in rather than discard" convention. That handoff's open items are folded forward below, unchanged except where explicitly resolved this session. The original section immediately below (audit narrative for `-041`/`-042`) is kept intact as history; this session's own work is summarized first.

## This session, in full: two follow-up fix dispatches, both off specs the audit produced

With Step 6 (and the six-step UI/UX audit) closed by the previous session, two more dispatches landed against decisions the audit's own specs had flagged as needing Hitesh's call:

**`GEN-2609-043` + `GEN-2609-047`** (one PR, #616) — `--afa-error` contrast retarget (targeted, not a global swap) + `NotificationOptIn.tsx`'s Enable button restyle. Both were "needs Hitesh's call" items from `-039`/`-041`; both got an actual decision this round, dispatched together.
- `-043`: `--afa-error` the variable stays untouched (`OfflineBanner.tsx` keeps its 6.54:1 pass). Only the CRITICAL severity badge background and dashboard-context `ErrorBanner` usages move to `--afa-red-alt`, per-usage via `style` overrides. **Correction found:** independently reclassifying every `<ErrorBanner>` usage by its real background found **14 real dashboard-context usages, not "~20"** as `docs/accessibility-guidelines.md` estimated — all 14 fixed. Recomputed ratios match the spec's predictions (CRITICAL badge 2.87→4.99:1, banners 2.68→4.65:1). **Residual gap, not solved, documented:** the 3 card/sheet-context banners the spec named (login page, `AuthPromptSheet`, `CorporateInquiryModal`) plus a 4th found independently (`verify-phone/page.tsx`, same `--afa-surface-raised` context) still sit at 4.17:1 even with `--afa-red-alt` — still open, needs a different fix eventually.
- `-047`: the dispatch described reusing "the existing secondary/outline `Button.tsx` variant... extracted during `GEN-2609-042`." **Wrong premise, caught before building:** no such variant existed — `-042` only ever used the pre-existing `primary`/`secondary` ones. Added a new `outline` variant (transparent fill, `--afa-on-fill-solid` border/text — the same token the banner's own message text already sits on) instead of reusing something that wasn't there.

**`GEN-2609-050` + `GEN-2609-051`** (one PR, #617) — `tickets/page.tsx` font migration (3 Georgia hits + 1 missing `fontFamily`) + status-badge color consolidation.
- `-050`: mechanical, confirmed exactly as scoped — 3 section-header `<h2>`s Georgia→`var(--font-display)`, and the companion-guest card's event-title `Link` (which had no `fontFamily` at all, silently inheriting `<main>`'s `system-ui` fallback) got one added. Confirmed it's the only such `Link` in the file.
- `-051`: **wrong premise, caught before building.** The dispatch said `dashboard/organiser/page.tsx`'s `STATUS_STYLE` could be extracted and imported wholesale into `tickets/page.tsx` "instead of redefining `CONFIRMED`/etc." Checked both objects fresh: they don't share a key set at all — organiser's are event-lifecycle states with a `label` field (`DRAFT`/`APPROVED`/`PENDING_APPROVAL`/`CANCELLED`/`COMPLETED`), tickets' are booking-lifecycle states without one (`PENDING`/`EXPIRED`/`CONFIRMED`/`CANCELLED`/`REFUNDED`) — there is no `CONFIRMED` key on the organiser side to redefine. Importing it wholesale would have given tickets the wrong statuses, not consolidated anything. What's genuinely duplicated is the 4 underlying `{bg,color}` tone pairs (gold/sage/error/muted) — extracted those into new `src/lib/statusStyle.ts`, each file still owns its own domain-specific status map built from the shared tones. Zero visual change.

**Verification held for both merges** — PR opened by chat, CI/Vercel green, fresh head-SHA re-fetch before squash-merge, branch deleted, real content re-verified, `qa` deployment READY, zero runtime errors. Both Feedback pairs confirmed `RESOLVED`/`DEPLOYED_QA` (independently re-queried, not assumed).

**No browser/Playwright tool available this session either** (4th session running with this gap) — `-047`'s 360/375/414px visual-separation check and `-050`'s before/after screenshot were reasoned from token values and existing on-page precedent instead of visually confirmed. Flagged, not claimed done.

**New follow-up ticket this session surfaced:** `GEN-2609-052` (`BUILD_QUEUE`, not yet scoped) — CI enforcement, diff-scoped only, to block a new raw hex/rgba literal or hardcoded font-family string outside `globals.css`/`statusStyle.ts` from landing at all. Direct reaction to the pattern across several sessions now (Georgia, `--afa-terracotta`, duplicated status-color literals) where each individual instance was legal at write-time and nothing caught it before merge.

---

# Original session narrative below (13 Sept 2026, Step 6 sub-specs 4-5 of 5: notifications → onboarding — audit complete)

## Session narrative — how it ran

Chat-side session, same three-layer pattern as the prior one: dispatch → CC builds → chat pulls the real diff and independently re-derives CC's own self-reported corrections before merging (not just trusting "CC caught something"). Two dispatches this session, back to back — the fourth and fifth (and final) sub-specs of the original six-step UI/UX audit:

1. **`GEN-2609-041` (notifications)** — catalog-plus-mechanical-fix pass, same shape as `-038`/`-039`/`-040`.
2. **`GEN-2609-042` (onboarding)** — a real feature build, not a docs-and-small-fix pass: a new full-screen component, a schema migration, and a live-DB backfill. Chat gathered requirements interactively via elicitation (three product questions: where phone verification should live, generic-vs-role-specific sequencing, scope size) plus rendered interactive mockups of the three phone-verify-placement options before Hitesh picked one — a new step in this project's dispatch-scoping process, worth carrying forward for future product-shaped (not just technical) specs.

**Net: Step 6 is now 5 of 5 — the entire six-step UI/UX audit is complete.**

## What shipped this session, in full

**`GEN-2609-041` (`d0dbd046`, #614) — notifications guidelines spec.** `docs/notifications-guidelines.md`: catalogued all push-notification call sites. Real finding, re-verified by CC and then independently re-verified by chat again (third layer): chat's own dispatch undercounted at "21 files/25+ sites" — actual figure is **20 files, 31 call sites** (CC's own re-verification first said 19 files before chat caught a further off-by-one between CC's summary text and CC's own table; corrected directly on `qa` via a one-line follow-up commit, `05cac1ff`). Also catalogued: `User` has no `locale` column at all (language switcher is `localStorage`-only, client-side) — so all 31 call sites' hardcoded-English content is a real gap but not a simple string-swap; needs a schema decision, flagged not fixed. The dispatch's proposed `--afa-terracotta` → `--afa-fill-solid` token swap on `NotificationOptIn.tsx` was re-verified and **withdrawn**: the banner's own container already uses `--afa-fill-solid` as its background, so the swap would have made the CTA button invisible against itself. Chat independently confirmed both the collision and that no other locked-palette token (checked every `--afa-amber` usage in the repo) has precedent as a solid-fill button background either. No source code changed — pure docs PR.

**`GEN-2609-042` (`5776e964`, #615) — onboarding welcome sequence.** New `WelcomeSequence.tsx`: full-screen, one-time takeover (Welcome → Verify phone → Enable notifications → next-step card) shown once after signup, mounted at root layout alongside `NudgeStack` (which now suppresses itself via a shared `lib/onboarding.ts` gate while the takeover is active — the same fix that closes the original stacking-banner problem this whole sub-spec started from). Reuses existing logic rather than forking it: OTP request/verify extracted into `useOtpVerification.ts` (shared with `/verify-phone/page.tsx`), push-subscribe extracted into `push-subscribe.ts` (shared with `NotificationOptIn.tsx`). New `User.onboardedAt`/`User.intendedRole` columns, migration applied directly to `aforaudience-qa` via Supabase MCP after Hitesh's explicit go-ahead on the backfill preview (233 rows, 232 already `isVerified`) — chat independently re-queried the live DB before approving (not just trusting the preview) and again immediately after applying (0 nulls, 0 mismatches, both columns confirmed via `information_schema.columns`). Localized across all 11 locales.

Three real corrections CC found on its own re-verification, all independently re-checked by chat via full diff review before merging:
- `intendedRole` already survived an *immediate* login as a URL query param (chat's dispatch assumption that it was dropped was wrong) — the actual gap was a *delayed* login (signup, close tab, log in days later), which is why it's now a persisted `User` column instead.
- Registration already has a mandatory OTP-verification stage before ever reaching `/login` — 232 of 233 real QA users are already `isVerified`. Screen 2 of the sequence only meaningfully matters for registration-abandoners and Google sign-ups (who never collect a phone at all) — it branches into three real cases (already-verified / no-phone-on-file / needs-a-code) rather than one generic form.
- The dispatch's open "is the registration-time OTP still valid by first login" question has a clear technical answer (5-minute TTL on `SIGNUP_VERIFY`) — Screen 2 always issues a fresh send rather than assuming the original is still good. Resolved, not left open.

Chat's own contribution beyond CC's build: caught that CC's phone-verify-location fix left every registration hardcoded to `role: "AUDIENCE"` regardless of `intendedRole` — meaning the final screen's role-aware CTA has to read `intendedRole`, never `session.user.role`, since no real role exists yet at welcome-sequence time (Artist/Organiser/Venue Owner only happens later via the separate apply-and-approve flow). This shaped the dispatch before CC ever started building, not a post-hoc catch.

**Minor open note, not blocking**: `WelcomeSequence.tsx`'s Screen 3 heading is a bare 🔔 emoji — same flagged-not-fixed pattern from `-041` (icon-registry vs. emoji), now duplicated in new code rather than avoided. Logged alongside the existing icon-consolidation item, not a separate ticket.

**Verification chain held for both merges** — PR opened by chat, CI/Vercel green, fresh head-SHA re-fetch immediately before squash-merge, branch deleted, real merged content re-verified via Contents API, `qa` deployment confirmed READY, runtime errors checked (zero both times).

## e2e verification gap — new this session, genuinely inconclusive (not a failure)

`GEN-2609-042` touches real auth/session/registration code, so chat manually triggered the `e2e.yml` workflow against `qa` after merging rather than waiting for the nightly run. **Two consecutive runs — the queued nightly run and chat's own manual dispatch — both got cancelled at the identical step** ("Run e2e suite against live QA"), both after almost exactly ~19 minutes, with every step before and after (checkout, deps, browser install, and the post-test report-upload steps) completing cleanly both times. This pattern (clean bookending, `cancelled` not `failure`, same ~19-minute cutoff twice) points to an external time limit hitting the job rather than a test failure or a code regression — but chat could not confirm the actual cause: the log-download URL redirects to `productionresultssa0.blob.core.windows.net`, which isn't on this sandbox's network allowlist, so no live test output was visible from chat's side either time. **Not re-triggered a third time** — diminishing returns on repeating an opaque failure mode. Worth a real run next time anyone is watching the Actions tab directly (where the actual test names and a possible timeout/quota message would be visible), or investigating whether the GitHub Actions account/org has a duration cap being hit. Filed alongside the existing DevTools reduced-motion gap as a standing verification debt, not resolved.

## Credential/tooling notes

Same pattern as last session: Hitesh pasted a fresh PAT directly into this chat conversation; chat stored it at `/home/claude/afa/token.txt` (chmod 600) for this session's sandbox only — doesn't persist between chat sessions. No `gh` CLI/`GITHUB_TOKEN` in the Claude Code environment — still true, unchanged.

## Open items for next session

**Step 6 — complete.** All 5 of 5 sub-specs shipped (motion, accessibility, icon system, notifications, onboarding). The original six-step UI/UX audit is now fully closed.

**New this session:**
- e2e verification for `GEN-2609-042` — genuinely unresolved, see above. Not a known failure, but not a confirmed pass either.
- `WelcomeSequence.tsx` Screen 3's bare 🔔 emoji heading — same icon-consolidation flag as `-041`, now in two places.
- Push-content localization (`-041`'s headline finding) needs a `User.locale` column + a decision on how the existing client-side `afa-locale` picker persists server-side — still nobody's call has been made on this, it's just documented in `docs/notifications-guidelines.md`.
- Real role-based onboarding (a "you're approved" welcome moment for newly-approved Artist/Organiser/Venue Owner accounts, distinct from this session's signup-time sequence) — flagged as a future idea in `docs/onboarding-guidelines.md`, not scheduled, not built.
- `PhoneVerifyNudge` remains live as the fallback banner for pre-existing unverified users (the 1 real unverified QA user, plus any future account that somehow skips the new sequence) — this is intentional, not a leftover to clean up.

**Flagged in `-041`, still needs Hitesh's call:**
- `--afa-error`'s contrast failure — **partially resolved this session** (`GEN-2609-043`): the CRITICAL badge and 14 dashboard-context `ErrorBanner` usages now retarget to `--afa-red-alt` per-usage. **Still open:** 4 card/sheet-context banners (login page, `AuthPromptSheet`, `CorporateInquiryModal`, `verify-phone/page.tsx`) still sit at 4.17:1 even with the retarget — a real fix here needs something beyond a text-color swap (background context itself may need to change), still undecided.
- `--afa-text-muted`'s AA failure for normal-text use — usage-rule documented, no misuse confirmed yet.
- Icon system consolidation shape, and which version of `calendar`/`tag` should win, and what to do about `map` being two different pictograms under one name — all documented in `docs/icon-system-guidelines.md` Section 5, none scheduled.
- Icon sizing/strokeWidth standardization (4 conventions found, one recommended).
- Emoji-vs-icon-registry crossover (see above, now a 2-instance pattern).
- ~~`NotificationOptIn.tsx`'s Enable button color~~ — **resolved this session** (`GEN-2609-047`, new `Button.tsx` `outline` variant).

**New this later session:**
- `GEN-2609-052` — CI enforcement to block new hardcoded design-token literals (diff-scoped). `BUILD_QUEUE`, not yet scoped further — needs a decision on grep-based vs. ESLint-custom-rule implementation before dispatching.
- The residual card/sheet-context `--afa-error` gap above (4 files, 4.17:1).

**Carried forward, unchanged from before this session:**
- 🔴 **Razorpay + Google Maps/Places QA key rotation** — outstanding since 25 Aug, still the single oldest item on the whole board and the sole blocker on `GEN-2609-005`'s live verification. Needs Hitesh directly.
- `GEN-2609-005` (Checkout + Fee Sheet dark restyle) — `IN_TEST`, blocked purely on the item above.
- `GEN-2609-009` — booking-fee copy fix, replacement copy already drafted, ready to dispatch.
- `GEN-2609-016` — `SeatLayoutPreview.tsx` deprecated `--afa-white` usages, ready to dispatch.
- `GEN-2609-022` — live click-through still not confirmed/`RESOLVED` (status: `BUILD_COMPLETE`).
- `GEN-2609-036` — global filter-tray lift (Option B). Scoped, not dispatched.
- `--afa-black` broken reference (6 hits in `my-feedback/page.tsx`) — logged, not fixed.
- One-off `<h1>` sizes never tiered — `messages/[id]/page.tsx` (22px), `(public)/tours/[slug]/page.tsx` (34px), `ComingSoon.tsx` (36px).
- Type-scale (Section 8.1) and grid-spacing rollout beyond the booking flow — spec exists, never dispatched.
- `Button.tsx`/`Input.tsx` component library — `WelcomeSequence.tsx` is a new (12th) consumer of `Button.tsx` this session, incremental organic growth, still no dedicated rollout push.
- RLS disabled on 22 QA-project tables — flagged, no policy pass done.
- IA question (hamburger drawer duplicating tab-bar items) — still waiting on Hitesh's go-ahead to dispatch.
- `GEN-2608-039` (pg pool `max:1` connection-contention warnings) — not urgent. The recurring `pg` "calling query() while already executing" deprecation warning on `/api/bookings` was seen again in last session's runtime-error check; still not confirmed as the same root cause.
- `GEN-2608-034` (Navarasa event filter) — deferred pending real event volume.
- `GEN-2608-031` — genuinely unclear, needs clarification from whoever filed it.
- Assorted smaller carried-forward notes, not re-verified this session: chat button's ~2px gap above the tab bar, 360px search placeholder clipping, unconfirmed label wrap risk, stale Admin session cache suspicion, unconfirmed `/events` stuck-loading thread, filter-badge missing active-count, `LocationChip` "Pune (IN)" vs "Pune" duplicate-city data quality.
- **DevTools reduced-motion Tab-key/emulation click-through** — still pending, no browser tool available in the chat sandbox across three sessions running now. Same 2-minute spot-check still needed: emulate `prefers-reduced-motion: reduce`, trigger the 5 cataloged animations, confirm all still suppress; Tab through 2-3 `afa-focusable` elements to confirm a visible ring renders.

## Testing gotchas (carried forward, unchanged this session)

- Next.js dev-mode's `<nextjs-portal>` overlay intercepts Playwright clicks on the bottom nav's first item — use `dispatchEvent('click')`, not `.click()`.
- `trailingSlash: true` — always include the trailing slash in Playwright URL globs.
- Login form's identifier field isn't `input.first()` — target `input[placeholder*="AFA code"]` directly.
- `useSearchParams()` requires a `<Suspense>` boundary for `next build` to succeed.
- Locked-palette color checks: grep the actual token *values* in `globals.css`, not just trust a variable name.
- `pkill -f "next dev"` unreliable for killing CC's dev server — verify via served-asset bytes; `taskkill //PID <real-pid>` is the reliable fallback.
- **New this session**: `next build` can transiently hit `JavaScript heap out of memory` from lingering `node.exe` processes plus back-to-back heavy builds in one session — not a code issue. Clear `.next` and retry with `NODE_OPTIONS="--max-old-space-size=4096"` before assuming a real build break.
- **New this session**: the `e2e.yml` workflow's log-download URL redirects to `productionresultssa0.blob.core.windows.net` — not fetchable from the chat sandbox (network allowlist). Live test output during a triggered run is only visible from the Actions tab directly, not from chat.

## Confirmed working QA credentials (all `QaPass!2026`)

`omkar.organiser@aforaudience.qa` (Organiser + Venue Owner), `hrithik.artist@aforaudience.qa` (Artist), `vinayak.venue@aforaudience.qa` (Venue Owner), `atul.audience@aforaudience.qa` (Audience). Admin is Hitesh's own real Google account, protected from reseeds. Local dev-only limitation (unchanged): QA `devOtp` bypass can't be exercised locally, `MSG91_AUTH_KEY`/`MSG91_TEMPLATE_ID` unset in CC's dev environment.

## Session-start checklist

1. `git fetch && git reset --hard origin/qa` — HEAD should be `6d03b48`.
2. If working from chat: ask Hitesh for a fresh GitHub PAT directly in-conversation. If working from CC: read `CC_HANDOFF.md` for its stored-path convention.
3. Read this file, then `docs/design.md` for anything logged since.
4. Check Razorpay/Google Maps billing dashboards — still the single oldest open item on the board.
5. The six-step UI/UX audit is done, plus two follow-up fix dispatches (`GEN-2609-043`/`-047`/`-050`/`-051`) off its flagged decisions. Decide with Hitesh what's next: the residual card/sheet-context `--afa-error` gap, icon consolidation, `calendar`/`tag`/`map` winner, `GEN-2609-052` (CI enforcement, needs scoping), a real e2e re-run/investigation for `-042`, `GEN-2609-036`, one of the two ready-to-dispatch quick fixes (`GEN-2609-009`/`-016`), the Razorpay rotation (needs Hitesh directly), or a new priority entirely.

---

# Session update (chat, 13 Sep, later session) — GEN-2609-052/053, a real merge conflict, and a process fix

**Ships this session:** `GEN-2609-052` (CI enforcement — diff-only check blocking new hardcoded hex/rgba/font-family literals, `.github/workflows/design-tokens.yml` + `scripts/check-design-tokens.js`) and `GEN-2609-053` (component library extraction — `Button`'s new `form-submit` variant, new `Badge` component, `Card` audited with reasons documented for staying unmerged). Both `RESOLVED`/`DEPLOYED_QA`, verified live on `qa.aforaudience.com`, zero runtime errors.

**Real bugs caught in `-052`'s own verification, not just happy-path testing:** the font-family regex's lookahead scanned past the captured value to end-of-line, missing the actual pre-fix Georgia hits (which shared a line with a `var()`-using `color` property); the hex regex collided with this repo's own `// ... (#261)`/`PR #212` comment convention (an all-digit PR number is hex-shaped). Both fixed — quoted-string scoping for hex, captured-value-only scoping for font-family.

**`-053`'s real findings:** `--afa-on-fill-solid` resolves to `--afa-brown-black` (#1A1000, near-black) despite its name — using it for the new `form-submit` button text would have been a real visible regression; used `--afa-cream` instead (verified visually identical to the literal `white` it replaces). `Badge` shipped as two variants (`status`/`status-compact`) after confirming organiser's and tickets' pill chrome genuinely differ, rather than forcing one shape and silently changing whichever file didn't already look that way. `Card` (VenueCard vs `EventCard.tsx`) has 4 real, deliberate differences — documented why it stays unmerged rather than forced.

**A real merge conflict, resolved properly.** CC's local `qa` was stale at `8cecbe9` (predating chat's earlier `#616`–`#619` merges in the same session), so CC independently rebuilt a chunk of `-052`'s own script from scratch, unaware it had already shipped, and `-053`'s branch genuinely conflicted with what `#617`'s `STATUS_TONE` work had already changed in `organiser/page.tsx`/`tickets/page.tsx`. Chat resolved this with an actual local `git clone` + `git merge` (not API guesswork) — only `docs/design.md`'s changelog prose conflicted (both entries kept, in order, plus a correction to a stale cross-reference in `-053`'s entry pointing at the now-deleted duplicate branch); the code files auto-merged clean since the underlying edits didn't overlap. Verified `tsc`-equivalent/design-tokens-check clean on the merge itself before pushing, not assumed.

**Process fix, the actual point of this note:** the root cause of both the wasted duplicate work and the merge conflict was the same thing — CC's local `qa` drifting behind the remote across a mid-session laptop restart. A standing rule (`git checkout qa && git fetch origin && git reset --hard origin/qa` before branching, every session, no exceptions) is now in `CC_HANDOFF.md`'s "Standing rules" section and in CC's own memory (`feedback_sync_qa_before_branching`). Two durable copies on purpose — the file survives even without memory loaded.

**Two now-orphaned duplicate branches deleted** (`feat/gen-2609-052-design-token-ci-check`'s two pushes) — their content is superseded by `#619`'s merged fix; nothing lost, just cleaned up so they don't cause confusion in a future session.

## Open items for next session (updated)

**Resolved, remove from any older list:** `GEN-2609-052` through `-064`/`-065`, all merged into `qa` (`qa` HEAD `0621ed1`). `-059`'s hover-treatment half is still genuinely open (see below) — the radius half that merged was only ever half the ticket.

**GEN-2609-066 (pill-shaped Button sizes) dispatched this session (CC-side), built, pushed, not yet merged — this is the terracotta/button-centralization sweep's actual close.** Added `pill-sm`/`pill-md` to `Button.tsx`'s size scale: `DisplayNameNudge`/`PhoneVerifyNudge` were byte-identical (`pill-sm`), `pwa/InstallPrompt` was genuinely different (`pill-md`) — fixed all 3 `color: 'white'` bugs for free. The would-be 4th instance (`RegisterForm`'s suggestion chip) turned out not to be a `Button`-shaped CTA at all once checked — it's a translucent-tint utility chip, the same pattern `GEN-2609-063` already centralized via `statusStyle.ts`'s `FILL_SOLID_TINT`/`FILL_SOLID_BORDER_TINT` — fixed there instead of adding an unneeded 3rd size, which also resolved its separate `rgba(196,90,52,...)` off-brand color bug. **Found and fixed a real `Button` API gap along the way:** `ButtonAsLink` never supported `onClick` (needed for the nudge components' dismiss-on-click-through), and even the type extension alone wasn't enough — the render branch wasn't spreading anchor props through to `<Link>` at all, so `onClick` would have silently done nothing; both fixed. Repo-wide grep confirms zero remaining pill-shaped `--afa-terracotta` or `rgba(196,90,52,...)` anywhere.

**The pill-button sub-problem is now fully closed. The wider sweep (`GEN-2609-052` through `-066`) still has 2 known, already-flagged items standing — not new, not re-discovered, just still genuinely unresolved and needing Hitesh's call:**
1. `dashboard/artist/edit/page.tsx`'s dashed-outline "+ Add tour stop" button — no `Button` variant supports a dashed border (flagged since `-064`).
2. `layout.tsx`'s `themeColor` / `manifest.ts`'s `theme_color` — coupled to a hardcoded PWA-manifest hex; swapping one side alone breaks a documented invariant (flagged since `-063`).

**Still open, unchanged:**
- 🔴 Razorpay + Google Maps/Places QA key rotation — still the single oldest item, unresolved multiple sessions running.
- `GEN-2609-005` — blocked purely on the above.
- `GEN-2609-009`, `GEN-2609-016` — ready to dispatch, not yet sent.
- `GEN-2609-022` — `BUILD_COMPLETE`, live click-through still not confirmed.
- `GEN-2609-036` — scoped, not dispatched.
- Residual card/sheet-context `--afa-error` gap (4 files, 4.17:1) — needs a decision beyond a text-color swap.
- Icon system consolidation, `calendar`/`tag`/`map` naming collision, icon sizing/strokeWidth standardization — all documented, none scheduled.
- Push-content localization foundation (`User.locale` column + server-side persistence decision) — nobody's call made yet.
- e2e verification gap for `GEN-2609-042` — still genuinely inconclusive from the prior session, not re-attempted this session.
- DevTools reduced-motion Tab-key/emulation click-through — still no browser tool available, now 5 sessions running.
- `GEN-2609-059`'s hover-treatment direction — still needs Hitesh's confirmation (VenueCard already has the richer hover; EventCard's is the plainer one — dispatch's stated direction was backwards).
- **New this session, unrelated to terracotta:** `DisplayNameNudge.tsx`'s own outer banner uses `--afa-orange-tint`/`--afa-brown-dark` plus a literal `#F0D9BF` border — noticed in passing while migrating its button; looks like a pre-dark-theme-migration leftover (light cream palette) sitting right next to the now-dark-themed pill button it wraps. Not investigated further, not in scope for this ticket — flagging so it's not lost.

## Session-start checklist (updated)

1. **`git checkout qa && git fetch origin && git reset --hard origin/qa`** — HEAD should be `0621ed1` until `GEN-2609-066` is merged. This step is now a hard requirement, not a suggestion — see `CC_HANDOFF.md`'s Standing rules section for why.
2. If working from chat: ask Hitesh for a fresh GitHub PAT directly in-conversation. If working from CC: read `CC_HANDOFF.md`.
3. Read this file, then `docs/design.md` for anything logged since.
4. Check Razorpay/Google Maps billing dashboards — still the oldest open item.
5. Merge `GEN-2609-066` (compare URL in `CC_HANDOFF.md`), then take the 2 remaining sweep items and `GEN-2609-059`'s hover direction back to Hitesh — the terracotta/button-centralization sweep itself is otherwise done.

---

# Session update (chat, 13 Sep, later session) — merged GEN-2609-060 through -066, closes the terracotta/button-centralization sweep

**Ships this session:** chat merged `GEN-2609-060` (Badge `micro`/`tag`/`pill` sizes), `-061` (3 remaining terracotta buttons), `-062` (13 duplicate `@keyframes afa-spin` → 1, in `globals.css`), `-063` (repo-wide non-button terracotta migration, real scope ~90 occurrences/~40 files vs the ~27 estimated), `-059` (VenueCard radius fix; hover half correctly stopped on a backwards premise), `-064` (14 remaining button-shaped terracotta sites outside `dashboard/organiser/`, not 13), `-065` (`RegisterForm.tsx`'s real error-color bug, routed to `--afa-error`), and `-066` (pill-shaped `Button` sizes, the sweep's actual close). `qa` HEAD now `c2ad606`. All verified `READY` on Vercel, zero runtime errors after each merge.

**Six real `docs/design.md` merge conflicts, all resolved the same way** — a real local `git clone`+`git merge` (never API guesswork), only the changelog prose ever conflicted, code always auto-merged clean. One flagged cross-branch risk (`-062`/`-063` both touching `dashboard/artist/page.tsx`) was pre-tested locally in an isolated throwaway merge *before* touching `qa` for real — confirmed clean (adjacent but non-overlapping lines), then merged for real with the same result.

**A correction on chat's own earlier work, for the record:** the comparison mockup shown to Hitesh mid-session (before `-059` was dispatched) depicting `EventCard` with a rich hover treatment (lift, shadow, amber) was wrong — built from a stale docs description, not the real code. Verified fresh before merging `-059`: `EventCard`'s hover is a bare border-color transition in `(public)/events/page.tsx`; `VenueCard` already has the richer treatment (`hover-lift-card`'s translateY+shadow plus its own amber border/title-color transition). `-059`'s dispatch had the direction backwards as a direct result of this — CC caught it on re-verification rather than building the wrong thing, and chat independently re-confirmed before merging rather than taking either its own prior mockup or CC's correction on faith.

**Every ticket's own real findings, not re-summarized here** — see `docs/design.md`'s `GEN-2609-059` through `-066` entries for the full detail (wrong-premise corrections, exact per-site before/after values, the `Button` `onClick`/`ButtonAsLink` API gap `-066` found and fixed).

## Open items for next session (updated)

**Resolved, remove from any older list:** `GEN-2609-052` through `-066`, all merged into `qa` (`c2ad606`). The terracotta/button-centralization sweep is done except the 2 items below.

**Still genuinely open — 3 real decisions, not busywork:**
1. `dashboard/artist/edit/page.tsx`'s dashed-outline "+ Add tour stop" button — no `Button` variant supports a dashed border. Needs a decision: add dashed-border support to `Button`, or leave as a documented one-off exception.
2. `layout.tsx`'s `themeColor` / `manifest.ts`'s `theme_color` — coupled to a hardcoded PWA-manifest hex; swapping one side alone breaks a documented invariant. Needs Hitesh's call given the bigger blast radius (anyone who's already installed the PWA).
3. `GEN-2609-059`'s hover-treatment direction — confirmed backwards from what was dispatched (`VenueCard` already has the richer hover; `EventCard`'s is plainer). Needs Hitesh to confirm actual intent before any hover CSS changes are made — most likely direction: give `EventCard` `VenueCard`'s treatment, but that's a guess, not a decision.

**New this session, unrelated to terracotta, not investigated:** `DisplayNameNudge.tsx`'s own outer banner sits on `--afa-orange-tint`/`--afa-brown-dark` plus a literal `#F0D9BF` border — noticed only because its pill button (now dark-themed) sits right next to it. Looks like a pre-dark-theme-migration leftover. Flagged, not scoped.

**Still open, unchanged from before this session:**
- 🔴 Razorpay + Google Maps/Places QA key rotation — still the single oldest item, unresolved multiple sessions running.
- `GEN-2609-005` — blocked purely on the above.
- `GEN-2609-009`, `GEN-2609-016` — ready to dispatch, not yet sent.
- `GEN-2609-022` — `BUILD_COMPLETE`, live click-through still not confirmed.
- `GEN-2609-036` — scoped, not dispatched.
- Residual card/sheet-context `--afa-error` gap (4 files, 4.17:1) — needs a decision beyond a text-color swap.
- Icon system consolidation, `calendar`/`tag`/`map` naming collision, icon sizing/strokeWidth standardization — all documented, none scheduled.
- Push-content localization foundation (`User.locale` column + server-side persistence decision) — nobody's call made yet.
- e2e verification gap for `GEN-2609-042` — still genuinely inconclusive, not re-attempted.
- DevTools reduced-motion Tab-key/emulation click-through — still no browser tool available, now 6 sessions running.
- IA question (hamburger drawer duplicating tab-bar items) — still waiting on Hitesh's go-ahead to dispatch.
- The stray `stash@{0}` — still unresolved, now spanning multiple sessions.
- Card (`VenueCard` vs `EventCard.tsx`) — still deliberately unmerged, 2 real differences remain after `-059` (dimming mechanism, grid/list layout mode); documented, not re-opened.
- New central-control standing rule (per Hitesh, this session): all UI/UX elements must be centrally controlled, the app follows the design system as-is — no deviation expected. Filed in the project's design-system notes. Any future "genuine difference, left as documented exception" finding should be treated as needing an actual resolution under this rule, not a permanent shrug.

## Session-start checklist (this session's version)

1. `git checkout qa && git fetch origin && git reset --hard origin/qa` — HEAD should be `c2ad606`.
2. If working from chat: ask Hitesh for a fresh GitHub PAT directly in-conversation. If working from CC: read `CC_HANDOFF.md`.
3. Read this file, then `docs/design.md` for anything logged since.
4. Check Razorpay/Google Maps billing dashboards — still the oldest open item, now 4+ sessions running.
5. Take the 3 real open decisions above (dashed button, PWA theme-color coupling, `-059` hover direction) to Hitesh — nothing is blocked on investigation, only on his call.

---

# Session update (CC, 13 Sep, later session) — GEN-2609-067, single-pass fix of an 8-item audit; both PRs pushed, awaiting merge

**Ships this session:** all 8 items from a single dispatch framed as "not new investigation — every item already located with exact file:line," fixed in one pass. Re-verified every file fresh against `qa` HEAD `4c8393e` before editing, per standing convention — every count/line-number premise held up this time (no corrections needed, a first for this sweep). Two branches pushed, **neither merged yet** (no `gh` CLI/`GITHUB_TOKEN` in this environment — hand off both compare URLs below rather than merging):

- `fix/gen-2609-067-ui-centralization-audit` (items 1-7): `https://github.com/hiteshshyamchandbanagde-arch/aforaudience/compare/fix/gen-2609-067-ui-centralization-audit?expand=1`
- `docs/gen-2609-067-status-tone-reference` (item 8, its own branch per the dispatch's own sequencing + "one PR or logically split PRs" framing — content is independent of items 1-7's edits, so it branches from the same `qa` point rather than waiting on 1-7's merge): `https://github.com/hiteshshyamchandbanagde-arch/aforaudience/compare/docs/gen-2609-067-status-tone-reference?expand=1`

**Full before/after for all 8 items:**

**1. PWA `theme_color` — resolves the open item flagged since `-063`.** `layout.tsx:119`'s `themeColor` was `var(--afa-terracotta)`, now `var(--afa-fill-solid)`. `manifest.ts`'s hardcoded hex (manifests can't use CSS vars) moved `#C8441A` → `#FF5A36` to match — the two sides are coupled (a documented "swap one side alone and you break the pair" invariant) and both are now on the same value again.

**2. Dashed-button decision — resolves the open item flagged since `-064`.** `artist/edit/page.tsx:330`'s "+ Add tour stop" button: no `design.md` note argued for amber, so `border: 1px dashed var(--afa-terracotta)` / `color: var(--afa-terracotta)` → `var(--afa-fill-solid)` for both, consistent with the rest of the sweep.

**3. `/tickets/` page CTA-orange misuse.** `--afa-fill-solid` is CTA/payment/booking-commit only. "Pay now" (~line 583) was already correct, untouched. "Download ticket (PDF)" (~line 601) and the tag-confirm button (~line 349) were wrongly fill-solid (same visual weight as a payment button) — both changed to a translucent amber outline (`color: var(--afa-amber)`, transparent background, `1px solid rgba(201,151,58,0.4)` border), matching the page's own existing secondary/outline pattern.

**4. Seat-map editor — the real migration gap, most time budgeted here.** `dashboard/venue/[id]/seat-map/page.tsx` had 11 live `--afa-ink`/`--afa-white` hits (count matched the dispatch exactly, unusual for this project). Full migration to dark tokens. **3 of the 11 were real bugs, not just wrong token names:** selection/marker outlines used near-black `--afa-ink` against the already-dark canvas, so "selected" rendered *less* visible than "unselected" — fixed with `--afa-fill-solid`/`--afa-cream` (unambiguous) rather than another dark-ish token that would have kept the same bug under a new name.

**5. Auth-page legacy banners.** `forgot-password/page.tsx:72` + `reset-password/page.tsx:93`'s identical error banners: `var(--afa-terracotta-tint)`/`var(--afa-terracotta)` → `rgba(179,38,30,0.1)` bg / `rgba(179,38,30,0.3)` border / `var(--afa-error)` text. `RegisterForm.tsx:340`'s dev-otp notice: `var(--afa-amber-tint)`/`var(--afa-ink)` → `rgba(201,151,58,0.15)`/`var(--afa-text-primary)`.

**6. Light-mode leftovers — 14 files migrated, plus several bugs found beyond the dispatch's own list** (each confirmed by reading full context first, not blind token-swapping):
- `AudienceChoiceVoting.tsx` had a white card behind already-dark text — invisible text, an actual bug.
- `RatePromptClientPage.tsx:212` had an unlisted `color: 'white'` on a fill-solid button, fixed to `var(--afa-on-fill-solid)`.
- `SeatLayoutPreview.tsx`'s canvas (~line 81) was itself an unlisted light-cream background, fixed to `var(--afa-surface-page)`; that made `TIER_COLORS`'s 6th entry (`var(--afa-ink)`) newly near-invisible, moved to `var(--afa-cream)` — cross-checked against `SeatPicker.tsx` (the other consumer) to confirm the shared fix is correct for both.
- **`FourRooms.tsx:62` / `PhotoCrossfadeBackdrop.tsx:46` are false positives, left untouched** — a near-black-to-near-black radial gradient is a legitimate dark-theme decorative technique, confirmed by reading full context.
- `about/page.tsx` and `dev/razorpay-test/page.tsx` turned out to be **entire pages** still on a legacy light "paper" theme (shared `INK`/`PAPER`/`MIST`/`EMBER` constants), not scattered one-offs — redefined at declaration; a blind redefinition would have silently broken 2 real CTA buttons relying on the old inverted pairing, caught by re-scanning both files after redefining and fixed those 2 sites to the correct `EMBER`/`--afa-on-fill-solid` CTA pairing.
- **Unlisted bonus: closes a previously-flagged open item.** `DisplayNameNudge.tsx`'s outer banner (`--afa-orange-tint`/`--afa-brown-dark`/literal `#F0D9BF` border) — flagged as a leftover in the `-065`/`-066` handoff notes, not on this dispatch's list, fixed anyway as the same family of legacy tokens: → `rgba(201,151,58,0.15)` / `var(--afa-text-primary)` / `var(--afa-amber)` border.

**7. Shadow error-red token.** `availability.ts`'s `filling-fast` badge and `tickets/page.tsx:326`'s `ErrorBanner` both used `--afa-red-alt` (#EF4444), independent of `STATUS_TONE.error`'s `--afa-error` (#B3261E). `tickets/page.tsx`'s override was pure redundancy (`ErrorBanner`'s own default is already `var(--afa-error)`) — deleted outright. `availability.ts` couldn't cleanly import `STATUS_TONE.error` itself (real domain mismatch: this badge is bold/solid/high-urgency, `STATUS_TONE`'s pills are subtle tints for admin/dashboard labels) — kept a distinct value, documented why in a code comment per the dispatch's own escape hatch, pointed at `--afa-error` instead of `--afa-red-alt`. Also fixed an incidental bug in the same object: `sold-out`'s `bg: var(--afa-ink), color: var(--afa-white)` (same light-theme-legacy pairing as item 6) → `var(--afa-brown-black)`/`var(--afa-cream)`, the same pairing already established as `--afa-on-fill-solid`.

**8. Docs correction.** Added a "Status tone system" section (5.1) to `docs/afa-design-tokens-reference.md` documenting `STATUS_TONE`'s 5 real tones (gold/sage/error/muted/orange), its per-domain scoping rule (each page owns its own status→tone map; only the tone is shared), and `Badge.tsx`'s 5 chrome variants with real call sites.

**Full-batch verification:** `tsc --noEmit` clean, `check-design-tokens.js` clean, a real `next build` succeeded, and the dispatch's own repo-wide regex (`--afa-terracotta|--afa-white|--afa-cream-tint|--afa-error-bg|--afa-success-bg|--afa-amber-tint|--afa-ink\b`) across all of `src/` returns zero hits outside `globals.css`'s own definitions, prose comments documenting past migrations, and the 2 confirmed false-positive dark-gradient sites (each carrying its own explanatory comment).

**Not done this session, flagged rather than silently skipped:** the dispatch asked to "log each fixed item to the Feedback table as you go." Supabase MCP tools are available this session, but no project_id or "Feedback" table was identified/confirmed as part of this dispatch — rather than guess at a project or table shape, this is left undone and flagged here for Hitesh or a future session with the right project context to either do or explicitly wave off.

## Open items for next session (updated)

**Resolved, remove from any older list:** the 2 real decisions carried forward since `-064`/`-066` (dashed button, PWA theme-color coupling) are both fixed in `GEN-2609-067` above — pending merge, not pending decision, so drop them from the "needs Hitesh's call" framing once merged. `DisplayNameNudge.tsx`'s orange-tint banner leftover (flagged 2 sessions ago) is also fixed above.

**New, blocking nothing but needs action:**
- Both `GEN-2609-067` branches need review + merge (see compare URLs above) — no CI/Vercel status has been checked from this session since there's no way to watch a PR without `gh`.
- Feedback-table logging for this dispatch's 8 items was not done — see note above, needs either the right Supabase project context or an explicit "skip it" from Hitesh.

**Still open, unchanged from before this session:**
- 🔴 Razorpay + Google Maps/Places QA key rotation — still the single oldest item, unresolved multiple sessions running.
- `GEN-2609-005` — blocked purely on the above.
- `GEN-2609-009`, `GEN-2609-016` — ready to dispatch, not yet sent.
- `GEN-2609-022` — `BUILD_COMPLETE`, live click-through still not confirmed.
- `GEN-2609-036` — scoped, not dispatched.
- Residual card/sheet-context `--afa-error` gap (4 files, 4.17:1) — needs a decision beyond a text-color swap.
- Icon system consolidation, `calendar`/`tag`/`map` naming collision, icon sizing/strokeWidth standardization — all documented, none scheduled.
- Push-content localization foundation (`User.locale` column + server-side persistence decision) — nobody's call made yet.
- e2e verification gap for `GEN-2609-042` — still genuinely inconclusive, not re-attempted.
- DevTools reduced-motion Tab-key/emulation click-through — still no browser tool available, now 7 sessions running.
- IA question (hamburger drawer duplicating tab-bar items) — still waiting on Hitesh's go-ahead to dispatch.
- The stray `stash@{0}` — still unresolved, now spanning multiple sessions.
- `GEN-2609-059`'s hover-treatment direction — still needs Hitesh's confirmation, unrelated to this session's work.
- Card (`VenueCard` vs `EventCard.tsx`) — still deliberately unmerged, documented, not re-opened.

## Session-start checklist (superseded by the section below - kept for history)

1. `git checkout qa && git fetch origin && git reset --hard origin/qa` — HEAD is still `4c8393e` as of this session's end (neither `GEN-2609-067` branch has merged).
2. If working from chat: ask Hitesh for a fresh GitHub PAT directly in-conversation. If working from CC: read `CC_HANDOFF.md`.
3. Read this file, then `docs/design.md` for anything logged since.
4. Check Razorpay/Google Maps billing dashboards — still the oldest open item, now 5+ sessions running.
5. Merge both `GEN-2609-067` branches (compare URLs above) — merge the item 1-7 branch first since item 8's doc content, while independent, documents the fuller "governed palette" picture the audit's items 1-7 are also about. Then take the remaining open items (Feedback-table logging, `-059` hover direction, Razorpay rotation) back to Hitesh.

---

# Session update (CC, 14 Sep) — GEN-2609-068, /tickets/ page rebuilt against the v6 Figma Make export; PR pushed, awaiting merge

**Both `GEN-2609-067` branches confirmed merged at this session's start** (`#634` item 8, `#635` items 1-7) — `qa` HEAD synced fresh to `6a26557` before branching. The 2 real open decisions carried forward from that sweep (dashed button, PWA `theme_color` coupling) are both closed now that `-067` landed; drop them from any older open-items list.

**Ships this session:** `GEN-2609-068` — full rebuild of `src/app/tickets/page.tsx` against the AFA Mobile App v6 Figma Make export's `Tickets.tsx`, used strictly as a visual/structural reference (never as code to copy in), per the standing Mobile Redesign rule that this export's output has repeatedly not matched rendered reality when trusted directly. One branch, not yet merged: `fix/gen-2609-067...` is done; this ticket's branch is `feat/gen-2609-068-tickets-page-v6-redesign`, branched from `qa` at `6a26557`. Compare URL: `https://github.com/hiteshshyamchandbanagde-arch/aforaudience/compare/feat/gen-2609-068-tickets-page-v6-redesign?expand=1`

Full technical detail (every changed file, the reconciliation with `-067` item 3, the real-QA-data verification findings) is in `docs/design.md`'s `GEN-2609-068` entry — this section covers what that entry doesn't: the WCAG contrast math (asked for explicitly, since it's a decision worth tracing back to) and the two things that need Hitesh's actual input.

### WCAG contrast math for the two new tokens (`--afa-sage-bright`, `--afa-error-bright`)

The dispatch's two known reference-design issues: the v6 mockup's status chips hardcoded `#7db873` (confirmed) and `#e05c55` (cancelled) as a workaround for `STATUS_TONE.sage`/`.error`'s real hues failing contrast against their own tinted pill backgrounds. Fixed at the token level, not per-chip.

**Method**: standard WCAG relative-luminance formula (sRGB -> linear via the `c <= 0.03928 ? c/12.92 : ((c+0.055)/1.055)^2.4` piecewise function, `L = 0.2126R + 0.7152G + 0.0722B`), contrast ratio `(L_light + 0.05) / (L_dark + 0.05)`. Backgrounds are the tone's real translucent `bg` composited over `--afa-surface-raised` (#1F1F1F, rgb(31,31,31)) — the actual surface every real consumer (dashboard status pills, this page's status chips) renders on.

**Sage** — `STATUS_TONE.sage.bg` = `rgba(74,103,65,0.12)`. Composited over #1F1F1F: ≈rgb(36,40,35), luminance ≈0.0201. Minimum text luminance for 4.5:1: `L ≥ 4.5×(0.0201+0.05) − 0.05 ≈ 0.2655`. Chosen: `--afa-sage-bright: #7AA86E` → rgb(122,168,110), luminance ≈0.333 → **ratio ≈5.46:1** at the real 0.12 alpha. Re-checked at a hypothetical 0.20 alpha (this dispatch's own upper estimate for "the tinted backgrounds actually used"): background luminance ≈0.0249 → **ratio ≈5.11:1** — still comfortably over 4.5:1.

**Error** — `STATUS_TONE.error.bg` = `rgba(179,38,30,0.10)`. Composited over #1F1F1F: ≈rgb(46,32,31), luminance ≈0.0172. Minimum text luminance for 4.5:1: ≈0.2522. Chosen: `--afa-error-bright: #E67870` → rgb(230,120,112), luminance ≈0.314 → **ratio ≈5.43:1** at the real 0.10 alpha; ≈5.10:1 at a hypothetical 0.20 alpha.

**Cross-check, not just internal consistency**: the existing `--afa-red-alt` (#EF4444, rgb(239,68,68)) — already folded into `--afa-error` elsewhere per `GEN-2609-067` item 7 — measures luminance ≈0.229, giving only **≈4.16:1** against this exact error-tint background. It would **not** have passed AA here. This independently confirms red-alt was never designed for this text-on-tint role, consistent with `-067`'s own reasoning for retiring it.

Both new tokens live in `globals.css` next to the dark-theme token block (not the legacy Phase-0 block `--afa-gold-bright` sits in, since these are freshly verified for the current dark theme) and are wired in as `STATUS_TONE.sage/.error`'s `color`, so every consumer gets the fix, not just this page.

### Two things that need Hitesh's actual input, not just a build decision

1. **Cancelled/refunded ticket cards are fully non-interactive** (ghosted at 55% opacity, no tap-through to the past event) — matches the v6 mockup exactly, but the dispatch explicitly asked to confirm this rather than silently copy it. There's a real argument a dead/past booking's card being tappable (to see the event page, who else attended) is more useful than fully inert. Kept matching the mockup for this pass since it's the simpler, lower-risk default and trivially reversible (the `isGhosted` flag already gates both the opacity and the interactivity in one place in the new `renderCard`). Needs a yes/no from Hitesh.
2. **Feedback-table logging capability gap from `GEN-2609-067`, now resolved** — see below. Not something needing Hitesh's input any more, but worth him knowing it's unblocked.

### Feedback-table gap closed

The last two sessions flagged "no project_id or 'Feedback' table located" as an open capability gap for the "log each fixed item to the Feedback table" instruction. This session found it: **project `aforaudience-qa` (id `nqiyrypmjtogoocerxtu`), table `public.Feedback`, 551 rows** — a real, live, in-app end-user feedback/bug-report feature (`src/app/api/feedback/route.ts`, reviewed at `/dashboard/admin/feedback`), which a concurrent session had *also* independently started using as a lightweight dev-ticket log (category `BUG`/`FEATURE_IDEA`/etc., `status` walking the real build pipeline `NEW → ... → BUILD_COMPLETE → ... → RESOLVED`, human-readable `displayId` like `BUG-2609-037` from a real atomic per-prefix/month counter in `CodeCounter` via `src/lib/codeCounter.ts`). Found all 8 of `GEN-2609-067`'s items already logged there (`RESOLVED`, referencing PR #635/#634) — written by another session after reading this session's own earlier flag, the same "concurrent session closes a flagged gap" pattern this project has hit many times before. Logged this ticket's own 2 entries the same way, `displayId`s `BUG-2609-038`/`BUG-2609-039`, `status: BUILD_COMPLETE` (built + pushed, not yet merged) — replicated the app's real atomic-increment SQL rather than guessing a number, to avoid colliding with a real concurrent user bug report landing in the same table.

**Important**: this table is genuinely dual-purpose — real end-user submissions AND this project's own dev-log convention share one table. Future sessions logging dev-ticket progress here should keep using `fromChatbot: false` and a real `category`/`status`/`displayId` exactly like the rows already there, not invent a separate convention.

### Unrelated finding surfaced by the Supabase tooling itself (not new, already tracked)

Every `list_tables`/schema query against `aforaudience-qa` this session carried a standing advisory: **22 tables have Row Level Security disabled**, fully exposed to the anon/authenticated Supabase client roles. This is the same item already on this file's open-items list ("RLS disabled on 22 QA-project tables — flagged, no policy pass done") — surfacing it again here only because the tool itself insists on it every time, not because it's new. Per the tool's own guidance, no remediation SQL was applied — enabling RLS without real policies would just break access outright. Still needs an actual policy-design pass, still nobody's call made.

### Verification

`tsc --noEmit` clean (confirms all 11 locale dictionary files stayed structurally in sync with the new `pageKicker`/`scanAtDoor`/etc. keys — `Dictionary = typeof en` makes a drift a compile error, not a silent gap), `check-design-tokens.js` clean, real `next build` succeeded, grep of every touched file for hex literals found none live. **No browser tool available this session** (same standing gap, many sessions running now) — real-data verification instead came from direct Supabase MCP queries against live QA booking rows (`atul.audience@aforaudience.qa`, 25 real bookings; `amit.audience@aforaudience.qa`, 0 bookings — confirmed as the real empty-state exercise path) rather than a screenshot. Notable real-data findings: every live booking's `ticketCode` is currently `null` (the new stub row's Ref cell shows an em-dash - a live, common case today, not a rare edge case, and not a bug introduced by this change); no live booking has multiple seat tiers or numbered seats yet, so that part of the stub-row logic is correct-by-schema but not exercised by real data; no live `PENDING` booking exists right now either.

## Open items for next session (updated)

**Resolved, remove from any older list:** `GEN-2609-067` (items 1-8, all merged, `qa` HEAD `6a26557`) — including its 2 carried-forward decisions (dashed button, PWA theme-color coupling). The Feedback-table capability gap is also resolved (see above).

**New this session:**
- `GEN-2609-068` branch needs review + merge: `https://github.com/hiteshshyamchandbanagde-arch/aforaudience/compare/feat/gen-2609-068-tickets-page-v6-redesign?expand=1`
- Decision needed: should cancelled/refunded ticket cards stay non-interactive (current, matches the v6 mockup), or should they tap through to the past event page? See "Two things that need Hitesh's actual input" above.
- `docs/afa-design-tokens-reference.md` doesn't yet document `--afa-sage-bright`/`--afa-error-bright` or the new `StubRow`/`Button outline-neutral`/`Badge icon` additions — worth a small follow-up doc pass once `-068` merges, same spirit as `-067` item 8.
- `SeatLayoutPreview.tsx`/`SeatPicker.tsx`'s seat-tier legend and `checkout/[bookingId]/page.tsx`'s booking-summary line are real `StubRow` reuse candidates, not migrated this pass (flagged in `docs/design.md`, not scheduled).

**Still open, unchanged from before this session:**
- 🔴 Razorpay + Google Maps/Places QA key rotation — still the single oldest item, unresolved multiple sessions running.
- `GEN-2609-005` — blocked purely on the above.
- `GEN-2609-009`, `GEN-2609-016` — ready to dispatch, not yet sent.
- `GEN-2609-022` — `BUILD_COMPLETE`, live click-through still not confirmed.
- `GEN-2609-036` — scoped, not dispatched.
- Residual card/sheet-context `--afa-error` gap (4 files, 4.17:1) — needs a decision beyond a text-color swap.
- Icon system consolidation, `calendar`/`tag`/`map` naming collision, icon sizing/strokeWidth standardization — all documented, none scheduled.
- Push-content localization foundation (`User.locale` column + server-side persistence decision) — nobody's call made yet.
- e2e verification gap for `GEN-2609-042` — still genuinely inconclusive, not re-attempted.
- DevTools reduced-motion Tab-key/emulation click-through — still no browser tool available, now 8 sessions running.
- IA question (hamburger drawer duplicating tab-bar items) — still waiting on Hitesh's go-ahead to dispatch.
- The stray `stash@{0}` — still unresolved, now spanning multiple sessions.
- `GEN-2609-059`'s hover-treatment direction — still needs Hitesh's confirmation, unrelated to this session's work.
- Card (`VenueCard` vs `EventCard.tsx`) — still deliberately unmerged, documented, not re-opened.
- RLS disabled on 22 `aforaudience-qa` tables — re-surfaced by this session's own Supabase queries, not new; still needs a real policy-design pass, not a blanket enable.

## Session-start checklist (this session's version)

1. `git checkout qa && git fetch origin && git reset --hard origin/qa` — HEAD should be `6a26557` until `GEN-2609-068` is merged.
2. If working from chat: ask Hitesh for a fresh GitHub PAT directly in-conversation. If working from CC: read `CC_HANDOFF.md`.
3. Read this file, then `docs/design.md` for anything logged since.
4. Check Razorpay/Google Maps billing dashboards — still the oldest open item, now 6+ sessions running.
5. Merge `GEN-2609-068` (compare URL above), then take the cancelled/refunded-tappability decision and the other still-open items above back to Hitesh.
