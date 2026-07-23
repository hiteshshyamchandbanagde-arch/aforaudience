import React from 'react'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import OrganiserFollowButton from './OrganiserFollowButton'

// See src/app/venues/page.tsx for why this is needed.
export const dynamic = 'force-dynamic'

async function getOrganiser(id: string) {
  try {
    return await prisma.organiser.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, displayName: true } },
        events: {
          where: { status: 'APPROVED' },
          include: { venue: true },
          orderBy: { date: 'desc' },
        },
      },
    })
  } catch (err) {
    console.error('Failed to fetch organiser:', err)
    return null
  }
}

export default async function OrganiserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const organiser = await getOrganiser(id)

  // Same gate as Venue's isApproved check - an organiser not yet approved
  // shouldn't have a public browsable profile.
  if (!organiser || !organiser.isApproved) {
    return (
      <main style={{ minHeight: '100vh', background: 'var(--afa-cream)', fontFamily: 'system-ui, sans-serif' }}>
        <SiteNav backHref="/events" backLabel="← Back to Events" />
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>Organiser not found.</div>
      </main>
    )
  }

  const now = new Date(new Date().toDateString())
  const upcoming = organiser.events.filter((e) => new Date(e.date) >= now)
  const past = organiser.events.filter((e) => new Date(e.date) < now)

  return (
    <main style={{ minHeight: '100vh', background: 'var(--afa-cream)', fontFamily: 'system-ui, sans-serif' }}>
      <SiteNav backHref="/events" backLabel="← Back to Events" />
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '6px' }}>
          {organiser.orgName}
        </h1>
        {organiser.code && (
          <p style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.4, marginBottom: '8px' }}>{organiser.code}</p>
        )}

        <OrganiserFollowButton organiserId={organiser.id} />

        {organiser.bio && (
          <p style={{ fontSize: '14px', color: 'var(--afa-ink)', opacity: 0.75, lineHeight: 1.6, marginBottom: '28px', maxWidth: '600px' }}>
            {organiser.bio}
          </p>
        )}

        <div style={{ background: 'var(--afa-white)', borderRadius: '12px', padding: '28px', border: '1px solid rgba(14,12,10,0.08)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '16px' }}>
            Events by {organiser.orgName}
          </h2>

          {organiser.events.length === 0 ? (
            <p style={{ fontSize: '14px', color: 'var(--afa-ink)', opacity: 0.5 }}>No published events yet.</p>
          ) : (
            <>
              {upcoming.length > 0 && (
                <div style={{ marginBottom: past.length > 0 ? '24px' : 0 }}>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--afa-ink)', opacity: 0.5, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Upcoming
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {upcoming.map((e) => (
                      <Link
                        key={e.id}
                        href={`/events/${e.id}`}
                        style={{ display: 'block', padding: '12px 16px', background: 'var(--afa-cream)', borderRadius: '8px', textDecoration: 'none', color: 'var(--afa-ink)' }}
                      >
                        <div style={{ fontSize: '14px', fontWeight: 600 }}>{e.title}</div>
                        <div style={{ fontSize: '12px', opacity: 0.6 }}>
                          {new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {e.venue && ` · ${e.venue.name}, ${e.venue.city}`}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {past.length > 0 && (
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--afa-ink)', opacity: 0.5, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Past
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {past.slice(0, 10).map((e) => (
                      <Link
                        key={e.id}
                        href={`/events/${e.id}`}
                        style={{ display: 'block', padding: '12px 16px', background: 'var(--afa-cream)', borderRadius: '8px', textDecoration: 'none', color: 'var(--afa-ink)', opacity: 0.7 }}
                      >
                        <div style={{ fontSize: '14px', fontWeight: 600 }}>{e.title}</div>
                        <div style={{ fontSize: '12px', opacity: 0.6 }}>
                          {new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {e.venue && ` · ${e.venue.name}, ${e.venue.city}`}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  )
}
