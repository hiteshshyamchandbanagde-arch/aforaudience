'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import { useToast } from '@/components/Toast'

interface Offer {
  id: string
  proposedBy: 'ORGANISER' | 'VENUE_OWNER'
  amount: number
  comment: string | null
  createdAt: string
}

interface RequestItem {
  id: string
  requestedDate: string
  durationHours: number
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED'
  venue: { id: string; name: string; city: string }
  event: { id: string; title: string; date: string } | null
  organiser: { orgName: string; user: { name: string; email: string } }
  offers: Offer[]
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  PENDING: { bg: 'rgba(201,151,58,0.15)', color: '#8a6a1f', label: 'Pending' },
  ACCEPTED: { bg: 'rgba(74,103,65,0.12)', color: '#4A6741', label: 'Accepted' },
  DECLINED: { bg: 'rgba(179,38,30,0.1)', color: '#B3261E', label: 'Declined' },
  EXPIRED: { bg: 'rgba(14,12,10,0.08)', color: '#0E0C0A', label: 'Expired' },
}

export default function VenueRequestsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const { showToast } = useToast()
  const [counterInputs, setCounterInputs] = useState<Record<string, string>>({})
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  const [actingOn, setActingOn] = useState<string | null>(null)

  const role = (session?.user as any)?.role as string | undefined
  const callerSide: 'ORGANISER' | 'VENUE_OWNER' | null =
    role === 'ORGANISER' ? 'ORGANISER' : role === 'VENUE_OWNER' ? 'VENUE_OWNER' : null

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const load = async () => {
    try {
      const res = await fetch('/api/venue-booking-requests')
      if (!res.ok) throw new Error('Failed to load requests')
      setRequests(await res.json())
    } catch (err: any) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  const act = async (reqId: string, action: 'accept' | 'decline' | 'counter') => {
    setActingOn(reqId)
    try {
      const res = await fetch(`/api/venue-booking-requests/${reqId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, amount: counterInputs[reqId], comment: commentInputs[reqId] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Action failed')
      await load()
      setCommentInputs((prev) => ({ ...prev, [reqId]: '' }))
      showToast(
        action === 'accept' ? 'Offer accepted.' : action === 'decline' ? 'Request declined.' : 'Counter-offer sent.',
        'success'
      )
    } catch (err: any) {
      showToast(err.message || 'Action failed', 'error')
    } finally {
      setActingOn(null)
    }
  }

  if (status === 'loading' || loading) return (<><SiteNav /><div style={{ padding: '32px' }}>Loading...</div></>)
  if (!session) return <SiteNav />

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
          <Link href={callerSide === 'VENUE_OWNER' ? '/dashboard/venue' : '/dashboard/organiser'} style={{ fontSize: '14px', color: '#C8441A', textDecoration: 'none', fontWeight: 600 }}>
            ← Back to Dashboard
          </Link>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#0E0C0A', marginTop: '16px', marginBottom: '8px' }}>
            Venue Booking Requests
          </h1>
          <p style={{ fontSize: '15px', color: '#0E0C0A', opacity: 0.6, marginBottom: '32px' }}>
            Flexible-rate venue negotiations — {callerSide === 'VENUE_OWNER' ? 'requests against your venues' : 'your outstanding requests'}.
          </p>

          {loadError && (
            <div style={{ padding: '14px 16px', background: '#FDECEA', border: '1px solid #F5C2C0', borderRadius: '8px', color: '#B3261E', fontSize: '14px', marginBottom: '20px' }}>
              {loadError}
            </div>
          )}

          {requests.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: '12px', padding: '40px', textAlign: 'center', border: '1px solid rgba(14,12,10,0.08)', color: '#0E0C0A', opacity: 0.6 }}>
              No booking requests yet.
            </div>
          ) : (
            requests.map((r) => {
              const lastOffer = r.offers[r.offers.length - 1]
              const canRespond = r.status === 'PENDING' && callerSide && (!lastOffer || lastOffer.proposedBy !== callerSide)
              const roundsUsed = r.offers.length
              const statusStyle = STATUS_STYLE[r.status]

              return (
                <div key={r.id} style={{ background: '#fff', borderRadius: '12px', padding: '22px 24px', marginBottom: '16px', border: '1px solid rgba(14,12,10,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <div>
                      <p style={{ fontSize: '16px', fontWeight: 600, color: '#0E0C0A', margin: 0 }}>
                        {r.event?.title || 'Untitled event'}
                      </p>
                      <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6, margin: '2px 0 0' }}>
                        {r.venue.name}, {r.venue.city} · {new Date(r.requestedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {r.durationHours}hr
                        {callerSide === 'VENUE_OWNER' && <> · {r.organiser.orgName} ({r.organiser.user.email})</>}
                      </p>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px', background: statusStyle.bg, color: statusStyle.color, whiteSpace: 'nowrap' }}>
                      {statusStyle.label}
                    </span>
                  </div>

                  {r.offers.length > 0 && (
                    <div style={{ background: '#F7F3EE', borderRadius: '8px', padding: '10px 12px', margin: '14px 0' }}>
                      {r.offers.map((o) => (
                        <div key={o.id} style={{ padding: '4px 0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                            <span style={{ color: '#0E0C0A', opacity: 0.6 }}>
                              {o.proposedBy === callerSide ? 'You' : o.proposedBy === 'ORGANISER' ? 'Organiser' : 'Venue'} proposed
                            </span>
                            <span style={{ fontWeight: 600, color: '#0E0C0A' }}>₹{o.amount.toLocaleString('en-IN')}</span>
                          </div>
                          {o.comment && (
                            <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.65, fontStyle: 'italic', margin: '2px 0 0' }}>
                              "{o.comment}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {r.status === 'PENDING' && (
                    <p style={{ fontSize: '11px', color: '#0E0C0A', opacity: 0.5, margin: '0 0 12px' }}>
                      Round {roundsUsed} of 6 · expires 48hr after the last offer with no response
                    </p>
                  )}

                  {r.status === 'PENDING' && canRespond && (
                    <div>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <input
                          type="number"
                          placeholder={lastOffer ? `Counter ₹${lastOffer.amount}` : 'Propose an amount (₹)'}
                          value={counterInputs[r.id] || ''}
                          onChange={(e) => setCounterInputs((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          style={{ flex: 1, padding: '9px 12px', borderRadius: '6px', border: '1px solid rgba(14,12,10,0.15)', fontSize: '13px' }}
                        />
                      </div>
                      <div style={{ marginBottom: '8px' }}>
                        <input
                          type="text"
                          placeholder="Add a note (optional) — e.g. can do ₹4000 but need load-in by 6pm"
                          value={commentInputs[r.id] || ''}
                          onChange={(e) => setCommentInputs((prev) => ({ ...prev, [r.id]: e.target.value.slice(0, 300) }))}
                          maxLength={300}
                          style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid rgba(14,12,10,0.15)', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {lastOffer && (
                          <button
                            onClick={() => act(r.id, 'accept')}
                            disabled={actingOn === r.id}
                            style={{ fontSize: '13px', fontWeight: 600, color: '#fff', background: '#4A6741', border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', opacity: actingOn === r.id ? 0.6 : 1 }}
                          >
                            Accept ₹{lastOffer.amount.toLocaleString('en-IN')}
                          </button>
                        )}
                        <button
                          onClick={() => act(r.id, 'counter')}
                          disabled={actingOn === r.id || roundsUsed >= 6}
                          style={{ fontSize: '13px', fontWeight: 600, color: '#0E0C0A', background: 'transparent', border: '1px solid rgba(14,12,10,0.2)', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', opacity: actingOn === r.id || roundsUsed >= 6 ? 0.5 : 1 }}
                        >
                          {lastOffer ? 'Counter' : 'Send quote'}
                        </button>
                        <button
                          onClick={() => act(r.id, 'decline')}
                          disabled={actingOn === r.id}
                          style={{ fontSize: '13px', fontWeight: 600, color: '#B3261E', background: 'transparent', border: '1px solid #F5C2C0', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', opacity: actingOn === r.id ? 0.6 : 1 }}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  )}

                  {r.status === 'PENDING' && !canRespond && (
                    <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.5, fontStyle: 'italic' }}>
                      Waiting on the other side to respond.
                    </p>
                  )}
                </div>
              )
            })
          )}
        </div>
      </main>
    </>
  )
}
