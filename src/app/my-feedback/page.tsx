'use client'

import { useCallback, useEffect, useState, type TouchEvent } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import SiteNav from '@/components/SiteNav'
import BrandLoader from '@/components/BrandLoader'

type FeedbackCategory = 'BUG' | 'FEATURE_IDEA' | 'QUESTION' | 'GENERAL' | 'OTHER'
type FeedbackStatus =
  | 'NEW' | 'UNDER_REVIEW' | 'BUILD_QUEUE' | 'IN_BUILD' | 'BUILD_COMPLETE'
  | 'IN_TEST' | 'RESOLVED' | 'REJECTED' | 'REOPENED'
type FeedbackDeployStage = 'DEPLOYED_QA' | 'IN_PRODUCT' | 'NOTIFIED_USER' | 'CLOSED' | null

type FeedbackItem = {
  id: string
  displayId: string | null
  title: string | null
  message: string
  category: FeedbackCategory
  status: FeedbackStatus
  deployStage: FeedbackDeployStage
  createdAt: string
  resolvedAt: string | null
  latestNote: string | null
}

const CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  BUG: 'Bug',
  FEATURE_IDEA: 'Feature idea',
  QUESTION: 'Question',
  GENERAL: 'General',
  OTHER: 'Other',
}

// User-facing labels stay deliberately simpler than the admin board's
// raw internal pipeline (session 63 workflow overhaul) - a submitter
// doesn't need to distinguish "Build Queue" from "In Build" from "Build
// Complete", just "we're working on it". RESOLVED's label depends on
// deployStage (computed below in statusStyleFor), since "fixed" reads
// very differently depending on whether it's live yet.
const STATUS_STYLE: Record<Exclude<FeedbackStatus, 'RESOLVED'>, { label: string; bg: string; fg: string }> = {
  NEW: { label: 'Submitted', bg: 'rgba(14,12,10,0.08)', fg: '#0E0C0A' },
  UNDER_REVIEW: { label: 'In review', bg: '#FFF3E6', fg: '#C2410C' },
  BUILD_QUEUE: { label: 'Queued to build', bg: '#FFF3E6', fg: '#C2410C' },
  IN_BUILD: { label: 'In progress', bg: '#FFF3E6', fg: '#C2410C' },
  BUILD_COMPLETE: { label: 'In progress', bg: '#FFF3E6', fg: '#C2410C' },
  IN_TEST: { label: 'Being tested', bg: '#FFF3E6', fg: '#C2410C' },
  REOPENED: { label: 'Reopened', bg: '#FFF3E6', fg: '#C2410C' },
  REJECTED: { label: 'Not planned', bg: 'rgba(14,12,10,0.08)', fg: 'rgba(14,12,10,0.6)' },
}

function statusStyleFor(item: FeedbackItem): { label: string; bg: string; fg: string } {
  if (item.status !== 'RESOLVED') return STATUS_STYLE[item.status]
  if (item.deployStage === 'IN_PRODUCT' || item.deployStage === 'NOTIFIED_USER' || item.deployStage === 'CLOSED') {
    return { label: 'Fixed - live', bg: '#E8F5E9', fg: '#2E7D32' }
  }
  // RESOLVED with no deployStage (or DEPLOYED_QA) - fixed, but not yet
  // shipped to the live app. Under the current prod freeze this is
  // where everything sits, so it's worth being explicit rather than
  // just saying "Resolved" and letting someone assume it's live.
  return { label: 'Fixed - in testing', bg: '#E8F5E9', fg: '#2E7D32' }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

// BUG-2608-019: this page rendered each row as a plain non-interactive
// div - there was nothing to click, and the swipe/arrow prev-next pattern
// from #327 only ever existed in the admin FeedbackDetailPanel. This is
// the user-facing equivalent: read-only (no status/severity controls,
// unlike the admin panel), operating entirely on the items array already
// loaded here, with the same guarded keyboard/swipe nav pattern used by
// #327/#328/#330 so the behavior feels consistent across the app.
function FeedbackDetailOverlay({
  items,
  index,
  onClose,
  onNavigate,
}: {
  items: FeedbackItem[]
  index: number
  onClose: () => void
  onNavigate: (nextIndex: number) => void
}) {
  const item = items[index]
  const hasPrev = index > 0
  const hasNext = index < items.length - 1
  const [navGuard, setNavGuard] = useState(false)

  useEffect(() => {
    setNavGuard(false)
  }, [index])

  const guardedPrev = useCallback(() => {
    if (navGuard || !hasPrev) return
    setNavGuard(true)
    onNavigate(index - 1)
  }, [navGuard, hasPrev, index, onNavigate])

  const guardedNext = useCallback(() => {
    if (navGuard || !hasNext) return
    setNavGuard(true)
    onNavigate(index + 1)
  }, [navGuard, hasNext, index, onNavigate])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'ArrowLeft') guardedPrev()
      if (e.key === 'ArrowRight') guardedNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, guardedPrev, guardedNext])

  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null)
  const SWIPE_THRESHOLD_PX = 60
  const handleTouchStart = (e: TouchEvent) => {
    setTouchStartPos({ x: e.touches[0].clientX, y: e.touches[0].clientY })
  }
  const handleTouchEnd = (e: TouchEvent) => {
    if (!touchStartPos) return
    const dx = e.changedTouches[0].clientX - touchStartPos.x
    const dy = e.changedTouches[0].clientY - touchStartPos.y
    setTouchStartPos(null)
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) return
    if (dx > 0) guardedPrev()
    else guardedNext()
  }

  if (!item) return null
  const statusStyle = statusStyleFor(item)

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(14,12,10,0.45)' }}
      />
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'relative',
          width: 'min(480px, 100%)',
          height: '100%',
          background: 'var(--afa-cream)',
          padding: '28px 24px',
          overflowY: 'auto',
          boxShadow: '-8px 0 24px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', color: 'rgba(14,12,10,0.5)' }}>
            {index + 1} of {items.length}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'transparent', fontSize: '20px', cursor: 'pointer', lineHeight: 1, color: 'var(--afa-black, #0E0C0A)' }}
          >
            ✕
          </button>
        </div>

        <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(14,12,10,0.5)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          {CATEGORY_LABEL[item.category]} · {formatDate(item.createdAt)}
          {item.displayId && <> · {item.displayId}</>}
        </div>

        <span
          style={{
            display: 'inline-block',
            marginTop: '10px',
            fontSize: '12px',
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: '999px',
            background: statusStyle.bg,
            color: statusStyle.fg,
          }}
        >
          {statusStyle.label}
        </span>

        <p style={{ marginTop: '18px', fontSize: '16px', lineHeight: 1.5, color: 'var(--afa-black, #0E0C0A)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {item.message}
        </p>

        {item.latestNote && (
          <div style={{ marginTop: '16px', padding: '14px 16px', background: 'var(--afa-white)', borderRadius: '10px', border: '1px solid rgba(14,12,10,0.08)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(14,12,10,0.5)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Note from the team
            </div>
            <p style={{ margin: 0, fontSize: '14px', fontStyle: 'italic', color: 'rgba(14,12,10,0.75)' }}>&quot;{item.latestNote}&quot;</p>
          </div>
        )}

        {item.resolvedAt && (
          <div style={{ marginTop: '16px', fontSize: '13px', color: 'rgba(14,12,10,0.55)' }}>
            Resolved {formatDateTime(item.resolvedAt)}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px', gap: '12px' }}>
          <button
            onClick={guardedPrev}
            disabled={!hasPrev}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '10px',
              border: '1px solid rgba(14,12,10,0.15)',
              background: 'var(--afa-white)',
              color: hasPrev ? 'var(--afa-black, #0E0C0A)' : 'rgba(14,12,10,0.3)',
              cursor: hasPrev ? 'pointer' : 'default',
              fontWeight: 600,
            }}
          >
            ← Previous
          </button>
          <button
            onClick={guardedNext}
            disabled={!hasNext}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '10px',
              border: '1px solid rgba(14,12,10,0.15)',
              background: 'var(--afa-white)',
              color: hasNext ? 'var(--afa-black, #0E0C0A)' : 'rgba(14,12,10,0.3)',
              cursor: hasNext ? 'pointer' : 'default',
              fontWeight: 600,
            }}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MyFeedbackPage() {
  const { status: sessionStatus } = useSession()
  const router = useRouter()
  const [items, setItems] = useState<FeedbackItem[] | null>(null)
  const [error, setError] = useState('')
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.replace('/login?callbackUrl=/my-feedback')
    }
  }, [sessionStatus, router])

  const loadFeedback = useCallback(() => {
    fetch('/api/feedback/mine')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load')
        return res.json()
      })
      .then((data) => {
        setItems(data.items ?? [])
        setError('')
      })
      .catch(() => {
        setError('Could not load your feedback right now. Please try again shortly.')
      })
  }, [])

  useEffect(() => {
    if (sessionStatus !== 'authenticated') return
    loadFeedback()
  }, [sessionStatus, loadFeedback])

  // BUG-2608-020: submitting via the SupportWidget is an in-page overlay,
  // not a real navigation, so this list never picked up a fresh
  // submission without a hard reload. The widget broadcasts this event on
  // a successful submit.
  useEffect(() => {
    if (sessionStatus !== 'authenticated') return
    window.addEventListener('afa:feedback-submitted', loadFeedback)
    return () => window.removeEventListener('afa:feedback-submitted', loadFeedback)
  }, [sessionStatus, loadFeedback])

  if (sessionStatus === 'loading' || sessionStatus === 'unauthenticated') {
    return <BrandLoader />
  }

  return (
    <div style={{ background: 'var(--afa-cream)', minHeight: '100vh' }}>
      <SiteNav variant="page" />
      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 20px 64px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '4px', color: 'var(--afa-black, #0E0C0A)' }}>
          My Feedback
        </h1>
        <p style={{ color: 'rgba(14,12,10,0.6)', marginBottom: '28px' }}>
          Everything you&apos;ve reported to the AforAudience team, and where it stands.
        </p>

        {error && (
          <div style={{ padding: '16px', background: '#FFEBEE', borderRadius: '10px', color: '#C62828', marginBottom: '20px' }}>
            {error}
          </div>
        )}

        {items === null && !error && <BrandLoader label="Loading your feedback..." />}

        {items !== null && items.length === 0 && (
          <div
            style={{
              background: 'var(--afa-white)',
              borderRadius: '12px',
              padding: '32px 24px',
              textAlign: 'center',
              border: '1px solid rgba(14,12,10,0.08)',
            }}
          >
            <p style={{ color: 'rgba(14,12,10,0.6)', margin: 0 }}>
              You haven&apos;t submitted any feedback yet. Use the chat icon in the corner any time to report a bug or
              suggest something.
            </p>
          </div>
        )}

        {items !== null && items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {items.map((item, i) => {
              const statusStyle = statusStyleFor(item)
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedIndex(i)}
                  style={{
                    background: 'var(--afa-white)',
                    borderRadius: '12px',
                    padding: '18px 20px',
                    border: '1px solid rgba(14,12,10,0.08)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    width: '100%',
                    font: 'inherit',
                    color: 'inherit',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(14,12,10,0.5)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        {CATEGORY_LABEL[item.category]} · {formatDate(item.createdAt)}
                        {item.displayId && <> · {item.displayId}</>}
                      </div>
                      <p style={{ margin: '6px 0 0', fontSize: '15px', color: 'var(--afa-black, #0E0C0A)', wordBreak: 'break-word' }}>
                        {item.title || item.message}
                      </p>
                      {item.latestNote && (
                        <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'rgba(14,12,10,0.65)', fontStyle: 'italic', wordBreak: 'break-word' }}>
                          &quot;{item.latestNote}&quot;
                        </p>
                      )}
                    </div>
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: '12px',
                        fontWeight: 600,
                        padding: '4px 10px',
                        borderRadius: '999px',
                        background: statusStyle.bg,
                        color: statusStyle.fg,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {statusStyle.label}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </main>

      {items !== null && selectedIndex !== null && (
        <FeedbackDetailOverlay
          items={items}
          index={selectedIndex}
          onClose={() => setSelectedIndex(null)}
          onNavigate={setSelectedIndex}
        />
      )}
    </div>
  )
}
