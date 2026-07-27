import { ImageResponse } from 'next/og'
import prisma from '@/lib/prisma'
import { publicEventUrl } from '@/lib/poster-url'
import { loadPosterFonts } from '@/lib/poster-fonts'
import QRCode from 'qrcode'

export const runtime = 'nodejs'

// Session 39 (Feedback ec6e4adf) - artist's individual poster. Triggers
// on THEIR OWN Performance row existing and being active (cancelledAt
// null), independent of whether the rest of the event's lineup is still
// filling - no reason to make one artist wait on others to promote
// their own set. Uses the artist's AFA profile photo, per Hitesh's
// decision (hype score explicitly removed from scope).
//
// Redesigned (same session, Hitesh: "Poster need improvement in
// design") - same real serif font + dark plum-black background as the
// organiser poster (see that route's comment for the full reasoning),
// not a separately-invented style.
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
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: '#1A0A1A', light: '#F7F3EE' } })
  const dateStr = new Date(performance.event.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

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

        <div style={{ display: 'flex', fontSize: '28px', fontWeight: 700, color: '#C8441A', textTransform: 'uppercase', letterSpacing: '4px', marginBottom: '32px' }}>
          I&apos;m Performing At
        </div>

        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: '56px' }}>
          {performance.artist.user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={performance.artist.user.avatar} width={170} height={170} style={{ borderRadius: '50%', objectFit: 'cover', marginRight: '36px', border: '4px solid #C8441A' }} alt="" />
          ) : (
            <div style={{ display: 'flex', width: '170px', height: '170px', borderRadius: '50%', background: '#C8441A', color: '#F7F3EE', fontSize: '68px', fontWeight: 700, alignItems: 'center', justifyContent: 'center', marginRight: '36px' }}>
              {artistName.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ display: 'flex', fontSize: '52px', fontWeight: 900, color: '#F7F3EE', maxWidth: '600px', lineHeight: 1.1 }}>{artistName}</div>
        </div>

        <div style={{ display: 'flex', fontSize: '62px', fontWeight: 900, color: '#F7F3EE', lineHeight: 1.1, marginBottom: '40px', maxWidth: '900px' }}>
          {performance.event.title}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', fontSize: '30px', fontWeight: 400, color: '#F7F3EE', opacity: 0.85, flex: 1 }}>
          <div style={{ display: 'flex', marginBottom: '10px' }}>{dateStr} · {performance.event.startTime}</div>
          {performance.event.venue && <div style={{ display: 'flex' }}>{performance.event.venue.name}, {performance.event.venue.city}</div>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '2px solid rgba(247,243,238,0.2)', paddingTop: '36px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: '22px', fontWeight: 700, color: '#F7F3EE' }}>Come Watch Me</div>
            <div style={{ display: 'flex', fontSize: '18px', fontWeight: 400, color: '#F7F3EE', opacity: 0.5 }}>{url.replace(/^https?:\/\//, '')}</div>
          </div>
          <div style={{ display: 'flex', padding: '14px', background: '#F7F3EE', borderRadius: '12px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} width={120} height={120} alt="" />
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      fonts: fonts.map((f) => ({ ...f, data: f.data as unknown as ArrayBuffer })),
      // Same no-store override as the organiser poster route - see there.
      headers: { 'Cache-Control': 'no-store' },
    }
  )
}
