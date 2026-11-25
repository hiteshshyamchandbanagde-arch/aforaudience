# CC dispatch: artist (Performance, D3) direct-pay, cancel after CONFIRMED + refund tracking (Part 71 Next #2, artist half)

> **Branch off `origin/qa` (after #780 is merged): `feat/performance-direct-pay-cancel-refund`.** Small chunks, commit + push after each. 60-min limit. **Commit nothing named cc-autopilot-status.md; write it per the workflow.** Never write the QA `PlatformSettings` row. **Mirror #780** (venue half, already on qa): reuse `cancelConfirmedOutcome`, `istCalendarDaysUntil` and `directRefundTransition` from `src/lib/venue-direct-pay.ts` rather than copying them. Generalise a helper only if it's needed, e.g. a payer side other than ORGANISER.

## DB: ALREADY APPLIED ON QA by chat (do not run it)
Commit as `prisma/migrations/20261112130000_add_performance_direct_refund_tracking/migration.sql` and mirror it in `schema.prisma`. The enums already exist from #780. `Performance.cancelledAt` already exists and is reused.
```sql
ALTER TABLE "Performance"
  ADD COLUMN "directRefundStatus" "DirectRefundStatus",
  ADD COLUMN "cancelledBy" "DirectPayParty",
  ADD COLUMN "refundReceivedAt" TIMESTAMP(3);
```

## Behaviour
- **Direction comes from `performanceDirection()`**: PAID means the organiser pays the artist; BUY_IN means the artist pays the organiser. The **payer** confirms the refund was received. For PAID that's the ORGANISER; for BUY_IN it's the ARTIST.
- **A new action `cancelConfirmed`** on `POST /api/performances/[id]/direct-pay`. Either party can use it from `directPayStatus: CONFIRMED`, before the event starts (`eventStartInstant(event.date, event.startTime)`). It sets `cancelledAt`, `cancelledBy`, `directPayStatus: CANCELLED`, `directRefundStatus` from the 15-day helper (counted against the event date), releases the lineup slot / promotes the waitlist the same way the existing cancel paths do, and notifies the other party with the outcome (same copy pattern as #780).
- **A new action `refundReceived`**: payer only, DUE/AS_AGREED → RECEIVED, `refundReceivedAt`, race-guarded (409), with the other party notified.
- **Bug to fix in the existing artist self-cancel** (`POST /api/performances/[id]/cancel`, ~lines 57–72). For a **direct-pay** performance it currently:
  - sets `buyInRefundStatus: 'REFUNDED'` on BUY_IN, which claims a refund AFA can't make;
  - leaves `directPayStatus: CONFIRMED` untouched.
  
  When `directPayStatus` is CONFIRMED, apply the same outcome as `cancelConfirmed` (`cancelledBy: ARTIST`, `directRefundStatus` from the helper, `directPayStatus: CANCELLED`) and do **not** set `buyInRefundStatus`. Keep today's behaviour for non-direct (online) performances, and keep the existing 24 h block.
- **UI** (`PerformanceDirectPay.tsx`, and the artist's own performance list if it renders these):
  - The same Cancel (outline) + ConfirmDialog outcome text, the refund chip, the "cancelled by" line, and the payer's "I've received the refund" button.
  - Reuse #780's i18n keys where the wording fits. Add new keys only for the artist/payer wording, en first, then the other locales **one file per call**.

## Tests (T1)
- **Unit:** payer by direction (PAID vs BUY_IN); the transition table; 403 for the non-payer.
- **e2e** (extend `e2e/performance-direct-pay.spec.ts`, `@needs-db`, state restored):
  - PAID: the organiser cancels ≥15 days out → "Refund due", then the organiser marks it received.
  - BUY_IN: the artist self-cancels a CONFIRMED direct buy-in through `/cancel` → "Refund due" or "Refund as agreed", and `buyInRefundStatus` stays null. This is the regression test for the bug.
  - Screenshots at 390/1440.
  - All must fail on `origin/qa` and pass on the branch.
- Run locally only the specs you touched. tsc, eslint (touched files) and design-tokens must be green.

## Finish
Status file: chunks, the payer rule, the `/cancel` bug fix with its before/after, tests fail→pass, baselines, pushed head. Human check: Hrithik/Omkar cancel a confirmed paid slot on a phone and read the copy (hi/mr).
