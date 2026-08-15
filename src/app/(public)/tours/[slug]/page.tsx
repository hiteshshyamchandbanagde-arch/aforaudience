import prisma from '@/lib/prisma'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'

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
        <main style={{ maxWidth: '700px', margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: '17px', color: 'var(--afa-text-primary)' }}>This Tour isn't available.</p>
        </main>
      </>
    )
  }

  return (
    <>
      <SiteNav />
      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 24px 100px' }}>
        <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--afa-terracotta)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
          Tour · {tour.organiser.orgName}
        </p>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '34px', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: '12px' }}>
          {tour.title}
        </h1>
        {tour.subject && (
          <p style={{ fontSize: '16px', color: 'var(--afa-text-primary)', opacity: 0.75, marginBottom: '32px', maxWidth: '600px' }}>
            {tour.subject}
          </p>
        )}

        {tour.stops.length === 0 ? (
          <div style={{ background: 'var(--afa-surface-raised)', borderRadius: '12px', padding: '40px 24px', textAlign: 'center', border: '1px solid rgba(245,245,240,0.08)' }}>
            <p style={{ fontSize: '15px', color: 'var(--afa-text-primary)', opacity: 0.6 }}>No stops are open for booking yet - check back soon.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {tour.stops.map((stop: (typeof tour.stops)[number]) => (
              <Link
                key={stop.id}
                href={`/events/${stop.id}`}
                style={{ display: 'block', background: 'var(--afa-surface-raised)', borderRadius: '12px', padding: '22px 24px', border: '1px solid rgba(245,245,240,0.08)', textDecoration: 'none' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
                  <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '19px', fontWeight: 700, color: 'var(--afa-text-primary)' }}>{stop.title}</h3>
                  {stop.status === 'COMPLETED' && (
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', padding: '4px 10px', borderRadius: '999px', background: 'rgba(245,245,240,0.08)', color: 'var(--afa-text-primary)', whiteSpace: 'nowrap' }}>
                      Completed
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '13px', color: 'var(--afa-text-primary)', opacity: 0.65, marginBottom: '10px' }}>
                  {new Date(stop.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {stop.startTime}
                  {stop.venue && ` · ${stop.venue.name}, ${stop.venue.city}`}
                </p>
                {stop.lineup.length > 0 && (
                  <p style={{ fontSize: '13px', color: 'var(--afa-text-primary)' }}>
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
