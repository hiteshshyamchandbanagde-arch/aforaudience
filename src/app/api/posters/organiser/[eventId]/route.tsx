import { ImageResponse } from 'next/og'
import prisma from '@/lib/prisma'
import { publicEventUrl } from '@/lib/poster-url'
import { loadPosterFonts } from '@/lib/poster-fonts'
import QRCode from 'qrcode'

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
// serif (see lib/poster-fonts.ts) and a bold dark plum-black background
// - the same #1A0A1A already used for the artist hero-card treatment
// elsewhere in the app, not a new one-off color - with content sized
// and spaced to fill the canvas in both the full-lineup and
// coming-soon states.
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
        include: { artist: { select: { user: { select: { displayName: true, name: true } } } } },
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
  const names = event.lineup.map((p: { artist: { user: { displayName: string | null; name: string } } }) => p.artist.user.displayName || p.artist.user.name)

  const url = publicEventUrl(event.id)
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 260, color: { dark: '#1A0A1A', light: '#F7F3EE' } })
  const dateStr = new Date(event.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  const envLabel = process.env.NEXT_PUBLIC_ENV_LABEL
  const isQA = envLabel?.toLowerCase().includes('qa') ?? false
  const fonts = await loadPosterFonts()

  return new ImageResponse(
    (
      <div
        style={{
          width: '1080px',
          height: '1350px',
          display: 'flex',
          flexDirection: 'column',
          background: '#1A0A1A',
          fontFamily: 'Poster Serif',
          padding: '72px',
          position: 'relative',
        }}
      >
        {/* Faint oversized watermark of the logo's three-bar motif, fills
            the background so the coming-soon state never reads as empty */}
        <div style={{ display: 'flex', position: 'absolute', right: '-60px', bottom: '160px', flexDirection: 'column', opacity: 0.06 }}>
          <div style={{ display: 'flex', width: '460px', height: '90px', background: '#C8441A', marginBottom: '24px', borderRadius: '8px' }} />
          <div style={{ display: 'flex', width: '340px', height: '90px', background: '#C9973A', marginBottom: '24px', borderRadius: '8px' }} />
          <div style={{ display: 'flex', width: '230px', height: '90px', background: '#F7F3EE', borderRadius: '8px' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '56px' }}>
          <div style={{ display: 'flex', width: '48px', height: '48px', borderRadius: '12px', background: '#0E0C0A', marginRight: '16px', flexDirection: 'column', padding: '8px' }}>
            <div style={{ display: 'flex', width: '32px', height: '8px', background: '#C8441A', marginBottom: '4px' }} />
            <div style={{ display: 'flex', width: '24px', height: '8px', background: '#C9973A', marginBottom: '4px' }} />
            <div style={{ display: 'flex', width: '16px', height: '8px', background: '#F7F3EE' }} />
          </div>
          <div style={{ display: 'flex', fontSize: '22px', fontWeight: 700, color: '#F7F3EE' }}>AforAudience</div>
          {envLabel && (
            <div style={{ display: 'flex', marginLeft: '10px', padding: '3px 10px', fontSize: '13px', fontWeight: 700, color: isQA ? '#F7F3EE' : '#0E0C0A', background: isQA ? '#C8441A' : '#E4DDD2', borderRadius: '999px' }}>
              {envLabel}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', fontSize: '30px', fontWeight: 700, color: '#C8441A', textTransform: 'uppercase', letterSpacing: '4px', marginBottom: '20px' }}>
          Open Mic
        </div>

        <div style={{ display: 'flex', fontSize: '84px', fontWeight: 900, color: '#F7F3EE', lineHeight: 1.05, marginBottom: '40px', maxWidth: '900px' }}>
          {event.title}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', fontSize: '30px', fontWeight: 400, color: '#F7F3EE', opacity: 0.85, marginBottom: '56px' }}>
          <div style={{ display: 'flex', marginBottom: '10px' }}>{dateStr} · {event.startTime}</div>
          {event.venue && <div style={{ display: 'flex' }}>{event.venue.name}, {event.venue.city}</div>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ display: 'flex', fontSize: '24px', fontWeight: 700, color: '#C9973A', marginBottom: '28px', textTransform: 'uppercase', letterSpacing: '3px' }}>
            Lineup
          </div>
          {isFull ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {names.map((name: string, i: number) => (
                <div key={i} style={{ display: 'flex', fontSize: '42px', fontWeight: 700, color: '#F7F3EE', marginBottom: '20px' }}>{name}</div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', fontSize: '34px', fontWeight: 400, color: '#F7F3EE', opacity: 0.55 }}>Lineup coming soon</div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '2px solid rgba(247,243,238,0.2)', paddingTop: '36px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: '22px', fontWeight: 700, color: '#F7F3EE' }}>Book Your Spot</div>
            <div style={{ display: 'flex', fontSize: '18px', fontWeight: 400, color: '#F7F3EE', opacity: 0.5 }}>{url.replace(/^https?:\/\//, '')}</div>
          </div>
          <div style={{ display: 'flex', padding: '14px', background: '#F7F3EE', borderRadius: '12px' }}>
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
