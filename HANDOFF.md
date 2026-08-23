# AFA Handoff — 23 Aug 2026 session (Venue Owner Portal redesign, full arc)

**qa HEAD: `c3580a40e3007663f0100ba8282ab6b2297c66c7`** (PR #531, squash-merged)
(verify fresh at next session start — do not trust this blindly; this repo has
a separate, more active workflow landing PRs outside this thread — see below)

---

## NEXT SESSION — priority order

1. 🔴 Razorpay / Google Maps billing dashboards (manual, Hitesh) — still unconfirmed across many sessions.
2. Re-check local dev DB status fresh — see below, do not assume either "broken" or "fixed" from this doc.
3. **Venue Owner Portal redesign is now functionally complete** (all 6 screens + a real Revenue Overview rebuild). No further design-pass work queued for it unless Hitesh flags something new from a live screenshot, the way BUG-2608-083 through 089 came in.
4. Pick up from "Open items, carried forward" below — nothing is currently blocking any of them, they've just been sitting.

---

## Shipped this session — Venue Owner Portal, start to finish

This thread carried the entire Venue Owner Portal arc in one session, across several dispatches:

1. **Docs commit** (`3c7b833`, `114b1d5`, `9a83eb6`, `58ef9ba`, `f27dedc`) — committed the previously local-only reference docs (`afa-design-tokens-reference.md`, `event-detail-organiser-tab-audit.md`, `search-input-audit.md`), wrote the missing `venue-owner-portal-design-brief.md` (had been referenced for two sessions but never actually committed — resolved now), ran the Figma Make prompt, and wrote `docs/venue-owner-portal-export-audit.md` verifying the export against the brief from raw source.

2. **PR #528 — 6-screen visual port.** Read the Figma Make export directly (`Figma/Review prompt details/`, untracked local folder), ported its styling/layout onto the 6 real routes (`dashboard/venue/{page,edit,sales,bookings,create}.tsx`, `dashboard/venue-requests/page.tsx`) without touching any data-fetching/interaction logic. Built one shared `src/components/dashboard/VenuePortalUI.tsx` kit (Card/Button/StatusPill/PageHead/EmptyState/icons) instead of six copies of hand-rolled styling, as inline styles (not Tailwind) to match the rest of `dashboard/`. Removed every `--afa-terracotta` usage in the 6 touched files.

3. **PR #529 — 3 polish fixes** (BUG-2608-083/084/085) from Hitesh's live screenshot review of the merged port:
   - "Per seat" stat tile no longer shows a bare `—` for non-NUMBERED venues; shows rate type instead.
   - Header pill renamed "Edit Profile" → "Account Settings" (it edits the owner's account, not a venue — confirmed before renaming).
   - Card title/address block got a min-height + line-clamp so mixed-length venue names don't misalign a grid row.

4. **PRs #530/without-number/#089** (BUG-2608-087/088/089) — **landed via the parallel workflow, not this thread**, further iterating on the same card (address-overflow fix, full 2-line address + country flag, then real SVG flags instead of Unicode emoji since Windows doesn't render flag emoji reliably). All three authored directly by Hitesh's account, no Claude Code co-author trailer — confirms the separate, more active chat-based workflow is still operating on this repo in parallel (see item 10 below). This thread's branch for the next piece was fetched fresh off `origin/qa` after these landed, so no conflict.

5. **PR #531 — Revenue Overview full rebuild** (BUG-2608-086). The other 5 screens got a real visual port in #528; Revenue Overview only got wrapper styling with the old chart/table logic underneath — this closed that gap:
   - Added `recharts` (new dependency — first chart library in this repo).
   - Backend (`api/venues/sales-overview/route.ts` + new `getPreviousRangeBounds()` in `lib/sales-range.ts`): previous-period comparison (same-length period immediately preceding `rangeStart`, not a full prior calendar period) + server-computed `avgBookingValue`, both guarded against divide-by-zero.
   - Frontend: real `AreaChart` for revenue-over-time (with a designed `EmptyState` fallback under 3 data points, not an unreadable chart), "By venue" → ranked top-5 horizontal bar chart with a "View all N venues" toggle preserving the full table, "By organiser" visually demoted (smaller/plain, still fully functional), 4 stat cards with ▲/▼ deltas guarded against a nonsensical `∞%` when the previous period has zero data.
   - **Incidental fix, same PR, separate commit**: `Figma/` excluded from `tsconfig.json`. Turned out the known `tsc --noEmit` pollution (see prior handoffs) actually hard-blocks `next build`'s own typecheck too, not just `tsc --noEmit` output — discovered while satisfying this task's own "`npm run build` succeeds" requirement. This is now fixed for good; no future session needs to route around it.
   - Occupancy % was explicitly requested out of scope (no defined metric) — did not invent one.

**Verification pattern used throughout**: `npx tsc --noEmit` (filtered for the pre-existing `Figma/` noise, now moot since it's excluded), live screenshots via a mocked-session + `page.route`-mocked-API Playwright script (same pattern as BUG-2608-081/082) rather than real login, since local DB access proved unreliable at the app level (see below). Every PR branched fresh off `origin/qa`, verified `ahead_by`/`behind_by` before push, and was handed to Hitesh as a `compare/qa...branch?expand=1` URL (no `gh` CLI on this machine) — Hitesh merged all of #528/#529/#531 manually.

---

## 🔴 Carried-forward blockers

**Razorpay and Google Maps/Places billing dashboards** remain unchecked across many sessions now, including this one (not touched — outside Claude Code's access, needs Hitesh directly). First thing to do next session, before anything else.

**Local dev DB — status is genuinely mixed, don't trust either extreme.** Confirmed unreachable (P1001) across 3+ sessions through early this session. Mid-session, `npx prisma db execute --stdin <<< "SELECT 1;"` succeeded and a raw TCP connect to the Supabase pooler host succeeded too — but a real `npm run dev` + real login attempt still hit the identical P1001 on the app's first live query. **Conclusion: a Prisma CLI success does NOT mean the running app can reach the DB** — always verify with an actual dev-server request, not just the CLI, before trusting local dev for screenshots/manual QA. Fell back to mocked-session Playwright every time this session, same as BUG-2608-081/082. Worth actually diagnosing (connection pooling / driver adapter config) rather than continuing to route around it indefinitely.

---

## Local-only docs — now resolved

`docs/afa-design-tokens-reference.md`, `docs/event-detail-organiser-tab-audit.md`, `docs/search-input-audit.md`, and `docs/venue-owner-portal-design-brief.md` are all committed now (see "Shipped this session" above). Nothing left uncommitted from this list as of this session's end — confirm with `git status` at next session start in case anything new has accumulated since.

---

## `Figma/` tsc/build pollution — now resolved

Previously flagged across two handoffs as "worth `.gitignore`-ing or excluding, didn't do it, out of scope." This session it became blocking (see PR #531 above) and got fixed for real: `Figma/` is now in `tsconfig.json`'s `exclude`. Both `npx tsc --noEmit` and `next build`'s typecheck are clean of it going forward. No action needed next session — just don't be surprised if you don't see the old ~160-line noise anymore, that's expected now.

---

## Open items, carried forward

1. 🔴 **Razorpay and Google Maps/Places API billing dashboards** — see above.

2. **Local dev DB (P1001 at the app level)** — see above. Status is unstable/mixed, not simply "broken" or "fixed." Re-verify fresh each session with a real dev-server request, not just the Prisma CLI.

3. **Standalone `/organisers` directory page** — still fully stale/pre-Phase-2c, still orphaned from real nav (zero inbound links). Needs Hitesh's call: give it a nav entry point and redesign it, or leave it as dead weight. Untouched again this session (out of scope for everything shipped here).

4. **GEN-2608-073** — Artist directory cards (real-photo ones) still read as "too basic/ordinary." Still NEW. No design direction agreed — needs a real conversation with Hitesh before building anything.

5. **Empty-state design gap** — 1,140 approved QA venues, only 22 have facilities data, only 1 has a seat map. Never designed. Hitesh hasn't picked a direction: (a) design a real sparse/empty state, or (b) treat it as a data problem and push owner-side facility/seatmap entry instead.

6. **Owner card city field** — export shows a city row with no backing schema/API field. Needs Hitesh's call: add it for real, or rule it out of scope. (Not to be confused with the venue-card city eyebrow, which is real and already shipped.)

7. Figma MCP raw-source access for Figma Make files — still unconfirmed (Claude Code local file reads at `Figma/Review prompt details/` were the workaround this entire session, worked fine).

8. **A pre-existing `git stash` on `qa`** (`WIP on qa: bb8613e Merge pull request #50...`) — still present, still untouched, contents/owner still unknown. Worth asking whoever created it whether it's still needed before it gets forgotten.

9. **Revenue Overview's real-data trend-line threshold is unverified against live QA data.** The empty-state cutoff (`timeline.length < 3`) was only demonstrated on synthetic Playwright fixtures this session (no reliable DB access to check real spread). Worth checking on `qa.aforaudience.com` post-deploy whether real venue owners are actually landing in the chart view or the empty state, and whether 3 is the right threshold.

10. **The separate, more active chat-based Claude workflow is still operating on this same repo, confirmed again this session** (BUG-2608-087/088/089 landed directly, no Claude Code co-author trailer, while this thread was mid-task on the Revenue Overview rebuild — this thread's branch for that work was fetched fresh after they landed, so no conflict occurred, but it could have). Remote branch count is now **99** (up from ~70+ noted two sessions ago), still spanning `feat/`, `fix/`, `docs/`, `toast-rollout/` prefixes across payments, seat-map, push notifications, admin, etc. This handoff doc only covers this thread's own continuity, not full repo state — don't treat it as complete awareness.

11. ~~`Figma/` pollutes `tsc --noEmit`/`next build`~~ — **resolved this session**, see above.

12. ~~Venue Owner Portal design pass~~ — **resolved this session**, see above.

---

## Still on the horizon (unchanged from prior sessions)

- Port Figma Make designs into the actual codebase for the remaining un-ported export folders under `Figma/` (website "AFA Website V1" dark editorial bento, mobile "AFA Mobile App" original tab, "Homepage with Header", "Organiser Profile Page Design", "Redesign Venues Directory Pages", "Event management app") — not started for any of these. Venue Owner Portal (`Review prompt details/`) is the only one ported so far.
- Four Rooms icon/typography treatment (GEN-2608-071) — deferred.
- Venue Owner landing page (public-facing, not the dashboard) — queued after artist pages confirmed (still mid-fidelity-review per GEN-2608-073 above). Organiser landing page (the standalone `/organisers` directory) is its own open item (#3 above).
- Seat-map remaining open items (architecture already shipped, PRs #147–#151, #193) — per-zone price input on Manual Canvas, grid-generator vs. draw-it-myself redundancy, cross-level zone pricing aggregation bug, no visual layout preview at event creation, curved/angled rows + balcony-as-distinct-tier not built, full venue snapshot/lock deferred.

---

## Reminders that don't change session to session

- Session-start: verify qa HEAD fresh (don't trust this doc's SHA blindly — this repo has a parallel workflow moving it), cross-check against `docs/design.md` before treating anything as open.
- Brief and build stay separate steps for design-fidelity-sensitive work — quote exact export values / diagnose before building. This session's docs-then-build sequence (design brief → Figma Make prompt → export audit → port) is the reference example going forward.
- PR workflow: feature branch off fresh `origin/qa` → push → PR → CI → squash-merge → delete branch, all targeting `qa`, never `main`. **On this specific machine, `gh` CLI and any GitHub token are unavailable** — Claude Code pushes a branch and hands over a pre-filled compare URL; Hitesh opens/merges manually until/unless a session runs somewhere `gh` is installed. All three of this session's PRs (#528, #529, #531) followed this exact pattern.
- When local dev DB access is uncertain, verify with a real dev-server request before trusting it — a Prisma CLI success alone is not sufficient (see this session's finding above). Mocked-session + `page.route`-mocked-API Playwright is the fallback verification method, used successfully across BUG-2608-081/082 and this entire session.
- `CodeCounter` has drifted from real max displayId at least twice before — worth a quick sanity check each time before using it rather than assuming it's in sync (not touched this session).
- No GitHub Copilot on this project at all. Only Claude (chat) and Claude Code.
- HARD PRODUCTION FREEZE still in effect — no qa→main merges, no prod Supabase touches, no Razorpay live keys, until Hitesh's explicit "company registered" signal. Company registration is complete, PAN received; current account and GST still pending.
