import type { Metadata } from "next"
import Link from "next/link"
import LegalDocLayout, { H2, P, UL, LI } from "@/components/LegalDocLayout"

export const metadata: Metadata = {
  title: "Terms of Service — AforAudience",
  description: "The terms that govern your use of AforAudience.",
}

export default function TermsPage() {
  return (
    <LegalDocLayout title="Terms of Service" lastUpdated="8 November 2026">
      <P>
        These Terms of Service ("Terms") govern your use of AforAudience (the "platform"), operated by
        Shyamkasturi Productions Private Limited. AforAudience is a product of Shyamkasturi Productions Private
        Limited. By creating an account or using the platform,
        you agree to these Terms. If you don't agree, please don't use the platform.
      </P>
      <P>
        The platform connects four kinds of users: <strong>Audience</strong> members who discover and book tickets
        to live events; <strong>Artists</strong> (comedians, poets, musicians, and other performers);{" "}
        <strong>Organisers</strong> who create and run events; and <strong>Venue Owners</strong> who list spaces for
        booking.
      </P>

      <H2>1. Eligibility</H2>
      <P>
        You must be at least 18 years old to create an account.
      </P>

      <H2>2. Accounts</H2>
      <P>
        You're responsible for keeping your login credentials secure and for all activity under your account.
        Provide accurate information when registering — in particular, a working phone number, since it's used both
        for verification and, practically, for event-day coordination (ticket delivery issues, entry problems).
        Impersonating someone else, or creating an account for anyone other than yourself, isn't allowed.
      </P>

      <H2 id="booking">3. Booking tickets (Audience)</H2>
      <UL>
        <LI>
          Prices shown at checkout include the ticket price plus a small platform booking fee (currently
          ₹20 per booking, plus GST where applicable), shown separately before you pay.
          We do not take a cut of the ticket price itself or of venue rental.
        </LI>
        <LI>
          Once payment is confirmed, you'll receive a ticket by email and in-app, as a PDF with a unique QR code.{" "}
          <strong>Do not share your ticket QR code or booking ID publicly</strong> — anyone holding it can be checked
          in at the venue in your place, and check-in is first-come, first-served.
        </LI>
        <LI>
          <strong>Refunds and cancellations:</strong> you can cancel a paid booking from My Tickets. What you get
          back depends on how far ahead of the show you cancel, and if the Organiser cancels the event you get a
          full refund including the booking fee. The full rules are in our{" "}
          <Link href="/refund-policy/">Refund &amp; Cancellation Policy</Link>.
        </LI>
        <LI>Free events are ticketed the same way (PDF + QR) but are never charged a platform fee.</LI>
        <LI>
          Events may be rescheduled, relocated, or cancelled by the Organiser. We'll make reasonable efforts to
          notify you, but timing/availability of the underlying live event is the Organiser's responsibility, not
          ours.
        </LI>
      </UL>

      <H2 id="delivery">4. Delivery of tickets</H2>
      <P>
        AforAudience sells no physical goods. Tickets are delivered electronically: on confirmation they appear in
        My Tickets in the app and a confirmation is sent to the email address on the account, normally within
        minutes. If you don&apos;t receive it, contact{" "}
        <a href="mailto:info@aforaudience.com">info@aforaudience.com</a>.
      </P>

      <H2>5. Listing events (Organisers) and venues (Venue Owners)</H2>
      <UL>
        <LI>
          Organisers are responsible for the accuracy of their event listings (date, time, venue, pricing, age
          restrictions, content warnings, etc.) and for delivering the event as advertised.
        </LI>
        <LI>
          Venue Owners are responsible for the accuracy of their listings (capacity, facilities, rates) and for
          honouring confirmed bookings.
        </LI>
        <LI>We do not charge commission on venue rental, performer fees, or ticket sales.</LI>
        <LI>
          We reserve the right to remove listings that are fraudulent, misleading, or that violate these Terms or
          applicable law.
        </LI>
      </UL>

      <H2>6. Payments</H2>
      <P>
        All payments are processed through Razorpay. We don't store your card, UPI, or bank details on our servers.
        Payouts to Organisers and Venue Owners are made as set out in the payout terms agreed when they join.
      </P>

      <H2>7. Check-in</H2>
      <P>
        Tickets are validated at the door via QR scan or manual booking-ID entry by the Organiser or their staff. A
        ticket can only be used once; once checked in, it can't be reused, including by someone else with the same
        QR code or booking ID. We're not responsible for disputes arising from a shared or forwarded ticket being
        used by someone other than the original purchaser.
      </P>

      <H2>8. Acceptable use</H2>
      <P>You agree not to:</P>
      <UL>
        <LI>Use the platform for any unlawful purpose, or to harass, threaten, or defraud other users.</LI>
        <LI>Attempt to circumvent booking fees, security measures, or ticket validation.</LI>
        <LI>Scrape, reverse-engineer, or interfere with the platform's operation.</LI>
        <LI>Post content that is defamatory, obscene, infringing, or that violates others' rights.</LI>
      </UL>
      <P>We may suspend or terminate accounts that violate these Terms.</P>

      <H2>9. Content ownership</H2>
      <P>
        You retain ownership of the content you post (event descriptions, artist bios, photos, etc.), but grant us a
        license to display it on the platform as needed to operate the service. You're responsible for having the
        rights to anything you upload.
      </P>

      <H2>10. Disclaimers &amp; limitation of liability</H2>
      <P>
        The platform is provided "as is." We facilitate discovery, booking, and payment for live events, but we are
        not the organiser, performer, or venue for any given event, and we're not responsible for the quality,
        safety, or conduct of events, venues, or performers listed on the platform. To the maximum extent permitted
        by law, our liability for any claim relating to the platform is limited to the amount of the platform
        booking fee(s) you paid in the relevant transaction.
      </P>

      <H2>11. Governing law</H2>
      <P>
        These Terms are governed by the laws of India, and any disputes will be subject to the exclusive
        jurisdiction of the courts at Pune, Maharashtra.
      </P>

      <H2>12. Changes to these Terms</H2>
      <P>
        We may update these Terms from time to time. Continued use of the platform after changes take effect
        constitutes acceptance of the updated Terms.
      </P>

      <H2>13. Contact us</H2>
      <P>
        Questions about these Terms: <a href="mailto:info@aforaudience.com">info@aforaudience.com</a>. Our
        registered office and Grievance Officer are listed on the <Link href="/contact/">Contact</Link> page.
      </P>
    </LegalDocLayout>
  )
}
