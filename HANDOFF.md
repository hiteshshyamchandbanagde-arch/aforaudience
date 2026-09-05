# Session Handoff — 5 Sep 2026 (Dashboard Shell merged #555, nav-consistency fix queued)

`qa` HEAD: `8a04ee1`. PR #555 (Audience Dashboard Shell) squash-merged this session. Verified independently before merge (deprecated-token grep clean, no hover-dependent color, color-fix decisions correctly applied, SupportWidget tap-fix confirmed, role sections inert, Vercel build READY both pre- and post-merge). BUG-2609-003 marked RESOLVED/DEPLOYED_QA.

**Post-merge, Hitesh caught a real gap via screenshots** (not a false alarm, not "remove it" territory) — logged as BUG-2609-004, build brief below.

## 🔴 Next session — priority order

1. **Check whether the BUG-2609-004 build brief (below) has been run yet.** If CC has pushed a branch, verify: Profile page now wrapped in DashboardShell + sidebar renders there; SiteNav dropdown correctly hides the 4 duplicate entries on shell pages (Dashboard/Messages/Tickets/Profile) but keeps its full list on non-shell pages (homepage, events, etc.); no regressions to the 3 already-shipped shell pages. If not yet run, build brief is below, ready to hand to CC as-is.

2. **Rotate Razorpay + Google Places credentials** — still unresolved, only Hitesh can fix.

3. **White-card-on-dark-shell** — still fully open, untouched (unrelated to shell work).

4. **`--afa-terracotta` sweep** — items 7-11 of the theme-migration audit still open (bell emoji, `AuthPromptSheet`/`CorporateInquiryModal`/`SeatPicker`, remaining shared components, dashboard sweep blocked on the gold-contrast question, bare `monospace` fontFamily).

5. **`--afa-gold` dark-on-dark contrast question — still unresolved.**

6. **`--afa-cream-tint-1/2`** — still live in `SeatPicker.tsx`/`LegalDocLayout.tsx`.

7. **Auth desktop brand panel's placeholder stock photo** — swap for real AFA photography when available.

8. **Profile page's two column-eyebrow labels** — deliberately skipped, needs a real i18n translation pass across all 11 locale files if wanted.

## In progress — BUG-2609-004, build brief ready

**Root cause**: last session's shell brief explicitly scoped out Profile ("Do NOT touch profile/page.tsx... not part of this shell") as a deliberate call at the time. Once built and viewed end-to-end, that call was wrong: the sidebar's own "Profile" nav item leads to a page with no sidebar (looks broken), and the pre-existing SiteNav account dropdown still duplicates all 4 nav destinations the sidebar now covers on the pages it wraps. This wasn't caught in the verify-before-merge pass because that pass checked code correctness (tokens/colors/structure/inertness), not the nav experience against existing chrome outside the diff. Adding that check to the standing verification list going forward.

<details>
<summary>Full CC build brief (click to expand if viewing this rendered)</summary>

```
TASK: Fix BUG-2609-004 (Dashboard Shell nav-consistency gap) on a NEW
PREVIEW BRANCH. Do NOT touch qa directly. Do NOT open a PR yet.

Branch from qa HEAD (8a04ee1). Name it: preview/dashboard-shell-nav-fix
Confirm a clean branch before starting.

WHAT TO FIX:
1. Wrap src/app/profile/page.tsx in <DashboardShell> the same way
   Dashboard/Messages/Tickets already are (see those 3 files' diffs
   in PR #555 for the pattern - import, wrap the existing return,
   adjust page bg to --afa-surface-page if not already). Preserve
   every handler/API call/state exactly as today - this is a wrapper
   change only, same discipline as the shell's original build.
   Profile's own two-column layout (#554) should render unchanged
   inside the shell's content area.

2. Make SiteNav's account dropdown shell-aware. It currently lists
   Dashboard / Messages / My Tickets / Profile / language switcher /
   location / Sign out on every page. On the 4 pages that now have
   DashboardShell's sidebar (dashboard/audience, dashboard/messages,
   tickets, profile), drop the 4 duplicate nav entries (Dashboard,
   Messages, My Tickets, Profile) from the dropdown - keep language
   switcher, location, and Sign out there, since those aren't in the
   sidebar. On every other page (homepage, events, artists, venues,
   wall-of-fame, etc.) keep the dropdown exactly as it is today - it's
   the only nav to those 4 destinations from outside the shell.
   Implementation approach is your call - e.g. a prop on SiteNav for
   "inside shell" pages, or a route check - whichever fits the
   existing SiteNav structure with the least duplication.

VERIFY BEFORE HANDOFF:
- Profile page has a working, visually-consistent sidebar matching
  the other 3 pages (same active-state highlighting on "Profile").
- Account dropdown shows the trimmed list on all 4 shell pages,
  full list everywhere else - spot check at least one shell page and
  one non-shell page.
- No regression to Profile's existing two-column content, handlers,
  or the 3 already-shipped shell pages.
- tsc --noEmit and next build both clean.

DELIVERABLE: Push the branch, deploy to Vercel preview, stop. No PR.
Report the preview URL, summary of changes per file, and explicit
confirmation of the two verify-before-handoff checks above.
```

</details>

## Process notes worth remembering

- Figma Make → chat-review → CC-build → chat-verify-and-merge continues to work well for catching *code-level* issues (tokens, colors, hover states, inert-ness). It does not automatically catch *cross-cutting nav/UX consistency* issues that only show up when a new shared component is used alongside chrome that predates it and wasn't part of the diff. Add this as a standing check for any future shared shell/nav work: does it duplicate or conflict with nav that already exists on the same pages?
- A scoping call made in one session ("don't touch X, out of scope") can look reasonable in isolation and still be wrong once the built result is seen end-to-end. Worth flagging scope-exclusions explicitly as "provisional, revisit once live" rather than treating them as settled, especially for anything nav/shell-adjacent that touches every page a user might land on.
- Continuing from last session: watch for Figma Make inventing a small *palette* for categorizations (N categories, only 2 non-CTA colors available) as a distinct failure shape from a single stray hex.

## Tally

29 PRs merged total (#527-#555). Zero pushed-and-awaiting-review as of this write-up (BUG-2609-004 build brief given, not yet executed). Zero reverted.
