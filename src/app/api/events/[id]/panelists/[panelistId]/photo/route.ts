import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { put, del } from '@vercel/blob'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// Competition show (31 Jul) - per-panelist photo upload, same Blob-store
// reuse pattern as celebrity-photo and venue underlays.
const MAX_SIZE_BYTES = 8 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

async function checkOwnership(eventId: string, panelistId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  if (!user) return { error: NextResponse.json({ error: 'User not found' }, { status: 404 }) }

  const event = await prisma.event.findUnique({ where: { id: eventId } })
  if (!event) return { error: NextResponse.json({ error: 'Event not found' }, { status: 404 }) }

  const panelist = await prisma.eventPanelist.findUnique({ where: { id: panelistId } })
  if (!panelist || panelist.eventId !== eventId) {
    return { error: NextResponse.json({ error: 'Panelist not found' }, { status: 404 }) }
  }

  if (user.role !== 'ADMIN') {
    const organiser = await prisma.organiser.findUnique({ where: { id: event.organiserId } })
    if (!organiser || organiser.userId !== user.id) {
      return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }
  }

  return { event, panelist }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string; panelistId: string }> }) {
  const { id, panelistId } = await params
  const check = await checkOwnership(id, panelistId)
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
    const existingUrl = check.panelist.photoUrl
    const blob = await put(`event-panelists/${panelistId}-${Date.now()}.${extension}`, file, {
      access: 'public',
      addRandomSuffix: true,
    })

    await prisma.eventPanelist.update({ where: { id: panelistId }, data: { photoUrl: blob.url } })

    if (existingUrl && existingUrl !== blob.url) {
      del(existingUrl).catch(() => {})
    }

    return NextResponse.json({ ok: true, photoUrl: blob.url })
  } catch (err) {
    console.error('Panelist photo upload failed:', err)
    return NextResponse.json({ error: 'Upload failed - please try again.' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; panelistId: string }> }) {
  const { id, panelistId } = await params
  const check = await checkOwnership(id, panelistId)
  if ('error' in check) return check.error

  try {
    const existingUrl = check.panelist.photoUrl
    await prisma.eventPanelist.update({ where: { id: panelistId }, data: { photoUrl: null } })
    if (existingUrl) del(existingUrl).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to remove photo' }, { status: 500 })
  }
}
