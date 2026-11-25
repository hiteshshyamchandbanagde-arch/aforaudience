# CC dispatch: run B, My Tickets (Hitesh phone pass 13-14 Oct; past-ticket decision 14 Oct)

> **New branch `fix/tickets-b` off `origin/qa`.** Small chunks (AGENTS.md): one small edit, commit, push, next; one locale file per tool call. **45-min hard limit, push after every commit** (autopilot token lives 60 min). Push, write the status file, stop. Chat opens the PR and merges. **Never `git stash pop` on a clean tree.**

**Start:** `git fetch && git reset --hard origin/qa` (must include this file and #756). Read `HANDOFF.md` Part 60 (batch B) and Part 58 ("DECIDED": past tickets), `docs/design.md`, `src/app/tickets/page.tsx`, and the existing tickets e2e specs (`e2e/*ticket*`, cancel-sheet spec).

## 1. Past tickets: no QR (Hitesh decision, 14 Oct)
- On a ticket whose event has ended, drop the QR code and the "Scan at door" label. Keep **Download PDF**.
- Upcoming tickets are unchanged. Use the page's existing past/upcoming rule; don't add a new one.
- The offline saved-tickets view must follow the same rule. Don't bump `CACHE_VERSION` unless the shell changes.

## 2. ₹0 ticket shows "Free"
- `src/app/tickets/page.tsx` ~line 897 renders `₹{b.totalAmount}`, so a free booking shows "₹0". When `totalAmount === 0`, show the existing `tr.eventDetailPage.freeAmount` ("Free", already in 12 locales). Check the ticket PDF and the cancel sheet for the same "₹0" and fix them the same way if present.

## 3. Cancel sheet: lock background scroll
- With the cancel sheet open on a phone, the page behind it scrolls. Lock background scroll while the sheet is open and restore it, with the same scroll position, on close (Escape, backdrop tap, Cancel, confirm). If the app already has a shared scroll-lock helper or sheet component, use it.

## Tests (T1)
- e2e: past ticket has no QR and no "Scan at door", and still has Download PDF; upcoming ticket still has its QR.
- e2e: a ₹0 booking shows "Free", not "₹0" (use a QA persona or route mock, never real payments).
- e2e at 390: with the cancel sheet open, scrolling does not move the page; after close the scroll position is restored.
- Screenshots at 390 + 1440 for the past ticket card; update baselines that change and list them with the reason (T2).
- Each regression must fail on `origin/qa` and pass on the branch (show both).

## Finish
- tsc, unit self-tests, eslint (touched files), checker/ratchet green on the pushed head.
- Status file `cc-autopilot-status.md` (T7) with a Human check for Hitesh, phone (Atul): a past ticket has no QR; a free ticket reads "Free"; the page behind an open cancel sheet doesn't scroll.
- Do not touch the Feedback table. No seed or data changes.
