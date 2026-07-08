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
    subject: "Reset your AforAudience password",
    html: `
      <p>We received a request to reset your AforAudience password.</p>
      <p><a href="${resetUrl}">Reset your password</a></p>
      <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    `,
  })
}
