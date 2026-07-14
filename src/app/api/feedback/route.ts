import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// ---------------------------------------------------------------------------
// POST /api/feedback
//
// Accepts feedback from both the manual widget tab and the chatbot's
// "I don't know, want to send this to the team?" fallback (see
// src/app/api/chat/route.ts). Guests can submit — browse-first model,
// no reason to gate this behind login (see design doc §2).
//
// No admin surface yet to review these — that's a follow-up story.
// For now, query the table directly via Supabase MCP or a future admin
// page. Kept deliberately minimal: this endpoint's only job is to
// reliably capture the message, not to route/notify/triage it.
// ---------------------------------------------------------------------------

const VALID_CATEGORIES = ['BUG', 'FEATURE_IDEA', 'QUESTION', 'GENERAL', 'OTHER'] as const;
const MAX_MESSAGE_LENGTH = 2000;

export async function POST(req: Request) {
  let body: {
    category?: string;
    message?: string;
    pageUrl?: string;
    fromChatbot?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { category, message, pageUrl, fromChatbot } = body;

  if (!category || !VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
    return NextResponse.json(
      { error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` },
      { status: 400 }
    );
  }

  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `message must be under ${MAX_MESSAGE_LENGTH} characters` },
      { status: 400 }
    );
  }

  // Attach the user if logged in, but never require it.
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

  const feedback = await prisma.feedback.create({
    data: {
      category: category as (typeof VALID_CATEGORIES)[number],
      message: message.trim(),
      pageUrl: typeof pageUrl === 'string' ? pageUrl.slice(0, 500) : null,
      userId,
      fromChatbot: Boolean(fromChatbot),
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: feedback.id }, { status: 201 });
}
