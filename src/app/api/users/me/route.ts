import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET /api/users/me
//
// Returns the calling user's editable profile fields. Deliberately a
// narrow projection — never returns password, tokenVersion, or any
// role-application internals. Extend as more editable fields land.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = await prisma.user.findUnique({
    where: { id: (session.user as any).id },
    select: {
      id: true,
      name: true,
      displayName: true,
      email: true,
      phone: true,
      code: true,
      isVerified: true,
    },
  })
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ user })
}

// PATCH /api/users/me
//
// Currently supports one editable field: displayName. Kept as a
// generic "me" endpoint so future editable profile fields (avatar,
// bio for non-artist users, notification prefs) land here rather
// than proliferating per-field routes.
//
// Auth-required. Only affects the calling user's own row.
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = await prisma.user.findUnique({
      where: { id: (session.user as any).id },
    })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const updates: { displayName?: string | null } = {}

    // Only touch displayName if it appears in the body. Undefined means
    // "not touched"; null/empty string means "clear". A trimmed non-empty
    // string sets the value, capped at 120 chars for consistency with
    // register.
    if (Object.prototype.hasOwnProperty.call(body, 'displayName')) {
      const raw = body.displayName
      if (raw === null || (typeof raw === 'string' && raw.trim() === '')) {
        updates.displayName = null
      } else if (typeof raw === 'string') {
        updates.displayName = raw.trim().slice(0, 120)
      } else {
        return NextResponse.json(
          { error: 'displayName must be a string or null' },
          { status: 400 }
        )
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 })
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updates,
      select: {
        id: true,
        name: true,
        displayName: true,
        email: true,
      },
    })

    return NextResponse.json({ ok: true, user: updated })
  } catch (err) {
    console.error('[users/me.PATCH] error:', err)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
