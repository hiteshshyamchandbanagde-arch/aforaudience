import type { Metadata } from "next"
import Link from "next/link"
import LegalDocLayout, { H2, P, UL, LI } from "@/components/LegalDocLayout"
import { REFUND_FULL_MIN_DAYS, REFUND_HALF_MIN_DAYS } from "@/lib/refund-policy"

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy — AforAudience",
  description: "When and how ticket bookings on AforAudience are refunded.",
}

// L1 (8 Nov) - the tiers below are read from src/lib/refund-policy.ts, the
// same module the refund API uses, so this page can't drift from what a
// cancellation actually pays back.
export default function RefundPolicyPage() {
  const full = REFUND_FULL_MIN_DAYS
  const half = REFUND_HALF_MIN_DAYS
  return (
    <LegalDocLayout title="Refund & Cancellation Policy" lastUpdated="8 November 2026">
      <P>
        AforAudience is a product of Shyamkasturi Productions Private Limited. This policy explains when a ticket
        booking made on AforAudience is refunded, how much is refunded, and how long it takes.
      </P>

      <H2 id="audience-cancels">1. If you cancel your booking</H2>
      <P>How much you get back depends on how long before the show starts you cancel:</P>
      <UL>
        <LI>
          <strong>{full} days or more before the show:</strong> a full refund of the amount you paid, minus the
          booking fee and taxes.
        </LI>
        <LI>
          <strong>
            {half} to {full} days before the show (less than {full} days, at least {half} days):
          </strong>{" "}
          a refund of 50% of the amount you paid.
        </LI>
        <LI>
          <strong>Less than {half} days before the show:</strong> no refund.
        </LI>
        <LI>Once the show has started, a booking can no longer be refunded.</LI>
      </UL>
      <P>
        Before you confirm a cancellation, the app shows you the exact amount you will get back.
      </P>

      <H2 id="organiser-cancels">2. If the Organiser cancels the event</H2>
      <P>
        If an event is cancelled by its Organiser, you get a full refund of everything you paid, including the
        booking fee.
      </P>

      <H2 id="free-events">3. Free events</H2>
      <P>
        Free events are never charged, so there is nothing to refund. You can still cancel a free booking to release
        your seat.
      </P>

      <H2 id="how-to-cancel">4. How to cancel</H2>
      <P>
        Log in, open <strong>My Tickets</strong>, choose the booking and select <strong>Cancel</strong>. Your seat is
        released as soon as the cancellation is confirmed.
      </P>

      <H2 id="refund-timing">5. How refunds are paid</H2>
      <P>
        Refunds go back to the original payment method through Razorpay, our payment processor. They typically reach
        your account within 5–7 working days, depending on your bank.
      </P>

      <H2 id="contact">6. Contact</H2>
      <P>
        Questions about a refund or a cancellation: <a href="mailto:info@aforaudience.com">info@aforaudience.com</a>.
        See also our <Link href="/terms/">Terms of Service</Link> and the <Link href="/contact/">Contact</Link> page.
      </P>
    </LegalDocLayout>
  )
}
