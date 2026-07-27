import { ImageResponse } from 'next/og'
import prisma from '@/lib/prisma'
import { publicEventUrl } from '@/lib/poster-url'
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
      bookingRequests: { select: { status: true } },
    },
  })

  if (!event) {
    return new Response('Not found', { status: 404 })
  }

  // Only meaningful once a venue booking is actually confirmed, per
  // Hitesh's trigger decision - not gated on event.status/publish.
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
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: '#0E0C0A', light: '#F7F3EE' } })

  const dateStr = new Date(event.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

  return new ImageResponse(
    (
      <div
        style={{
          width: '1080px',
          height: '1350px',
          display: 'flex',
          flexDirection: 'column',
          background: '#F7F3EE',
          fontFamily: 'Georgia, serif',
          padding: '64px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '48px' }}>
          <div style={{ display: 'flex', width: '48px', height: '48px', borderRadius: '12px', background: '#0E0C0A', marginRight: '16px', flexDirection: 'column', padding: '8px' }}>
            <div style={{ display: 'flex', width: '32px', height: '8px', background: '#C8441A', marginBottom: '4px' }} />
            <div style={{ display: 'flex', width: '24px', height: '8px', background: '#C9973A', marginBottom: '4px' }} />
            <div style={{ display: 'flex', width: '16px', height: '8px', background: '#F7F3EE' }} />
          </div>
          <div style={{ display: 'flex', fontSize: '22px', fontWeight: 700, color: '#0E0C0A' }}>AforAudience</div>
        </div>

        <div style={{ display: 'flex', fontSize: '64px', fontWeight: 700, color: '#0E0C0A', lineHeight: 1.15, marginBottom: '24px' }}>
          {event.title}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', fontSize: '28px', color: '#0E0C0A', opacity: 0.8, marginBottom: '48px' }}>
          <div style={{ display: 'flex', marginBottom: '8px' }}>{dateStr} · {event.startTime}</div>
          {event.venue && <div style={{ display: 'flex' }}>{event.venue.name}, {event.venue.city}</div>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ display: 'flex', fontSize: '22px', fontWeight: 700, color: '#C8441A', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '2px' }}>
            Lineup
          </div>
          {isFull ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {names.map((name: string, i: number) => (
                <div key={i} style={{ display: 'flex', fontSize: '34px', color: '#0E0C0A', marginBottom: '14px' }}>{name}</div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', fontSize: '30px', color: '#0E0C0A', opacity: 0.6 }}>Lineup coming soon</div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '2px solid rgba(14,12,10,0.15)', paddingTop: '32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: '20px', color: '#0E0C0A', opacity: 0.6 }}>Book your spot</div>
            <div style={{ display: 'flex', fontSize: '18px', color: '#0E0C0A', opacity: 0.45 }}>{url.replace(/^https?:\/\//, '')}</div>
          </div>
          { /* eslint-disable-next-line @next/next/no-img-element */ }
          <img src={qrDataUrl} width={120} height={120} alt="" />
        </div>
      </div>
    ),
    // ImageResponse defaults to a 1-year Cache-Control header - explicitly
    // overridden since this is meant to be generated fresh every time
    // (event details can change after a poster's first been shared).
    { width: 1080, height: 1350, headers: { 'Cache-Control': 'no-store' } }
  )
}
