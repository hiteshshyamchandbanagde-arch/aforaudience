# CC dispatch: GEN-2609-108 — design-system editor guardrails (+ BUG-2609-061)

> **One branch, these tickets only. Do NOT stack. Do NOT start another ticket in this run.** Push, hand off the compare link, stop. Chat merges. **Never `git stash pop` on a clean tree.**

**Start:** `git fetch && git reset --hard origin/qa`, read `HANDOFF.md` (26 Sep entries).
**Branch:** `feat/gen-2609-108-editor-guardrails`, off `origin/qa`. One commit per section.

## Why
Since #706/#708, every colour, radius and font token is admin-editable and live site-wide. The editor still lets through values that break the site: QA history shows `--afa-radius-pill: 0100000px` and `--afa-radius-md: 200px` saved without complaint. Tokens also show as raw names in one long list (65 colour tokens now), and DB changes made outside the editor never reach the site until someone saves.

## Already there — keep, don't rebuild
`isValidTokenValue()` allowlist (server), `LOCKED_TOKEN_KEYS` confirm, the unsaved-edits Button preview (`previewStyle`), the `CONTRAST_PAIRS` panel, version history + restore confirm (BUG-2609-059).

## A. Value ranges — server-enforced
- In `src/lib/design-tokens.ts`, add a range table keyed by token (fallback by group). Enforce it in `isValidTokenValue` (server) and mirror it client-side for inline errors. Starting ranges (adjust only with a stated reason):
  - radius: 0–40px; `--afa-radius-pill` must be ≥ 100px. The scale must stay ordered (sharp ≤ xs ≤ sm ≤ md ≤ lg ≤ xl ≤ 2xl); reject a save that breaks the order and name the neighbour it crosses.
  - font sizes: 10–72px; body/ui/label/small text roles: 11–24px.
  - spacing and button padding: 0–64px per part.
- Tighten the regexes: no leading zeros (`0100000px`), no negative dimensions unless a token is explicitly allowed, rgb channels 0–255 (today `\d{1,3}` accepts 999), alpha 0–1.
- Unit tests for every rule, including the two real bad values above.

## B. Contrast guard on save
- Extend `CONTRAST_PAIRS` to every text/surface pair the site actually uses at rest: primary, secondary and muted text on page and raised surfaces; `-bright` tone text on its own tint (sage/error/amber); button text on fill; amber on page.
- If a save would take any pair below 4.5:1 (3:1 for large text, e.g. headings), show a confirm dialog listing each failing pair with before → after ratios, like the locked-token confirm. The server requires `confirmContrast: true` for such a save. Compute on the composited colour (rgba over its surface), same as the existing panel.

## C. Plain-language labels and structure
- Add a `TOKEN_META` map: a label ("Muted text"), a one-line "used for" ("timestamps, helper text, empty states"), and the raw key shown small underneath. Every token gets an entry, with a test that fails if a token has none.
- Split Colour into subsections: Surfaces · Text · Brand & actions · Status tones · Tints & borders · Overlays & shadows.
- Add a search box that filters by label, key or "used for".
- **Hide the Spacing group from the editor** (decision: GEN-2609-107 keeps spacing out of admin control). Keep its tokens in code and in the DB.

## D. Type-aware inputs
- Hex colours: swatch + native picker + text field (as now).
- rgba tokens: base-colour picker + alpha slider (0–1, step 0.01), composing `rgba(r, g, b, a)` in the canonical spaced form the DB uses.
- Dimensions: number input with the fixed unit shown, min/max from the range table, plus a slider for radius and font size.

## E. Preview before save
Add a sample card inside the existing `previewStyle` wrapper so unsaved edits show on more than buttons: a card on raised surface with a heading, body, secondary and muted text, a badge in each status tone, an input, a tinted border, and card/pill radii. Nothing outside the editor changes until save.

## F. Token cache refresh
- The token cache (`unstable_cache`, tag `design-tokens`) has no expiry, so DB changes made outside the editor (chat applies SQL after merges) stay invisible until an editor save. On 26 Sep, `--afa-text-muted` 0.5 sat unseen for hours.
- Add `revalidate: 300` to the cache (5-minute safety net). This means one small DB read per 5 minutes; say so in the code comment.
- Add a "Refresh site cache" button: admin-only `POST /api/admin/design-tokens/revalidate` calling `revalidateDesignTokens()`, no version row.

## G. BUG-2609-061 — revert note
A restore's note currently embeds the target's note, so reverts nest ("Reverted to version X (Reverted to version Y (Updated 1 token(s)))") and report the target's count. Make it `Restored version <id> (<n> token(s) changed)` using the real diff count. Also: if the target snapshot lacks keys that exist now (tokens added after it), the confirm dialog says "N newer tokens are not in this version and stay as they are", and the restore leaves them untouched. Check that that's already true, and fix it if not.

## Verification (report each)
- tsc and `next build`; checker vs origin/qa and ratchet (nothing may rise); all self-tests plus the new ones; ESLint per-line diff.
- With a mocked admin session against this branch's build:
  1. `0100000px` and `200px` on a radius are rejected inline and by the API.
  2. Making muted text 0.3 triggers the contrast confirm; Cancel sends nothing.
  3. An alpha-slider edit shows in the preview card and nothing else changes before save.
  4. Refresh returns 200 for admin and 403 for a non-admin.
  5. A restore writes the new note format.
- Screenshots of the editor at 1280 and 390.

## Handoff must include
Compare link, commits, the final range table, the contrast pairs list, any token missing a sensible label (ask rather than invent), and a click-through list for Hitesh.
