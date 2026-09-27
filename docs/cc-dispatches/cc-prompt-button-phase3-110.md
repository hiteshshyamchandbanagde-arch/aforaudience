# CC dispatch: GEN-2609-110 — Button phase 3 (bare 91 → 0 unexplained)

> **One branch, this ticket only. Do NOT stack. Do NOT start another ticket in this run.** Push, hand off the compare link, stop. Chat merges. **Never `git stash pop` on a clean tree.**

**Start:** `git fetch && git reset --hard origin/qa`, read `HANDOFF.md` (27 Sep parts) and `src/components/ui/Button.tsx` in full (variant comments carry the history).
**Branch:** `feat/gen-2609-110-button-phase3`, off `origin/qa`. One commit per step; area commits for step 4.

## Goal and definition of done
The North Star: an admin edit to buttons reaches every button on the site. After #706/#708 even `variant="bare"` buttons already use colour and radius tokens, so colour/radius edits reach them. What bare buttons miss is the *button* layer: variant look, button padding tokens, hover/focus/disabled behaviour.

**Done = every `<Button variant="bare">` is either migrated to a real variant, or deliberately custom with a one-line reason.** Ratchet target: `bare-button` counts only *unexplained* bare buttons → **0**.

## Measured baseline (chat, `qa@8217eaa`)
`bare-button` 91 across 41 files, `raw-button` 2. Heaviest: `venue/[id]/seat-map` 14, `SupportWidget` 4, `SiteNav` 4, `admin/feedback` 4, `SearchBox` 3, `HomeHeader` 3, `VenuesGridClient` 3, `organiser/events/[id]/edit` 3. A rough chat heuristic (verify, don't trust): ~17 toggle/tab/chip, ~7 seat-grid cells, ~6 inline links, ~5 menu/list rows, ~3 icon-only, ~50 unclassified. GEN-2609-110's original estimate: a `toggle-box` shape (17 sites) and an inline `link` shape (~9 sites).

## Steps
1. **Classify all 91 first** (no code changes). Table in the handoff: file:line · what it is · current look · proposed destination (existing variant / new variant / stays custom + reason). Group identical looks.
2. **Existing variants first.** Where a bare button's look already matches a variant (`link`, `icon`, `close`, `toggle-pill`, `outline-neutral`, `secondary`…) up to trivial differences (≤2px, the same token), migrate it. List the trivial differences accepted.
3. **New variants only by the 3-site rule** (same discipline as GEN-2609-047/053): a look repeated at ≥3 sites becomes a variant, fully tokenized (colour, radius, the button padding tokens, font tokens), with hover/focus-visible/disabled states consistent with the other variants. Expected candidates: `toggle-box` (box selectors), inline `link` if the existing `link` doesn't fit, `menu-row` (nav/dropdown rows), maybe `tab`. Each new variant gets a sample in the editor's live preview.
4. **Apply** by area (public / dashboard / components / seat-map). Remove per-site style overrides the variant now covers; keep only genuinely positional ones (margin, width, absolute placement).
5. **Deliberately custom** (expected: seat-grid cells, carousel dots, icon-inside-input, drag handles). Keep `variant="bare"`, add `// bare-reason: <why>` on the line above. Change the checker so `bare-button` counts only bare buttons **without** a `bare-reason` comment, with unit tests. A reason must say why no variant fits, not just what the button is.
6. **The 2 `raw-button`s**: migrate to `<Button>` or give a `token-ok` reason.
7. **Ratchet**: update the baseline (bare → 0 unexplained, raw → 0 or exempted). Nothing else may rise. Regenerate `TOKEN_COVERAGE` last.

## Visual check (required)
Before/after screenshots at 390 and 1280: `/`, `/events`, `/venues`, an event detail page, the seat picker, SiteNav open menu, SupportWidget open, `/dashboard/admin/feedback`, the venue seat-map editor. Expected differences: consistent hover/focus rings, button padding tokens applied, ≤2px size shifts. **Call out anything else**, and list the dashboard pages Hitesh should check (he has admin; QA personas are in the handoff template).

## Verification (report each)
tsc; `next build`; checker vs origin/qa; ratchet; all self-tests plus the new checker tests; ESLint per-line diff on touched files; keyboard check: Tab reaches every migrated button with a visible focus ring; `next dev` renders the screenshot pages.

## Handoff must include
Compare link, commits, the classification table, the new variants (name · looks · sites), every `bare-reason` with file:line, the accepted trivial differences, ratchet before/after, screenshots summary, and the click-through list for Hitesh.
