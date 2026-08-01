import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// ---------------------------------------------------------------------------
// GET /api/feedback/mine
//
// Feedback cms9yxnll - lets a logged-in user see the status of feedback
// they've personally submitted (BUG/FEATURE_IDEA/QUESTION/GENERAL/OTHER),
// so submissions don't feel like they vanish into a black hole. Read-only:
// no reply thread, no internal notes exposed - just their own message,
// category, and current status/resolvedAt. Guest-submitted feedback
// (userId null at submit time) has nothing to attach to and never shows
// here, same as it never shows for anyone else.
// ---------------------------------------------------------------------------

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const items = await prisma.feedback.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      message: true,
      category: true,
      status: true,
      createdAt: true,
      resolvedAt: true,
    },
  });

  return NextResponse.json({ items });
}
