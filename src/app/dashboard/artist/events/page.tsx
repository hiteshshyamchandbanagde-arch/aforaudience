'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import SiteNav from '@/components/SiteNav'
import PosterShareCard from '@/components/PosterShareCard'
import { useToast } from '@/components/Toast'
import BrandLoader from '@/components/BrandLoader'
import DashboardShell from '@/components/DashboardShell'

interface EventItem {
  id: string
  title: string
  description: string
  type: string
  date: string
  startTime: string
  isFree: boolean
  ticketPrice: number | null
  defaultCompensationType: 'FREE' | 'PAID' | 'BUY_IN'
  defaultFeeAmount: number | null
  defaultBuyInAmount: number | null
  maxPerformers: number | null
  lineup: { id: string }[]
  venue: { name: string; city: string } | null
}

function compensationBadge(event: EventItem): { label: string; bg: string; color: string } {
  if (event.defaultCompensationType === 'PAID') {
    return { label: `You're paid: ₹${event.defaultFeeAmount?.toLocaleString('en-IN') ?? '—'}`, bg: 'rgba(74,103,65,0.12)', color: 'var(--afa-sage)' }
  }
  if (event.defaultCompensationType === 'BUY_IN') {
    return { label: `Buy-in required: ₹${event.defaultBuyInAmount?.toLocaleString('en-IN') ?? '—'}`, bg: 'rgba(179,38,30,0.1)', color: 'var(--afa-error)' }
  }
  return { label: 'Free / Exposure slot', bg: 'rgba(245,245,240,0.06)', color: 'var(--afa-text-primary)' }
}

// Full lineups no longer hard-block applying - they queue as WAITLISTED
// instead (Hitesh's own admin note, 22 Jul). FCFS, promoted manually by
// the Organiser for now - no auto-cancellation-triggered promotion exists
// yet, that's a separate gap (see design.md 9.4).
function isEventFull(event: EventItem): boolean {
  return event.maxPerformers !== null && event.lineup.length >= event.maxPerformers
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING: { label: '✓ Applied - pending review', color: 'var(--afa-sage)' },
  APPROVED: { label: "✓ You're in the lineup!", color: 'var(--afa-sage)' },
  WAITLISTED: { label: '⏳ Waitlisted', color: 'var(--afa-gold)' },
  REJECTED: { label: 'Not selected this time', color: 'var(--afa-text-primary)' },
}

export default function BrowseEventsToApplyPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [events, setEvents] = useState<EventItem[]>([])
  // BUG-2608-053 (follow-up from FEAT-2608-048) - this page had no city/
  // country filter at all, unlike the public Events browse and Venues
  // listing (FEAT-2608-036). Same pattern as (public)/events/page.tsx:
  // /api/events already accepts ?city= and filters server-side (indexed
  // via Venue_city_idx), and /api/venues/cities gives the full option
  // list regardless of the current filter, so the dropdown doesn't
  // narrow itself out of its own options.
  const [cities, setCities] = useState<{ city: string; country: string | null; label: string }[]>([])
  const [selectedCity, setSelectedCity] = useState('All Cities')
  const cityAutoAppliedRef = useRef(false)
  const [applicationStatus, setApplicationStatus] = useState<Record<string, string>>({})
  // Session 39 (Feedback ec6e4adf) - maps eventId -> this artist's own
  // Performance id, so the poster share card can be shown for their
  // active confirmed slot independent of the rest of the lineup filling.
  const [performanceIdByEvent, setPerformanceIdByEvent] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()
  const [message, setMessage] = useState<Record<string, string>>({})
  const [applying, setApplying] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  // Cities list is independent of the current filter - always the full
  // set we have approved venues in, same source the public Events page
  // uses, so the dropdown never narrows itself out of its own options.
  useEffect(() => {
    fetch('/api/venues/cities')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data?.cities) setCities(data.cities) })
      .catch(() => {})
  }, [])

  // Apply the artist's resolved default location as a starting filter,
  // once, the moment we know it's a real option (validated against the
  // cities list first - same guard the public page uses so an unknown
  // or stale guess doesn't silently zero out the results).
  useEffect(() => {
    if (cityAutoAppliedRef.current) return
    if (cities.length === 0) return
    cityAutoAppliedRef.current = true
    const cityNames = cities.map((c) => c.city)
    fetch('/api/user/location')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.city && cityNames.includes(data.city)) {
          setSelectedCity(data.city)
        }
      })
      .catch(() => {})
  }, [cities])

  useEffect(() => {
    if (!session?.user) return
    const fetchEvents = async () => {
      setLoading(true)
      try {
        const url = selectedCity === 'All Cities' ? '/api/events' : `/api/events?city=${encodeURIComponent(selectedCity)}`
        const eventsRes = await fetch(url)
        if (!eventsRes.ok) throw new Error('Failed to fetch events')
        const eventsData = await eventsRes.json()
        setEvents(eventsData)
      } catch (err: any) {
        showToast(err.message || 'Failed to load events', 'error')
      } finally {
        setLoading(false)
      }
    }
    fetchEvents()
  }, [session, selectedCity])

  // Applications/performances status is per-artist, not per-city - fetched
  // once per session, independent of the events filter above.
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profileRes = await fetch('/api/artists/me')
        if (profileRes.ok) {
          const profile = await profileRes.json()
          const statusMap: Record<string, string> = {}
          for (const a of profile.applications || []) {
            statusMap[a.event.id] = a.status
          }
          setApplicationStatus(statusMap)

          const perfMap: Record<string, string> = {}
          for (const p of profile.performances || []) {
            if (!p.cancelledAt) perfMap[p.event.id] = p.id
          }
          setPerformanceIdByEvent(perfMap)
        }
      } catch {
        // Non-fatal - the events list above still renders without this.
      }
    }

    if (session?.user) {
      fetchProfile()
    }
  }, [session])

  const apply = async (eventId: string) => {
    setApplying(eventId)
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, message: message[eventId] || '' }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to apply')
      }
      setApplicationStatus((prev) => ({ ...prev, [eventId]: data.status }))
    } catch (err: any) {
      showToast(err.message || 'Failed to apply', 'error')
    } finally {
      setApplying(null)
    }
  }

  if (status === 'loading' || loading) return (<><SiteNav /><DashboardShell><BrandLoader /></DashboardShell></>)
  if (!session) return (<><SiteNav /><DashboardShell>{null}</DashboardShell></>)

  return (
    <>
      <SiteNav />
      <DashboardShell>
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: '8px' }}>
            Browse Events
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: '16px' }}>
            Apply to perform at published events.
          </p>

          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            style={{
              fontSize: '13px', fontWeight: 600, color: 'var(--afa-text-primary)',
              background: 'var(--afa-surface-raised)', border: '1px solid rgba(245,245,240,0.15)',
              borderRadius: '999px', padding: '8px 14px', marginBottom: '32px', cursor: 'pointer',
            }}
          >
            <option value="All Cities">All Cities</option>
            {cities.map((c) => (
              <option key={`${c.city}-${c.country ?? ''}`} value={c.city}>{c.label}</option>
            ))}
          </select>

          {events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 24px', background: 'var(--afa-surface-raised)', borderRadius: '12px', border: '1px solid rgba(245,245,240,0.08)' }}>
              <p style={{ fontSize: '15px', color: 'var(--afa-text-primary)', opacity: 0.6 }}>No published events yet. Check back soon!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {events.map((event) => {
                const existingStatus = applicationStatus[event.id]
                const comp = compensationBadge(event)
                const full = isEventFull(event)
                return (
                  <div key={event.id} style={{ background: 'var(--afa-surface-raised)', borderRadius: '12px', padding: '22px', border: '1px solid rgba(245,245,240,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '10px', flexWrap: 'wrap' }}>
                      <div>
                        <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: 'var(--afa-text-primary)' }}>{event.title}</h3>
                        <p style={{ fontSize: '13px', color: 'var(--afa-text-primary)', opacity: 0.6, marginTop: '2px' }}>
                          {new Date(event.date).toLocaleDateString()} · {event.startTime} · {event.venue ? `${event.venue.name}, ${event.venue.city}` : 'Venue TBD'}
                        </p>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.5 }}>
                        Audience pays: {event.isFree ? 'Free' : event.ticketPrice ? `₹${event.ticketPrice}` : '—'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                      <div style={{ display: 'inline-block', fontSize: '13px', fontWeight: 700, padding: '5px 12px', borderRadius: '999px', background: comp.bg, color: comp.color }}>
                        {comp.label}
                      </div>
                      {full && !existingStatus && (
                        <div style={{ display: 'inline-block', fontSize: '13px', fontWeight: 700, padding: '5px 12px', borderRadius: '999px', background: 'rgba(245,245,240,0.06)', color: 'var(--afa-text-primary)' }}>
                          Lineup full - waitlist only
                        </div>
                      )}
                    </div>

                    {/* §9.4 low-risk fix identified 29 Jul, session 47 - the
                        Buy-in badge above previously only carried this
                        disclaimer on the artist's own dashboard (§4.5); a
                        real user-facing expectation gap since this is the
                        first place an artist actually sees the amount,
                        before ever applying. Same wording used on the
                        dashboard's "Recorded Earnings" section, for
                        consistency. */}
                    {event.defaultCompensationType === 'BUY_IN' && (
                      <p style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.55, marginTop: '-6px', marginBottom: '12px' }}>
                        Pay directly to the organiser - not yet processed or confirmed by the platform.
                      </p>
                    )}

                    <p style={{ fontSize: '14px', color: 'var(--afa-text-primary)', opacity: 0.7, marginBottom: '14px' }}>{event.description}</p>

                    {existingStatus ? (
                      <>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: STATUS_LABEL[existingStatus]?.color || 'var(--afa-text-primary)' }}>
                          {STATUS_LABEL[existingStatus]?.label || existingStatus}
                        </span>
                        {performanceIdByEvent[event.id] && (
                          <div style={{ marginTop: '14px' }}>
                            <PosterShareCard
                              src={`/api/posters/artist/${performanceIdByEvent[event.id]}`}
                              filename={`${event.title}-my-poster.png`}
                              title={`I'm performing at ${event.title}`}
                            />
                          </div>
                        )}
                      </>
                    ) : (
                      <div>
                        <textarea
                          value={message[event.id] || ''}
                          onChange={(e) => setMessage((prev) => ({ ...prev, [event.id]: e.target.value }))}
                          placeholder="Optional note to the organiser"
                          rows={2}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(245,245,240,0.15)', fontSize: '13px', marginBottom: '10px', resize: 'vertical' as const, background: 'var(--afa-surface-raised)', color: 'var(--afa-text-primary)' }}
                        />
                        <button
                          onClick={() => apply(event.id)}
                          disabled={applying === event.id}
                          style={{
                            fontSize: '13px', fontWeight: 600, color: full ? 'var(--afa-text-primary)' : 'var(--afa-on-fill-solid)',
                            background: full ? 'transparent' : 'var(--afa-terracotta)',
                            border: full ? '1.5px solid rgba(245,245,240,0.2)' : 'none',
                            borderRadius: '6px', padding: '8px 20px', cursor: 'pointer', opacity: applying === event.id ? 0.6 : 1,
                          }}
                        >
                          {applying === event.id ? 'Submitting...' : full ? 'Join Waitlist' : 'Apply to Perform'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
      </DashboardShell>
    </>
  )
}
