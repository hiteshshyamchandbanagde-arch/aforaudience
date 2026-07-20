'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'

interface EventItem {
  id: string
  title: string
  type: string
  date: string
  status: string
  totalSeats: number
  isFree: boolean
  ticketPrice: number | null
  venue: { name: string; city: string } | null
  applications: { id: string; status: string }[]
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  DRAFT: { bg: 'rgba(201,151,58,0.15)', color: '#8a6a1f', label: 'Draft' },
  APPROVED: { bg: 'rgba(74,103,65,0.12)', color: '#4A6741', label: 'Published' },
  PENDING_APPROVAL: { bg: 'rgba(201,151,58,0.15)', color: '#8a6a1f', label: 'Pending' },
  CANCELLED: { bg: 'rgba(179,38,30,0.1)', color: '#B3261E', label: 'Cancelled' },
  COMPLETED: { bg: 'rgba(14,12,10,0.08)', color: '#0E0C0A', label: 'Completed' },
}

export default function OrganiserDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [orgStatus, setOrgStatus] = useState<{ isOrganiser: boolean; hasProfile: boolean; isApproved: boolean; orgName?: string | null } | null>(null)
  const [pendingFlexRequests, setPendingFlexRequests] = useState(0)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    const fetchStatusAndEvents = async () => {
      try {
        const statusRes = await fetch('/api/organisers/status')
        if (!statusRes.ok) throw new Error('Failed to load account status')
        const statusData = await statusRes.json()
        setOrgStatus(statusData)

        if (statusData.isOrganiser && statusData.isApproved) {
          const res = await fetch('/api/events/my-events')
          if (!res.ok) throw new Error('Failed to fetch events')
          setEvents(await res.json())
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    // Same pending-count badge pattern as the Venue Owner side's Booking
    // Requests badge - the Flexible-rate negotiation inbox previously had
    // no indicator, so a request sitting on the Organiser's own turn to
    // respond was easy to miss.
    const fetchFlexRequests = async () => {
      try {
        const res = await fetch('/api/venue-booking-requests')
        if (res.ok) {
          const data = await res.json()
          setPendingFlexRequests(data.filter((r: any) => r.status === 'PENDING').length)
        }
      } catch {
        // Non-critical for this view; the dedicated requests page will surface errors.
      }
    }

    if (session?.user) {
      fetchStatusAndEvents()
      fetchFlexRequests()
    }
  }, [session])

  if (status === 'loading' || loading) return (<><SiteNav /><div style={{ padding: '32px' }}>Loading...</div></>)
  if (!session) return <SiteNav />

  if (orgStatus && !orgStatus.isOrganiser) {
    return (
      <>
        <SiteNav />
        <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', marginBottom: '12px' }}>You're not registered as an Organiser</h1>
            <p style={{ color: '#0E0C0A', opacity: 0.6, marginBottom: '24px' }}>Apply to become an Organiser from your profile to start creating events.</p>
            <Link href="/" style={{ color: '#C8441A', fontWeight: 600, textDecoration: 'none' }}>Back to Home</Link>
          </div>
        </main>
      </>
    )
  }

  if (orgStatus && orgStatus.isOrganiser && !orgStatus.isApproved) {
    return (
      <>
        <SiteNav />
        <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>⏳</div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', marginBottom: '12px' }}>
              {orgStatus.orgName ? `${orgStatus.orgName} is` : 'Your Organiser account is'} pending approval
            </h1>
            <p style={{ color: '#0E0C0A', opacity: 0.6 }}>
              Our team reviews new Organiser applications before you can create and publish events. We'll notify you as soon as you're approved.
            </p>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '48px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#0E0C0A', marginBottom: '6px' }}>
                Your Events
              </h1>
              <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.6 }}>Create events, book venues, and review artist applications</p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Link
                href="/dashboard/organiser/sales"
                style={{ fontSize: '14px', fontWeight: 600, color: '#0E0C0A', background: 'transparent', border: '1px solid rgba(14,12,10,0.2)', textDecoration: 'none', padding: '12px 22px', borderRadius: '8px' }}
              >
                📊 Sales Overview
              </Link>
              <Link
                href="/dashboard/venue-requests"
                style={{ position: 'relative', fontSize: '14px', fontWeight: 600, color: '#0E0C0A', background: 'transparent', border: '1px solid rgba(14,12,10,0.2)', textDecoration: 'none', padding: '12px 22px', borderRadius: '8px' }}
              >
                Flexible Requests
                {pendingFlexRequests > 0 && (
                  <span style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#C8441A', color: '#F7F3EE', fontSize: '11px', fontWeight: 700, borderRadius: '999px', padding: '2px 7px' }}>
                    {pendingFlexRequests}
                  </span>
                )}
              </Link>
              <Link
                href="/dashboard/organiser/events/create"
                style={{ fontSize: '14px', fontWeight: 600, color: '#F7F3EE', background: '#C8441A', textDecoration: 'none', padding: '12px 22px', borderRadius: '8px' }}
              >
                + Create Event
              </Link>
            </div>
          </div>

          {error && (
            <div style={{ padding: '14px 16px', background: '#FDECEA', border: '1px solid #F5C2C0', borderRadius: '8px', color: '#B3261E', fontSize: '14px', marginBottom: '24px' }}>
              {error}
            </div>
          )}

          {events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 24px', background: '#fff', borderRadius: '12px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <p style={{ fontSize: '17px', color: '#0E0C0A', marginBottom: '8px' }}>No events yet</p>
              <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.6, marginBottom: '20px' }}>Create your first event to start booking venues and artists</p>
              <Link
                href="/dashboard/organiser/events/create"
                style={{ fontSize: '14px', fontWeight: 600, color: '#F7F3EE', background: '#C8441A', textDecoration: 'none', padding: '12px 24px', borderRadius: '8px' }}
              >
                Create Event
              </Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {events.map((event) => {
                const pendingApplications = event.applications.filter((a) => a.status === 'PENDING').length
                const statusStyle = STATUS_STYLE[event.status] || STATUS_STYLE.DRAFT
                return (
                  <div key={event.id} style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid rgba(14,12,10,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', gap: '10px' }}>
                      <div>
                        <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '19px', fontWeight: 700, color: '#0E0C0A' }}>{event.title}</h3>
                        <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6, marginTop: '2px' }}>
                          {new Date(event.date).toLocaleDateString()} · {event.venue ? `${event.venue.name}, ${event.venue.city}` : 'No venue booked'}
                        </p>
                      </div>
                      <span
                        style={{
                          fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                          padding: '5px 10px', borderRadius: '999px', background: statusStyle.bg, color: statusStyle.color, whiteSpace: 'nowrap',
                        }}
                      >
                        {statusStyle.label}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', marginBottom: '18px', fontSize: '13px', color: '#0E0C0A', flexWrap: 'wrap' }}>
                      <span><strong>{event.totalSeats}</strong> seats</span>
                      <span><strong>{event.isFree ? 'Free' : event.ticketPrice ? `₹${event.ticketPrice}` : '—'}</strong></span>
                      {pendingApplications > 0 && (
                        <span style={{ color: '#C8441A', fontWeight: 600 }}>{pendingApplications} pending application{pendingApplications > 1 ? 's' : ''}</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <Link
                        href={`/dashboard/organiser/events/${event.id}`}
                        style={{ flex: 1, textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#0E0C0A', border: '1px solid rgba(14,12,10,0.15)', textDecoration: 'none', padding: '9px 0', borderRadius: '8px' }}
                      >
                        View
                      </Link>
                      <Link
                        href={`/dashboard/organiser/events/${event.id}/edit`}
                        style={{ flex: 1, textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#F7F3EE', background: '#0E0C0A', textDecoration: 'none', padding: '9px 0', borderRadius: '8px' }}
                      >
                        Edit
                      </Link>
                    </div>
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
