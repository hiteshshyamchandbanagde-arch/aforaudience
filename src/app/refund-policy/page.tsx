import type { Metadata } from "next"
import Link from "next/link"
import LegalDocLayout, { H2, P, UL, LI } from "@/components/LegalDocLayout"

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy — AforAudience",
  description: "When and how ticket bookings on AforAudience are refunded.",
}

// P1 prod port (8 Nov 2026) - main has no src/lib/refund-policy.ts, so the
// tiers are inlined here. Keep in sync with REFUND_FULL_MIN_DAYS /
// REFUND_HALF_MIN_DAYS in qa's src/lib/refund-policy.ts (the module the refund
// API uses there).
const REFUND_FULL_MIN_DAYS = 14
const REFUND_HALF_MIN_DAYS = 7

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
      <P>
        Sections 1, 2 and 6 apply to <strong>online payments</strong> made through AforAudience. For an online
        payment, how much you get back depends on how long before the show starts you cancel:
      </P>
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
        If an event you paid for online is cancelled by its Organiser, you get a full refund of everything you paid,
        including the booking fee.
      </P>

      <H2 id="free-events">3. Free events</H2>
      <P>
        Free events are never charged, so there is nothing to refund. You can still cancel a free booking to release
        your seat.
      </P>

      <H2 id="pay-at-entry">4. Pay at entry and direct payments</H2>
      <P>
        For <strong>Pay at entry</strong>{" "}tickets nothing is collected online, so there is nothing for
        AforAudience to refund. If you can&apos;t attend, cancel your reservation in <strong>My Tickets</strong> to
        release your seat.
      </P>
      <P>
        Any money paid directly to an Organiser, Venue Owner or Artist (at the venue, or by UPI or cash) is refunded,
        or not, by them under their own terms. Contact them first; if you need the in-app record of the booking,
        write to <a href="mailto:info@aforaudience.com">info@aforaudience.com</a>.
      </P>

      <H2 id="how-to-cancel">5. How to cancel</H2>
      <P>
        Log in, open <strong>My Tickets</strong>, choose the booking and select <strong>Cancel</strong>. Your seat is
        released as soon as the cancellation is confirmed.
      </P>

      <H2 id="refund-timing">6. How refunds are paid</H2>
      <P>
        Refunds of online payments go back to the original payment method through Razorpay, our payment processor. They typically reach
        your account within 5–7 working days, depending on your bank.
      </P>

      <H2 id="contact">7. Contact</H2>
      <P>
        Questions about a refund or a cancellation: <a href="mailto:info@aforaudience.com">info@aforaudience.com</a>.
        See also our <Link href="/terms/">Terms of Service</Link> and the <Link href="/contact/">Contact</Link> page.
      </P>
    </LegalDocLayout>
  )
}
