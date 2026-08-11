import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendCorporateInquiryEmail } from '@/lib/email'

// FEAT-2608-046 - corporate show booking, inquiry-only. Deliberately no
// auth required to POST: the person reaching out is a corporate buyer,
// not necessarily an AFA account holder at all (Organiser/Artist/etc
// accounts don't apply here) - same "anyone can reach an artist" shape
// as a public contact form. Basic required-field + email-shape validation
// only; no rate limiting yet (same posture as other public forms in this
// codebase today, not a new gap introduced here).
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { artistId, companyName, contactName, contactEmail, contactPhone, eventType, city, preferredDate, budgetRange, message } = body

    if (!artistId || !companyName?.trim() || !contactName?.trim() || !contactEmail?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailPattern.test(contactEmail.trim())) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    const artist = await prisma.artist.findUnique({
      where: { id: artistId },
      include: { user: { select: { email: true, name: true, displayName: true } } },
    })
    if (!artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
    }

    const inquiry = await prisma.corporateBookingInquiry.create({
      data: {
        artistId,
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone?.trim() || null,
        eventType: eventType?.trim() || null,
        city: city?.trim() || null,
        preferredDate: preferredDate ? new Date(preferredDate) : null,
        budgetRange: budgetRange?.trim() || null,
        message: message?.trim() || null,
      },
    })

    // Fire-and-forget - don't fail the submission over an email hiccup,
    // same pattern as sendEmailVerificationEmail's caller.
    if (artist.user.email) {
      sendCorporateInquiryEmail(artist.user.email, artist.user.displayName || artist.user.name, {
        companyName: inquiry.companyName,
        contactName: inquiry.contactName,
        contactEmail: inquiry.contactEmail,
        contactPhone: inquiry.contactPhone,
        eventType: inquiry.eventType,
        city: inquiry.city,
        message: inquiry.message,
      }).catch((err) => console.error('[corporate-inquiries] email send failed:', err))
    }

    return NextResponse.json({ id: inquiry.id }, { status: 201 })
  } catch (err) {
    console.error('[corporate-inquiries POST] error:', err)
    return NextResponse.json({ error: 'Failed to submit inquiry' }, { status: 500 })
  }
}

// Artist's own inbox of inquiries received - auth required, scoped to
// the logged-in artist's own artistId only (never another artist's).
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user || user.role !== 'ARTIST') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const artist = await prisma.artist.findUnique({ where: { userId: user.id } })
    if (!artist) {
      return NextResponse.json({ error: 'Artist profile not found' }, { status: 404 })
    }

    const inquiries = await prisma.corporateBookingInquiry.findMany({
      where: { artistId: artist.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(inquiries)
  } catch (err) {
    console.error('[corporate-inquiries GET] error:', err)
    return NextResponse.json({ error: 'Failed to load inquiries' }, { status: 500 })
  }
}
