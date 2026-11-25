// 12 Nov - the ConfirmDialog body for cancelling a CONFIRMED direct-pay
// performance: states the refund outcome (same helper the API uses, 15-day
// term vs the event date) before anything changes. Shared by the direct-pay
// panel (PerformanceDirectPay) and the artist's own upcoming list, which
// cancels through POST /api/performances/[id]/cancel.
import { DIRECT_PAY_FULL_REFUND_MIN_DAYS } from '@/lib/direct-pay-terms'
import { formatINR } from '@/lib/money-display'
import type { Dictionary } from '@/lib/i18n/translate'
import { cancelConfirmedOutcome } from '@/lib/venue-direct-pay'

export function performanceCancelOutcomeBody(opts: {
  eventDate: string | Date
  confirmedAt: string | Date | null | undefined
  amount: number
  payeeName: string
  payerName: string
  v: Dictionary['venueDirectPay']
  s: Dictionary['performanceDirectPay']
}) {
  const { v, s } = opts
  const outcome = cancelConfirmedOutcome(opts.eventDate, Date.now(), opts.confirmedAt != null)
  const line = outcome === 'DUE' ? v.cancelOutcomeDue : outcome === 'AS_AGREED' ? v.cancelOutcomeAsAgreed : v.cancelOutcomeNone
  return (
    <span data-afa-cancel-outcome={outcome ?? 'NONE'}>
      {line.replaceAll('{days}', String(DIRECT_PAY_FULL_REFUND_MIN_DAYS)).replaceAll('{amount}', formatINR(opts.amount))}
      {outcome && (
        <>
          <br />
          {s.cancelOutcomeNote.replace('{payee}', opts.payeeName).replace('{payer}', opts.payerName)}
        </>
      )}
    </span>
  )
}
