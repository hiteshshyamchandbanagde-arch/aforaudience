# Session Handoff — 5 Sep 2026 (Dashboard Shell: #555-#557 merged, BUG-2609-009 brief ready, not yet executed)

`qa` HEAD: `52fe85d` (docs-only, no new code since PR #557). BUG-2609-009's build brief is written and ready to hand to CC as-is - not yet sent/executed as of this write-up.

## 🔴 Next session — priority order

1. **Send BUG-2609-009's build brief to CC (full text below), then run the standard verify-before-merge pass.** This is the largest single batch yet - 13 nested pages across all 3 roles getting wrapped in DashboardShell, zero exceptions (see below for why the earlier "leave 5 task pages alone" plan was revised to "wrap everything"). Given the size, lean hard on CC's own one-page-at-a-time verification discipline, and don't skip spot-checking Create Event and Register Venue specifically for layout regressions - they're the widest/most complex of the 13.

2. **Admin nav (BUG-2609-008), deferred by explicit choice.** `/dashboard/admin/` has the same unwrapped-dashboard gap the other 3 roles had, but Admin's real surface (7 sub-areas: artists/bookings/diary/feedback/revenue/settings/users) is much bigger than a 3-5 item role section fits. Needs a design decision first (does Admin get a role-section at all, or a different nav shape?) before any code.

3. **Rotate Razorpay + Google Places credentials** — still unresolved, only Hitesh can fix.

4. **White-card-on-dark-shell** — still fully open, untouched (unrelated to shell work).

5. **`--afa-terracotta` sweep** — items 7-11 of the theme-migration audit still open (bell emoji, `AuthPromptSheet`/`CorporateInquiryModal`/`SeatPicker`, remaining shared components, dashboard sweep blocked on the gold-contrast question, bare `monospace` fontFamily).

6. **`--afa-gold` dark-on-dark contrast question — still unresolved.**

7. **`--afa-cream-tint-1/2`** — still live in `SeatPicker.tsx`/`LegalDocLayout.tsx`.

8. **Auth desktop brand panel's placeholder stock photo** — swap for real AFA photography when available.

9. **Profile page's two column-eyebrow labels** — deliberately skipped, needs a real i18n translation pass across all 11 locale files if wanted.

## Ready to hand off — BUG-2609-009 build brief

<details>
<summary>Full CC build brief (click to expand if viewing this rendered)</summary>

```
TASK: Fix BUG-2609-009 - extend DashboardShell to ALL 13 nested pages
across Organiser/Venue Owner/Artist. Nothing excluded this round.

Branch from qa HEAD, name it: preview/dashboard-shell-nested-pages
Confirm a clean branch before starting.

CONTEXT: BUG-2609-007 wrapped each role's top-level dashboard. Every
nested page one level deeper still has no shell - just a "Back to
Dashboard" link. Decision: wrap all of them for full consistency, no
exceptions - checked the 2 biggest/most complex ones (Create Event,
Register Venue) for layout risk first; both are narrow single-column
forms (~760-780px), no wide canvas content, safe to wrap like everything
else.

WHAT TO WRAP (wrapper-only, same pattern as Profile/organiser/venue/
artist - import DashboardShell, wrap the existing return, no handler/
fetch/state changes, all early-return branches get it too):

VENUE_OWNER:
- /dashboard/venue/bookings/page.tsx
- /dashboard/venue/sales/page.tsx
- /dashboard/venue/edit/page.tsx
- /dashboard/venue/create/page.tsx

ORGANISER:
- /dashboard/organiser/sales/page.tsx
- /dashboard/organiser/payouts/page.tsx
- /dashboard/organiser/tours/page.tsx
- /dashboard/organiser/events/[id]/page.tsx
- /dashboard/organiser/edit/page.tsx
- /dashboard/organiser/events/create/page.tsx

ARTIST:
- /dashboard/artist/events/page.tsx (heading is "Browse Events")
- /dashboard/artist/corporate-inquiries/page.tsx
- /dashboard/artist/edit/page.tsx

Existing "Back to Dashboard"/"Back to Venues" links can stay -
redundant with the sidebar's own Dashboard link, but harmless.

13 pages is the largest batch yet - go one at a time, verify each live
before moving to the next, don't batch-verify at the end.

VERIFY BEFORE HANDOFF, for each of the 13 pages:
- Persistent sidebar/mobile nav renders correctly.
- Correct nav item shows active-state highlighting where applicable.
- No regression to existing handlers, fetches, state, or the page's
  own internal layout - specifically check Create Event and Register
  Venue render at full usability with the sidebar present (their forms
  are the widest of the 13, confirm nothing wraps awkwardly or feels
  cramped even though the content itself is narrow).
- tsc --noEmit clean. Vercel build READY (local VAPID_SUBJECT failure
  is the known pre-existing gap, not this branch's problem).

DELIVERABLE: Push the branch, deploy to Vercel preview, stop. No PR.
Report preview URL, summary of changes per file, and confirmation of
every verify-before-handoff item above, per page.
```

</details>

**Why the scope grew from "5 pages excluded" to "wrap everything"**: original plan split nested pages into hub-like (repeatedly checked - gets the shell) vs task-like (one-shot forms/creation flows - stays shell-free, on the reasoning that full-bleed focus is better for a long form). Hitesh preferred full consistency instead ("keep all pages on sidebar if there is not harm to do so"). Checked the one real risk that reasoning raised - whether Create Event or Register Venue have wide canvas/seat-map layouts that would clash with a 220px sidebar - and found neither does (both are narrow single-column forms, the actual seat-map builder is a separate later flow). No real harm found, so scope was widened to all 13 pages, zero exclusions.

## What shipped this session, in order

**PR #555 — Audience Dashboard Shell.** New `DashboardShell.tsx`, applied to Dashboard/Messages/Tickets. Fixed BUG-2609-003 in the same pass.

**PR #556 — BUG-2609-004/005.** Profile wrapped in the shell. SiteNav's account dropdown made shell-aware. Badge counts (`useBadgeCounts()`) restored on the shell's own sidebar/mobile nav after a second-order regression from the dropdown fix.

**PR #557 — BUG-2609-006/007.** All 11 role-section sidebar sub-items converted from inert placeholders to real links (11/11 already had real, built pages - the "no destinations yet" claim was never checked and was simply wrong). Each role's own top-level dashboard page (`/dashboard/organiser/`, `/dashboard/venue/`, `/dashboard/artist/`) wrapped in the shell for the first time. Shell's own "Dashboard" nav item made role-aware via `getShellDashboardLink()` (was hardcoded to `/dashboard/audience` for everyone). A suspected mobile-specific role-section rendering bug was investigated and found not to be a real defect - confirmed live this session as a plain page-load timing window (role section briefly absent right after navigation, present a moment later, same on every viewport) - not fixed because there was nothing to fix.

**BUG-2609-009 — scoped and written up, not yet sent to CC.** Extends the shell to all 13 nested pages under the 3 role dashboards, per the discussion above.

All 3 merged PRs independently verified before merge - every diff read directly against the actual pushed branch, deprecated-token/hover-color grep clean throughout, route-existence claims spot-checked against the actual repo, CI green and Vercel READY confirmed pre- and post-merge each time.

## Process notes worth remembering

- **Verify claims about what a page "doesn't have yet" against the actual repo, every time** - BUG-2609-006 existed for one full merged PR because "no destinations yet" was written into a brief and repeated through two verification passes without anyone actually checking. One grep, once someone checked, was the whole fix.
- **Live testing as each actual role catches real bugs that code review alone does not.** Every bug found after #555 (account dropdown duplication, badge regression, dead role links, unwrapped role dashboards + hardcoded Dashboard link, and now the nested-pages gap) was found by Hitesh clicking through the live site as each role in turn - not by anything in the build-verify-merge loop on its own. Treat "test live as every affected role" as a standing step before considering any shared-nav/shell change done.
- **When a design call raises a specific risk, check it against the actual code rather than treating the risk as settled either way.** The "task pages might have wide layouts that clash with a sidebar" concern was worth raising, but turned out false once checked - don't let a plausible-sounding risk go unverified in either direction (assuming it's real, or assuming it's fine).
- A scoping call made in one session can look reasonable in isolation and still be revised once the person actually using the product weighs in on the trade-off - "leave 5 pages alone" wasn't wrong, it was a preference Hitesh was entitled to override once he understood the actual trade-off (which turned out to have no real cost once checked).

## Tally

31 PRs merged total (#527-#557). BUG-2609-009 scoped and ready, not yet executed. Zero pushed-and-awaiting-review as of this write-up. Zero reverted.
