'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import BrandLoader from '@/components/BrandLoader'
import DashboardShell from '@/components/DashboardShell'
import { fillSolidTint, FILL_SOLID_TINT } from '@/lib/statusStyle'
import Button from '@/components/ui/Button'

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

interface TourInvite {
  id: string
  tour: {
    id: string
    title: string
    subject: string | null
    slug: string
    organiser: { orgName: string }
    stops: { id: string; title: string; date: string; venue: { name: string; city: string } | null }[]
  }
}

interface Performance {
  id: string
  slot: number
  duration: number
  compensationType: 'PAID' | 'FREE' | 'BUY_IN'
  feeAmount: number | null
  buyInAmount: number | null
  cancelledAt: string | null
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
  socialLinks: Record<string, string> | null
  name: string
  displayName: string | null
  email: string
  applications: Application[]
  performances: Performance[]
  followers: Follower[]
}

const APPLICATION_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: 'rgba(201,151,58,0.15)', color: 'var(--afa-gold)' },
  APPROVED: { bg: 'rgba(74,103,65,0.12)', color: 'var(--afa-sage)' },
  REJECTED: { bg: 'rgba(179,38,30,0.1)', color: 'var(--afa-error)' },
}

export default function ArtistDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [navigatingEventId, setNavigatingEventId] = useState<string | null>(null)

  // Same click-guard pattern as /events, /artists, /venues (standing
  // rule, 1 Aug: every tile must open in a single click). These
  // Application cards were static with no navigation at all - found via
  // s60-my-applications-card-not-clickable while click-testing the
  // reputation epic.
  const goToEvent = (id: string) => {
    if (navigatingEventId) return
    setNavigatingEventId(id)
    startTransition(() => {
      router.push(`/events/${id}`)
    })
  }

  const [profile, setProfile] = useState<ArtistProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [replySubmitting, setReplySubmitting] = useState<string | null>(null)
  const [localReplies, setLocalReplies] = useState<Record<string, { text: string; author: { name: string; displayName: string | null } }>>({})
  // Tour by Organiser (12 Aug) - pending Tour consent invites, same
  // "You've been tagged" inbox pattern as panelist/celebrity Accept-to-
  // Appear (GET /api/invites/mine).
  const [tourInvites, setTourInvites] = useState<TourInvite[]>([])
  const [respondingTour, setRespondingTour] = useState<string | null>(null)

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

  useEffect(() => {
    const fetchTourInvites = async () => {
      try {
        const res = await fetch('/api/invites/mine')
        if (res.ok) {
          const data = await res.json()
          setTourInvites(data.tourInvites || [])
        }
      } catch {
        // Non-critical for this view.
      }
    }
    if (session?.user) fetchTourInvites()
  }, [session])

  const respondToTourInvite = async (consentId: string, accept: boolean) => {
    setRespondingTour(consentId)
    try {
      const res = await fetch(`/api/tour-invites/${consentId}/respond`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accept }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to respond')
      setTourInvites((prev) => prev.filter((inv) => inv.id !== consentId))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setRespondingTour(null)
    }
  }

  const cancelPerformance = async (performanceId: string) => {
    if (!window.confirm("Cancel this performance? If it's a Buy-in slot, your payment is recorded as refunded.")) return
    setCancelling(performanceId)
    try {
      const res = await fetch(`/api/performances/${performanceId}/cancel`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to cancel')
      const refreshed = await fetch('/api/artists/me')
      if (refreshed.ok) setProfile(await refreshed.json())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCancelling(null)
    }
  }

  // Client-side mirror of the server's 24h gate - purely so the button
  // can be disabled/labeled correctly before a click; the real
  // enforcement is server-side in POST /api/performances/[id]/cancel.
  const canCancel = (p: Performance) => {
    const [h, m] = p.event.startTime.split(':').map(Number)
    const start = new Date(p.event.date)
    start.setHours(h, m, 0, 0)
    return start.getTime() - Date.now() >= 24 * 60 * 60 * 1000
  }

  if (status === 'loading' || loading) return (<><SiteNav /><BrandLoader /></>)
  if (!session) return <SiteNav />
  if (error) return (<><SiteNav /><DashboardShell><div style={{ padding: 'var(--afa-space-32px)', color: 'var(--afa-error)' }}>{error}</div></DashboardShell></>)
  if (!profile) return (<><SiteNav /><DashboardShell><div style={{ padding: 'var(--afa-space-32px)' }}>Profile not found</div></DashboardShell></>)

  const upcoming = profile.performances
    .filter((p) => !p.cancelledAt && new Date(p.event.date) >= new Date(new Date().toDateString()))
    .sort((a, b) => new Date(a.event.date).getTime() - new Date(b.event.date).getTime())

  // Profile completion - from live feedback (18 Jul): "notify user profile
  // completion percentage... recommend for early completion for better
  // result." Four equally-weighted checks, matching exactly what the
  // feedback named. A more complete profile is a real, low-effort
  // engagement lever - Organisers reviewing applications see bio/genre/
  // style directly, so an artist who fills these out has a materially
  // better shot at approval.
  const completionChecks = [
    !!profile.bio?.trim(),
    profile.genre.length > 0,
    profile.styleTag.length > 0,
    !!profile.socialLinks && Object.values(profile.socialLinks).some((v) => !!v),
  ]
  const completionPercent = Math.round((completionChecks.filter(Boolean).length / completionChecks.length) * 100)

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
      <DashboardShell>
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'var(--afa-space-48px) var(--afa-space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 'var(--afa-space-32px)', flexWrap: 'wrap', gap: 'var(--afa-space-4)' }}>
            <div>
              {/* BUG-2609-018: was profile.name (the API's raw username
                  field) - this heading is the public-profile preview, same
                  fallback chain as the rest of the app. */}
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-page-title-lg)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-6px)' }}>
                {profile.displayName || profile.name || profile.email}
              </h1>
              <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.6 }}>
                {profile.followers.length} follower{profile.followers.length === 1 ? '' : 's'}
              </p>
            </div>
            {/* BUG-2609-010: Edit Profile/Corporate Inquiries/Browse Events
                (My Events, same href) are all now sidebar entries
                (DashboardShell's ARTIST ROLE_SECTIONS). */}
          </div>

          {/* Tour by Organiser (12 Aug) - pending consent invites, one per
              Tour (not per stop). Placed right after the header, same
              can't-miss-it priority as the corporate-inquiry inbox link. */}
          {tourInvites.length > 0 && (
            <div style={{ marginBottom: 'var(--afa-space-28px)', display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-14px)' }}>
              {tourInvites.map((inv) => (
                <div key={inv.id} style={{ background: 'var(--afa-surface-raised)', border: '1px solid var(--afa-gold)', borderRadius: 'var(--afa-radius-12px)', padding: 'var(--afa-space-5) var(--afa-space-6)' }}>
                  <p style={{ fontSize: 'var(--afa-text-ui)', fontWeight: 700, color: 'var(--afa-gold)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--afa-space-2)' }}>
                    Tour invite
                  </p>
                  <h3 style={{ fontSize: 'var(--afa-text-title)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-1)' }}>{inv.tour.title}</h3>
                  <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.7, marginBottom: 'var(--afa-space-10px)' }}>
                    {inv.tour.organiser.orgName} wants to feature you on this Tour
                    {inv.tour.stops.length > 0 && ` — ${inv.tour.stops.length} stop${inv.tour.stops.length > 1 ? 's' : ''}`}.
                  </p>
                  {inv.tour.stops.length > 0 && (
                    <ul style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.8, marginBottom: 'var(--afa-space-14px)', paddingLeft: 'var(--afa-space-18px)' }}>
                      {inv.tour.stops.map((s) => (
                        <li key={s.id}>{s.title} — {new Date(s.date).toLocaleDateString()}{s.venue ? `, ${s.venue.city}` : ''}</li>
                      ))}
                    </ul>
                  )}
                  <div style={{ display: 'flex', gap: 'var(--afa-space-10px)' }}>
                    <button
                      onClick={() => respondToTourInvite(inv.id, true)}
                      disabled={respondingTour === inv.id}
                      style={{ fontSize: 'var(--afa-text-ui)', fontWeight: 600, color: 'var(--afa-on-fill-solid)', background: 'var(--afa-sage)', border: 'none', padding: '9px var(--afa-space-5)', borderRadius: 'var(--afa-radius-md)', cursor: 'pointer' }}
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => respondToTourInvite(inv.id, false)}
                      disabled={respondingTour === inv.id}
                      style={{ fontSize: 'var(--afa-text-ui)', fontWeight: 600, color: 'var(--afa-error)', background: 'transparent', border: '1px solid var(--afa-error-border)', padding: '9px var(--afa-space-5)', borderRadius: 'var(--afa-radius-md)', cursor: 'pointer' }}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Growth messaging for brand-new artists (Hitesh, 31 Jul feedback): a fresh
              profile with zero performances/followers/hype should read as "just the
              beginning", not as a flat empty state. Gated strictly on real zero
              numbers (not a low-but-nonzero score) so it never contradicts actual
              stats once the artist has any real activity. */}
          {profile.performances.length === 0 && profile.followers.length === 0 && (
            <div style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-12px)', padding: 'var(--afa-space-5) var(--afa-space-6)', marginBottom: 'var(--afa-space-6)', border: `1px solid ${fillSolidTint(0.15)}` }}>
              <p style={{ fontSize: 'var(--afa-text-body)', fontWeight: 600, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-1)' }}>
                Today is just the beginning 🎤
              </p>
              <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.65, lineHeight: 1.5 }}>
                Every hype score and follower count starts at zero. Complete your profile and apply to your first event to start building yours — this platform is here to grow with you.
              </p>
            </div>
          )}

          {completionPercent < 100 && (
            <div style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-12px)', padding: 'var(--afa-space-5) var(--afa-space-6)', marginBottom: 'var(--afa-space-6)', border: '1px solid rgba(255,90,54,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--afa-space-10px)', flexWrap: 'wrap', gap: 'var(--afa-space-2)' }}>
                <span style={{ fontSize: 'var(--afa-text-ui)', fontWeight: 600, color: 'var(--afa-text-primary)' }}>Profile {completionPercent}% complete</span>
                <Link href="/dashboard/artist/edit" style={{ fontSize: 'var(--afa-text-ui)', fontWeight: 600, color: 'var(--afa-fill-solid)', textDecoration: 'none' }}>
                  Complete your profile →
                </Link>
              </div>
              <div style={{ height: '6px', borderRadius: 'var(--afa-radius-pill)', background: 'var(--afa-tint-08)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${completionPercent}%`, background: 'var(--afa-fill-solid)', borderRadius: 'var(--afa-radius-pill)' }} />
              </div>
              <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.5, marginTop: 'var(--afa-space-2)' }}>
                A complete profile - bio, genre, style, and a social link - helps Organisers say yes faster.
              </p>
            </div>
          )}

          {/* Profile summary */}
          <div style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-12px)', padding: 'var(--afa-space-28px)', marginBottom: 'var(--afa-space-6)', border: '1px solid var(--afa-tint-08)' }}>
            <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: profile.bio ? 0.8 : 0.4, marginBottom: 'var(--afa-space-4)', lineHeight: 1.6, fontStyle: profile.bio ? 'normal' : 'italic' }}>
              {profile.bio || 'No bio yet — add one from Edit Profile.'}
            </p>
            {(profile.genre.length > 0 || profile.styleTag.length > 0) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--afa-space-2)' }}>
                {profile.genre.map((g) => (
                  <span key={g} style={{ fontSize: 'var(--afa-text-small)', padding: '5px var(--afa-space-3)', background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-pill)', color: 'var(--afa-text-primary)' }}>{g}</span>
                ))}
                {profile.styleTag.map((s) => (
                  <span key={s} style={{ fontSize: 'var(--afa-text-small)', padding: '5px var(--afa-space-3)', background: FILL_SOLID_TINT, borderRadius: 'var(--afa-radius-pill)', color: 'var(--afa-fill-solid)' }}>{s}</span>
                ))}
              </div>
            )}
          </div>

          {/* Recorded Earnings - off-platform promises (§4.5), not real
              platform-processed money. Only shown once there's something
              to show, so a brand-new artist with zero performances doesn't
              see an empty ₹0/₹0/₹0 block. */}
          {(totalCompensation > 0 || totalSpend > 0) && (
            <div style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-12px)', padding: 'var(--afa-space-28px)', marginBottom: 'var(--afa-space-6)', border: '1px solid var(--afa-tint-08)' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-subtitle)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-6px)' }}>
                Recorded Earnings
              </h2>
              <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.5, marginBottom: 'var(--afa-space-18px)' }}>
                Compensation and spend agreed with Organisers - not processed or confirmed by the platform. Tips will show separately once available.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--afa-space-4)' }}>
                <div>
                  <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.5, marginBottom: 'var(--afa-space-1)' }}>Recorded Compensation</p>
                  <p style={{ fontSize: 'var(--afa-text-subheading)', fontWeight: 700, color: 'var(--afa-text-primary)' }}>₹{totalCompensation.toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.5, marginBottom: 'var(--afa-space-1)' }}>Recorded Spend</p>
                  <p style={{ fontSize: 'var(--afa-text-subheading)', fontWeight: 700, color: 'var(--afa-text-primary)' }}>₹{totalSpend.toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.5, marginBottom: 'var(--afa-space-1)' }}>Net</p>
                  <p style={{ fontSize: 'var(--afa-text-subheading)', fontWeight: 700, color: netFigure >= 0 ? 'var(--afa-green-bright)' : 'var(--afa-error)' }}>
                    {netFigure >= 0 ? '+' : '−'}₹{Math.abs(netFigure).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Reviews */}
          <div style={{ marginBottom: 'var(--afa-space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--afa-space-10px)', marginBottom: 'var(--afa-space-14px)' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-subtitle)', fontWeight: 700, color: 'var(--afa-text-primary)' }}>
                Reviews
              </h2>
              {avgRating !== null && (
                <span style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.6 }}>
                  {'⭐'.repeat(Math.round(avgRating))} {avgRating.toFixed(1)} · {allReviews.length} review{allReviews.length === 1 ? '' : 's'}
                </span>
              )}
            </div>
            {allReviews.length === 0 ? (
              <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.5 }}>
                No reviews yet. Audiences can rate you after checking in at a show.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-10px)' }}>
                {allReviews.map((r) => {
                  const reply = r.reply || localReplies[r.id]
                  return (
                    <div key={r.id} style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-10px)', padding: 'var(--afa-space-4) var(--afa-space-5)', border: '1px solid var(--afa-tint-08)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--afa-space-6px)', flexWrap: 'wrap', gap: 'var(--afa-space-2)' }}>
                        <span style={{ fontSize: 'var(--afa-text-body)' }}>{'⭐'.repeat(r.rating)}</span>
                        <span style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.5 }}>{r.eventTitle}</span>
                      </div>
                      {r.comment && (
                        <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.8, lineHeight: 1.5, marginBottom: 'var(--afa-space-6px)' }}>{r.comment}</p>
                      )}
                      <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.4, marginBottom: reply ? '10px' : 0 }}>
                        {r.user.displayName || r.user.name} · {new Date(r.createdAt).toLocaleDateString()}
                      </p>

                      {reply ? (
                        <div style={{ marginTop: 'var(--afa-space-1)', paddingTop: 'var(--afa-space-10px)', borderTop: '1px solid rgba(245,245,240,0.06)' }}>
                          <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.85, lineHeight: 1.5 }}>
                            <strong>Your reply:</strong> {reply.text}
                          </p>
                        </div>
                      ) : (
                        <div style={{ marginTop: 'var(--afa-space-10px)', paddingTop: 'var(--afa-space-10px)', borderTop: '1px solid rgba(245,245,240,0.06)', display: 'flex', gap: 'var(--afa-space-2)' }}>
                          <input
                            type="text"
                            placeholder="Write a reply..."
                            value={replyDrafts[r.id] || ''}
                            onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                            maxLength={500}
                            style={{ flex: 1, padding: 'var(--afa-space-2) var(--afa-space-3)', borderRadius: 'var(--afa-radius-sm)', border: '1px solid var(--afa-border-resting)', fontSize: 'var(--afa-text-ui)', background: 'var(--afa-surface-raised)', color: 'var(--afa-text-primary)' }}
                          />
                          <Button
                            variant="primary"
                            size="sm"
                            fullWidth={false}
                            onClick={() => submitReply(r.id)}
                            disabled={replySubmitting === r.id || !(replyDrafts[r.id] || '').trim()}
                            style={{
                              padding: 'var(--afa-space-2) var(--afa-space-4)',
                              opacity: replySubmitting === r.id || !(replyDrafts[r.id] || '').trim() ? 0.6 : 1,
                            }}
                          >
                            {replySubmitting === r.id ? 'Sending...' : 'Reply'}
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Followers */}
          <div style={{ marginBottom: 'var(--afa-space-6)' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-subtitle)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-14px)' }}>
              Followers
            </h2>
            {profile.followers.length === 0 ? (
              <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.5 }}>
                No followers yet. They&apos;ll show up here as people find your profile.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-2)' }}>
                {profile.followers.map((f) => {
                  const label = f.user.displayName || f.user.name
                  return (
                    <div key={f.id} style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-10px)', padding: 'var(--afa-space-3) var(--afa-space-4)', border: '1px solid var(--afa-tint-08)', display: 'flex', alignItems: 'center', gap: 'var(--afa-space-3)' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%', background: 'var(--afa-fill-solid)', color: 'var(--afa-on-fill-solid)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--afa-text-ui)', fontWeight: 700, flexShrink: 0,
                      }}>
                        {label.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', fontWeight: 500 }}>{label}</span>
                      <span style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.4, marginLeft: 'auto' }}>
                        since {new Date(f.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Upcoming performances */}
          <div style={{ marginBottom: 'var(--afa-space-6)' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-subtitle)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-14px)' }}>
              Upcoming Performances
            </h2>
            {upcoming.length === 0 ? (
              <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.5 }}>No upcoming performances yet. Apply to events to get booked.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-10px)' }}>
                {upcoming.map((p) => (
                  <div key={p.id} style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-10px)', padding: 'var(--afa-space-4) var(--afa-space-5)', border: '1px solid var(--afa-tint-08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--afa-space-10px)' }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 'var(--afa-text-body-lg)', color: 'var(--afa-text-primary)' }}>{p.event.title}</p>
                      <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.6 }}>
                        {new Date(p.event.date).toLocaleDateString()} · {p.event.startTime} · {p.event.venue ? `${p.event.venue.name}, ${p.event.venue.city}` : 'Venue TBD'}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--afa-space-10px)' }}>
                      <span style={{ fontSize: 'var(--afa-text-small)', fontWeight: 600, color: 'var(--afa-fill-solid)' }}>Slot #{p.slot} · {p.duration} min</span>
                      {canCancel(p) ? (
                        <button
                          onClick={() => cancelPerformance(p.id)}
                          disabled={cancelling === p.id}
                          style={{ fontSize: 'var(--afa-text-small)', fontWeight: 600, color: 'var(--afa-error)', background: 'transparent', border: '1px solid rgba(179,38,30,0.3)', borderRadius: 'var(--afa-radius-sm)', padding: 'var(--afa-space-6px) var(--afa-space-3)', cursor: cancelling === p.id ? 'default' : 'pointer', opacity: cancelling === p.id ? 0.6 : 1 }}
                        >
                          {cancelling === p.id ? 'Cancelling...' : 'Cancel'}
                        </button>
                      ) : (
                        <span style={{ fontSize: 'var(--afa-text-micro)', color: 'var(--afa-text-primary)', opacity: 0.4 }} title="Cancellations must be made at least 24 hours before the event">
                          Too close to cancel
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Applications */}
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-subtitle)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-14px)' }}>
              My Applications
            </h2>
            {profile.applications.length === 0 ? (
              <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.5 }}>
                No applications yet. <Link href="/dashboard/artist/events" style={{ color: 'var(--afa-fill-solid)', fontWeight: 600 }}>Browse events</Link> to apply.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-10px)' }}>
                {profile.applications.map((app) => {
                  const appStyle = APPLICATION_STYLE[app.status] || APPLICATION_STYLE.PENDING
                  const isNavigatingThis = navigatingEventId === app.event.id
                  return (
                    <div
                      key={app.id}
                      role="link"
                      tabIndex={0}
                      aria-busy={isNavigatingThis}
                      onClick={() => goToEvent(app.event.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          goToEvent(app.event.id)
                        }
                      }}
                      className="afa-focusable"
                      style={{
                        position: 'relative',
                        background: 'var(--afa-surface-raised)',
                        borderRadius: 'var(--afa-radius-10px)',
                        padding: 'var(--afa-space-4) var(--afa-space-5)',
                        border: '1px solid var(--afa-tint-08)',
                        cursor: navigatingEventId ? 'default' : 'pointer',
                        opacity: navigatingEventId && !isNavigatingThis ? 0.5 : 1,
                        transition: 'opacity 0.15s ease',
                      }}
                    >
                      {isNavigatingThis && (
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            zIndex: 2,
                            borderRadius: 'var(--afa-radius-10px)',
                            background: 'rgba(255,255,255,0.7)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <div
                            style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '50%',
                              border: '3px solid var(--afa-border-resting)',
                              borderTopColor: 'var(--afa-fill-solid)',
                              animation: 'afa-spin 0.7s linear infinite',
                            }}
                          />
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--afa-space-6px)', flexWrap: 'wrap', gap: 'var(--afa-space-2)' }}>
                        <p style={{ fontWeight: 600, fontSize: 'var(--afa-text-body-lg)', color: 'var(--afa-text-primary)' }}>{app.event.title}</p>
                        <span style={{ fontSize: 'var(--afa-text-micro)', fontWeight: 700, textTransform: 'uppercase', padding: 'var(--afa-space-1) var(--afa-space-10px)', borderRadius: 'var(--afa-radius-pill)', background: appStyle.bg, color: appStyle.color }}>
                          {app.status.toLowerCase()}
                        </span>
                      </div>
                      <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.6 }}>
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
      </DashboardShell>
    </>
  )
}
