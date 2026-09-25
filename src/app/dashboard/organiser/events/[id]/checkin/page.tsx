'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, use, useCallback } from 'react'
import SiteNav from '@/components/SiteNav'
import BackLink from '@/components/BackLink'
import BrandLoader from '@/components/BrandLoader'
import Button from '@/components/ui/Button'
import { FILL_SOLID_TINT } from '@/lib/statusStyle'

type ScanResult = {
  ok: boolean
  reason?: string
  message?: string
  attendeeName?: string
  seats?: Record<string, number>
  checkedInAt?: string
}

type Attendee = {
  bookingId: string
  name: string
  seats: Record<string, number>
  // Display-only, deterministic-not-real seat label for NUMBERED bookings
  // (see attendees API comment) - null for GA bookings, which have no
  // per-seat labels at all.
  seatLabel: string | null
  checkedInAt: string | null
  // Companion Tagging Phase 2 (step 6) - ACCEPTED companions only,
  // each individually checkable at the door.
  companions: { id: string; name: string; seatLabel: string | null; checkedInAt: string | null }[]
}

function seatsSummary(seats?: Record<string, number>) {
  if (!seats) return ''
  return Object.entries(seats)
    .filter(([, n]) => n > 0)
    .map(([section, n]) => `${n} × ${section}`)
    .join(', ')
}

export default function CheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()

  const [eventTitle, setEventTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [counts, setCounts] = useState<{ total: number; checkedIn: number } | null>(null)

  const [manualCode, setManualCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [lastResult, setLastResult] = useState<ScanResult | null>(null)

  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const scannerRef = useRef<any>(null)
  const scanningRef = useRef(false) // guards against double-fires while a request is in flight
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [listOpen, setListOpen] = useState(false)
  const [attendees, setAttendees] = useState<Attendee[] | null>(null)
  const [listFilter, setListFilter] = useState<'all' | 'checked_in' | 'pending'>('all')
  const [checkingInCompanion, setCheckingInCompanion] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    return () => { if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current) }
  }, [])

  const refreshCounts = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/checkin`)
      if (res.ok) setCounts(await res.json())
    } catch {
      // non-critical - the counter just won't update this round
    }
  }, [eventId])

  const refreshAttendees = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/attendees`)
      if (res.ok) {
        const data = await res.json()
        setAttendees(data.attendees)
      }
    } catch {
      // non-critical - list just won't refresh this round
    }
  }, [eventId])

  const checkInCompanion = useCallback(async (companionTagId: string) => {
    setCheckingInCompanion(companionTagId)
    try {
      const res = await fetch(`/api/events/${eventId}/checkin/companion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companionTagId }),
      })
      if (res.ok && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(120)
      await refreshAttendees()
    } finally {
      setCheckingInCompanion(null)
    }
  }, [eventId, refreshAttendees])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/events/${eventId}/owner`)
        if (!res.ok) {
          throw new Error(res.status === 403 ? 'You do not have access to this event' : 'Event not found')
        }
        const data = await res.json()
        setEventTitle(data.title)
        await refreshCounts()
      } catch (err: any) {
        setLoadError(err.message)
      } finally {
        setLoading(false)
      }
    }
    if (session?.user) load()
  }, [session, eventId, refreshCounts])

  const submitCode = useCallback(async (code: string) => {
    if (!code.trim() || scanningRef.current) return
    scanningRef.current = true
    setSubmitting(true)
    try {
      const res = await fetch(`/api/events/${eventId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })
      const data: ScanResult = await res.json()
      setLastResult(data)
      // Haptic feedback so a scan register is felt without having to look
      // away from lining the QR up with the camera.
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(data.ok ? 120 : [80, 60, 80])
      }
      // The result is shown as a fixed overlay (not inline in the page
      // flow) specifically so it's never dependent on scroll position -
      // an inline card was missed entirely while the camera view filled
      // the screen. Auto-dismiss after a few seconds so it doesn't sit
      // there blocking the next scan.
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = setTimeout(() => setLastResult(null), 4000)
      if (data.ok) {
        setManualCode('')
        refreshCounts()
        if (listOpen) refreshAttendees()
      }
    } catch {
      setLastResult({ ok: false, message: 'Network error - try again.' })
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = setTimeout(() => setLastResult(null), 4000)
    } finally {
      setSubmitting(false)
      // Small cooldown so the camera loop doesn't instantly re-fire on the
      // same still-visible QR code before the person walks off.
      setTimeout(() => { scanningRef.current = false }, 1500)
    }
  }, [eventId, refreshCounts, listOpen, refreshAttendees])

  useEffect(() => {
    if (!cameraOn) return
    let cancelled = false

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (cancelled) return
      const scanner = new Html5Qrcode('checkin-camera')
      scannerRef.current = scanner
      scanner
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decodedText: string) => submitCode(decodedText),
          () => { /* per-frame no-QR-found noise, ignore */ }
        )
        .catch((err: any) => {
          setCameraError('Could not access the camera. Check browser permissions, or use manual entry below.')
          setCameraOn(false)
          console.error('Camera start failed:', err)
        })
    })

    return () => {
      cancelled = true
      const scanner = scannerRef.current
      if (scanner) {
        scanner.stop().then(() => scanner.clear()).catch(() => {})
        scannerRef.current = null
      }
    }
  }, [cameraOn, submitCode])

  if (status === 'loading' || loading) return (<><SiteNav /><BrandLoader /></>)
  if (!session) return <SiteNav />
  if (loadError) return (<><SiteNav /><div style={{ padding: 'var(--afa-space-32px)', color: 'var(--afa-error)' }}>{loadError}</div></>)

  return (
    <>
      <SiteNav />

      {/* Fixed overlay, not inline in page flow - guarantees visibility
          regardless of scroll position while the camera view fills the
          screen. This replaced an inline card that was easy to miss. */}
      {lastResult && (
        <div
          role="status"
          onClick={() => setLastResult(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
            padding: 'var(--afa-space-18px) var(--afa-space-5)', paddingTop: 'calc(18px + env(safe-area-inset-top, 0px))',
            background: lastResult.ok ? 'var(--afa-forest)' : 'var(--afa-error)',
            color: 'var(--afa-on-fill-solid)', boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            cursor: 'pointer',
          }}
        >
          <p style={{ fontSize: 'var(--afa-text-lead)', fontWeight: 700, marginBottom: 'var(--afa-space-1)' }}>
            {lastResult.ok ? '✓ Checked in' : lastResult.reason === 'ALREADY_CHECKED_IN' ? '⚠ Already checked in' : '✗ Not valid'}
          </p>
          {lastResult.attendeeName && (
            <p style={{ fontSize: 'var(--afa-text-body-lg)', marginBottom: 'var(--afa-space-2px)' }}>{lastResult.attendeeName}</p>
          )}
          {lastResult.seats && seatsSummary(lastResult.seats) && (
            <p style={{ fontSize: 'var(--afa-text-ui)', opacity: 0.85, marginBottom: 'var(--afa-space-2px)' }}>{seatsSummary(lastResult.seats)}</p>
          )}
          {lastResult.message && (
            <p style={{ fontSize: 'var(--afa-text-ui)', opacity: 0.85 }}>{lastResult.message}</p>
          )}
          <p style={{ fontSize: 'var(--afa-text-micro)', opacity: 0.7, marginTop: 'var(--afa-space-6px)' }}>Tap to dismiss</p>
        </div>
      )}

      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto', padding: 'var(--afa-space-32px) var(--afa-space-5) 64px' }}>
          <BackLink href={`/dashboard/organiser/events/${eventId}`} label="Back to Event" />

          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-page-title)', fontWeight: 700, color: 'var(--afa-text-primary)', marginTop: 'var(--afa-space-14px)', marginBottom: 'var(--afa-space-1)' }}>
            Check-In
          </h1>
          <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: 'var(--afa-space-1)' }}>{eventTitle}</p>
          {counts && (
            <p style={{ fontSize: 'var(--afa-text-body)', fontWeight: 600, color: 'var(--afa-sage)', marginBottom: 'var(--afa-space-6)' }}>
              {counts.checkedIn} of {counts.total} checked in
            </p>
          )}

          <div style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-12px)', padding: 'var(--afa-space-5)', marginBottom: 'var(--afa-space-5)', border: '1px solid var(--afa-tint-08)' }}>
            {!cameraOn ? (
              <Button variant="primary" size="lg" fullWidth={true} onClick={() => { setCameraError(''); setCameraOn(true) }}>
                📷 Start Camera Scan
              </Button>
            ) : (
              <>
                <div id="checkin-camera" style={{ width: '100%', borderRadius: 'var(--afa-radius-md)', overflow: 'hidden' }} />
                <Button
                  variant="outline-neutral"
                  size="md"
                  onClick={() => setCameraOn(false)}
                  style={{ marginTop: 'var(--afa-space-3)' }}
                >
                  Stop Camera
                </Button>
              </>
            )}
            {cameraError && (
              <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-error)', marginTop: 'var(--afa-space-10px)' }}>{cameraError}</p>
            )}
          </div>

          <div style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-12px)', padding: 'var(--afa-space-5)', marginBottom: 'var(--afa-space-5)', border: '1px solid var(--afa-tint-08)' }}>
            <label style={{ display: 'block', fontSize: 'var(--afa-text-ui)', fontWeight: 600, marginBottom: 'var(--afa-space-2)', color: 'var(--afa-text-primary)' }}>
              Manual entry <span style={{ fontWeight: 400, opacity: 0.6 }}>(booking ID printed on the ticket)</span>
            </label>
            <div style={{ display: 'flex', gap: 'var(--afa-space-10px)' }}>
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitCode(manualCode) }}
                placeholder="e.g., ckabc123..."
                style={{
                  flex: 1, padding: 'var(--afa-space-10px) var(--afa-space-3)', borderRadius: 'var(--afa-radius-sm)', border: '1px solid var(--afa-border-resting)',
                  background: 'var(--afa-surface-raised)', fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)',
                }}
              />
              <Button
                variant="solid"
                size="lg"
                fullWidth={false}
                onClick={() => submitCode(manualCode)}
                disabled={submitting || !manualCode.trim()}
              >
                Check In
              </Button>
            </div>
          </div>

          <div style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-12px)', padding: 'var(--afa-space-5)', border: '1px solid var(--afa-tint-08)' }}>
            <Button
              variant="bare"
              onClick={() => {
                const next = !listOpen
                setListOpen(next)
                if (next && !attendees) refreshAttendees()
              }}
              style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: 'var(--afa-text-body)', fontWeight: 600, color: 'var(--afa-text-primary)',
                padding: 0,
              }}
            >
              <span>Attendee List</span>
              <span style={{ fontSize: 'var(--afa-text-ui)', opacity: 0.6 }}>{listOpen ? '▲ Hide' : '▼ Show'}</span>
            </Button>

            {listOpen && (
              <div style={{ marginTop: 'var(--afa-space-4)' }}>
                <div style={{ display: 'flex', gap: 'var(--afa-space-2)', marginBottom: 'var(--afa-space-14px)' }}>
                  {(['all', 'checked_in', 'pending'] as const).map((f) => (
                    <Button
                      key={f}
                      variant="bare"
                      onClick={() => setListFilter(f)}
                      style={{
                        flex: 1, padding: 'var(--afa-space-2)', borderRadius: 'var(--afa-radius-md)', fontSize: 'var(--afa-text-small)', fontWeight: 600,
                        border: listFilter === f ? '2px solid var(--afa-fill-solid)' : '1px solid var(--afa-border-resting)',
                        background: listFilter === f ? FILL_SOLID_TINT : 'var(--afa-surface-raised)',
                        color: listFilter === f ? 'var(--afa-fill-solid)' : 'var(--afa-text-primary)',
                      }}
                    >
                      {f === 'all' ? 'All' : f === 'checked_in' ? 'Checked In' : 'Pending'}
                    </Button>
                  ))}
                </div>

                {attendees === null ? (
                  <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.6 }}>Loading...</p>
                ) : (
                  (() => {
                    const filtered = attendees.filter((a) =>
                      listFilter === 'all' ? true : listFilter === 'checked_in' ? !!a.checkedInAt : !a.checkedInAt
                    )
                    if (filtered.length === 0) {
                      return <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.6 }}>No one in this list yet.</p>
                    }
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-10px)' }}>
                        {filtered.map((a) => (
                          <div key={a.bookingId}>
                            <div
                              style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                                padding: 'var(--afa-space-10px) var(--afa-space-3)', borderRadius: 'var(--afa-radius-md)',
                                background: a.checkedInAt ? 'var(--afa-mint-tint)' : 'var(--afa-surface-raised)',
                              }}
                            >
                              <div>
                                <p style={{ fontSize: 'var(--afa-text-ui)', fontWeight: 600, color: 'var(--afa-text-primary)' }}>
                                  {a.name}
                                  {a.seatLabel && <span style={{ fontWeight: 400, opacity: 0.6 }}> · {a.seatLabel}</span>}
                                </p>
                                {seatsSummary(a.seats) && (
                                  <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.6 }}>{seatsSummary(a.seats)}</p>
                                )}
                              </div>
                              <span style={{ fontSize: 'var(--afa-text-small)', fontWeight: 600, color: a.checkedInAt ? 'var(--afa-sage)' : 'var(--afa-text-primary)', opacity: a.checkedInAt ? 1 : 0.4 }}>
                                {a.checkedInAt ? '✓ In' : 'Pending'}
                              </span>
                            </div>
                            {/* Companion Tagging Phase 2 (step 6) - accepted
                                companions get their own check-in row, indented
                                under the booking they're tagged on. */}
                            {a.companions.length > 0 && (
                              <div style={{ marginLeft: 'var(--afa-space-18px)', marginTop: 'var(--afa-space-1)', display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-1)' }}>
                                {a.companions.map((c) => (
                                  <div
                                    key={c.id}
                                    style={{
                                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                      padding: 'var(--afa-space-2) var(--afa-space-3)', borderRadius: 'var(--afa-radius-md)', fontSize: 'var(--afa-text-ui)',
                                      background: c.checkedInAt ? 'var(--afa-mint-tint)' : 'transparent',
                                      border: c.checkedInAt ? 'none' : '1px dashed var(--afa-border-resting)',
                                    }}
                                  >
                                    <span style={{ color: 'var(--afa-text-primary)' }}>
                                      👥 {c.name}
                                      {c.seatLabel && <span style={{ opacity: 0.6 }}> · {c.seatLabel}</span>}
                                    </span>
                                    {c.checkedInAt ? (
                                      <span style={{ fontWeight: 600, color: 'var(--afa-sage)' }}>✓ In</span>
                                    ) : (
                                      <Button
                                        variant="primary"
                                        size="sm"
                                        fullWidth={false}
                                        onClick={() => checkInCompanion(c.id)}
                                        disabled={checkingInCompanion === c.id}
                                        style={{ opacity: checkingInCompanion === c.id ? 0.6 : 1 }}
                                      >
                                        {checkingInCompanion === c.id ? 'Checking in…' : 'Check in'}
                                      </Button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  })()
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
