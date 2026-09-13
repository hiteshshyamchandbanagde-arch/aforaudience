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
