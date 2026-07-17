'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, use, useCallback } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'

type ScanResult = {
  ok: boolean
  reason?: string
  message?: string
  attendeeName?: string
  seats?: Record<string, number>
  checkedInAt?: string
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
  }, [eventId, refreshCounts])

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

  if (status === 'loading' || loading) return (<><SiteNav /><div style={{ padding: '32px' }}>Loading...</div></>)
  if (!session) return <SiteNav />
  if (loadError) return (<><SiteNav /><div style={{ padding: '32px', color: '#B3261E' }}>{loadError}</div></>)

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
            padding: '18px 20px', paddingTop: 'calc(18px + env(safe-area-inset-top, 0px))',
            background: lastResult.ok ? '#2F4A28' : '#B3261E',
            color: '#F7F3EE', boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            cursor: 'pointer',
          }}
        >
          <p style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>
            {lastResult.ok ? '✓ Checked in' : lastResult.reason === 'ALREADY_CHECKED_IN' ? '⚠ Already checked in' : '✗ Not valid'}
          </p>
          {lastResult.attendeeName && (
            <p style={{ fontSize: '15px', marginBottom: '2px' }}>{lastResult.attendeeName}</p>
          )}
          {lastResult.seats && seatsSummary(lastResult.seats) && (
            <p style={{ fontSize: '13px', opacity: 0.85, marginBottom: '2px' }}>{seatsSummary(lastResult.seats)}</p>
          )}
          {lastResult.message && (
            <p style={{ fontSize: '13px', opacity: 0.85 }}>{lastResult.message}</p>
          )}
          <p style={{ fontSize: '11px', opacity: 0.7, marginTop: '6px' }}>Tap to dismiss</p>
        </div>
      )}

      <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto', padding: '32px 20px 64px' }}>
          <Link href={`/dashboard/organiser/events/${eventId}`} style={{ fontSize: '14px', color: '#C8441A', textDecoration: 'none', fontWeight: 600 }}>
            ← Back to Event
          </Link>

          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '26px', fontWeight: 700, color: '#0E0C0A', marginTop: '14px', marginBottom: '4px' }}>
            Check-In
          </h1>
          <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.6, marginBottom: '4px' }}>{eventTitle}</p>
          {counts && (
            <p style={{ fontSize: '14px', fontWeight: 600, color: '#4A6741', marginBottom: '24px' }}>
              {counts.checkedIn} of {counts.total} checked in
            </p>
          )}

          <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
            {!cameraOn ? (
              <button
                onClick={() => { setCameraError(''); setCameraOn(true) }}
                style={{
                  width: '100%', fontSize: '14px', fontWeight: 600, color: '#F7F3EE', background: '#C8441A',
                  border: 'none', borderRadius: '8px', padding: '14px', cursor: 'pointer',
                }}
              >
                📷 Start Camera Scan
              </button>
            ) : (
              <>
                <div id="checkin-camera" style={{ width: '100%', borderRadius: '8px', overflow: 'hidden' }} />
                <button
                  onClick={() => setCameraOn(false)}
                  style={{
                    width: '100%', fontSize: '13px', fontWeight: 600, color: '#0E0C0A', background: 'transparent',
                    border: '1px solid rgba(14,12,10,0.2)', borderRadius: '8px', padding: '10px', cursor: 'pointer', marginTop: '12px',
                  }}
                >
                  Stop Camera
                </button>
              </>
            )}
            {cameraError && (
              <p style={{ fontSize: '13px', color: '#B3261E', marginTop: '10px' }}>{cameraError}</p>
            )}
          </div>

          <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#0E0C0A' }}>
              Manual entry <span style={{ fontWeight: 400, opacity: 0.6 }}>(booking ID printed on the ticket)</span>
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitCode(manualCode) }}
                placeholder="e.g., ckabc123..."
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(14,12,10,0.15)',
                  background: '#fff', fontSize: '14px', color: '#0E0C0A',
                }}
              />
              <button
                onClick={() => submitCode(manualCode)}
                disabled={submitting || !manualCode.trim()}
                style={{
                  fontSize: '14px', fontWeight: 600, color: '#F7F3EE', background: '#0E0C0A',
                  border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer',
                  opacity: submitting || !manualCode.trim() ? 0.5 : 1,
                }}
              >
                Check In
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
