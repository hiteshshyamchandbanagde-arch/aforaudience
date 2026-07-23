'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import { useToast } from '@/components/Toast'

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
    return { label: `You're paid: ₹${event.defaultFeeAmount?.toLocaleString('en-IN') ?? '—'}`, bg: 'rgba(74,103,65,0.12)', color: '#4A6741' }
  }
  if (event.defaultCompensationType === 'BUY_IN') {
    return { label: `Buy-in required: ₹${event.defaultBuyInAmount?.toLocaleString('en-IN') ?? '—'}`, bg: 'rgba(179,38,30,0.1)', color: '#B3261E' }
  }
  return { label: 'Free / Exposure slot', bg: 'rgba(14,12,10,0.06)', color: '#0E0C0A' }
}

// Full lineups no longer hard-block applying - they queue as WAITLISTED
// instead (Hitesh's own admin note, 22 Jul). FCFS, promoted manually by
// the Organiser for now - no auto-cancellation-triggered promotion exists
// yet, that's a separate gap (see design.md 9.4).
function isEventFull(event: EventItem): boolean {
  return event.maxPerformers !== null && event.lineup.length >= event.maxPerformers
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING: { label: '✓ Applied - pending review', color: '#4A6741' },
  APPROVED: { label: "✓ You're in the lineup!", color: '#4A6741' },
  WAITLISTED: { label: '⏳ Waitlisted', color: '#8a6a1f' },
  REJECTED: { label: 'Not selected this time', color: '#0E0C0A' },
}

export default function BrowseEventsToApplyPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [events, setEvents] = useState<EventItem[]>([])
  const [applicationStatus, setApplicationStatus] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()
  const [message, setMessage] = useState<Record<string, string>>({})
  const [applying, setApplying] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventsRes, profileRes] = await Promise.all([
          fetch('/api/events'),
          fetch('/api/artists/me'),
        ])
        if (!eventsRes.ok) throw new Error('Failed to fetch events')
        const eventsData = await eventsRes.json()
        setEvents(eventsData)

        if (profileRes.ok) {
          const profile = await profileRes.json()
          const statusMap: Record<string, string> = {}
          for (const a of profile.applications || []) {
            statusMap[a.event.id] = a.status
          }
          setApplicationStatus(statusMap)
        }
      } catch (err: any) {
        showToast(err.message || 'Failed to load events', 'error')
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchData()
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

  if (status === 'loading' || loading) return (<><SiteNav /><div style={{ padding: '32px' }}>Loading...</div></>)
  if (!session) return <SiteNav />

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
          <Link href="/dashboard/artist" style={{ fontSize: '14px', color: '#C8441A', textDecoration: 'none', fontWeight: 600 }}>
            ← Back to Dashboard
          </Link>

          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#0E0C0A', marginTop: '16px', marginBottom: '8px' }}>
            Browse Events
          </h1>
          <p style={{ fontSize: '15px', color: '#0E0C0A', opacity: 0.6, marginBottom: '32px' }}>
            Apply to perform at published events.
          </p>

          {events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 24px', background: '#fff', borderRadius: '12px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <p style={{ fontSize: '15px', color: '#0E0C0A', opacity: 0.6 }}>No published events yet. Check back soon!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {events.map((event) => {
                const existingStatus = applicationStatus[event.id]
                const comp = compensationBadge(event)
                const full = isEventFull(event)
                return (
                  <div key={event.id} style={{ background: '#fff', borderRadius: '12px', padding: '22px', border: '1px solid rgba(14,12,10,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '10px', flexWrap: 'wrap' }}>
                      <div>
                        <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#0E0C0A' }}>{event.title}</h3>
                        <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6, marginTop: '2px' }}>
                          {new Date(event.date).toLocaleDateString()} · {event.startTime} · {event.venue ? `${event.venue.name}, ${event.venue.city}` : 'Venue TBD'}
                        </p>
                      </div>
                      <span style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.5 }}>
                        Audience pays: {event.isFree ? 'Free' : event.ticketPrice ? `₹${event.ticketPrice}` : '—'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                      <div style={{ display: 'inline-block', fontSize: '13px', fontWeight: 700, padding: '5px 12px', borderRadius: '999px', background: comp.bg, color: comp.color }}>
                        {comp.label}
                      </div>
                      {full && !existingStatus && (
                        <div style={{ display: 'inline-block', fontSize: '13px', fontWeight: 700, padding: '5px 12px', borderRadius: '999px', background: 'rgba(14,12,10,0.06)', color: '#0E0C0A' }}>
                          Lineup full - waitlist only
                        </div>
                      )}
                    </div>

                    <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.7, marginBottom: '14px' }}>{event.description}</p>

                    {existingStatus ? (
                      <span style={{ fontSize: '13px', fontWeight: 600, color: STATUS_LABEL[existingStatus]?.color || '#0E0C0A' }}>
                        {STATUS_LABEL[existingStatus]?.label || existingStatus}
                      </span>
                    ) : (
                      <div>
                        <textarea
                          value={message[event.id] || ''}
                          onChange={(e) => setMessage((prev) => ({ ...prev, [event.id]: e.target.value }))}
                          placeholder="Optional note to the organiser"
                          rows={2}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(14,12,10,0.15)', fontSize: '13px', marginBottom: '10px', resize: 'vertical' as const }}
                        />
                        <button
                          onClick={() => apply(event.id)}
                          disabled={applying === event.id}
                          style={{
                            fontSize: '13px', fontWeight: 600, color: full ? '#0E0C0A' : '#F7F3EE',
                            background: full ? 'transparent' : '#C8441A',
                            border: full ? '1.5px solid rgba(14,12,10,0.2)' : 'none',
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
    </>
  )
}
