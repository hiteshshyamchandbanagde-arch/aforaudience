import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET/PATCH /api/organisers/me - session 62 addition. orgName/bio could
// previously only be set once, at apply-time (POST /api/organisers/apply) -
// this is the first way to edit them afterward, needed for the new public
// Organiser bio profile page to actually be maintainable.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const organiser = await prisma.organiser.findUnique({
    where: { userId: (session.user as any).id },
  })
  if (!organiser) {
    return NextResponse.json({ error: 'Organiser profile not found' }, { status: 404 })
  }
  return NextResponse.json({ id: organiser.id, orgName: organiser.orgName, bio: organiser.bio })
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const organiser = await prisma.organiser.findUnique({
      where: { userId: (session.user as any).id },
    })
    if (!organiser) {
      return NextResponse.json({ error: 'Organiser profile not found' }, { status: 404 })
    }

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

    const updates: { orgName?: string; bio?: string | null } = {}

    if (Object.prototype.hasOwnProperty.call(body, 'orgName')) {
      const raw = body.orgName
      if (typeof raw !== 'string' || raw.trim() === '') {
        return NextResponse.json({ error: 'orgName cannot be empty' }, { status: 400 })
      }
      updates.orgName = raw.trim().slice(0, 120)
    }

    if (Object.prototype.hasOwnProperty.call(body, 'bio')) {
      const raw = body.bio
      if (raw === null || (typeof raw === 'string' && raw.trim() === '')) {
        updates.bio = null
      } else if (typeof raw === 'string') {
        updates.bio = raw.trim().slice(0, 1000)
      } else {
        return NextResponse.json({ error: 'bio must be a string or null' }, { status: 400 })
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 })
    }

    const updated = await prisma.organiser.update({ where: { id: organiser.id }, data: updates })
    return NextResponse.json({ id: updated.id, orgName: updated.orgName, bio: updated.bio })
  } catch (err) {
    console.error('Error updating organiser profile:', err)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
