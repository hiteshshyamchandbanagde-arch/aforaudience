# CC dispatch G: ticket-card action buttons overflow on phones (BUG-2610-012)

> **New branch `fix/ticket-actions-g` off `origin/qa`** (start only after F, `chore/spacing-p2-f`, is merged: F converts spacing across `src/`). Push after every commit. Chat merges. Autopilot.

**FIRST ACTION:** status file `RESULT: PARTIAL fix/ticket-actions-g none`. Budget about 50 turns. Read `docs/testing-rules.md`, `docs/design.md`, `src/app/tickets/page.tsx` and whatever it renders the booking card with.

Seen on a real phone (Hitesh, 4 Oct, Atul's Jaipur Mic Gala 100 booking `AFA-DGHJ-PFFM`, My Tickets): the three buttons under PAID, **Download PDF / Message Organiser / Cancel ticket**, sit in one row next to the QR. They're too narrow, so each label wraps to two lines and spills past its border.

1. **Regression test first (T1):** `e2e/ticket-actions.spec.ts`, signed in as Atul (QA persona, never production), at 390 and 1440 (`useRuleViewport`): for every action button on an upcoming confirmed booking card, the label's bounding box sits inside the button's box and the label doesn't overflow (`scrollWidth <= clientWidth`). Show it **failing on `origin/qa`** and passing on the branch. Read-only: no cancel, no message sent.
2. **Fix the layout**, tokens only (no new literals; checker and ratchet must not rise): at narrow widths let the actions take the full card width under the QR (or wrap to full-width buttons) so each label fits on one line; desktop stays as is unless it also overflows. Tap targets at least 44px tall.
3. Screenshot baselines at 390 and 1440 for the card.

Status file at the end: `RESULT: PUSHED fix/ticket-actions-g <sha>`, the cause in one line, the fix, the test before/after, and the **Human check**: the card on a real phone.
