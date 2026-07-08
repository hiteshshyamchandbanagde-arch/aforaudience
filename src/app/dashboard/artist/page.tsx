'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'

interface Application {
  id: string
  message: string
  status: string
  createdAt: string
  event: {
    id: string
    title: string
    date: string
    venue: { name: string; city: string } | null
    organiser: { orgName: string }
  }
}

interface Performance {
  id: string
  slot: number
  duration: number
  event: {
    id: string
    title: string
    date: string
    startTime: string
    venue: { name: string; city: string } | null
  }
}

interface ArtistProfile {
  id: string
  bio: string
  genre: string[]
  styleTag: string[]
  hypScore: number
  name: string
  applications: Application[]
  performances: Performance[]
}

const APPLICATION_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: 'rgba(201,151,58,0.15)', color: '#8a6a1f' },
  APPROVED: { bg: 'rgba(74,103,65,0.12)', color: '#4A6741' },
  REJECTED: { bg: 'rgba(179,38,30,0.1)', color: '#B3261E' },
}

export default function ArtistDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [profile, setProfile] = useState<ArtistProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/artists/me')
        if (!res.ok) throw new Error('Failed to fetch profile')
        const data = await res.json()
        setProfile(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchProfile()
    }
  }, [session])

  if (status === 'loading' || loading) return (<><SiteNav /><div style={{ padding: '32px' }}>Loading...</div></>)
  if (!session) return <SiteNav />
  if (error) return (<><SiteNav /><div style={{ padding: '32px', color: '#B3261E' }}>{error}</div></>)
  if (!profile) return (<><SiteNav /><div style={{ padding: '32px' }}>Profile not found</div></>)

  const upcoming = profile.performances
    .filter((p) => new Date(p.event.date) >= new Date(new Date().toDateString()))
    .sort((a, b) => new Date(a.event.date).getTime() - new Date(b.event.date).getTime())

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#0E0C0A', marginBottom: '6px' }}>
                {profile.name}
              </h1>
              <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.6 }}>Hype Score: {profile.hypScore.toFixed(1)}</p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Link
                href="/dashboard/artist/edit"
                style={{ fontSize: '14px', fontWeight: 600, color: '#0E0C0A', background: 'transparent', border: '1px solid rgba(14,12,10,0.2)', textDecoration: 'none', padding: '10px 20px', borderRadius: '8px' }}
              >
                Edit Profile
              </Link>
              <Link
                href="/dashboard/artist/events"
                style={{ fontSize: '14px', fontWeight: 600, color: '#F7F3EE', background: '#C8441A', textDecoration: 'none', padding: '10px 20px', borderRadius: '8px' }}
              >
                Browse Events to Apply
              </Link>
            </div>
          </div>

          {/* Profile summary */}
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', marginBottom: '24px', border: '1px solid rgba(14,12,10,0.08)' }}>
            <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: profile.bio ? 0.8 : 0.4, marginBottom: '16px', lineHeight: 1.6, fontStyle: profile.bio ? 'normal' : 'italic' }}>
              {profile.bio || 'No bio yet — add one from Edit Profile.'}
            </p>
            {(profile.genre.length > 0 || profile.styleTag.length > 0) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {profile.genre.map((g) => (
                  <span key={g} style={{ fontSize: '12px', padding: '5px 12px', background: '#F7F3EE', borderRadius: '999px', color: '#0E0C0A' }}>{g}</span>
                ))}
                {profile.styleTag.map((s) => (
                  <span key={s} style={{ fontSize: '12px', padding: '5px 12px', background: 'rgba(200,68,26,0.08)', borderRadius: '999px', color: '#C8441A' }}>{s}</span>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming performances */}
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#0E0C0A', marginBottom: '14px' }}>
              Upcoming Performances
            </h2>
            {upcoming.length === 0 ? (
              <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.5 }}>No upcoming performances yet. Apply to events to get booked.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {upcoming.map((p) => (
                  <div key={p.id} style={{ background: '#fff', borderRadius: '10px', padding: '16px 20px', border: '1px solid rgba(14,12,10,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '15px', color: '#0E0C0A' }}>{p.event.title}</p>
                      <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6 }}>
                        {new Date(p.event.date).toLocaleDateString()} · {p.event.startTime} · {p.event.venue ? `${p.event.venue.name}, ${p.event.venue.city}` : 'Venue TBD'}
                      </p>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#C8441A' }}>Slot #{p.slot} · {p.duration} min</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Applications */}
          <div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#0E0C0A', marginBottom: '14px' }}>
              My Applications
            </h2>
            {profile.applications.length === 0 ? (
              <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.5 }}>
                No applications yet. <Link href="/dashboard/artist/events" style={{ color: '#C8441A', fontWeight: 600 }}>Browse events</Link> to apply.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {profile.applications.map((app) => {
                  const appStyle = APPLICATION_STYLE[app.status] || APPLICATION_STYLE.PENDING
                  return (
                    <div key={app.id} style={{ background: '#fff', borderRadius: '10px', padding: '16px 20px', border: '1px solid rgba(14,12,10,0.08)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
                        <p style={{ fontWeight: 600, fontSize: '15px', color: '#0E0C0A' }}>{app.event.title}</p>
                        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', padding: '4px 10px', borderRadius: '999px', background: appStyle.bg, color: appStyle.color }}>
                          {app.status.toLowerCase()}
                        </span>
                      </div>
                      <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6 }}>
                        {new Date(app.event.date).toLocaleDateString()} · {app.event.venue ? `${app.event.venue.name}, ${app.event.venue.city}` : 'Venue TBD'} · by {app.event.organiser.orgName}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
