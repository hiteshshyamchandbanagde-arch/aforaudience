import type { Metadata } from "next"
import Link from "next/link"
import LegalDocLayout, { H2, P } from "@/components/LegalDocLayout"

export const metadata: Metadata = {
  title: "Contact Us — AforAudience",
  description: "How to reach AforAudience and Shyamkasturi Productions Private Limited.",
}

const ADDRESS_LINES = [
  "A-504, The Nest Co-op Housing Society",
  "Sr. No. 76/2, Chandrabhaga Corner",
  "Ravet, Haveli, Pune 412101",
  "Maharashtra, India",
]

const addressStyle = { fontStyle: "normal", marginBottom: "var(--afa-space-4)", opacity: 0.88 } as const

function AddressLines() {
  return (
    <>
      {ADDRESS_LINES.map((line) => (
        <span key={line}>
          {line}
          <br />
        </span>
      ))}
    </>
  )
}

// L1 (8 Nov) - Contact page for Razorpay website verification. English only,
// like /terms and /privacy.
export default function ContactPage() {
  return (
    <LegalDocLayout title="Contact Us" lastUpdated="8 November 2026">
      <P>AforAudience is a product of Shyamkasturi Productions Private Limited.</P>

      <H2 id="support">Customer support</H2>
      <P>
        For help with bookings, tickets, refunds or your account, email{" "}
        <a href="mailto:info@aforaudience.com">info@aforaudience.com</a> or call{" "}
        <a href="tel:+919225139690">+91 92251 39690</a>.
      </P>

      <H2 id="company">Company</H2>
      <address style={addressStyle}>
        <strong>Shyamkasturi Productions Private Limited</strong>
        <br />
        Registered office:
        <br />
        <AddressLines />
        Email: <a href="mailto:info@shyamkasturiproductions.com">info@shyamkasturiproductions.com</a>
        <br />
        Phone: <a href="tel:+919225139690">+91 92251 39690</a>
      </address>

      <H2 id="grievance-officer">Grievance Officer</H2>
      <P>
        In accordance with the Information Technology Act, 2000 and the rules made under it, the Grievance Officer
        for AforAudience is:
      </P>
      <address style={addressStyle}>
        <strong>Shyamchand Bangade</strong>, Director
        <br />
        Email: <a href="mailto:info@aforaudience.com">info@aforaudience.com</a>
        <br />
        Phone: <a href="tel:+919225139690">+91 92251 39690</a>
        <br />
        <AddressLines />
      </address>

      <H2 id="policies">Policies</H2>
      <P>
        Read our <Link href="/refund-policy/">Refund &amp; Cancellation Policy</Link>,{" "}
        <Link href="/terms/">Terms of Service</Link> and <Link href="/privacy/">Privacy Policy</Link>.
      </P>
    </LegalDocLayout>
  )
}
