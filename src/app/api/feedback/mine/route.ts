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
// category, and current status/resolvedAt/deployStage/displayId.
//
// Workflow overhaul (session 63) exception to "no internal notes exposed":
// the note attached to a REJECTED or REOPENED transition IS meant for the
// submitter (Hitesh's design explicitly calls it "reason provided by
// admin" / "reopen with comment") - so `latestNote` surfaces that one
// specific note, only when it matches the item's CURRENT status (not
// stale history from an earlier rejection that was later reopened and
// resolved). Every other changeLog entry (severity changes, build-stage
// moves, etc.) stays hidden, same as before.
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
      displayId: true,
      title: true,
      message: true,
      category: true,
      status: true,
      deployStage: true,
      createdAt: true,
      resolvedAt: true,
      changeLog: {
        where: { field: 'status', toValue: { in: ['REJECTED', 'REOPENED'] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { toValue: true, note: true },
      },
    },
  });

  const withLatestNote = items.map(({ changeLog, ...item }: (typeof items)[number]) => ({
    ...item,
    // Only surface it if it matches where the item actually sits right
    // now - an old rejection note shouldn't linger once it's since been
    // reopened and resolved.
    latestNote: changeLog[0]?.toValue === item.status ? changeLog[0].note : null,
  }));

  return NextResponse.json({ items: withLatestNote });
}
