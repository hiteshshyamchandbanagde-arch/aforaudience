import Anthropic from '@anthropic-ai/sdk';

// ---------------------------------------------------------------------------
// Anthropic client — single source of truth for how the support-chatbot
// SDK is initialized, matching the pattern in src/lib/razorpay.ts: one
// file owns the env var read and the "is this configured" check, so
// the rest of the codebase never touches process.env directly for
// this integration.
//
// Env var expected:
//   - ANTHROPIC_API_KEY (server-only; never exposed to the client)
//
// Model choice: Haiku 4.5. This is a bounded FAQ chatbot, not an agent
// — it needs to follow a tight system prompt reliably and respond fast
// at low cost, not perform novel reasoning. At current pricing ($1/$5
// per million input/output tokens), a cache-assisted conversation turn
// costs well under ₹0.15 — see the cost discussion that led to this
// choice.
// ---------------------------------------------------------------------------

const API_KEY = process.env.ANTHROPIC_API_KEY;

export function anthropicCredentialsPresent(): boolean {
  return Boolean(API_KEY);
}

let client: Anthropic | null = null;

/**
 * Lazily-constructed singleton client. Constructing Anthropic() with no
 * key throws immediately, so we only build it once the caller has already
 * checked `anthropicCredentialsPresent()`.
 */
export function getAnthropicClient(): Anthropic {
  if (!API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY is not configured. Check anthropicCredentialsPresent() before calling this.'
    );
  }
  if (!client) {
    client = new Anthropic({ apiKey: API_KEY });
  }
  return client;
}

export const CHAT_MODEL = 'claude-haiku-4-5-20251001';
