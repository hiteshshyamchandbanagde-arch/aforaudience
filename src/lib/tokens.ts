import crypto from "crypto"

// The raw token goes in the email link; only its SHA-256 hash is ever
// stored, so a database read alone can't be used to reset an account.
export function generateResetToken() {
  const rawToken = crypto.randomBytes(32).toString("hex")
  const tokenHash = hashResetToken(rawToken)
  return { rawToken, tokenHash }
}

export function hashResetToken(rawToken: string) {
  return crypto.createHash("sha256").update(rawToken).digest("hex")
}
