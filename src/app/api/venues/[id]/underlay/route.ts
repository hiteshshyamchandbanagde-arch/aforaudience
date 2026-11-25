import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { put, del } from '@vercel/blob'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// §9.4 seat-map cluster item #5 (session 49) - PDF/image reference
// underlay. One image per (venueId, level), reusing the same Vercel Blob
// store already provisioned and confirmed working for Artist Profile
// Picture uploads (PR #232/#233) - no new infra risk.
const MAX_SIZE_BYTES = 8 * 1024 * 1024 // 8MB - floor plans/scans run larger than avatars
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

async function checkOwnership(venueId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  if (!user) return { error: NextResponse.json({ error: 'User not found' }, { status: 404 }) }

  const venue = await prisma.venue.findUnique({ where: { id: venueId } })
  if (!venue) return { error: NextResponse.json({ error: 'Venue not found' }, { status: 404 }) }

  if (user.role !== 'ADMIN') {
    const venueOwner = await prisma.venueOwner.findUnique({ where: { id: venue.ownerId } })
    if (!venueOwner || venueOwner.userId !== user.id) {
      return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }
    if (!venueOwner.isApproved) {
      return { error: NextResponse.json({ error: 'Your Venue Owner account is still pending approval' }, { status: 403 }) }
    }
  }

  return { venue }
}

// POST uploads/replaces the reference image for one level. multipart/
// form-data: file, level (optional, defaults to '').
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const check = await checkOwnership(id)
  if ('error' in check) return check.error
  // §9.4 Freeze (session 48) framing was "read-only everywhere in this
  // builder" - the underlay is reference material for editing the map,
  // so it stays gated the same way seats/markers are while frozen.
  if (check.venue.seatMapFrozen) {
    return NextResponse.json({ error: 'This seat map is frozen. Unfreeze it first to make changes.' }, { status: 409 })
  }

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

  const level = (formData?.get('level') as string | null)?.trim().slice(0, 60) || ''
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'

  try {
    // Old blob (if any) gets orphaned rather than deleted-then-replaced -
    // deleting first and having the upload fail would leave the level
    // with no underlay at all instead of the old-but-working one.
    const existing = await prisma.venueLevelUnderlay.findUnique({ where: { venueId_level: { venueId: id, level } } })

    const blob = await put(`venue-underlays/${id}-${level || 'main'}-${Date.now()}.${extension}`, file, {
      access: 'public',
      addRandomSuffix: true,
    })

    const row = await prisma.venueLevelUnderlay.upsert({
      where: { venueId_level: { venueId: id, level } },
      create: { venueId: id, level, imageUrl: blob.url },
      update: { imageUrl: blob.url },
    })

    if (existing?.imageUrl && existing.imageUrl !== blob.url) {
      // Best-effort cleanup of the old blob - not fatal if it fails
      // (e.g. already gone, or a transient Blob API error).
      del(existing.imageUrl).catch(() => {})
    }

    return NextResponse.json({ ok: true, level, imageUrl: row.imageUrl, opacity: row.opacity })
  } catch (err) {
    console.error('Underlay upload failed:', err)
    return NextResponse.json({ error: 'Upload failed - please try again.' }, { status: 500 })
  }
}

// PATCH updates just the opacity for an existing underlay - no re-upload.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const check = await checkOwnership(id)
  if ('error' in check) return check.error
  if (check.venue.seatMapFrozen) {
    return NextResponse.json({ error: 'This seat map is frozen. Unfreeze it first to make changes.' }, { status: 409 })
  }

  const body = await req.json()
  const level = typeof body?.level === 'string' ? body.level.trim().slice(0, 60) : ''
  if (typeof body?.opacity !== 'number' || !Number.isFinite(body.opacity) || body.opacity < 0.1 || body.opacity > 1) {
    return NextResponse.json({ error: 'opacity must be a number between 0.1 and 1' }, { status: 400 })
  }

  try {
    const row = await prisma.venueLevelUnderlay.update({
      where: { venueId_level: { venueId: id, level } },
      data: { opacity: body.opacity },
    })
    return NextResponse.json({ ok: true, level, imageUrl: row.imageUrl, opacity: row.opacity })
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return NextResponse.json({ error: 'No underlay exists for this level yet.' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to update opacity' }, { status: 500 })
  }
}

// DELETE removes the underlay for one level.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const check = await checkOwnership(id)
  if ('error' in check) return check.error
  if (check.venue.seatMapFrozen) {
    return NextResponse.json({ error: 'This seat map is frozen. Unfreeze it first to make changes.' }, { status: 409 })
  }

  const { searchParams } = new URL(req.url)
  const level = (searchParams.get('level') || '').trim().slice(0, 60)

  try {
    const existing = await prisma.venueLevelUnderlay.findUnique({ where: { venueId_level: { venueId: id, level } } })
    if (!existing) return NextResponse.json({ ok: true }) // already gone - idempotent

    await prisma.venueLevelUnderlay.delete({ where: { venueId_level: { venueId: id, level } } })
    del(existing.imageUrl).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to remove underlay' }, { status: 500 })
  }
}
