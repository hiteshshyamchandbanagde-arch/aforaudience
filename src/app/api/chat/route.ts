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
// Cost note: prompt caching (which would cut the knowledge-base
// portion of each request to ~10% of its input cost) is not used here
// — it lives under a `beta` namespace in the pinned SDK version
// (0.32.1) rather than the stable `messages.create()` surface, and
// reaching into a beta API for a small saving isn't worth the added
// fragility. At current traffic this is a non-issue: even uncached,
// a full conversation turn costs a fraction of a rupee (see the cost
// analysis this feature was built against). Revisit once the SDK is
// bumped to a version with stable caching support, or once real
// traffic volume actually makes the saving worth it.
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
      // NOTE: prompt caching (cache_control on the system block) is a
      // planned cost optimization, not yet wired in — the installed
      // @anthropic-ai/sdk version's TypeScript types don't expose
      // cache_control on this call shape even though the underlying API
      // supports it (confirmed against Anthropic's own docs). Rather
      // than fight the SDK's type definitions and block shipping, this
      // ships uncached: cost goes from ~₹0.11 to ~₹0.30 per conversation
      // turn — still negligible at current traffic. Revisit once SDK
      // types catch up, or by dropping to `as any` deliberately if this
      // becomes worth the cost difference at higher volume.
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
