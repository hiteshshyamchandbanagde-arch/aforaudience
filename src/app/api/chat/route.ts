import { NextResponse } from 'next/server';
import { getAnthropicClient, anthropicCredentialsPresent, CHAT_MODEL } from '@/lib/anthropic';
import { renderKnowledgeBaseForPrompt } from '@/lib/site-knowledge';

// ---------------------------------------------------------------------------
// POST /api/chat
//
// Bounded FAQ chatbot. Answers ONLY from `src/lib/site-knowledge.ts` —
// the system prompt is explicit and repeated (belt-and-suspenders) that
// the model must not answer from general knowledge, must not invent
// policy details, and must say it doesn't know rather than guess. This
// matters specifically because this platform handles real ticket
// payments, and a wrong refund-policy answer from a bot is a real
// trust/liability problem, not just an embarrassing typo.
//
// Cost note: prompt caching is not used here, and after a second look
// it wouldn't help even if wired. Two independent blockers, both real:
//
//   1. In the pinned SDK (@anthropic-ai/sdk 0.32.1) `cache_control`
//      lives only under `client.beta.messages` and
//      `client.beta.promptCaching.messages` — not on the stable
//      `client.messages.create()` surface used below. Fixable by
//      switching to the beta client.
//
//   2. The deeper blocker: the rendered system prompt is ~1.2-1.3k
//      tokens (SITE_KNOWLEDGE + strict-rules preamble). Anthropic's
//      Haiku prompt-caching minimum is 2048 tokens. Below that, the
//      API silently doesn't cache — so even a fully-wired PR would
//      change nothing at today's knowledge-base size.
//
// Making caching actually pay off would need one of: SITE_KNOWLEDGE
// grown by ~800 tokens (a product call, not engineering), or switching
// to Sonnet (which costs MORE per token — defeats the purpose). At
// current traffic a full turn is ~₹0.30, still negligible, so this is
// intentionally left off.
//
// No conversation persistence: each request carries its own short
// history from the client. Nothing is stored server-side beyond what
// flows into Feedback when the "I don't know" fallback is used and the
// user explicitly chooses to send it.
//
// Rate limiting: relies on Vercel's platform-level abuse protection for
// now. Revisit if this becomes a cost or abuse vector at higher traffic
// — not needed at current scale.
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are the AforAudience support assistant, embedded on the AforAudience website (a live-art and event discovery platform in India).

STRICT RULES — follow these exactly:
1. Answer ONLY using the information in the "SITE KNOWLEDGE" section below. Do not use any other knowledge you have about ticketing platforms, refund norms, or anything else.
2. If the answer is not clearly covered in SITE KNOWLEDGE, say so plainly — do NOT guess, infer, or extrapolate a plausible-sounding answer. Say something like: "I don't have that information yet. Would you like to send this question to the team instead?"
3. Never invent specific numbers, dates, policies, or promises that aren't in SITE KNOWLEDGE — especially about refunds, fees, or payments. If a number or policy isn't explicitly stated below, treat it as unknown.
4. Keep answers short — 2-4 sentences. This is a quick-help widget, not a long-form assistant.
5. Be warm and direct. No corporate hedging, no "as an AI" disclaimers.
6. If asked something completely unrelated to AforAudience (general trivia, coding help, etc.), politely redirect: this assistant only helps with AforAudience questions.

SITE KNOWLEDGE:
${renderKnowledgeBaseForPrompt()}`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: Request) {
  if (!anthropicCredentialsPresent()) {
    return NextResponse.json(
      { error: 'Chat is not configured on this environment.' },
      { status: 503 }
    );
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages array is required' }, { status: 400 });
  }

  // Cap history length server-side too — defense in depth against a
  // client sending an unbounded conversation and inflating cost.
  const recentMessages = messages.slice(-10);

  // Basic shape validation — don't trust the client's role/content types.
  for (const m of recentMessages) {
    if (
      !m ||
      (m.role !== 'user' && m.role !== 'assistant') ||
      typeof m.content !== 'string' ||
      m.content.length > 2000
    ) {
      return NextResponse.json({ error: 'Malformed message in history' }, { status: 400 });
    }
  }

  const anthropic = getAnthropicClient();

  try {
    const response = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: 400,
      // See the file-level comment above for the full "why not prompt
      // caching" analysis - short version: SDK stable shape doesn't
      // expose cache_control, AND the system prompt is below Haiku's
      // 2048-token cache minimum, so even a fully-wired PR would
      // change nothing at today's knowledge-base size.
      system: SYSTEM_PROMPT,
      messages: recentMessages.map((m) => ({ role: m.role, content: m.content })),
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const answer = textBlock && 'text' in textBlock ? textBlock.text : '';

    // Heuristic used by the frontend to decide whether to surface the
    // "send to team" fallback CTA. Kept simple and readable rather than
    // asking the model to emit structured JSON — a bounded FAQ bot's
    // plain-text "I don't know" phrasing is reliable enough to detect
    // this way, and structured output would cost more tokens for no
    // real benefit here.
    const suggestsFallback =
      /don't have that information|don't know|not sure|send this|send it to the team|ask the team/i.test(
        answer
      );

    return NextResponse.json({
      answer,
      suggestsFallback,
    });
  } catch (err) {
    console.error('[api/chat] Anthropic request failed:', err);
    return NextResponse.json(
      { error: 'The assistant is temporarily unavailable. Please try the feedback form instead.' },
      { status: 502 }
    );
  }
}
