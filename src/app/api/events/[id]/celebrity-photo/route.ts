import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { put, del } from '@vercel/blob'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// Competition show (31 Jul) - celebrity-attending photo upload. Reuses the
// same Vercel Blob store already provisioned/confirmed working for Artist
// Profile Pictures (PR #232/#233) and venue underlays - no new infra risk.
const MAX_SIZE_BYTES = 8 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

async function checkOwnership(eventId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  if (!user) return { error: NextResponse.json({ error: 'User not found' }, { status: 404 }) }

  const event = await prisma.event.findUnique({ where: { id: eventId } })
  if (!event) return { error: NextResponse.json({ error: 'Event not found' }, { status: 404 }) }

  if (user.role !== 'ADMIN') {
    const organiser = await prisma.organiser.findUnique({ where: { id: event.organiserId } })
    if (!organiser || organiser.userId !== user.id) {
      return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }
  }

  return { event }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const check = await checkOwnership(id)
  if ('error' in check) return check.error

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "File upload isn't configured on this environment yet - a Vercel Blob store needs to be created and linked to the project first." },
      { status: 503 }
    )
  }

  const formData = await req.formData().catch(() => null)
  const file = formData?.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Please upload a JPEG, PNG, or WebP image.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'Image must be under 8MB.' }, { status: 400 })
  }

  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'

  try {
    const existingUrl = check.event.celebrityPhotoUrl
    const blob = await put(`event-celebrity/${id}-${Date.now()}.${extension}`, file, {
      access: 'public',
      addRandomSuffix: true,
    })

    await prisma.event.update({ where: { id }, data: { celebrityPhotoUrl: blob.url } })

    // Old blob orphaned (not deleted) on replace, same pattern as venue
    // underlays - a failed re-upload can't leave the event photo-less.
    if (existingUrl && existingUrl !== blob.url) {
      del(existingUrl).catch(() => {})
    }

    return NextResponse.json({ ok: true, celebrityPhotoUrl: blob.url })
  } catch (err) {
    console.error('Celebrity photo upload failed:', err)
    return NextResponse.json({ error: 'Upload failed - please try again.' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const check = await checkOwnership(id)
  if ('error' in check) return check.error

  try {
    const existingUrl = check.event.celebrityPhotoUrl
    await prisma.event.update({ where: { id }, data: { celebrityPhotoUrl: null } })
    if (existingUrl) del(existingUrl).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to remove photo' }, { status: 500 })
  }
}
