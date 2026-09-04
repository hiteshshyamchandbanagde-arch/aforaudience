# Session Handoff — 5 Sep 2026 (Audience Dashboard Shell — architecture agreed, not yet built)

`qa` HEAD: `b9bb740`. No code changes this session — pure design/architecture work. Nothing pushed and awaiting review.

## 🔴 Next session — priority order

1. **Rotate Razorpay + Google Places credentials** — still unresolved, only Hitesh can fix. Standing reminder, unchanged for many sessions now.

2. **White-card-on-dark-shell — still fully open, untouched.** Unchanged: the known 5-file dashboard list (`dashboard/admin/diary`, `dashboard/artist/edit`, `dashboard/artist/corporate-inquiries`, `dashboard/organiser/events/[id]/edit`, `dashboard/admin/settings`) plus the 2 public-facing spots (`AudienceChoiceVoting.tsx`, `checkout/[bookingId]/page.tsx`) all still need their own pass.

3. **`--afa-terracotta` sweep — unchanged, still open.** `docs/theme-migration-audit.md`'s "Prioritized fix sequence": items 1-6, 12 done; still open: item 7 (bell emoji), item 8 (`AuthPromptSheet.tsx`, `CorporateInquiryModal.tsx`, `SeatPicker.tsx`), item 9 (remaining shared components), item 10 (dashboard terracotta sweep, ~25 files, blocked on the `--afa-gold` contrast question below), item 11 (bare `monospace` fontFamily, 6 files).

4. **`--afa-gold` dark-on-dark contrast question — still unresolved.** ~20 dashboard files use `var(--afa-gold)` as text color directly on dark surfaces, same contrast-bug shape as already-fixed BUG-2608-093.

5. **`--afa-cream-tint-1/2`** — still live in `SeatPicker.tsx` and `LegalDocLayout.tsx`, unchanged.

6. **Auth desktop brand panel's placeholder stock photo** — `AuthBrandPanel.tsx`, flagged in a code comment. Swap for real AFA event photography when available (Hitesh's call on timing).

7. **Profile page's two column-eyebrow labels ("YOUR PROFILE"/"GROW YOUR REACH")** — deliberately skipped in PR #554, no i18n keys exist and the `Dictionary` type requires all 11 locale files. Needs a real translation pass if wanted, not a guess.

8. **NEW this session — Audience Dashboard Shell, architecture agreed, Figma Make round sent, not yet run/built.** See "In progress" below — this is the next concrete piece of work once Hitesh runs the Figma Make prompt and sends the export back.

9. **NEW this session — BUG-2609-003, leftover Phase-0 `--afa-terracotta` + a white-card bug, found while scoping the shell.** Dashboard/Messages/Tickets all have terracotta leftovers (Dashboard's "Browse events" link, several Tickets status badges/buttons, Messages' unread-dot); Messages additionally has a real bug — read-thread rows fall back to `var(--afa-cream, #fff)`, a light background on a dark-theme page (unread threads render fine with a dark amber tint; every *read* thread would show as a bright white card). Not yet fixed — flagged for the same pass as the shell build, since these 3 files are being touched anyway.

10. **Local dev env, two standing issues:**
    - DB unreachable (recurring Prisma P1001) — check freshly each session.
    - `.env.local`'s VAPID vars malformed — breaks `/api/events` with a 500 before the DB issue even kicks in. Standing workaround: throwaway keys via `npx web-push generate-vapid-keys`, env-override for the dev-server process only, never written to `.env.local`.

## In progress — Audience Dashboard Shell

Full architecture discussion and decision this session, no build yet. Full detail in `docs/design.md`, "Audience Dashboard Shell — Architecture Decision" - summary here:

- **Problem:** Dashboard/My Activity, Messages, and Tickets all duplicate the same no-shared-layout, narrow-centered-column pattern already fixed on auth/profile pages.
- **Key context that shaped the decision:** every AFA account starts as Audience and can additively hold Artist/Organiser/Venue Owner roles (not exclusive). Organiser (~10 pages) and Venue Owner (~9 pages) both have real depth (list → detail → sub-actions); Messages is already role-agnostic (one shared inbox, keyed by `contextType`, not by viewer role).
- **Decision:** two-tier sidebar, not a role mode-switcher. Top tier always present (Dashboard/Tickets/Messages/Profile); below that, one section per role, rendered only if held (Organiser/Artist/Venue Owner sections with their respective sub-items). Mobile: bottom tab bar for the 4 universal items + a "More" drawer for role sections.
- **Profile deliberately stays separate** — just got its own two-column redesign last session (PR #554), don't want a sidebar eating into that width. Figma Make round mocks a 4th "Profile" sidebar entry (link only) so the option is visible without committing to it.
- **Figma Make round sent, not yet run:** "AFA Audience Dashboard Shell." Asks for the full two-tier sidebar (desktop, mocked with all role sections visible for review) + mobile bottom-tab/More + real content for the 3 Audience-tier pages (empty + populated states).
- **Next step:** Hitesh runs the Figma Make prompt, sends the export back for the same token/scope review pass as the last two rounds (auth pages, profile page), then a CC build brief gets written. Build brief will need an explicit scope fence: role sections render per the account's actual held roles (already-existing gating logic), not hardcoded visible/interactive for everyone; and the terracotta/white-card fixes from BUG-2609-003 should get folded into the same pass since these files are being touched anyway.

## Process notes worth remembering

- **The Figma Make → chat-review → CC-build → chat-verify-and-merge loop continues to be the right shape** for design-heavy work - two clean rounds so far (auth pages #553, profile page #554), no rework needed on either.
- **Stopping to resolve a bigger architecture question before designing anything was the right call this session.** The instinct to jump straight to "fix these 3 pages' dead space" would have produced a shell that didn't account for Organiser/Artist/Venue Owner at all, likely needing a rebuild once those roles' pages got their own redesign pass later. Worth continuing this pattern: before building a shared shell/component, check whether other parts of the app that will eventually share it have requirements that change the shape.
- **Route-auditing before designing is cheap and worth doing every time a "shared shell" is on the table** - a 5-minute `git/trees` recursive listing revealed the Organiser/Venue Owner depth that shaped the whole sidebar-vs-switcher decision. Would have been easy to skip and design blind.
- Same ~3.5s intro-splash/BrandLoader timing gotcha applies everywhere on this app - still true.

## Tally

28 PRs merged total (#527-#554), unchanged from last session - nothing new merged this session. Zero pushed-and-awaiting-review. Zero reverted.
