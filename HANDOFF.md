# AFA Handoff — 23 Aug 2026 session (BUG-2608-082 close-out)

**qa HEAD: `5c158af5643252c93343578ab729aa23b85a62cc`** (PR #527, squash-merged)
(verify fresh at next session start — do not trust this blindly)

---

## NEXT SESSION — priority order

1. 🔴 Razorpay / Google Maps billing dashboards (manual, Hitesh) — still unconfirmed across many sessions.
2. Confirm local dev DB (P1001) status — see below, now confirmed recurring across 3+ sessions.
3. **Venue Owner Portal — next real task, nothing blocking it now.** Brief
   is already written and ready (`venue-owner-portal-design-brief.md`).
   Step 1 token-extraction is superseded by
   `docs/afa-design-tokens-reference.md` (still local-only, see below —
   reuse it, don't redo Step 1). Go straight to Step 2: run the Figma
   Make prompt. See full section further down this doc for details.

---

## Shipped this session — BUG-2608-082 (Organiser Profile event cards)

Picked up the diagnostic the prior session queued (Hitesh's screenshot
flag: "DETAILS →" reads as the only clickable element on Upcoming/Past
event cards on `/organisers/[id]`). Two-step flow, diagnosis before fix:

1. **Diagnosis (findings only, no fix)**: quoted `EventDateCard`'s JSX —
   the whole card was already wrapped in one outer `<Link>`, so it *was*
   already single-click-navigable end to end (not a broken-navigation
   bug, contrary to what the screenshot suggested). Two real gaps
   confirmed instead: (a) the card had none of the
   `navigatingId`/spinner/dim click-guard affordances that
   `OrganisersGridEmbed.tsx`/`VenuesGridClient.tsx` give their tiles —
   different, simpler implementation, not the same pattern; (b)
   "DETAILS →" was `rgba(245,245,240,0.4)` (dim gray, same shade as
   muted secondary text) and only turned amber on whole-card hover
   alongside the title — no distinct actionable-text cue at rest.

2. **Fix — PR #527 (`1cddcc8` → squash-merged as `5c158af`)**:
   - Lifted `navigatingId` state to `OrganiserPage` (shared across
     Upcoming + Past so any in-flight card navigation dims/disables
     every other card as one group, matching the reference grids).
   - Added a spinner overlay + double-click guard on the clicked card.
     Kept the real `<Link>` (not a `div role="link"` rebuild) — the new
     `onClick` only intercepts plain left-clicks (checks
     button/ctrl/meta/shift/alt) so prefetch, right-click, and
     middle-click-new-tab all still work unmodified.
   - "DETAILS →" is now permanently `var(--afa-amber)` (matching the
     page's own "View all N" button, which was already unconditionally
     amber) instead of hover-gated gray; hover now adds an underline
     instead of relying on color alone.

**Verification** (local dev DB is still down — see 🔴 below — so this
followed the same mocked-API Playwright workaround as BUG-2608-081):
`npx tsc --noEmit` clean (0 new errors — the raw run shows ~160 lines
but all of them are pre-existing noise from the untracked `Figma/`
export directory, see below, confirmed by re-running with it excluded);
live screenshots of default state (amber DETAILS→), hover (underline),
and a network-throttled mid-navigation capture showing the spinner
overlay + dimmed sibling card; rapid double-click produced no
console/page errors and no double-navigation; ctrl-click opened a new
tab to the correct URL while the origin tab stayed put.

**Note on this machine specifically**: no `gh` CLI and no
`GITHUB_TOKEN`/`GH_TOKEN` available here, so the branch was pushed and
handed off as a pre-filled `compare/qa...branch?expand=1` URL rather
than opened via `gh pr create` — Hitesh opened and merged PR #527
manually. If a future session runs on a machine with `gh` available,
prefer that; this is a per-machine constraint, not a repo-wide one.

---

## 🔴 Carried-forward blockers

**Razorpay and Google Maps/Places billing dashboards** remain unchecked
across many sessions now, including this one (not touched — outside
Claude Code's access, needs Hitesh directly). First thing to do next
session, before anything else.

**Local dev DB unreachable, now confirmed across at least three
sessions.** `npm run dev` hits Prisma `P1001: Can't reach database
server` on every DB-backed route (`/api/artists`, `/api/organisers`,
`/api/events`, NextAuth login, etc.) — reconfirmed again this session
via live `curl` against `/api/organisers/`. This is a standing
environment issue at this point, not a fluke — worth actually
diagnosing (DB service state / connection string / network) rather
than continuing to route around it with Playwright API mocks every
session.

---

## New this session — `Figma/` export directory pollutes `tsc --noEmit`

The untracked `Figma/` directory at the repo root (multiple Figma Make
export folders, each with their own unbuilt `vite.config.ts` and no
local `vite`/`@vitejs/plugin-react`/`@tailwindcss/vite` installed)
falls inside `tsconfig.json`'s `**/*.ts`/`**/*.tsx` include with no
matching exclude, so a plain `npx tsc --noEmit` picks up ~160 lines of
unrelated `Cannot find module 'vite'` / implicit-`any` errors from
files that were never meant to be type-checked as part of this app.
Confirmed this session by re-running with a scoped tsconfig excluding
`Figma/`+`docs/` → 0 errors (and no Prisma-noise baseline either,
contrary to what an earlier handoff described — that baseline may have
predated `Figma/` existing, or predated a Prisma client regen).
**Worth either `.gitignore`-ing `Figma/` for real or adding it to
`tsconfig.json`'s `exclude`** so future sessions' `tsc --noEmit` runs
aren't muddied by it — did not do this myself since it's a repo-hygiene
change outside this bug's scope, flagging instead.

---

## Local-only docs — still not committed anywhere

Unchanged from the prior handoff: `docs/afa-design-tokens-reference.md`
and `docs/event-detail-organiser-tab-audit.md` are real reference docs,
still untracked in the local working directory, never committed or
pushed. `docs/search-input-audit.md` is also still untracked
(provenance still unclear). All three survived this session's checkout
resets untouched. Worth committing at least the tokens-reference doc
somewhere durable, since it's now been reused as the styling source of
truth across two sessions running.

---

## Open items, carried forward

1. 🔴 **Razorpay and Google Maps/Places API billing dashboards** — see above.

2. 🔴 **Local dev DB (P1001)** — see above. Now 3+ sessions; worth
   actually diagnosing.

3. **Standalone `/organisers` directory page** — still fully
   stale/pre-Phase-2c, still orphaned from real nav (zero inbound
   links). Needs Hitesh's call: give it a nav entry point and redesign
   it, or leave it as dead weight the way it's been treated so far.
   Untouched again this session (deliberately out of scope for
   BUG-2608-082).

4. **GEN-2608-073** — Artist directory cards (real-photo ones) still
   read as "too basic/ordinary." Still NEW. No design direction agreed
   — needs a real conversation with Hitesh before building anything.

5. **Empty-state design gap** — 1,140 approved QA venues, only 22 have
   facilities data, only 1 has a seat map. Never designed. Hitesh
   hasn't picked a direction: (a) design a real sparse/empty state, or
   (b) treat it as a data problem and push owner-side facility/seatmap
   entry instead.

6. **Owner card city field** — export shows a city row with no backing
   schema/API field. Needs Hitesh's call: add it for real, or rule it
   out of scope.

7. Figma MCP raw-source access for Figma Make files — unconfirmed again
   this session (the Figma MCP connection dropped mid-session before it
   was tested either way). Claude Code local file reads remain the
   workaround regardless.

8. **A pre-existing `git stash` on `qa`** (`WIP on qa: bb8613e Merge
   pull request #50...`) — still present, still untouched, contents/
   owner still unknown. Worth asking whoever created it whether it's
   still needed before it gets forgotten.

9. ~~Leftover remote branch `fix/artists-search-flex-grow`~~ — **resolved**,
   confirmed gone from `origin` this session (along with
   `fix/organiser-event-card-click-guard-BUG-2608-082`, this session's
   own branch, auto-deleted on merge as expected).

10. **A large number of `origin` branches unrelated to this thread's own
    work** (~70+, spanning `feat/`, `fix/`, `docs/`, `toast-rollout/`
    prefixes — payments, seat-map, push notifications, admin, intro
    splash, toast rollouts, etc.) were visible via `git ls-remote` this
    session. None of this thread's sessions touched or tracked them —
    consistent with the known parallel chat-based Claude workflow
    operating on this same repo (see the handoff-collision note from
    22 Aug). Not investigated further this session; flagging only so
    the next session doesn't mistake this doc for full repo awareness —
    it only covers the Organisers-round thread's own continuity.

---

## Venue Owner Portal (not started, ready to kick off — now top priority)

Hitesh shared 6 screenshots of the live Venue Owner dashboard (Your
Venues, Edit Profile, Revenue Overview, Booking Requests calendar,
Flexible Requests, Register Venue form) — flagged as visually the odd
one out on the whole platform: plain white calendar grid, default form
styling, an almost-empty revenue chart, no illustration/duotone
treatment anywhere. Functionally solid, never had a design pass.

A two-step design brief is ready (`venue-owner-portal-design-brief.md`):

1. **Step 1 (would normally be sent to Claude Code first, read-only)**:
   extract a real design-token/pattern reference from the shipped
   codebase — already done, superseded by
   `docs/afa-design-tokens-reference.md` (see "Local-only docs" above)
   — reuse that instead of redoing this step from scratch.
2. **Step 2**: paste that output into the Figma Make prompt (already
   drafted, covers all 6 screens as one cohesive portal) and run it.

**Still not sent to Claude Code — still the next thing to do**, once
the 🔴 billing dashboard check and DB status are out of the way. Two
sessions running now where this got bumped by other work (Organisers
round, then this session's BUG-2608-082 close-out).

---

## Still on the horizon (unchanged from prior sessions)

- Port Figma Make designs into the actual codebase (website "AFA
  Website V1" dark editorial bento, mobile "AFA Mobile App" original
  tab) — not started for either.
- Four Rooms icon/typography treatment (GEN-2608-071) — deferred.
- Venue Owner landing page — queued after artist pages confirmed
  (still mid-fidelity-review per GEN-2608-073 above). Organiser landing
  page (the standalone `/organisers` directory) is its own open item
  (#3 above).
- Seat-map remaining open items (architecture already shipped, PRs
  #147–#151, #193) — per-zone price input on Manual Canvas, grid-
  generator vs. draw-it-myself redundancy, cross-level zone pricing
  aggregation bug, no visual layout preview at event creation,
  curved/angled rows + balcony-as-distinct-tier not built, full venue
  snapshot/lock deferred.

---

## Reminders that don't change session to session

- Session-start: verify qa HEAD fresh (don't trust this doc's SHA
  blindly), query Feedback table (NEW/REVIEWED, esp. BUG) — **not done
  this session** (no DB/Supabase access available — same P1001 issue),
  cross-check against `docs/design.md` before treating anything as
  open.
- Brief and build stay separate steps for design-fidelity-sensitive
  work — quote exact export values / diagnose before building. This
  session again did diagnosis-then-fix as two explicit steps
  (BUG-2608-082) — keep doing that for anything design/UX-flagged.
- PR workflow: feature branch off fresh `origin/qa` → push → PR → CI →
  squash-merge → delete branch, all targeting `qa`. **On this specific
  machine, `gh` CLI and any GitHub token are unavailable** — Claude
  Code can push a branch and hand over a pre-filled compare URL, but
  cannot open/merge the PR itself here; Hitesh does that step manually
  until/unless a session runs somewhere `gh` is installed.
- `CodeCounter` has drifted from real max displayId at least twice
  before — worth a quick sanity check each time before using it rather
  than assuming it's in sync (not re-checked this session).
- No GitHub Copilot on this project at all. Only Claude (chat) and
  Claude Code.
- HARD PRODUCTION FREEZE still in effect — no qa→main merges, no prod
  Supabase touches, no Razorpay live keys, until Hitesh's explicit
  "company registered" signal. Company registration is complete, PAN
  received; current account and GST still pending.
