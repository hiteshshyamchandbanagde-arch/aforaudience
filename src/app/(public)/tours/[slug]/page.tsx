import prisma from '@/lib/prisma'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import { formatDate } from '@/lib/format-date'

// Tour by Organiser (12 Aug) - public landing page. Server component,
// direct prisma read (same pattern as the artist profile page) rather
// than a client fetch to GET /api/tours/[slug], since this needs no
// interactivity beyond navigation. Deliberately only ever shows
// APPROVED/COMPLETED stops - a stop still waiting on artist consent is
// an internal management detail (see GET /api/tours/[slug] for the same
// rule enforced API-side too).
export default async function TourLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const tour = await prisma.tour.findUnique({
    where: { slug },
    include: {
      organiser: { select: { orgName: true } },
      stops: {
        where: { status: { in: ['APPROVED', 'COMPLETED'] } },
        include: {
          venue: { select: { name: true, city: true } },
          lineup: {
            where: { cancelledAt: null },
            include: { artist: { include: { user: { select: { name: true, displayName: true } } } } },
            orderBy: { slot: 'asc' },
          },
        },
        orderBy: { date: 'asc' },
      },
    },
  })

  if (!tour || tour.status === 'CANCELLED') {
    return (
      <>
        <SiteNav />
        <main style={{ maxWidth: '700px', margin: '0 auto', padding: '80px var(--afa-space-6)', textAlign: 'center' }}>
          <p style={{ fontSize: 'var(--afa-text-title)', color: 'var(--afa-text-primary)' }}>This Tour isn't available.</p>
        </main>
      </>
    )
  }

  return (
    <>
      <SiteNav />
      <main style={{ maxWidth: '800px', margin: '0 auto', padding: 'var(--afa-space-48px) var(--afa-space-6) 100px' }}>
        <p style={{ fontSize: 'var(--afa-text-small)', fontWeight: 700, color: 'var(--afa-fill-solid)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--afa-space-2)' }}>
          Tour · {tour.organiser.orgName}
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '34px', // token-ok(font-size-literal): tour page h1, the only 34px display-font title, above page-title-lg (32px), the top step of the scale
          fontWeight: 700,
          color: 'var(--afa-text-primary)',
          marginBottom: 'var(--afa-space-3)',
        }}>
          {tour.title}
        </h1>
        {tour.subject && (
          <p style={{ fontSize: 'var(--afa-text-title)', color: 'var(--afa-text-primary)', opacity: 0.75, marginBottom: 'var(--afa-space-32px)', maxWidth: '600px' }}>
            {tour.subject}
          </p>
        )}

        {tour.stops.length === 0 ? (
          <div style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', padding: '40px var(--afa-space-6)', textAlign: 'center', border: '1px solid var(--afa-tint-08)' }}>
            <p style={{ fontSize: 'var(--afa-text-body-lg)', color: 'var(--afa-text-primary)', opacity: 0.6 }}>No stops are open for booking yet - check back soon.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-4)' }}>
            {tour.stops.map((stop: (typeof tour.stops)[number]) => (
              <Link
                key={stop.id}
                href={`/events/${stop.id}`}
                style={{ display: 'block', background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', padding: '22px var(--afa-space-6)', border: '1px solid var(--afa-tint-08)', textDecoration: 'none' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--afa-space-3)', marginBottom: 'var(--afa-space-2)' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-subtitle)', fontWeight: 700, color: 'var(--afa-text-primary)' }}>{stop.title}</h3>
                  {stop.status === 'COMPLETED' && (
                    <span style={{ fontSize: 'var(--afa-text-micro)', fontWeight: 700, textTransform: 'uppercase', padding: 'var(--afa-space-1) var(--afa-space-10px)', borderRadius: 'var(--afa-radius-pill)', background: 'var(--afa-tint-08)', color: 'var(--afa-text-primary)', whiteSpace: 'nowrap' }}>
                      Completed
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.65, marginBottom: 'var(--afa-space-10px)' }}>
                  {formatDate(stop.date, 'medium')} · {stop.startTime}
                  {stop.venue && ` · ${stop.venue.name}, ${stop.venue.city}`}
                </p>
                {stop.lineup.length > 0 && (
                  <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)' }}>
                    Featuring {stop.lineup.map((l: (typeof stop.lineup)[number]) => l.artist.user.displayName || l.artist.user.name).join(', ')}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
