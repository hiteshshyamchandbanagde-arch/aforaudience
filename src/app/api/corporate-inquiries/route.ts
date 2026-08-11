import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendCorporateInquiryEmail } from '@/lib/email'

// FEAT-2608-046 - corporate show booking, inquiry-only. Login required
// as of 11 Aug (Hitesh's rule): any authenticated AFA user can submit -
// no role restriction, since a corporate rep might legitimately hold any
// account type (most likely AUDIENCE). Not scoped to a submittedByUserId
// on the record itself (schema unchanged) - contactName/contactEmail are
// still what gets sent to the artist, same as before; the login gate is
// purely to stop anonymous abuse, not to attribute the inquiry to an
// account.
//
// Length caps (11 Aug, caught live): matches CorporateInquiryModal's
// client-side maxLength attributes - a direct API call bypasses the
// client entirely, so truncating server-side too rather than trusting
// the browser is the only real guarantee. Truncate-not-reject: a client
// that already enforced maxLength never trips this, and a slightly-too-
// long value degrades gracefully instead of losing the whole submission.
const FIELD_LIMITS: Record<string, number> = {
  companyName: 100,
  contactName: 80,
  contactEmail: 120,
  contactPhone: 20,
  eventType: 100,
  city: 60,
  budgetRange: 60,
}
const MESSAGE_LIMIT = 500
const cap = (v: string, limit: number) => v.slice(0, limit)

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
        companyName: cap(companyName.trim(), FIELD_LIMITS.companyName),
        contactName: cap(contactName.trim(), FIELD_LIMITS.contactName),
        contactEmail: cap(contactEmail.trim(), FIELD_LIMITS.contactEmail),
        contactPhone: contactPhone?.trim() ? cap(contactPhone.trim(), FIELD_LIMITS.contactPhone) : null,
        eventType: eventType?.trim() ? cap(eventType.trim(), FIELD_LIMITS.eventType) : null,
        city: city?.trim() ? cap(city.trim(), FIELD_LIMITS.city) : null,
        preferredDate: preferredDate ? new Date(preferredDate) : null,
        budgetRange: budgetRange?.trim() ? cap(budgetRange.trim(), FIELD_LIMITS.budgetRange) : null,
        message: message?.trim() ? cap(message.trim(), MESSAGE_LIMIT) : null,
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
