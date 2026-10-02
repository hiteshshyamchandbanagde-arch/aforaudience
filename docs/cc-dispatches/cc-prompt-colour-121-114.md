# CC dispatch: GEN-2609-121 (colour-rule follow-ups) + GEN-2609-114 (colour leftovers)

> **New branch `fix/colour-121-114` off `origin/qa`.** One commit per numbered item below. Push, hand off, stop. Chat merges. **Never `git stash pop` on a clean tree.**

**Start:**
- `git fetch && git reset --hard origin/qa`. It must contain BUG-2609-081's merge (`fix/bubble-081`). **If `qa` doesn't have it yet, or your base is older than the commit carrying this file, stop: stale checkout.**
- Read `HANDOFF.md` from the latest part back to 28, `docs/design.md` "Decisions 29 Sep" (GEN-2609-121 bullet) and the colour rule from GEN-2609-118.
- Read both Feedback messages in full (QA DB, GEN-2609-121 and GEN-2609-114).

**Why this matters:** this is goal work. Several "selected" states still read `--afa-amber` directly. `--afa-amber` is **locked** in the admin editor, while `--afa-selected`, `--afa-selected-bg` and `--afa-selected-border` are editable DesignTokens. Until these sites move, an admin colour edit doesn't reach them.

**Colour rule (from GEN-2609-118, do not reinterpret):**
- Orange (primary) is for the one main action in view.
- Outline is for secondary actions.
- `--afa-selected*` is for on/selected states.
- Neutral is for labels.

## GEN-2609-121 (all decided by Hitesh 29 Sep; no new decisions)
1. **Stage bars and the builder's front-tier seats:** solid orange → `--afa-tint-20` fill with primary text. Applies in SeatPicker, the builder canvas, the wizard preview and SeatLayoutPreview.
2. **Artist profile:**
   - The per-show ticket links stay primary.
   - "+ Follow" → outline.
   - The prev/next arrows → plain icon buttons.
3. **Profile cards:**
   - Each card's Save is outline.
   - It becomes primary **only while that card has unsaved changes**, then reverts after a successful save.
   - Keep "one primary in view": if two cards are dirty, both can be primary, since each is the action for its own card. State in the handoff exactly how you handled that case.
4. **Amber-direct selected states → `--afa-selected*`:**
   - Sites: DashboardShell nav, MobileTabBar active tab and drawer row, SiteNav active link, venue bookings calendar selected day, profile role cards.
   - Text/icon → `--afa-selected`; wash → `--afa-selected-bg`; edge → `--afa-selected-border`.
   - The fainter 0.08 wash is accepted.
   - After converting, grep for `var(--afa-amber)` across `src` and list every remaining use with a one-line reason it isn't a selected state.
5. **My Venues cards (desktop):** Edit, solid orange on every card → outline, as in the organiser dashboard fix in #714.
6. **Messages:** Send, currently green → primary.
7. **Seat Map Builder:** "Freeze this seat map" → outline. Save Seat Map stays the one primary.

## GEN-2609-114
8. **Modal backdrops:** AuthPromptSheet, CorporateInquiryModal, FeedbackDetailPanel `.fb-detail-backdrop` and the fourth one named in #708's closeout are currently `--afa-tint-30`, a cream wash. Change them → `--afa-scrim`. Grep for any other backdrop or overlay still using a tint and include it.
9. **Sage text on dark surfaces:**
   - Text/icon uses of `--afa-sage` (34 `var(--afa-sage` sites in `.tsx`; triage them) → `--afa-sage-bright`. This follows the GEN-2609-068 pattern already used for error and gold.
   - Fills and backgrounds keep `--afa-sage` / `--afa-sage-tint`.
   - Report before/after contrast for 3 representative sites.
10. **SVG presentation attributes:** the 10 `fill="var(...)"` / `stroke="var(...)"` / `stopColor="var(...)"` sites → `style={{ fill: 'var(...)' }}` etc. (presentation attributes don't reliably resolve `var()`). Re-count first; the #708 closeout said 14.
- **Not in scope:** 114 item (4), the grey vs warm-brown poster-less event cards. That's pending Hitesh; leave them grey (`--afa-surface-raised`).

## Verify
- tsc; `next build`; checker vs `origin/qa`; ratchet at or below baseline in every category (spacing may only go down); all self-tests; ESLint per-line diff on touched files; e2e smoke.
- **Admin round-trip proof (the goal check):**
  - In QA `/dashboard/admin/design-system`, as Hitesh's Admin account, or via a direct QA `DesignToken` update of `--afa-selected` to an obvious test colour, then reverted.
  - Screenshot the DashboardShell nav, MobileTabBar active tab, SiteNav active link and the venue calendar's selected day picking it up with no redeploy.
  - **Revert the token** and confirm the revert in the handoff.
- **Screenshots at 390 and 1280:** the seat picker stage, artist profile, a dirty vs clean profile card, My Venues, Messages, the builder action row, one modal backdrop and one sage-text site.

## Handoff (delta-only)
- Compare link and commits.
- The remaining `--afa-amber` list with reasons.
- The item 3 two-dirty-cards behaviour.
- The sage contrast numbers.
- The SVG count.
- The admin round-trip result, including the revert.
- Screenshots.
