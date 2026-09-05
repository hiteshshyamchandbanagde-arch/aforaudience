# Session Handoff — 5 Sep 2026 (Audience Dashboard Shell — build brief written, not yet built)

`qa` HEAD: `ec7537a`. No code changes this session — export review + build-brief-writing only. Nothing pushed and awaiting review.

## 🔴 Next session — priority order

1. **Check whether the dashboard shell build brief has been run yet.** If Claude Code has pushed `preview/dashboard-shell`, this is the first thing to verify (branch SHA/file list match claim, grep for the 3 color fixes below, confirm role-section items are genuinely inert with no working links, confirm BUG-2609-003's fixes landed) before opening a PR — same process as PRs #553/#554. If not yet run, the build brief is below, ready to hand to CC as-is.

2. **Rotate Razorpay + Google Places credentials** — still unresolved, only Hitesh can fix.

3. **White-card-on-dark-shell — still fully open, untouched.**

4. **`--afa-terracotta` sweep** — items 7-11 of the theme-migration audit still open (bell emoji, `AuthPromptSheet`/`CorporateInquiryModal`/`SeatPicker`, remaining shared components, dashboard sweep blocked on the gold-contrast question, bare `monospace` fontFamily).

5. **`--afa-gold` dark-on-dark contrast question — still unresolved.**

6. **`--afa-cream-tint-1/2`** — still live in `SeatPicker.tsx`/`LegalDocLayout.tsx`.

7. **Auth desktop brand panel's placeholder stock photo** — swap for real AFA photography when available.

8. **Profile page's two column-eyebrow labels** — deliberately skipped, needs a real i18n translation pass across all 11 locale files if wanted.

9. **BUG-2609-003** (leftover terracotta + Messages' white-card fallback) — folded into the dashboard shell build brief below, will get fixed as part of that pass rather than separately.

## In progress — Audience Dashboard Shell, build brief ready

Figma Make export ("AFA Audience Dashboard Shell") reviewed this session. Structurally clean — role-section sidebar/drawer items have no `onClick`/`href` (genuinely inert), only 7 distinct hex values used, no stray colors beyond what's listed below. Full review detail in `docs/design.md`'s "Figma Make Export Review" section.

**Three color decisions made, all confirmed by Hitesh:**
- Rejected the export's invented muted-gray `#9C9C96` (35 occurrences) — same call as the profile-page round, use `var(--afa-text-primary)` + opacity instead.
- Rejected orange on both "Browse Events →" links (Dashboard/Tickets empty states) — orange is CTA-only, these are nav links, should be amber.
- Rejected 3 distinct colors for message thread type tags (booking/venue-booking/performance) — collapsed to one amber treatment for all three, differentiated by label text only, since the locked palette only has 2 non-CTA colors.

**Build brief written and handed to Hitesh, full text below for reference / to re-paste if needed:**

<details>
<summary>Full CC build brief (click to expand if viewing this rendered)</summary>

```
TASK: Build the audience dashboard shell from a Figma Make export onto a
NEW PREVIEW BRANCH. Do NOT touch qa directly. Do NOT open a PR yet.

Branch from qa HEAD (ec7537a). Name it: preview/dashboard-shell
Confirm a clean branch before starting.

SOURCE: Design_AFA_Dashboard_Shell.zip - a Figma Make code export
(React/Vite), single-file App.tsx (~750 lines).

WHAT TO BUILD:
1. New shared shell component implementing:
   - Desktop: persistent left sidebar, 220px wide, two tiers - top tier
     always rendered (Dashboard/Tickets/Messages/Profile, linking to
     real routes /dashboard/audience, /tickets, /dashboard/messages,
     /profile), below that one section per role (Organiser/Artist/
     Venue Owner) rendered ONLY if the account holds that role (reuse
     existing role-check logic), items styled as inert placeholders
     (no onClick/href).
   - Mobile: bottom tab bar (same 4 top-tier items) + "More" button
     opening a drawer with the same inert role sections.
   - Keep the existing global top bar untouched, out of scope.
2. Apply the shell to 3 real pages: dashboard/audience/page.tsx,
   dashboard/messages/page.tsx, tickets/page.tsx. Preserve every
   handler/API call/state exactly as today - layout/styling change
   only, same discipline as the auth-pages and profile-page rounds.
   Do NOT touch profile/page.tsx - stays exactly as shipped, not part
   of this shell.

REQUIRED FIXES (don't copy verbatim from export):
1. Replace the export's #9C9C96 muted-gray (35 occurrences) with
   var(--afa-text-primary) + opacity. Check each spot for nested
   links/buttons first (the bug class already fixed on auth pages) -
   scan suggests all clear, but verify.
2. Both "Browse Events ->" links use orange - change to
   var(--afa-amber), same fix pattern as elsewhere this session.
3. Collapse the 3 message-thread type tag colors to one amber
   treatment, differentiate by label text only.
4. Fold in BUG-2609-003's fixes since these files are being touched
   anyway: Messages' read-thread rows currently fall back to
   var(--afa-cream, #fff) on the live page - fix to a correct dark
   tone (export's own MessagesPage already does this right, port that
   pattern). Dashboard's "Browse events" link and Tickets' status
   badges/buttons currently use leftover --afa-terracotta - fix each
   to whichever of --afa-fill-solid/--afa-amber matches its actual
   action, check individually rather than blanket-replacing.
5. The export's gradient accent strip on ticket cards
   (orange->amber) is fine to keep as-is - decorative, not a
   mislabeled action/category color.

DELIVERABLE: Push the branch, deploy to Vercel preview, stop. No PR.
Report the preview URL, summary of changes per file, explicit
confirmation role-section items are inert, and confirmation no
existing handler/API logic in the 3 ported pages was touched.

TESTING NOTE: ~3.5s intro-splash/BrandLoader delay before a fresh
screenshot is trustworthy.
```

</details>

## Process notes worth remembering

- Continuing the pattern from last session: Figma Make → chat-review → CC-build → chat-verify-and-merge. This round's review surfaced a genuinely new failure mode worth watching for on future rounds - Figma Make inventing a small *palette* (3 colors for thread types) rather than just one stray token, when the underlying categorization has more states than the locked palette has spare colors for. Worth checking for this shape of issue (N categories needing N colors, but only 2 non-CTA colors exist) on any future export involving status/category tags, not just individual hardcoded hex.
- Route-auditing before designing a shared shell (done last session) continues to pay off - this round's shell design cleanly reflects the role-gating reality already surfaced then.

## Tally

28 PRs merged total (#527-#554), unchanged - nothing new merged this session. Zero pushed-and-awaiting-review as of this write-up (build brief given, not yet executed). Zero reverted.
