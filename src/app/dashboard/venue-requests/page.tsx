'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import SiteNav from '@/components/SiteNav'
import { useToast } from '@/components/Toast'
import BrandLoader from '@/components/BrandLoader'
import DashboardShell from '@/components/DashboardShell'
import { PageHead, Card, StatusPill, Button, EmptyState, IconTag, IconCheck, ErrorBanner, type StatusPillTone } from '@/components/dashboard/VenuePortalUI'

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

const STATUS_STYLE: Record<string, { tone: StatusPillTone; label: string }> = {
  PENDING: { tone: 'gold', label: 'Pending' },
  ACCEPTED: { tone: 'sage', label: 'Accepted' },
  DECLINED: { tone: 'error', label: 'Declined' },
  EXPIRED: { tone: 'muted', label: 'Expired' },
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

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Previously keyed off the whole `session` object, which next-auth
    // only replaces on its own unrelated schedule (window-focus revalidation,
    // internal polling) - not a reliable "something changed" signal. That
    // made this list mostly sit stale until one of those unrelated events
    // happened to fire (P0 grep, third instance). Fixed the same way as the
    // seat-map page: key off session?.user?.id (only changes on real
    // login/logout) plus an explicit poll, since this page is a read-only
    // list (no local edits to clobber) and genuinely benefits from refreshing
    // on a real timer, same pattern as the Revenue page.
    if (!session?.user) return
    load()
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(load, 20000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(session?.user as any)?.id])

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

  if (status === 'loading' || loading) return (<><SiteNav /><DashboardShell><BrandLoader /></DashboardShell></>)
  if (!session) return (<><SiteNav /><DashboardShell>{null}</DashboardShell></>)

  return (
    <>
      <SiteNav />
      <DashboardShell>
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-page)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '820px', margin: '0 auto', padding: '48px 24px 80px' }}>
          <div>
            <PageHead
              eyebrow="Flexible-rate negotiations"
              title="Venue Booking Requests"
              description={
                callerSide === 'VENUE_OWNER' ? 'Requests against your venues.'
                  : callerSide === 'ORGANISER' ? 'Your outstanding requests.'
                  : undefined
              }
            />
          </div>

          {loadError && (
            <ErrorBanner style={{ marginBottom: '20px' }}>{loadError}</ErrorBanner>
          )}

          {requests.length === 0 ? (
            <EmptyState icon={<IconTag size={56} strokeWidth={1} />} caption="No booking requests yet" />
          ) : (
            requests.map((r) => {
              const lastOffer = r.offers[r.offers.length - 1]
              const canRespond = r.status === 'PENDING' && callerSide && (!lastOffer || lastOffer.proposedBy !== callerSide)
              const roundsUsed = r.offers.length
              const statusStyle = STATUS_STYLE[r.status]

              return (
                <Card key={r.id} style={{ padding: '22px 24px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px', gap: '10px' }}>
                    <div>
                      <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--afa-text-primary)', margin: 0 }}>
                        {r.event?.title || 'Untitled event'}
                      </p>
                      <p style={{ fontSize: '13px', color: 'var(--afa-text-secondary)', margin: '2px 0 0' }}>
                        {r.venue.name}, {r.venue.city} · {new Date(r.requestedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {r.durationHours}hr
                        {callerSide === 'VENUE_OWNER' && <> · {r.organiser.orgName} ({r.organiser.user.email})</>}
                      </p>
                    </div>
                    <StatusPill tone={statusStyle.tone}>{statusStyle.label}</StatusPill>
                  </div>

                  {r.offers.length > 0 && (
                    <div style={{ background: '#171717', borderRadius: '8px', padding: '10px 14px', margin: '16px 0' }}>
                      {r.offers.map((o) => (
                        <div key={o.id} style={{ padding: '4px 0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                            <span style={{ color: 'var(--afa-text-secondary)' }}>
                              {o.proposedBy === callerSide ? 'You' : o.proposedBy === 'ORGANISER' ? 'Organiser' : 'Venue'} proposed
                            </span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--afa-amber)' }}>₹{o.amount.toLocaleString('en-IN')}</span>
                          </div>
                          {o.comment && (
                            <p style={{ fontSize: '12px', color: 'var(--afa-text-secondary)', fontStyle: 'italic', margin: '2px 0 0' }}>
                              "{o.comment}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {r.status === 'PENDING' && (
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--afa-text-muted)', margin: '0 0 14px' }}>
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
                          min="1"
                          max="10000000"
                          className="avp-field"
                          style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(245,245,240,0.08)', background: '#171717', color: 'var(--afa-text-primary)', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div style={{ marginBottom: '12px' }}>
                        <input
                          type="text"
                          placeholder="Add a note (optional) — e.g. can do ₹4000 but need load-in by 6pm"
                          value={commentInputs[r.id] || ''}
                          onChange={(e) => setCommentInputs((prev) => ({ ...prev, [r.id]: e.target.value.slice(0, 300) }))}
                          maxLength={300}
                          className="avp-field"
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(245,245,240,0.08)', background: '#171717', color: 'var(--afa-text-primary)', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {lastOffer && (
                          <Button onClick={() => act(r.id, 'accept')} disabled={actingOn === r.id} style={{ padding: '8px 16px', fontSize: '13px', opacity: actingOn === r.id ? 0.6 : 1 }}>
                            <IconCheck /> Accept ₹{lastOffer.amount.toLocaleString('en-IN')}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          onClick={() => act(r.id, 'counter')}
                          disabled={actingOn === r.id || roundsUsed >= 6}
                          style={{ padding: '8px 16px', fontSize: '13px', opacity: actingOn === r.id || roundsUsed >= 6 ? 0.5 : 1 }}
                        >
                          {lastOffer ? 'Counter' : 'Send quote'}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => act(r.id, 'decline')}
                          disabled={actingOn === r.id}
                          style={{ padding: '8px 16px', fontSize: '13px', color: 'var(--afa-error)', opacity: actingOn === r.id ? 0.6 : 1 }}
                        >
                          Decline
                        </Button>
                      </div>
                    </div>
                  )}

                  {r.status === 'PENDING' && !canRespond && (
                    <p style={{ fontSize: '13px', color: 'var(--afa-text-muted)', fontStyle: 'italic', margin: 0 }}>
                      Waiting on the other side to respond.
                    </p>
                  )}
                </Card>
              )
            })
          )}
        </div>
      </main>
      </DashboardShell>
    </>
  )
}
