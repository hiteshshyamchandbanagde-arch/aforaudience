import type { Metadata } from "next"
import Link from "next/link"
import LegalDocLayout, { H2, P, UL, LI } from "@/components/LegalDocLayout"
import { DIRECT_PAY_FULL_REFUND_MIN_DAYS } from "@/lib/direct-pay-terms"

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy — AforAudience",
  description: "How cancellations and refunds work on AforAudience, where payments are made directly between the parties.",
}

// 12 Nov 2026 (Hitesh) - direct-pay model. AforAudience processes no payments
// and holds no money, so it can't issue refunds; it publishes one standard
// term, read from src/lib/direct-pay-terms.ts so this page and the in-app
// disclosure line can't drift.
export default function RefundPolicyPage() {
  const days = DIRECT_PAY_FULL_REFUND_MIN_DAYS
  return (
    <LegalDocLayout title="Refund & Cancellation Policy" lastUpdated="12 November 2026">
      <P>
        AforAudience is a product of Shyamkasturi Productions Private Limited. This policy explains how bookings made
        on AforAudience are cancelled, and who refunds what.
      </P>

      <H2 id="no-payments">1. AforAudience processes no payments</H2>
      <P>
        AforAudience charges no fee and processes no payments. Every payment (tickets paid at entry, venue hire,
        artist fees) is made directly between the people involved, by cash, UPI or bank transfer. Because
        AforAudience never receives or holds the money, it cannot issue or force a refund. What it does is publish
        the standard term below, which both parties agree to before paying, and keep the record of the booking.
      </P>

      <H2 id="audience-cancels">2. Tickets</H2>
      <P>
        Tickets on AforAudience are <strong>free</strong> or <strong>pay at entry</strong>, so nothing is paid in
        advance and there is nothing to refund. If you can&apos;t attend, cancel your reservation in{" "}
        <strong>My Tickets</strong> to release your seat.
      </P>

      {/* The online-payment tiers (src/lib/refund-policy.ts) and the Razorpay
          refund-timing section used to be here. Restore from git (pre-12 Nov)
          if paidBookingsEnabled is ever turned on. */}

      <H2 id="standard-term">3. Venue hire and artist fees: the standard term</H2>
      <P>
        Venue hire and artist fees are paid directly between the Organiser and the Venue Owner or Artist. When a
        booking is cancelled, this standard term applies:
      </P>
      <UL>
        <LI>
          <strong>Cancelled {days} days or more before the booked date:</strong> any advance is refunded in full by the
          party who received it.
        </LI>
        <LI>
          <strong>Cancelled less than {days} days before the booked date:</strong> as agreed between the parties.
        </LI>
      </UL>
      <P>The refund is paid directly by the party who received the advance, not by AforAudience.</P>

      <H2 id="organiser-cancels">4. If an event is cancelled</H2>
      <P>
        The Organiser cancels the event in the app. Every ticket holder, and every Venue Owner and Artist on the
        event, is notified. Any advance for venue hire or artist fees is then settled under the standard term above.
      </P>

      <H2 id="what-afa-does">5. What AforAudience does</H2>
      <UL>
        <LI>Keeps the in-app record of each booking, its dates and its cancellation.</LI>
        <LI>Can mediate between the parties if there is a disagreement.</LI>
        <LI>May restrict accounts that repeatedly cancel late or don&apos;t refund an advance that is due.</LI>
      </UL>

      <H2 id="how-to-cancel">6. How to cancel</H2>
      <P>
        Log in, open <strong>My Tickets</strong> (for tickets) or the booking in your dashboard (for venue and artist
        bookings) and select <strong>Cancel</strong>. The cancellation is recorded with its date.
      </P>

      <H2 id="contact">7. Contact</H2>
      <P>
        Questions about a refund or a cancellation, or if you need the in-app record of a booking:{" "}
        <a href="mailto:info@aforaudience.com">info@aforaudience.com</a>. See also our{" "}
        <Link href="/terms/">Terms of Service</Link> and the <Link href="/contact/">Contact</Link> page.
      </P>
    </LegalDocLayout>
  )
}
