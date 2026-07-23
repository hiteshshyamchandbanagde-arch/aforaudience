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

interface Review {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  user: { name: string; displayName: string | null }
  reply: { text: string; author: { name: string; displayName: string | null } } | null
}

interface Performance {
  id: string
  slot: number
  duration: number
  compensationType: 'PAID' | 'FREE' | 'BUY_IN'
  feeAmount: number | null
  buyInAmount: number | null
  event: {
    id: string
    title: string
    date: string
    startTime: string
    venue: { name: string; city: string } | null
  }
  reviews: Review[]
}

interface Follower {
  id: string
  createdAt: string
  user: { name: string; displayName: string | null; avatar: string | null }
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
  followers: Follower[]
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
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [replySubmitting, setReplySubmitting] = useState<string | null>(null)
  const [localReplies, setLocalReplies] = useState<Record<string, { text: string; author: { name: string; displayName: string | null } }>>({})

  const submitReply = async (reviewId: string) => {
    const text = (replyDrafts[reviewId] || '').trim()
    if (!text) return
    setReplySubmitting(reviewId)
    try {
      const res = await fetch(`/api/reviews/${reviewId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send reply')
      setLocalReplies((prev) => ({
        ...prev,
        [reviewId]: { text: data.text, author: { name: profile?.name || '', displayName: null } },
      }))
      setReplyDrafts((prev) => ({ ...prev, [reviewId]: '' }))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setReplySubmitting(null)
    }
  }

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

  const allReviews = profile.performances
    .flatMap((p) => p.reviews.map((r) => ({ ...r, eventTitle: p.event.title })))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const avgRating = allReviews.length > 0 ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length : null

  // Recorded compensation/spend - these are off-platform promises between
  // Organiser and Artist (§4.5 "never tax the scene" model), NOT real
  // platform-processed money. Deliberately kept separate from Tips (once
  // tipping ships) rather than blended into one trust-implying total -
  // the platform never confirms this money actually changed hands.
  const totalCompensation = profile.performances
    .filter((p) => p.compensationType === 'PAID')
    .reduce((sum, p) => sum + (p.feeAmount || 0), 0)
  const totalSpend = profile.performances
    .filter((p) => p.compensationType === 'BUY_IN')
    .reduce((sum, p) => sum + (p.buyInAmount || 0), 0)
  const netFigure = totalCompensation - totalSpend

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
              <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.6 }}>
                Hype Score: {profile.hypScore.toFixed(1)} · {profile.followers.length} follower{profile.followers.length === 1 ? '' : 's'}
              </p>
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

          {/* Recorded Earnings - off-platform promises (§4.5), not real
              platform-processed money. Only shown once there's something
              to show, so a brand-new artist with zero performances doesn't
              see an empty ₹0/₹0/₹0 block. */}
          {(totalCompensation > 0 || totalSpend > 0) && (
            <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', marginBottom: '24px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#0E0C0A', marginBottom: '6px' }}>
                Recorded Earnings
              </h2>
              <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.5, marginBottom: '18px' }}>
                Compensation and spend agreed with Organisers - not processed or confirmed by the platform. Tips will show separately once available.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
                <div>
                  <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.5, marginBottom: '4px' }}>Recorded Compensation</p>
                  <p style={{ fontSize: '22px', fontWeight: 700, color: '#0E0C0A' }}>₹{totalCompensation.toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.5, marginBottom: '4px' }}>Recorded Spend</p>
                  <p style={{ fontSize: '22px', fontWeight: 700, color: '#0E0C0A' }}>₹{totalSpend.toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.5, marginBottom: '4px' }}>Net</p>
                  <p style={{ fontSize: '22px', fontWeight: 700, color: netFigure >= 0 ? '#2F7D4A' : '#B3261E' }}>
                    {netFigure >= 0 ? '+' : '−'}₹{Math.abs(netFigure).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Reviews */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '14px' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#0E0C0A' }}>
                Reviews
              </h2>
              {avgRating !== null && (
                <span style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6 }}>
                  {'⭐'.repeat(Math.round(avgRating))} {avgRating.toFixed(1)} · {allReviews.length} review{allReviews.length === 1 ? '' : 's'}
                </span>
              )}
            </div>
            {allReviews.length === 0 ? (
              <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.5 }}>
                No reviews yet. Audiences can rate you after checking in at a show.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {allReviews.map((r) => {
                  const reply = r.reply || localReplies[r.id]
                  return (
                    <div key={r.id} style={{ background: '#fff', borderRadius: '10px', padding: '16px 20px', border: '1px solid rgba(14,12,10,0.08)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ fontSize: '14px' }}>{'⭐'.repeat(r.rating)}</span>
                        <span style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.5 }}>{r.eventTitle}</span>
                      </div>
                      {r.comment && (
                        <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.8, lineHeight: 1.5, marginBottom: '6px' }}>{r.comment}</p>
                      )}
                      <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.4, marginBottom: reply ? '10px' : 0 }}>
                        {r.user.displayName || r.user.name} · {new Date(r.createdAt).toLocaleDateString()}
                      </p>

                      {reply ? (
                        <div style={{ marginTop: '4px', paddingTop: '10px', borderTop: '1px solid rgba(14,12,10,0.06)' }}>
                          <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.85, lineHeight: 1.5 }}>
                            <strong>Your reply:</strong> {reply.text}
                          </p>
                        </div>
                      ) : (
                        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(14,12,10,0.06)', display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            placeholder="Write a reply..."
                            value={replyDrafts[r.id] || ''}
                            onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                            maxLength={500}
                            style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(14,12,10,0.15)', fontSize: '13px' }}
                          />
                          <button
                            onClick={() => submitReply(r.id)}
                            disabled={replySubmitting === r.id || !(replyDrafts[r.id] || '').trim()}
                            style={{
                              fontSize: '12px', fontWeight: 600, padding: '8px 16px', borderRadius: '6px', border: 'none',
                              background: '#C8441A', color: 'white', cursor: replySubmitting === r.id ? 'default' : 'pointer',
                              opacity: replySubmitting === r.id || !(replyDrafts[r.id] || '').trim() ? 0.6 : 1,
                            }}
                          >
                            {replySubmitting === r.id ? 'Sending...' : 'Reply'}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Followers */}
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#0E0C0A', marginBottom: '14px' }}>
              Followers
            </h2>
            {profile.followers.length === 0 ? (
              <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.5 }}>
                No followers yet. They&apos;ll show up here as people find your profile.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {profile.followers.map((f) => {
                  const label = f.user.displayName || f.user.name
                  return (
                    <div key={f.id} style={{ background: '#fff', borderRadius: '10px', padding: '12px 16px', border: '1px solid rgba(14,12,10,0.08)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%', background: '#0E0C0A', color: '#F7F3EE',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, flexShrink: 0,
                      }}>
                        {label.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontSize: '14px', color: '#0E0C0A', fontWeight: 500 }}>{label}</span>
                      <span style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.4, marginLeft: 'auto' }}>
                        since {new Date(f.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  )
                })}
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
