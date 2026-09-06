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
