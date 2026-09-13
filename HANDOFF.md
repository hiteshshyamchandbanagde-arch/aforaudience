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

## Session-start checklist (this session's version)

1. `git checkout qa && git fetch origin && git reset --hard origin/qa` — HEAD is still `4c8393e` as of this session's end (neither `GEN-2609-067` branch has merged).
2. If working from chat: ask Hitesh for a fresh GitHub PAT directly in-conversation. If working from CC: read `CC_HANDOFF.md`.
3. Read this file, then `docs/design.md` for anything logged since.
4. Check Razorpay/Google Maps billing dashboards — still the oldest open item, now 5+ sessions running.
5. Merge both `GEN-2609-067` branches (compare URLs above) — merge the item 1-7 branch first since item 8's doc content, while independent, documents the fuller "governed palette" picture the audit's items 1-7 are also about. Then take the remaining open items (Feedback-table logging, `-059` hover direction, Razorpay rotation) back to Hitesh.
