'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'

interface EventItem {
  id: string
  title: string
  description: string
  type: string
  date: string
  startTime: string
  isFree: boolean
  ticketPrice: number | null
  venue: { name: string; city: string } | null
}

export default function BrowseEventsToApplyPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [events, setEvents] = useState<EventItem[]>([])
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState<Record<string, string>>({})
  const [applying, setApplying] = useState<string | null>(null)
  const [justApplied, setJustApplied] = useState<Set<string>>(new Set())

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
          setAppliedIds(new Set((profile.applications || []).map((a: any) => a.event.id)))
        }
      } catch (err: any) {
        setError(err.message)
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
    setError('')
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, message: message[eventId] || '' }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to apply')
      }
      setJustApplied((prev) => new Set(prev).add(eventId))
    } catch (err: any) {
      setError(err.message)
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

          {error && (
            <div style={{ padding: '14px 16px', background: '#FDECEA', border: '1px solid #F5C2C0', borderRadius: '8px', color: '#B3261E', fontSize: '14px', marginBottom: '24px' }}>
              {error}
            </div>
          )}

          {events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 24px', background: '#fff', borderRadius: '12px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <p style={{ fontSize: '15px', color: '#0E0C0A', opacity: 0.6 }}>No published events yet. Check back soon!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {events.map((event) => {
                const alreadyApplied = appliedIds.has(event.id) || justApplied.has(event.id)
                return (
                  <div key={event.id} style={{ background: '#fff', borderRadius: '12px', padding: '22px', border: '1px solid rgba(14,12,10,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '10px', flexWrap: 'wrap' }}>
                      <div>
                        <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#0E0C0A' }}>{event.title}</h3>
                        <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6, marginTop: '2px' }}>
                          {new Date(event.date).toLocaleDateString()} · {event.startTime} · {event.venue ? `${event.venue.name}, ${event.venue.city}` : 'Venue TBD'}
                        </p>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#C8441A' }}>
                        {event.isFree ? 'Free' : event.ticketPrice ? `₹${event.ticketPrice}` : ''}
                      </span>
                    </div>
                    <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.7, marginBottom: '14px' }}>{event.description}</p>

                    {alreadyApplied ? (
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#4A6741' }}>✓ Applied</span>
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
                          style={{ fontSize: '13px', fontWeight: 600, color: '#F7F3EE', background: '#C8441A', border: 'none', borderRadius: '6px', padding: '8px 20px', cursor: 'pointer', opacity: applying === event.id ? 0.6 : 1 }}
                        >
                          {applying === event.id ? 'Applying...' : 'Apply to Perform'}
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
