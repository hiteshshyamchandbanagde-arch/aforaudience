import { ImageResponse } from 'next/og'
import prisma from '@/lib/prisma'
import { publicEventUrl } from '@/lib/poster-url'
import QRCode from 'qrcode'

export const runtime = 'nodejs'

// Session 39 (Feedback ec6e4adf) - artist's individual poster. Triggers
// on THEIR OWN Performance row existing and being active (cancelledAt
// null), independent of whether the rest of the event's lineup is still
// filling - no reason to make one artist wait on others to promote
// their own set. Uses the artist's AFA profile photo, per Hitesh's
// decision (hype score explicitly removed from scope). Same single-
// theme-for-v1 approach as the organiser poster.
export async function GET(req: Request, { params }: { params: Promise<{ performanceId: string }> }) {
  const { performanceId } = await params

  const performance = await prisma.performance.findUnique({
    where: { id: performanceId },
    include: {
      event: { include: { venue: { select: { name: true, city: true } } } },
      artist: { select: { user: { select: { displayName: true, name: true, avatar: true } } } },
    },
  })

  if (!performance || performance.cancelledAt) {
    return new Response('Not found', { status: 404 })
  }

  const artistName = performance.artist.user.displayName || performance.artist.user.name
  const url = publicEventUrl(performance.event.id)
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: '#0E0C0A', light: '#F7F3EE' } })
  const dateStr = new Date(performance.event.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

  // Same env-detection as EnvBadge - see the organiser poster route for
  // the full comment.
  const envLabel = process.env.NEXT_PUBLIC_ENV_LABEL
  const isQA = envLabel?.toLowerCase().includes('qa') ?? false

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
          {envLabel && (
            <div style={{ display: 'flex', marginLeft: '10px', padding: '3px 10px', fontSize: '13px', fontWeight: 600, color: isQA ? '#F7F3EE' : '#0E0C0A', background: isQA ? '#C8441A' : '#E4DDD2', borderRadius: '999px' }}>
              {envLabel}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', fontSize: '26px', color: '#C8441A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '20px' }}>
          I&apos;m Performing At
        </div>

        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: '48px' }}>
          {performance.artist.user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={performance.artist.user.avatar} width={160} height={160} style={{ borderRadius: '50%', objectFit: 'cover', marginRight: '32px' }} alt="" />
          ) : (
            <div style={{ display: 'flex', width: '160px', height: '160px', borderRadius: '50%', background: '#0E0C0A', color: '#F7F3EE', fontSize: '64px', alignItems: 'center', justifyContent: 'center', marginRight: '32px' }}>
              {artistName.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ display: 'flex', fontSize: '48px', fontWeight: 700, color: '#0E0C0A' }}>{artistName}</div>
        </div>

        <div style={{ display: 'flex', fontSize: '56px', fontWeight: 700, color: '#0E0C0A', lineHeight: 1.15, marginBottom: '24px' }}>
          {performance.event.title}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', fontSize: '28px', color: '#0E0C0A', opacity: 0.8, flex: 1 }}>
          <div style={{ display: 'flex', marginBottom: '8px' }}>{dateStr} · {performance.event.startTime}</div>
          {performance.event.venue && <div style={{ display: 'flex' }}>{performance.event.venue.name}, {performance.event.venue.city}</div>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '2px solid rgba(14,12,10,0.15)', paddingTop: '32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: '20px', color: '#0E0C0A', opacity: 0.6 }}>Come watch me</div>
            <div style={{ display: 'flex', fontSize: '18px', color: '#0E0C0A', opacity: 0.45 }}>{url.replace(/^https?:\/\//, '')}</div>
          </div>
          { /* eslint-disable-next-line @next/next/no-img-element */ }
          <img src={qrDataUrl} width={110} height={110} alt="" />
        </div>
      </div>
    ),
    // Same no-store override as the organiser poster route - see there.
    { width: 1080, height: 1350, headers: { 'Cache-Control': 'no-store' } }
  )
}
