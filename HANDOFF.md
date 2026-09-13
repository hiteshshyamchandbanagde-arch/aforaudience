# Session Handoff — 13 Sept 2026 (Step 6, sub-specs 1–3 of 5: motion → accessibility → icon system)

## qa HEAD: `48c3f43` — GEN-2609-038/039/040 all merged and verified. This replaces the 12 Sept "page-title font decision → 4 audit-correction dispatches → Step 5 built" handoff (`252c748`) — supersedes, does not delete, per this project's "fold in rather than discard" convention. That handoff's open items are folded forward below, unchanged except where explicitly resolved this session.

## Session narrative — how it ran

This was a **chat-side session**, not a CC session: three Step 6 dispatches were drafted here, run through Claude Code in Hitesh's own environment, and each PR reviewed/merged from chat. The pattern held for all three, back to back:

1. Clone `qa` fresh, grep the real codebase for the sub-spec's subject matter, compute/derive real findings (not assumed from prior audit text) before drafting the dispatch.
2. Draft a dispatch prompt that (a) asks CC to independently re-verify chat's own findings rather than trust them, (b) scopes one bounded, mechanical fix to actually ship, (c) explicitly flags anything requiring a visual/design judgment call as documented-not-implemented.
3. When CC's PR came back, pull the real diff and review line-by-line — and this session added a third verification layer beyond the standing one: **independently re-deriving CC's own self-reported corrections**, not just trusting that CC caught something chat missed. All three dispatches produced genuine self-corrections (below), and all three held up under independent re-derivation from chat's own fresh clone. Worth naming as a pattern: CC's self-correction discipline is holding, but re-verifying the correction itself (not just the original claim) is what actually closes the loop.
4. Open the PR (CC only pushes branches, doesn't open PRs — no `gh`/`GITHUB_TOKEN` in that environment, unchanged from before), confirm CI/Vercel green, re-fetch head SHA immediately before squash-merge, delete the branch, verify real merged content via the Contents API (not the diff view), confirm `qa`'s own Vercel deployment READY, check runtime errors via the Vercel MCP tool.

**Net: Step 6 is now 3 of 5 done (motion, accessibility, icon system). Two remain: notifications (visual/content system) and onboarding (one designed sequence) — onboarding flagged as the biggest and most product-decision-heavy of the five, deliberately saved for last.**

## What shipped this session, in full

**`GEN-2609-038` (`d304ce5`, #611) — motion guidelines spec.** `docs/motion-guidelines.md`: catalogued all 5 existing animation patterns (`seatIn`, `afa-push-in`, `afa-sheet-in`/`afa-backdrop-in`, `afa-seal-stamp-in`/`afa-seal-ring-pulse`, plain-hover lifts) with duration/easing/trigger for each. Real finding, not just cataloguing: reduced-motion handling was fragmented across 3 separate `@media (prefers-reduced-motion: reduce)` blocks in `globals.css` — consolidated to 1, mechanical merge, diff-verified no selector dropped, confirmed live post-merge (only one block remains). Easing-custom-properties recommendation flagged, not implemented. Chosen to write retroactively now (resolving the open sequencing question from the prior handoff — motion guidelines technically should have preceded Step 5's animation) rather than wait for the next animation.

**`GEN-2609-039` (`0ed4f48`, #612) — accessibility guidelines spec.** `docs/accessibility-guidelines.md`: real WCAG contrast ratios computed from actual token hex values (not eyeballed) — `--afa-text-muted` fails AA for normal text (3.6:1) but passes for large/UI; `--afa-error` on its own translucent banner background fails badly (2.68:1 on `--afa-surface-page`, worse at 2.40:1 on `--afa-surface-raised` — a real correction CC caught, since the two contexts use different base surfaces and the fix-candidate `--afa-red-alt` clears AA in one context but not the other, 4.66:1 vs 4.17:1). Fixed: `afa-focusable` added to 10 click-guard elements across 8 files (dispatch estimated 8 elements; CC found `EventCard.tsx` and `wall-of-fame/page.tsx` each had two independent click-guard divs — a second real correction, file-list unaffected). Flagged not fixed: `--afa-error`'s 54-file text-color footprint (retargeting the single CSS variable fixes all 54 as text but breaks 2 known background-fill usages, `OfflineBanner.tsx` and a CRITICAL severity badge — not a clean swap either direction, genuinely needs Hitesh's call, likely wants a separate `--afa-error-text` variable rather than a flat retarget); `--afa-text-muted` misuse check. Both corrections independently re-verified by chat via a fresh clone before merging (grepped `DashboardShell.tsx`/`login/page.tsx`/`AuthPromptSheet.tsx`/`CorporateInquiryModal.tsx` directly to confirm the surface-page vs. surface-raised split).

**`GEN-2609-040` (`48c3f43`, #613) — icon system guidelines spec.** `docs/icon-system-guidelines.md`: found 3 parallel icon systems that were never reconciled — `DashboardShell.tsx`'s exported `Icon({name,size})` registry (17 names, built to be shared), `VenuePortalUI.tsx`'s 19 standalone exported `Icon*`/`Icon*Glyph` functions (dispatch's own brief said 17 — CC corrected this, chat independently confirmed 19 via `grep -c`), and `dashboard/admin/page.tsx`'s 7 private/non-exported functions. Of 5 icons believed to overlap by name, real diffing found: `plus`/`x` are pixel-identical (just `<line>` vs `<path>` authoring, chat independently confirmed via coordinate comparison), `calendar`/`tag` genuinely drifted in shape and stroke weight, and `map` isn't drift at all — the registry's version is a folded-paper map, `VenuePortalUI`'s is a location pin, two different pictograms sharing a name (also independently confirmed). `IconClock` is separately duplicated (`VenuePortalUI.tsx` vs. `admin/page.tsx`), independently drawn, not copy-pasted. Fixed: 15 `aria-label` additions across 3 files for icon-only interactive elements with no accessible name — `SiteNav.tsx`'s logged-out account-menu button, 4 bare "×" remove buttons in the seat-map builder, 10 star-rating buttons (the `★`/`☆` glyph alone doesn't convey rating position to assistive tech). This was a real, disclosed-scope sweep (traced every icon-heavy surface from the three icon systems — nav chrome, seat-map builder, rating flows, modals/sheets, save/follow toggles, admin feedback panel) rather than a literal read of all 287 `<button>` elements in the repo; CC was explicit about that boundary rather than overclaiming full coverage. Flagged not fixed: the 3-system consolidation itself (shape documented — extend `IconName` to ~24 concepts, have the other two files import the shared `Icon` — but real visual-diff risk across two full page contexts, out of scope for a spec pass), which version of `calendar`/`tag`/`map` should win, and a sizing/strokeWidth standardization (4 different conventions found side by side, reuse-the-registry's-convention recommended, not imposed). Also surfaced in passing: `IconRupee` in Admin's private set isn't actually a vector icon — it's a text `₹` glyph styled to match — worth knowing before any future consolidation assumes "icon" always means "swappable for an `Icon` registry entry."

**Verification chain held for all three merges.** PR opened by chat each time (branch-only pushes from CC, unchanged pattern) → CI/Vercel green → fresh head-SHA re-fetch immediately before squash-merge → branch deleted → real merged content re-verified via Contents API → `qa` deployment confirmed READY → runtime errors checked. Zero regressions across all three. One pre-existing runtime warning surfaced (`pg` client "calling query() while already executing" deprecation on `/api/bookings`, first seen 28 July, last seen 12 Sept) — confirmed unrelated to any of this session's changes (none of the three PRs touch booking/pg code), not a regression.

## New standing observation this session

**Re-verify the correction, not just the claim.** All three dispatches this session asked CC to independently re-derive chat's own starting numbers before building — and all three came back with genuine, real corrections (VenuePortalUI's 19-not-17 count, the surface-page/surface-raised contrast split, the 8-vs-10 click-guard file count, the calendar/tag/map drift breakdown). Chat then independently re-derived each of those corrections from a fresh clone before merging, rather than accepting "CC caught something" as automatically more trustworthy than "CC's original claim." All three held up. This is a genuine third layer on top of the existing "diff review before merge" and "grep before trusting inherited claims" disciplines — worth carrying forward as its own explicit step, not folded into either of the other two.

## Credential/tooling notes

**This session's PAT was supplied differently from the CC-environment pattern.** This is the claude.ai chat surface, not the Claude Code container — there is no persistent `/home/claude/afa/token.txt` file here; Hitesh pasted a fresh PAT directly into the chat conversation when asked, and chat used it for the session's `git clone`/GitHub API calls in its own ephemeral sandbox. That PAT is now sitting in this conversation's history (flagged to Hitesh in-session); it doesn't persist between chat sessions any more than the CC file-based one persists between CC sessions, but worth Hitesh's awareness rather than assuming either is truly ephemeral. **CC's own environment/PAT-path notes are unchanged this session** — see `CC_HANDOFF.md` for those (this was a chat-only session, no CC environment work happened here beyond running the three dispatches CC-side).

No `gh` CLI/`GITHUB_TOKEN` in the Claude Code environment — still true. Chat opens/merges every PR via the PAT; CC only ever pushes branches.

## Open items for next session

**Step 6 — 2 of 5 remaining:**
- **Notifications** (visual/content system) — not started.
- **Onboarding** (one designed sequence) — not started, deliberately last given it's the most product-decision-heavy of the five.

**Flagged this session, needs Hitesh's call before any dispatch can act on them:**
- `--afa-error`'s contrast failure (54-file text footprint, background-fill conflict with `OfflineBanner.tsx`/a CRITICAL badge) — likely wants a separate `--afa-error-text` variable rather than a flat retarget of the existing token, but that's a design decision, not a dispatch guess.
- `--afa-text-muted`'s AA failure for normal-text use — usage-rule documented, no misuse confirmed yet.
- Icon system consolidation shape (documented in `docs/icon-system-guidelines.md` Section 5) — real visual-diff risk across Venue Portal + Admin Overview, not yet scheduled.
- Which version of `calendar`/`tag` should win, and what to do about `map` being two different pictograms under one name.
- Icon sizing/strokeWidth standardization (4 conventions found, one recommended).

**Carried forward, unchanged from before this session:**
- 🔴 **Razorpay + Google Maps/Places QA key rotation** — outstanding since 25 Aug, still the single oldest item on the whole board and the sole blocker on `GEN-2609-005`'s live verification. Needs Hitesh directly — dashboard access, not dispatchable.
- `GEN-2609-005` (Checkout + Fee Sheet dark restyle) — `IN_TEST`, blocked purely on the item above.
- `GEN-2609-009` — booking-fee copy fix, replacement copy already drafted, ready to dispatch.
- `GEN-2609-016` — `SeatLayoutPreview.tsx` deprecated `--afa-white` usages, ready to dispatch.
- `GEN-2609-022` — live click-through still not confirmed/`RESOLVED` (status: `BUILD_COMPLETE`).
- `GEN-2609-036` — global filter-tray lift (Option B). Scoped, not dispatched. Open design decision: what happens when a filter is applied from a non-events page.
- `--afa-black` broken reference (6 hits in `my-feedback/page.tsx`) — logged, not fixed, not re-verified this session.
- One-off `<h1>` sizes never tiered — `messages/[id]/page.tsx` (22px), `(public)/tours/[slug]/page.tsx` (34px), `ComingSoon.tsx` (36px).
- Type-scale (Section 8.1) and grid-spacing rollout beyond the booking flow — spec exists, never dispatched.
- `Button.tsx`/`Input.tsx` component library — still only in the original 11 files.
- RLS disabled on 22 QA-project tables — flagged, no policy pass done.
- IA question (hamburger drawer duplicating tab-bar items) — still waiting on Hitesh's go-ahead to dispatch.
- `GEN-2608-039` (pg pool `max:1` connection-contention warnings) — not urgent, flagged for before any high-concurrency event. Note: this session's runtime-error check surfaced a `pg` deprecation warning on `/api/bookings` — related family of issue, not yet connected to this ticket, worth checking if it's the same root cause next time this ticket is picked up.
- `GEN-2608-034` (Navarasa event filter) — deferred pending real event volume.
- `GEN-2608-031` — genuinely unclear, needs clarification from whoever filed it.
- Assorted smaller carried-forward notes, not re-verified this session: chat button's ~2px gap above the tab bar, 360px search placeholder clipping, unconfirmed label wrap risk, stale Admin session cache suspicion, unconfirmed `/events` stuck-loading thread, filter-badge missing active-count, `LocationChip` "Pune (IN)" vs "Pune" duplicate-city data quality.
- **DevTools reduced-motion Tab-key/emulation click-through** — flagged in both the `-038` and `-039` handoff entries as never actually run (no browser tool available in the chat sandbox either session). Still pending — worth a real 2-minute spot-check next time anyone's on `qa` in a browser: emulate `prefers-reduced-motion: reduce`, trigger the 5 cataloged animations, confirm all still suppress; separately Tab through 2–3 of the newly-`afa-focusable` elements to confirm a visible ring renders.

## Testing gotchas (carried forward, unchanged this session)

- Next.js dev-mode's `<nextjs-portal>` overlay intercepts Playwright clicks on the bottom nav's first item — use `dispatchEvent('click')`, not `.click()`.
- `trailingSlash: true` — always include the trailing slash in Playwright URL globs.
- Login form's identifier field isn't `input.first()` — target `input[placeholder*="AFA code"]` directly.
- `useSearchParams()` requires a `<Suspense>` boundary for `next build` to succeed — `tsc --noEmit` and dev mode both stay silent about this.
- Locked-palette color checks: grep the actual token *values* in `globals.css`, not just trust a variable name.
- `pkill -f "next dev"` unreliable for killing CC's dev server — verify via served-asset bytes; `taskkill //PID <real-pid>` is the reliable fallback.

## Confirmed working QA credentials (all `QaPass!2026`)

`omkar.organiser@aforaudience.qa` (Organiser + Venue Owner), `hrithik.artist@aforaudience.qa` (Artist), `vinayak.venue@aforaudience.qa` (Venue Owner), `atul.audience@aforaudience.qa` (Audience). Admin is Hitesh's own real Google account, protected from reseeds. Local dev-only limitation (unchanged): QA `devOtp` bypass can't be exercised locally, `MSG91_AUTH_KEY`/`MSG91_TEMPLATE_ID` unset in CC's dev environment.

## Session-start checklist

1. `git fetch && git reset --hard origin/qa` — HEAD should be `48c3f43`.
2. If working from chat: ask Hitesh for a fresh GitHub PAT directly in-conversation (this environment has no persistent token file). If working from CC: read `CC_HANDOFF.md` for its stored-path convention.
3. Read this file, then `docs/design.md` for anything logged since.
4. Check Razorpay/Google Maps billing dashboards — still the single oldest open item on the board.
5. Decide with Hitesh: notifications or onboarding (Step 6's last 2 specs), the flagged design-decision items above (`--afa-error` retarget shape, icon consolidation, calendar/tag/map winner), `GEN-2609-036`, one of the two ready-to-dispatch quick fixes (`GEN-2609-009`/`-016`), or the Razorpay rotation (needs Hitesh directly).
