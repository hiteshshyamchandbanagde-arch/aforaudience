'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'

interface Application {
  id: string
  message: string
  status: string
  createdAt: string
  artist: { id: string; stageName?: string; user: { name: string; email: string } }
}

interface Performance {
  id: string
  slot: number
  duration: number
  artistId: string
}

interface EventDetail {
  id: string
  title: string
  description: string
  type: string
  status: string
  date: string
  startTime: string
  endTime: string
  isFree: boolean
  ticketPrice: number | null
  totalSeats: number
  availableSeats: number
  dresscode?: string | null
  vibe?: string | null
  surpriseAct: boolean
  venue: { id: string; name: string; city: string; address: string } | null
  applications: Application[]
  lineup: Performance[]
  venueBooking: { id: string; status: string; amount: number; fromDate: string; toDate: string } | null
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  DRAFT: { bg: 'rgba(201,151,58,0.15)', color: '#8a6a1f', label: 'Draft' },
  APPROVED: { bg: 'rgba(74,103,65,0.12)', color: '#4A6741', label: 'Published' },
  PENDING_APPROVAL: { bg: 'rgba(201,151,58,0.15)', color: '#8a6a1f', label: 'Pending' },
  CANCELLED: { bg: 'rgba(179,38,30,0.1)', color: '#B3261E', label: 'Cancelled' },
  COMPLETED: { bg: 'rgba(14,12,10,0.08)', color: '#0E0C0A', label: 'Completed' },
}

const APPLICATION_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: 'rgba(201,151,58,0.15)', color: '#8a6a1f' },
  APPROVED: { bg: 'rgba(74,103,65,0.12)', color: '#4A6741' },
  REJECTED: { bg: 'rgba(179,38,30,0.1)', color: '#B3261E' },
}

export default function OrganiserEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const [event, setEvent] = useState<EventDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toggling, setToggling] = useState(false)
  const [actingOn, setActingOn] = useState<string | null>(null)
  const [compensation, setCompensation] = useState<Record<string, { type: 'PAID' | 'FREE' | 'BUY_IN'; amount: string }>>({})

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  const fetchEvent = async () => {
    try {
      const res = await fetch(`/api/events/${id}/owner`)
      if (!res.ok) {
        if (res.status === 403) throw new Error('You do not have access to this event')
        throw new Error('Event not found')
      }
      const data = await res.json()
      setEvent(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user) {
      fetchEvent()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, id])

  const togglePublish = async () => {
    if (!event) return
    setToggling(true)
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publish: event.status !== 'APPROVED' }),
      })
      if (!res.ok) throw new Error('Failed to update publish status')
      await fetchEvent()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setToggling(false)
    }
  }

  const reviewApplication = async (applicationId: string, newStatus: 'APPROVED' | 'REJECTED') => {
    setActingOn(applicationId)
    try {
      const comp = compensation[applicationId] || { type: 'FREE', amount: '' }
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          compensationType: comp.type,
          feeAmount: comp.type === 'PAID' ? comp.amount : undefined,
          buyInAmount: comp.type === 'BUY_IN' ? comp.amount : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update application')
      }
      await fetchEvent()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActingOn(null)
    }
  }

  if (status === 'loading' || loading) return (<><SiteNav /><div style={{ padding: '32px' }}>Loading...</div></>)
  if (!session) return <SiteNav />
  if (error && !event) return (<><SiteNav /><div style={{ padding: '32px', color: '#B3261E' }}>{error}</div></>)
  if (!event) return (<><SiteNav /><div style={{ padding: '32px' }}>Event not found</div></>)

  const statusStyle = STATUS_STYLE[event.status] || STATUS_STYLE.DRAFT

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
          <Link href="/dashboard/organiser" style={{ fontSize: '14px', color: '#C8441A', textDecoration: 'none', fontWeight: 600 }}>
            ← Back to Events
          </Link>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '16px', marginBottom: '28px', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#0E0C0A', marginBottom: '6px' }}>
                {event.title}
              </h1>
              <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.6 }}>
                {new Date(event.date).toLocaleDateString()} · {event.startTime}–{event.endTime}
              </p>
            </div>
            <span
              style={{
                fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                padding: '6px 14px', borderRadius: '999px', background: statusStyle.bg, color: statusStyle.color, whiteSpace: 'nowrap',
              }}
            >
              {statusStyle.label}
            </span>
          </div>

          {error && (
            <div style={{ padding: '14px 16px', background: '#FDECEA', border: '1px solid #F5C2C0', borderRadius: '8px', color: '#B3261E', fontSize: '14px', marginBottom: '20px' }}>
              {error}
            </div>
          )}

          {/* Overview */}
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
            <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.8, marginBottom: '20px', lineHeight: 1.6 }}>{event.description}</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.5, marginBottom: '4px' }}>Seats</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: '#0E0C0A' }}>{event.availableSeats} / {event.totalSeats} available</p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.5, marginBottom: '4px' }}>Ticket Price</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: '#0E0C0A' }}>{event.isFree ? 'Free' : event.ticketPrice ? `₹${event.ticketPrice}` : '—'}</p>
              </div>
              {event.dresscode && (
                <div>
                  <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.5, marginBottom: '4px' }}>Dress Code</p>
                  <p style={{ fontSize: '14px', color: '#0E0C0A' }}>{event.dresscode}</p>
                </div>
              )}
              {event.vibe && (
                <div>
                  <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.5, marginBottom: '4px' }}>Vibe</p>
                  <p style={{ fontSize: '14px', color: '#0E0C0A' }}>{event.vibe}</p>
                </div>
              )}
            </div>
          </div>

          {/* Venue booking */}
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#0E0C0A', marginBottom: '14px' }}>Venue</h2>
            {event.venue ? (
              <div>
                <p style={{ fontSize: '15px', fontWeight: 600, color: '#0E0C0A' }}>{event.venue.name}</p>
                <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6, marginBottom: '10px' }}>{event.venue.address}, {event.venue.city}</p>
                {event.venueBooking && (
                  <span
                    style={{
                      fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                      padding: '5px 10px', borderRadius: '999px',
                      background: event.venueBooking.status === 'CONFIRMED' ? 'rgba(74,103,65,0.12)' : event.venueBooking.status === 'CANCELLED' ? 'rgba(179,38,30,0.1)' : 'rgba(201,151,58,0.15)',
                      color: event.venueBooking.status === 'CONFIRMED' ? '#4A6741' : event.venueBooking.status === 'CANCELLED' ? '#B3261E' : '#8a6a1f',
                    }}
                  >
                    Booking {event.venueBooking.status.toLowerCase()}
                  </span>
                )}
              </div>
            ) : (
              <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.5 }}>
                No venue booked yet. <Link href={`/dashboard/organiser/events/${event.id}/edit`} style={{ color: '#C8441A', fontWeight: 600 }}>Add one from the edit page.</Link>
              </p>
            )}
          </div>

          {/* Applications */}
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#0E0C0A', marginBottom: '14px' }}>
              Artist Applications {event.applications.length > 0 && `(${event.applications.length})`}
            </h2>
            {event.applications.length === 0 ? (
              <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.5 }}>No applications yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {event.applications.map((app) => {
                  const appStyle = APPLICATION_STYLE[app.status] || APPLICATION_STYLE.PENDING
                  return (
                    <div key={app.id} style={{ padding: '14px 16px', background: '#F7F3EE', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px', color: '#0E0C0A' }}>
                          {app.artist.stageName || app.artist.user.name}
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', padding: '4px 10px', borderRadius: '999px', background: appStyle.bg, color: appStyle.color }}>
                          {app.status.toLowerCase()}
                        </span>
                      </div>
                      {app.message && <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.7, marginBottom: '10px' }}>{app.message}</p>}
                      {app.status === 'PENDING' && (
                        <div>
                          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                            {(['FREE', 'PAID', 'BUY_IN'] as const).map((t) => {
                              const current = compensation[app.id]?.type || 'FREE'
                              return (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => setCompensation((prev) => ({ ...prev, [app.id]: { type: t, amount: prev[app.id]?.amount || '' } }))}
                                  style={{
                                    padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                                    border: current === t ? '2px solid #C8441A' : '1px solid rgba(14,12,10,0.15)',
                                    background: current === t ? 'rgba(200,68,26,0.08)' : '#fff',
                                    color: current === t ? '#C8441A' : '#0E0C0A',
                                  }}
                                >
                                  {t === 'FREE' ? 'Free' : t === 'PAID' ? 'Paid' : 'Buy-in'}
                                </button>
                              )
                            })}
                            {(compensation[app.id]?.type === 'PAID' || compensation[app.id]?.type === 'BUY_IN') && (
                              <input
                                type="number"
                                placeholder="₹ amount"
                                value={compensation[app.id]?.amount || ''}
                                onChange={(e) => setCompensation((prev) => ({ ...prev, [app.id]: { type: prev[app.id]?.type || 'PAID', amount: e.target.value } }))}
                                style={{ width: '100px', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(14,12,10,0.15)', fontSize: '12px' }}
                              />
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => reviewApplication(app.id, 'APPROVED')}
                              disabled={actingOn === app.id}
                              style={{ fontSize: '12px', fontWeight: 600, color: '#F7F3EE', background: '#4A6741', border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', opacity: actingOn === app.id ? 0.6 : 1 }}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => reviewApplication(app.id, 'REJECTED')}
                              disabled={actingOn === app.id}
                              style={{ fontSize: '12px', fontWeight: 600, color: '#B3261E', background: 'transparent', border: '1px solid rgba(179,38,30,0.3)', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', opacity: actingOn === app.id ? 0.6 : 1 }}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Link
              href={`/dashboard/organiser/events/${event.id}/edit`}
              style={{ fontSize: '14px', fontWeight: 600, color: '#F7F3EE', background: '#0E0C0A', textDecoration: 'none', padding: '12px 24px', borderRadius: '8px' }}
            >
              Edit Event
            </Link>
            <Link
              href={`/dashboard/organiser/events/${event.id}/checkin`}
              style={{ fontSize: '14px', fontWeight: 600, color: '#0E0C0A', background: 'transparent', border: '1px solid rgba(14,12,10,0.2)', textDecoration: 'none', padding: '12px 24px', borderRadius: '8px' }}
            >
              🎟 Check-In
            </Link>
            <button
              onClick={togglePublish}
              disabled={toggling}
              style={{
                fontSize: '14px', fontWeight: 600, color: event.status === 'APPROVED' ? '#0E0C0A' : '#F7F3EE',
                background: event.status === 'APPROVED' ? 'transparent' : '#C8441A',
                border: event.status === 'APPROVED' ? '1px solid rgba(14,12,10,0.2)' : 'none',
                padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', opacity: toggling ? 0.6 : 1,
              }}
            >
              {toggling ? 'Updating...' : event.status === 'APPROVED' ? 'Unpublish' : 'Publish Event'}
            </button>
          </div>
        </div>
      </main>
    </>
  )
}
