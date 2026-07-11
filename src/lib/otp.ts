import crypto from "crypto"
import { prisma } from "@/lib/prisma"

const OTP_LENGTH = 6
const OTP_EXPIRY_MINUTES = 5
const MAX_SEND_PER_WINDOW = 3
const SEND_WINDOW_MINUTES = 10
const MAX_VERIFY_ATTEMPTS = 5

export type OtpPurpose = "LOGIN" | "SIGNUP_VERIFY"

interface OtpProvider {
  name: string
  send(phone: string, code: string): Promise<void>
}

// QA only. Never calls a real SMS gateway - the code is returned to the
// caller (see devCode below) so the QA UI can display it directly. Selected
// via OTP_PROVIDER=mock, which must only ever be set in the Preview/qa
// scope in Vercel, never Production.
class MockOtpProvider implements OtpProvider {
  name = "mock"
  async send(phone: string, code: string): Promise<void> {
    console.log(`[MOCK OTP] phone=${phone} code=${code} (not actually sent - QA only)`)
  }
}

// Production. India-only for now - MSG91's OTP API requires DLT template
// registration per TRAI regulation, which is India-specific.
class Msg91OtpProvider implements OtpProvider {
  name = "msg91"
  async send(phone: string, code: string): Promise<void> {
    const authKey = process.env.MSG91_AUTH_KEY
    const templateId = process.env.MSG91_TEMPLATE_ID
    if (!authKey || !templateId) {
      throw new Error(
        "MSG91_AUTH_KEY / MSG91_TEMPLATE_ID missing - cannot send real OTP. Check Vercel Production env vars."
      )
    }

    const res = await fetch("https://control.msg91.com/api/v5/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: authKey },
      body: JSON.stringify({
        template_id: templateId,
        mobile: phone.startsWith("+") ? phone : `+91${phone}`,
        otp: code,
        otp_expiry: OTP_EXPIRY_MINUTES,
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`MSG91 send failed: ${res.status} ${text}`)
    }
  }
}

function getProvider(): OtpProvider {
  // Fail-safe default: a missing/misconfigured env var in prod must never
  // silently fall back to mock. Only an explicit "mock" enables it.
  const name = process.env.OTP_PROVIDER ?? "msg91"
  return name === "mock" ? new MockOtpProvider() : new Msg91OtpProvider()
}

function generateNumericCode(length: number): string {
  const max = 10 ** length
  return crypto.randomInt(0, max).toString().padStart(length, "0")
}

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex")
}

export interface GenerateAndSendResult {
  ok: true
  /** Only populated when using the mock provider (QA). Always undefined in prod. */
  devCode?: string
}

export async function generateAndSendOtp(phone: string, purpose: OtpPurpose): Promise<GenerateAndSendResult> {
  const windowStart = new Date(Date.now() - SEND_WINDOW_MINUTES * 60_000)
  const recentCount = await prisma.otp.count({
    where: { phone, purpose, createdAt: { gte: windowStart } },
  })
  if (recentCount >= MAX_SEND_PER_WINDOW) {
    throw new Error("Too many OTP requests. Please wait a few minutes and try again.")
  }

  const provider = getProvider()
  const code = generateNumericCode(OTP_LENGTH)
  const codeHash = hashCode(code)
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000)

  await prisma.otp.create({ data: { phone, codeHash, purpose, expiresAt } })
  await provider.send(phone, code)

  return { ok: true, devCode: provider.name === "mock" ? code : undefined }
}

export async function verifyOtp(
  phone: string,
  submittedCode: string,
  purpose: OtpPurpose
): Promise<{ ok: boolean; error?: string }> {
  const otp = await prisma.otp.findFirst({
    where: { phone, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  })

  if (!otp) return { ok: false, error: "No pending code for this number. Request a new one." }
  if (otp.expiresAt < new Date()) return { ok: false, error: "Code expired. Request a new one." }
  if (otp.attempts >= MAX_VERIFY_ATTEMPTS) {
    return { ok: false, error: "Too many incorrect attempts. Request a new code." }
  }

  if (hashCode(submittedCode) !== otp.codeHash) {
    await prisma.otp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } })
    return { ok: false, error: "Incorrect code." }
  }

  await prisma.otp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } })
  return { ok: true }
}
