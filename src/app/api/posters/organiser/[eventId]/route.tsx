import { ImageResponse } from 'next/og'
import prisma from '@/lib/prisma'
import { publicEventUrl } from '@/lib/poster-url'
import { loadPosterFonts } from '@/lib/poster-fonts'
import { loadPosterColors, POSTER_LOGO, POSTER_QR } from '@/lib/poster-colors'
import { getSceneStatusBatch } from '@/lib/scene-status'
import QRCode from 'qrcode'
import { formatDate } from '@/lib/format-date'

export const runtime = 'nodejs'

// Session 39 (Feedback ec6e4adf) - Hitesh's design, confirmed over
// several rounds this session:
//   - Available as soon as the venue booking is confirmed (not gated on
//     event publish).
//   - Lineup section stays hidden ("coming soon") until ALL performer
//     slots are filled - reuses the exact same isEventFull logic already
//     used on the artist events page (maxPerformers vs lineup.length),
//     not a new/different definition.
//   - AFA branding mandatory on every poster (platform marketing too).
//   - QR code + link to the public event page on every poster, not just
//     the logo - turns shared posters into a real discovery/booking
//     funnel.
//   - Generated on demand, never cached/stored - event details (date,
//     venue, lineup) can change after a poster's first been shared, and
//     a stale cached image showing wrong info would be worse than none.
//
// Redesigned (same session, Hitesh: "Poster need improvement in
// design") - the first pass looked flat: Satori (next/og's renderer)
// silently can't use system fonts like Georgia at all, so the intended
// serif branding never actually rendered, and the layout left a large
// dead gap in the "lineup coming soon" state. Now uses a real bundled
// serif (see lib/poster-fonts.ts) and a dark background, with content
// sized and spaced to fill the canvas in both the full-lineup and
// coming-soon states.
//
// GEN-2609-119 - colours come from the admin's design tokens (page
// surface, text, primary fill, amber), resolved per request. The logo
// and the QR keep fixed values; see lib/poster-colors.ts.
//
// Single theme for v1 (Hitesh deferred the "how many themes" decision -
// shipping the harder part, the generation mechanism + share flow, with
// one well-built theme now; more themes are a cheap fast-follow once
// this is proven working).
export async function GET(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      venue: { select: { name: true, city: true } },
      organiser: { select: { orgName: true } },
      lineup: {
        where: { cancelledAt: null },
        include: { artist: { select: { id: true, user: { select: { displayName: true, name: true } } } } },
      },
    },
  })

  if (!event) {
    return new Response('Not found', { status: 404 })
  }

  const hasConfirmedVenueBooking = await prisma.venueBooking.findFirst({
    where: { eventId, status: 'CONFIRMED' },
    select: { id: true },
  })
  if (!hasConfirmedVenueBooking) {
    return new Response('Poster not available until the venue booking is confirmed', { status: 404 })
  }

  const isFull = event.maxPerformers !== null && event.lineup.length >= event.maxPerformers

  // Scene Status (reputation epic §1, amended session 55) - Featured and
  // Headliner performers render larger on the poster, reflecting their
  // live/current tier everywhere (not a per-event vouch state - an artist
  // Featured from past shows shows large here even if this organiser
  // personally never vouched for them on this event).
  const sceneStatusByArtistId = await getSceneStatusBatch(event.lineup.map((p: { artist: { id: string } }) => p.artist.id))
  const names = event.lineup.map((p: { artist: { id: string; user: { displayName: string | null; name: string } } }) => ({
    name: p.artist.user.displayName || p.artist.user.name,
    sceneStatus: sceneStatusByArtistId.get(p.artist.id) || 'NEW_EMERGING',
  }))

  const url = publicEventUrl(event.id, req)
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 260, color: { dark: POSTER_QR.dark, light: POSTER_QR.light } })
  const dateStr = formatDate(event.date, 'long')

  const envLabel = process.env.NEXT_PUBLIC_ENV_LABEL
  const isQA = envLabel?.toLowerCase().includes('qa') ?? false
  const fonts = await loadPosterFonts()
  // GEN-2609-119 - resolved once per request; see lib/poster-colors.ts.
  const c = await loadPosterColors()
  const envBadge = c.envBadge(isQA)

  return new ImageResponse(
    (
      <div
        style={{
          width: '1080px',
          height: '1350px',
          display: 'flex',
          flexDirection: 'column',
          background: c.page,
          fontFamily: 'Poster Serif',
          padding: '72px',
          position: 'relative',
        }}
      >
        {/* Faint oversized watermark of the logo's three-bar motif, fills
            the background so the coming-soon state never reads as empty */}
        <div style={{ display: 'flex', position: 'absolute', right: '-60px', bottom: '160px', flexDirection: 'column', opacity: 0.06 }}>
          <div style={{ display: 'flex', width: '460px', height: '90px', background: POSTER_LOGO.barTop, marginBottom: '24px', borderRadius: '8px' }} />
          <div style={{ display: 'flex', width: '340px', height: '90px', background: POSTER_LOGO.barMiddle, marginBottom: '24px', borderRadius: '8px' }} />
          <div style={{ display: 'flex', width: '230px', height: '90px', background: POSTER_LOGO.barBottom, borderRadius: '8px' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '56px' }}>
          <div style={{ display: 'flex', width: '48px', height: '48px', borderRadius: '12px', background: POSTER_LOGO.tile, marginRight: '16px', flexDirection: 'column', padding: '8px' }}>
            <div style={{ display: 'flex', width: '32px', height: '8px', background: POSTER_LOGO.barTop, marginBottom: '4px' }} />
            <div style={{ display: 'flex', width: '24px', height: '8px', background: POSTER_LOGO.barMiddle, marginBottom: '4px' }} />
            <div style={{ display: 'flex', width: '16px', height: '8px', background: POSTER_LOGO.barBottom }} />
          </div>
          <div style={{ display: 'flex', fontSize: '22px', fontWeight: 700, color: POSTER_LOGO.wordmark }}>AforAudience</div>
          {envLabel && (
            <div style={{ display: 'flex', marginLeft: '10px', padding: '3px 10px', fontSize: '13px', fontWeight: 700, color: envBadge.color, background: envBadge.background, borderRadius: '999px' }}>
              {envLabel}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', fontSize: '30px', fontWeight: 700, color: c.accent, textTransform: 'uppercase', letterSpacing: '4px', marginBottom: '20px' }}>
          Open Mic
        </div>

        <div style={{ display: 'flex', fontSize: '84px', fontWeight: 900, color: c.text, lineHeight: 1.05, marginBottom: '40px', maxWidth: '900px' }}>
          {event.title}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', fontSize: '30px', fontWeight: 400, color: c.textSoft, marginBottom: '56px' }}>
          <div style={{ display: 'flex', marginBottom: '10px' }}>{dateStr} · {event.startTime}</div>
          {event.venue && <div style={{ display: 'flex' }}>{event.venue.name}, {event.venue.city}</div>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ display: 'flex', fontSize: '24px', fontWeight: 700, color: c.amber, marginBottom: '28px', textTransform: 'uppercase', letterSpacing: '3px' }}>
            Lineup
          </div>
          {isFull ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {names.map((entry: { name: string; sceneStatus: string }, i: number) => {
                const isBig = entry.sceneStatus === 'FEATURED' || entry.sceneStatus === 'HEADLINER'
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      fontSize: isBig ? '54px' : '42px',
                      fontWeight: 700,
                      color: entry.sceneStatus === 'HEADLINER' ? c.amber : c.text,
                      marginBottom: '20px',
                    }}
                  >
                    {entry.name}
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', fontSize: '34px', fontWeight: 400, color: c.textMuted }}>Lineup coming soon</div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `2px solid ${c.rule}`, paddingTop: '36px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: '22px', fontWeight: 700, color: c.text }}>Book Your Spot</div>
            <div style={{ display: 'flex', fontSize: '18px', fontWeight: 400, color: c.textMuted }}>{url.replace(/^https?:\/\//, '')}</div>
          </div>
          <div style={{ display: 'flex', padding: '14px', background: POSTER_QR.light, borderRadius: '12px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} width={130} height={130} alt="" />
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      fonts: fonts.map((f) => ({ ...f, data: f.data as unknown as ArrayBuffer })),
      // ImageResponse defaults to a 1-year Cache-Control header -
      // explicitly overridden since this is meant to be generated fresh
      // every time (event details can change after a poster's first
      // been shared).
      headers: { 'Cache-Control': 'no-store' },
    }
  )
}
