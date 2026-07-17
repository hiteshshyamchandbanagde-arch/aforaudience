import type { Metadata } from "next"
import LegalDocLayout, { H2, P, UL, LI, Placeholder } from "@/components/LegalDocLayout"

export const metadata: Metadata = {
  title: "Privacy Policy — AforAudience",
  description: "How AforAudience collects, uses, and protects your personal data.",
}

export default function PrivacyPage() {
  return (
    <LegalDocLayout title="Privacy Policy" lastUpdated={<Placeholder>date to be set on publish</Placeholder>}>
      <P>
        AforAudience ("we", "us", "the platform") connects comedians, poets, musicians, and other live performers with
        venues, event organisers, and audiences, starting in Pune, India. This policy explains what personal data we
        collect, why, and what rights you have over it.
      </P>
      <P>
        Operated by: <Placeholder>Legal entity name, once registered</Placeholder>
        <br />
        Registered address: <Placeholder>Address, once registered</Placeholder>
        <br />
        Contact for privacy questions: <Placeholder>privacy@aforaudience.com</Placeholder>
      </P>

      <H2>1. What we collect</H2>
      <P>
        <strong>Account information</strong> — name (used as your login username), display name (optional, shown to
        others), email address, phone number, password (stored hashed, never in plain text), and your role on the
        platform (audience, artist, organiser, or venue owner).
      </P>
      <P>
        <strong>Booking &amp; payment information</strong> — event bookings, seat/section selections, and amounts
        paid. Payments themselves are processed by Razorpay; we do not see or store your card, UPI, or bank account
        details — Razorpay handles that directly and is PCI-DSS compliant in its own right.
      </P>
      <P>
        <strong>Verification information</strong> — your phone number is verified via a one-time password sent
        through MSG91. We keep a record that verification succeeded, not the OTP itself beyond its short validity
        window.
      </P>
      <P>
        <strong>Content you provide</strong> — event listings, artist profiles, venue details, lineup applications,
        and any feedback or bug reports you submit (including optional screenshots) through the in-app feedback tool.
      </P>
      <P>
        <strong>Usage information</strong> — standard technical logs (IP address, browser/device type, pages
        visited) collected automatically to keep the service secure and working.
      </P>
      <P>
        We do not knowingly collect information from anyone under the age of <Placeholder>13 / 16 / 18</Placeholder>{" "}
        without appropriate consent, and the platform is not directed at children.
      </P>

      <H2>2. How we use it</H2>
      <UL>
        <LI>To create and run your account, and to let you book, sell, or manage tickets and venue bookings.</LI>
        <LI>
          To send you transactional communications — booking confirmations, tickets (PDF + email via Resend), phone
          verification codes, password resets, and important account or event updates.
        </LI>
        <LI>To process payments and refunds through Razorpay.</LI>
        <LI>To respond to support requests and feedback.</LI>
        <LI>
          To detect and prevent fraud and abuse (for example, validating tickets at check-in so the same ticket
          can't be used twice).
        </LI>
        <LI>To improve the product — understanding which features are used and where things break.</LI>
      </UL>
      <P>
        We do not sell your personal data to third parties, and we do not use your data to serve third-party
        advertising.
      </P>

      <H2>3. Who we share it with</H2>
      <UL>
        <LI><strong>Razorpay</strong> — to process payments and refunds.</LI>
        <LI><strong>Resend</strong> — to deliver transactional emails (tickets, confirmations, password resets).</LI>
        <LI><strong>MSG91</strong> — to deliver phone verification codes.</LI>
        <LI>
          <strong>Supabase</strong> (our database and infrastructure provider) and <strong>Vercel</strong> (our
          application hosting provider) — who host the infrastructure our app runs on, under their own
          data-processing terms.
        </LI>
        <LI>
          <strong>Event organisers and venue owners</strong>, if you book a ticket or make a booking with them — they
          see the attendee/booking information reasonably needed to run their event (e.g. your name and ticket
          details for check-in), not your full account profile.
        </LI>
        <LI><strong>Law enforcement or regulators</strong>, only if legally required to do so.</LI>
      </UL>
      <P>We do not share your data with anyone else without your consent, except as described above.</P>

      <H2>4. Your rights</H2>
      <UL>
        <LI>View and edit your profile information (display name, etc.) from your account settings.</LI>
        <LI>Request a copy of the personal data we hold about you.</LI>
        <LI>Request correction of inaccurate data.</LI>
        <LI>
          Request deletion of your account and associated personal data, subject to what we're legally required to
          retain (e.g. transaction records for tax/audit purposes).
        </LI>
      </UL>
      <P>
        To exercise these rights, contact <Placeholder>privacy email</Placeholder>. We aim to respond within{" "}
        <Placeholder>30 days</Placeholder>.
      </P>

      <H2>5. Data retention</H2>
      <P>
        We keep account and booking data for as long as your account is active, and for a reasonable period
        afterward to comply with tax, accounting, and legal obligations (typically <Placeholder>X years</Placeholder>{" "}
        for financial records under Indian law). Verification codes (OTPs) expire and are discarded within minutes of
        issuance.
      </P>

      <H2>6. Security</H2>
      <P>
        We take reasonable technical and organisational measures to protect your data — passwords are hashed,
        payment details are never stored on our servers, and access to production data is restricted. No system is
        perfectly secure, and we can't guarantee absolute security, but we treat this seriously and will notify
        affected users in the event of a breach as required by law.
      </P>

      <H2>7. Cookies</H2>
      <P>
        We use essential cookies to keep you logged in (authentication session cookies) and to remember basic
        preferences. We do not currently use third-party advertising or tracking cookies.
      </P>

      <H2>8. Grievance Officer</H2>
      <P>
        In accordance with the Information Technology Act, 2000 and rules made thereunder, the Grievance Officer for
        AforAudience is:
      </P>
      <P>
        <Placeholder>Name</Placeholder>
        <br />
        <Placeholder>Email</Placeholder>
        <br />
        <Placeholder>Address</Placeholder>
      </P>

      <H2>9. Changes to this policy</H2>
      <P>
        We may update this policy from time to time. If we make material changes, we'll notify you via email or an
        in-app notice before they take effect.
      </P>

      <H2>10. Contact us</H2>
      <P>
        Questions about this policy: <Placeholder>privacy email</Placeholder>
      </P>
    </LegalDocLayout>
  )
}
