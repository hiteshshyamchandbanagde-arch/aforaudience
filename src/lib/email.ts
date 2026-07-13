import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = process.env.EMAIL_FROM || "AforAudience <no-reply@aforaudience.com>"

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  if (!resend) {
    // No RESEND_API_KEY configured (e.g. local dev). Don't fail the
    // request over it - log the link so the flow is still testable.
    console.warn("[email] RESEND_API_KEY not set, skipping send. Reset URL:", resetUrl)
    return
  }

  await resend.emails.send({
    from: FROM,
    to,
    replyTo: "info@aforaudience.com",
    subject: "Reset your AforAudience password",
    html: `
      <p>We received a request to reset your AforAudience password.</p>
      <p><a href="${resetUrl}">Reset your password</a></p>
      <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    `,
  })
}

// Fire-and-forget from register/route.ts - deliberately does not block
// signup completion. Phone OTP is the one mandatory verification gate;
// email verification is a background nudge, not a login requirement.
export async function sendEmailVerificationEmail(to: string, verifyUrl: string) {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set, skipping send. Verify URL:", verifyUrl)
    return
  }

  await resend.emails.send({
    from: FROM,
    to,
    replyTo: "info@aforaudience.com",
    subject: "Verify your AforAudience email",
    html: `
      <p>Welcome to AforAudience! Confirm this is your email address.</p>
      <p><a href="${verifyUrl}">Verify your email</a></p>
      <p>This link expires in 24 hours. You can keep using your account either way - this is just a confirmation.</p>
    `,
  })
}

// Ticket delivery. Sent from the delivery orchestrator once a booking
// transitions to CONFIRMED. PDF is passed in as bytes so the caller
// controls PDF generation lifecycle (regenerate on demand from the
// download endpoint too, so we never store a stale copy).
//
// TICKETS_FROM defaults to a role-address on the sending subdomain
// (`tickets@mail.aforaudience.com`) so filters and DMARC alignment
// route cleanly. Overridable via env if we ever move senders.
export type TicketEmailInput = {
  to: string
  attendeeName: string
  eventTitle: string
  eventDateHuman: string
  venueLine: string | null
  seatsSummary: string
  totalAmount: number
  bookingId: string
  ticketPdf: Uint8Array
}

const TICKETS_FROM =
  process.env.EMAIL_FROM_TICKETS ||
  "AforAudience Tickets <tickets@mail.aforaudience.com>"

export async function sendTicketEmail(input: TicketEmailInput) {
  if (!resend) {
    // Local dev / mis-configured env — log so the flow is still
    // testable end-to-end without a real Resend key.
    console.warn(
      "[email] RESEND_API_KEY not set, skipping ticket send. Booking:",
      input.bookingId
    )
    return
  }

  const amountLine =
    input.totalAmount > 0
      ? `₹${input.totalAmount.toLocaleString("en-IN")}`
      : "Free entry"

  await resend.emails.send({
    from: TICKETS_FROM,
    to: input.to,
    replyTo: "info@aforaudience.com",
    subject: `You're in! ${input.eventTitle}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #0E0C0A; max-width: 560px; margin: 0 auto; padding: 24px;">
        <div style="font-size: 22px; font-weight: 700; margin-bottom: 4px;">
          <span style="color: #C8441A;">A</span>forAudience
        </div>
        <div style="font-size: 12px; color: #8a827a; margin-bottom: 32px;">Where art finds its crowd</div>

        <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 30px; font-weight: 700; line-height: 1.2; margin-bottom: 16px;">
          You're in.
        </div>
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          Hi ${escapeHtml(input.attendeeName)}, your booking for
          <strong>${escapeHtml(input.eventTitle)}</strong> is confirmed.
          Your ticket is attached to this email as a PDF.
        </p>

        <table role="presentation" cellspacing="0" cellpadding="0" style="width: 100%; background: #F7F3EE; border-radius: 12px; padding: 20px; margin-bottom: 24px; border-collapse: separate;">
          <tr>
            <td style="padding: 8px 0;">
              <div style="font-size: 10px; font-weight: 700; color: #C8441A; letter-spacing: 0.06em; margin-bottom: 4px;">WHEN</div>
              <div style="font-size: 14px;">${escapeHtml(input.eventDateHuman)}</div>
            </td>
          </tr>
          ${
            input.venueLine
              ? `<tr><td style="padding: 8px 0;">
                <div style="font-size: 10px; font-weight: 700; color: #C8441A; letter-spacing: 0.06em; margin-bottom: 4px;">WHERE</div>
                <div style="font-size: 14px;">${escapeHtml(input.venueLine)}</div>
              </td></tr>`
              : ""
          }
          <tr>
            <td style="padding: 8px 0;">
              <div style="font-size: 10px; font-weight: 700; color: #C8441A; letter-spacing: 0.06em; margin-bottom: 4px;">SEATS</div>
              <div style="font-size: 14px;">${escapeHtml(input.seatsSummary)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">
              <div style="font-size: 10px; font-weight: 700; color: #C8441A; letter-spacing: 0.06em; margin-bottom: 4px;">AMOUNT PAID</div>
              <div style="font-size: 14px;">${escapeHtml(amountLine)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">
              <div style="font-size: 10px; font-weight: 700; color: #C8441A; letter-spacing: 0.06em; margin-bottom: 4px;">BOOKING ID</div>
              <div style="font-size: 12px; font-family: 'SF Mono', Menlo, Consolas, monospace;">${escapeHtml(input.bookingId)}</div>
            </td>
          </tr>
        </table>

        <p style="font-size: 13px; color: #8a827a; line-height: 1.6; margin: 0 0 8px;">
          Show the QR on the attached PDF at the door — screen or print is fine.
          Doors typically open 15 minutes before showtime.
        </p>
        <p style="font-size: 13px; color: #8a827a; line-height: 1.6; margin: 0 0 24px;">
          Non-transferable. One entry per booking, up to the seat count shown above.
        </p>

        <p style="font-size: 12px; color: #8a827a; margin: 0;">
          Reply to this email if you need help — a human reads every reply.
        </p>
      </div>
    `,
    attachments: [
      {
        filename: `aforaudience-ticket-${input.bookingId}.pdf`,
        content: Buffer.from(input.ticketPdf).toString("base64"),
      },
    ],
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
