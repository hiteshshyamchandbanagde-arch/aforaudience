import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  getPlatformSettings,
  setAudienceFeeSettings,
  setChatMaxMessagesPerSession,
  setSceneStatusThresholds,
  setArtistRosterHypeScoreLookback,
  MAX_BOOKING_FEE_PAISE,
  MAX_CHAT_MESSAGES_CAP,
} from '@/lib/platform-settings'

// GET /api/admin/platform-settings
// PATCH /api/admin/platform-settings
//
// Admin-only. Reads and writes the singleton PlatformSettings row.
//
// Deliberately narrow projection — this endpoint is UI-facing, not a
// generic config export. If we add more admin-editable fields later,
// they get plumbed through here explicitly, not passed via generic
// key/value objects.

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  const user = await prisma.user.findUnique({
    where: { id: (session.user as any).id },
    select: { id: true, role: true },
  })
  if (!user || user.role !== 'ADMIN') return null
  return user
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const settings = await getPlatformSettings()
  return NextResponse.json({
    settings,
    limits: {
      maxBookingFeePaise: MAX_BOOKING_FEE_PAISE,
      maxChatMessagesCap: MAX_CHAT_MESSAGES_CAP,
    },
  })
}

export async function PATCH(req: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const hasBookingFee = Object.prototype.hasOwnProperty.call(body, 'audienceBookingFee')
  const hasMinFee = Object.prototype.hasOwnProperty.call(body, 'minAudienceBookingFee')
  const hasMaxFee = Object.prototype.hasOwnProperty.call(body, 'maxAudienceBookingFee')
  const hasFeeBand = hasBookingFee || hasMinFee || hasMaxFee
  const hasChatCap = Object.prototype.hasOwnProperty.call(body, 'chatMaxMessagesPerSession')
  const hasRisingMinGigs = Object.prototype.hasOwnProperty.call(body, 'sceneStatusRisingMinGigs')
  const hasRisingMinAvgRating = Object.prototype.hasOwnProperty.call(body, 'sceneStatusRisingMinAvgRating')
  const hasRisingMinAttendees = Object.prototype.hasOwnProperty.call(body, 'sceneStatusRisingMinAttendees')
  const hasFeaturedThreshold = Object.prototype.hasOwnProperty.call(body, 'sceneStatusFeaturedVouchThreshold')
  const hasSceneStatus = hasRisingMinGigs || hasRisingMinAvgRating || hasRisingMinAttendees || hasFeaturedThreshold
  const hasRosterLookback = Object.prototype.hasOwnProperty.call(body, 'artistRosterHypeScoreLookback')

  if (!hasFeeBand && !hasChatCap && !hasSceneStatus && !hasRosterLookback) {
    return NextResponse.json(
      {
        error:
          'audienceBookingFee, minAudienceBookingFee, maxAudienceBookingFee, chatMaxMessagesPerSession, a sceneStatus* field, or artistRosterHypeScoreLookback is required',
      },
      { status: 400 }
    )
  }

  try {
    let updated = await getPlatformSettings()

    // Fee band (min/standard/max) is saved as a unit — see
    // setAudienceFeeSettings. Any field the caller omits falls back to
    // its current value so a single-field PATCH (e.g. just the standard
    // fee) doesn't accidentally reset min/max. All accepted as PAISE
    // (integer); the UI converts from rupees on submit.
    if (hasFeeBand) {
      const toPaise = (label: string, v: unknown): number => {
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          throw new Error(`${label} must be a number (paise)`)
        }
        return Math.round(v)
      }
      const minPaise = hasMinFee ? toPaise('minAudienceBookingFee', body.minAudienceBookingFee) : updated.minAudienceBookingFee
      const standardPaise = hasBookingFee ? toPaise('audienceBookingFee', body.audienceBookingFee) : updated.audienceBookingFee
      const maxPaise = hasMaxFee ? toPaise('maxAudienceBookingFee', body.maxAudienceBookingFee) : updated.maxAudienceBookingFee
      updated = await setAudienceFeeSettings({ minPaise, standardPaise, maxPaise })
    }

    if (hasChatCap) {
      const cap = body.chatMaxMessagesPerSession
      if (typeof cap !== 'number' || !Number.isFinite(cap)) {
        return NextResponse.json(
          { error: 'chatMaxMessagesPerSession must be a number' },
          { status: 400 }
        )
      }
      updated = await setChatMaxMessagesPerSession(Math.round(cap))
    }

    if (hasSceneStatus) {
      updated = await setSceneStatusThresholds({
        risingMinGigs: hasRisingMinGigs ? Number(body.sceneStatusRisingMinGigs) : undefined,
        risingMinAvgRating: hasRisingMinAvgRating ? Number(body.sceneStatusRisingMinAvgRating) : undefined,
        risingMinAttendees: hasRisingMinAttendees ? Number(body.sceneStatusRisingMinAttendees) : undefined,
        featuredVouchThreshold: hasFeaturedThreshold ? Number(body.sceneStatusFeaturedVouchThreshold) : undefined,
      })
    }

    if (hasRosterLookback) {
      const lookback = Number(body.artistRosterHypeScoreLookback)
      if (!Number.isInteger(lookback) || lookback < 1) {
        return NextResponse.json({ error: 'artistRosterHypeScoreLookback must be a positive integer' }, { status: 400 })
      }
      updated = await setArtistRosterHypeScoreLookback(lookback)
    }

    return NextResponse.json({ settings: updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
