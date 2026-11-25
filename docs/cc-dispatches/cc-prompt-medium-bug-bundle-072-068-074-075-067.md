# CC dispatch: MEDIUM bug bundle — BUG-2609-072, 068, 074, 075, 067 (+ one comment cleanup)

> **New branch `fix/medium-bug-bundle-2609` off `origin/qa`. One commit per bug.** Push, hand off, stop. Chat merges. **Never `git stash pop` on a clean tree.**

**Start:** `git fetch && git reset --hard origin/qa` (≥ `90c7e02`, #715). Read `HANDOFF.md` parts 14 and 19, and each bug's full Feedback message (QA DB, `displayId` below). All new styling goes through tokens; the checker and ratchet must stay at or below baseline. `token-ok` is now scoped (`token-ok(<rule>): reason`).

## 1. BUG-2609-072 — toast is see-through (`src/components/Toast.tsx`)
The info toast is translucent and prints over the button row after Publish on `/dashboard/organiser/events/create`. Give every toast variant an opaque surface (`--afa-surface-raised`), a border and a shadow; keep variant colour on the icon/edge, not a translucent fill. Position: top-right on desktop; on mobile, above the tab bar and clear of the chat button. Check all 24 call sites render through the one component (report any that don't).

## 2. BUG-2609-068 — chat bubble covers bottom actions (`src/components/SupportWidget.tsx`)
**Decision:** keep the bubble available; it must never cover a tappable control. Mark bottom action rows with `data-afa-action-row`, and when one is in the viewport on mobile, the bubble lifts above it (IntersectionObserver; no per-page padding hacks). If there isn't room, it hides until the row leaves view. Mark at least: venue edit, venue create, profile, checkout, event create, Seat Map Builder. Verify at 390 and 440.

## 3. BUG-2609-074 — register race (`src/app/(auth)/register/RegisterForm.tsx` ~L174-205)
AbortController per username check, aborted in the effect cleanup, **and** ignore any response whose value ≠ current `form.username`. Same fix for the initials-suggestion fetch. Clearing the field must return to idle, show no status, and bring the initials chips + Try more back.

## 4. BUG-2609-075 — selected seats cover neighbours (`src/components/SeatPicker.tsx` ~L383-393)
Remove the size "pop". Selected changes colour/border/weight only (it already uses `--afa-selected*` after #714); if any scale remains it must not overlap a neighbour at any zoom. Four adjacent selected seats must each stay readable. Add **Available** to the legend (the legend-swatch part landed in #714; check what's left). Heading "Choose your section" → a seat-level heading on seat-level maps; keep "section" wording for section-level maps.

## 5. BUG-2609-067 — Seat Map Builder overflows on mobile (`src/app/dashboard/venue/[id]/seat-map/page.tsx`)
The page body must never scroll sideways. Text blocks (orientation note, "Viewing only on this screen", stage bar, reference-image help) wrap to viewport width; only the canvas sits in its own `overflow-x: auto` container. Verify at 390 and 440: `document.documentElement.scrollWidth === clientWidth`.

## 6. Cleanup — `src/components/ui/Button.tsx:789`
Delete the `token-ok(radius-literal)` comment on `borderRadius: '50%'`: percentages are always allowed, so it exempts nothing and misleads (chat decision, 29 Sep).

## Verification
tsc; `next build`; checker vs origin/qa; ratchet at or below baseline; all self-tests; ESLint per-line diff on touched files. Screenshots at 390 (and 440 for 067/068), before/after, for: toast after Publish; venue edit bottom row with the bubble; register clear-after-check; seat picker with 4 adjacent selected; Seat Map Builder. Vercel preview green on the pushed head.

## Handoff (delta-only)
Compare link; commits; per bug: root cause in one line, fix, what was verified live vs not (auth-gated pages: say which persona or that you couldn't); toast call sites not using the component; ratchet per category.
