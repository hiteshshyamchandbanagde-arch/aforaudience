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
