# CC dispatch: user-facing bug batch (BUG-2609-053, BUG-2609-054, BUG-2609-050) + Tailwind `Figma/` exclusion

> **One branch, these tickets only. Do NOT stack. Do NOT start another ticket in this run.** Push, hand off the compare link, stop. Chat merges.

**Start:** `git fetch && git reset --hard origin/qa`, read `HANDOFF.md` (26 Sep entries). **Never run `git stash pop` on a clean tree** (last run applied a stale PR #50 stash).
**Branch:** `fix/bug-batch-053-054-050`, off `origin/qa`. One commit per item, in this order.

## 1. BUG-2609-053: ticket stub REF cell always shows a dash
- `tickets/page.tsx` `stubCells()` renders `b.ticketCode`; `Booking.ticketCode` is null on every QA booking, including CONFIRMED ones.
- **Decision (chat): populate it, don't hide it.** A ticket reference is what a customer reads out at the door or quotes to support.
- First find out why it's null: is there a generator that never runs, or none at all? Check `CodeCounter` (there's an `AFA` prefix) and any existing code helpers before writing a new one. Reuse if it exists.
- Assign the code when a booking becomes CONFIRMED (every path: paid, free, admin-confirmed). Format: short, human-readable, no ambiguous characters (no 0/O, 1/I/L), unique (check the column's constraint; add one via migration if missing, with a matching file in `prisma/migrations/` — chat applies it via Supabase MCP).
- **Backfill:** write the SQL to fill CONFIRMED bookings with null `ticketCode` on QA. **Don't run it**; put a row-count preview and 5 sample rows in the handoff. Chat runs it.
- Check every other place that shows a booking reference (ticket PDF, confirmation email, admin bookings, organiser check-in) and make them show the same code.

## 2. BUG-2609-054: register says a username is "Available" when the server will reject it
- Server rule: `/^[a-zA-Z0-9_]{3,20}$/` (`api/auth/register/route.ts` ~L74). Client only checks uniqueness.
- Move the regex into one shared helper used by the register route, `/api/auth/username-check`, and `RegisterForm.tsx`.
- Client: validate format before calling the availability check. Show an inline, localized format message instead of "Available" (add the string to all locale files, same keys pattern as the existing register errors).
- `username-check` returns an invalid-format state for bad input rather than "available".
- Set `autoComplete="username"` on the field so browser autofill stops dropping an email into it.
- Test: unit test for the helper; e2e or manual check that `foo@bar.com`, `ab`, and a 21-char name all show the format message, and `valid_name` still gets the availability tick.

## 3. BUG-2609-050: special-notes status badge fails contrast
- `dashboard/organiser/events/[id]/edit/page.tsx` ~L805–808 re-types the badge colours and uses `--afa-sage`/`--afa-error` for text on the tinted background (a WCAG failure).
- Render it from `STATUS_TONE` (sage/error/gold) instead of re-typing. The bg values are already identical, so only the text colour changes (to the `-bright` variants).
- Grep for other hand-typed copies of `STATUS_TONE` backgrounds with non-bright text; fix any in the same commit and list them.
- **Also (found by Hitesh, 26 Sep):** the admin Overview "Nothing needs attention right now — all clear." banner (`dashboard/admin/page.tsx` ~L284–299) uses `--afa-green-deep` text on `rgba(22,101,52,0.12)`, which measures 2.15:1. Use `--afa-sage-bright` (5.6:1) for the text, via `STATUS_TONE` if a matching tone exists. Keep the left accent border as is.

## 4. Tailwind: exclude `Figma/`
- Add `@source not "../../Figma";` to the GEN-2609-111 block in `src/app/globals.css`. Confirm the stray `rounded-[12px]` class is gone from the built CSS.

## Verification (report each)
tsc; `next build`; design-token checker vs origin/qa and ratchet (nothing may rise); test suites; ESLint per-line diff on touched files; `next dev` renders `/`, `/register`, `/tickets`.

## Handoff must include
Compare link, commits, what caused the null `ticketCode`, the code format chosen, backfill SQL + preview (not run), any migration file (not applied), the list of other booking-reference surfaces updated, and any extra STATUS_TONE copies fixed.

## Not in scope (flag only)
The refund tiers: 7–14 days refunds 50% of the total including the booking fee, while 14+ days keeps the fee. That's a product decision for Hitesh; don't change it.
