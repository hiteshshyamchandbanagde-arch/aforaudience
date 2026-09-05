# Session Handoff — 6 Sept 2026

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
