# CC dispatch: GEN-2609-115 — token cleanup, restore contrast check, editor polish

> **One branch, this ticket only. Do NOT stack. Do NOT start another ticket in this run.** Push, hand off the compare link, stop. Chat merges and applies the DB SQL. **Never `git stash pop` on a clean tree.**

**Start:** `git fetch && git reset --hard origin/qa`, read `HANDOFF.md` parts 9–11.
**Branch:** `chore/gen-2609-115-token-cleanup`, off `origin/qa`. One commit per item.

All items were decided by chat on 26 Sep, delegated by Hitesh. Report if anything looks wrong in practice; don't re-decide.

1. **Delete `--afa-terracotta`.** 0 live uses (only a comment in `SiteNav.tsx`; reword the comment). Remove it from `globals.css`, `DEFAULT_TOKEN_VALUES`, `TOKEN_META`, `COLOR_MAP` if present, and the reference doc.
2. **Fold `--afa-text-inverse` into `--afa-text-primary`.** They have the same value, and there are 8 uses. Rewrite the uses, then remove the token.
3. **Fold `--afa-red-alt` (#EF4444) into `--afa-error-bright` (#E67870).** 14 uses, 12 files. This is a visible shift (slightly softer red). Screenshot 2–3 of the affected pages before/after. If any use is a *fill* where `--afa-error` is the right token, not text, use that and say so.
4. **"Seat map" subsection** in the editor for the seat-map colours currently under Status tones.
5. **Restores get the save-time contrast check.** A restore that would take any `CONTRAST_PAIRS` pair below AA shows the same confirm, and the revert API requires `confirmContrast: true`, as the PATCH route already does. Today, restoring an old version drops muted text to 0.4 with no warning.
6. **`form-submit` Button text: `--afa-cream` → `--afa-on-fill-solid`.** Cream on `--afa-fill-solid` is 2.81:1, the only failing pair in the editor's contrast panel. `primary` already uses `--afa-on-fill-solid` (6.05:1). This affects the 4 auth pages (login/register/forgot/reset). Update the long comment above the variant (its "no visible change" reasoning no longer applies; this is a deliberate AA fix). Screenshot `/login` before/after.
7. **Caption range.** `--afa-text-caption` shows 10–72px in the editor; it belongs with the small-text roles. Use 9–16px unless a real use needs more.
8. **Preview label.** Label the Outline sample in the live preview "Outline (on orange)", so its orange backing box reads as intentional.

## DB SQL (write it in the handoff, don't run it)
Delete rows for `--afa-terracotta`, `--afa-text-inverse`, `--afa-red-alt`. Nothing else changes in the DB.

## Verification (report each)
tsc; `next build`; checker vs origin/qa and ratchet (nothing may rise); all self-tests plus new ones for item 5; ESLint per-line diff; `verify-equivalence --base=origin/qa` (items 3 and 6 listed as intentional changes); screenshots named above; editor contrast panel shows 0 failing pairs.

## Handoff must include
Compare link, commits, per-file list for items 2 and 3, before/after contrast for item 6, the DB SQL (not run), and a short click-through for Hitesh (restore contrast confirm, `/login` button).
