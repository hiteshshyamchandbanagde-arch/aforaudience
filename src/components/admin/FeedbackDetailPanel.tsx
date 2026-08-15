'use client'

import { useEffect, useState, type TouchEvent } from 'react'

// Admin Dashboard v1 detail panel (design.md §9.1).
//
// Slides in from the right on desktop, full-screen sheet on mobile
// (same breakpoint - 780px - as SiteNav's own desktop/mobile split).
// Self-serve editing here is deliberately narrow: status and severity
// only, via controls. The original `message` stays immutable - it's
// the evidence, not something to edit after the fact.

export interface ChangeLogEntry {
  id: string
  field: string
  fromValue: string | null
  toValue: string
  note: string | null
  createdAt: string
}

export interface FeedbackDetailItem {
  id: string
  displayId: string | null
  category: string
  message: string
  pageUrl: string | null
  fromChatbot: boolean
  status: string
  deployStage: string | null
  severity: string | null
  title: string | null
  resolvedAt: string | null
  createdAt: string
  attachmentData: string | null
  user: { name: string | null; email: string | null; displayName: string | null } | null
  changeLog: ChangeLogEntry[]
}

// Workflow overhaul (session 63, Hitesh's design) - two-field split.
// STATUSES is the fix lifecycle; DEPLOY_STAGES only matters once
// status = RESOLVED (see FeedbackDetailPanel's own rendering below).
const STATUSES = [
  'NEW', 'UNDER_REVIEW', 'BUILD_QUEUE', 'IN_BUILD', 'BUILD_COMPLETE',
  'IN_TEST', 'RESOLVED', 'REJECTED', 'REOPENED',
]
const DEPLOY_STAGES = ['DEPLOYED_QA', 'IN_PRODUCT', 'NOTIFIED_USER', 'CLOSED']
// REJECTED needs a reason, REOPENED needs a comment on what's still
// wrong - Hitesh's explicit design, enforced server-side too.
const NOTE_REQUIRED_STATUSES = ['REJECTED', 'REOPENED']
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

const SEVERITY_COLORS: Record<string, string> = {
  LOW: 'var(--afa-sage)',
  MEDIUM: 'var(--afa-gold)',
  HIGH: 'var(--afa-orange-dark)',
  CRITICAL: 'var(--afa-error)',
}

function fmtDateTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function labelize(v: string) {
  return v
    .split('_')
    .map((w) => (w === 'QA' ? 'QA' : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(' ')
}

export default function FeedbackDetailPanel({
  item,
  busy,
  onClose,
  onSetStatus,
  onSetDeployStage,
  onSetSeverity,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  position = null,
}: {
  item: FeedbackDetailItem
  busy: boolean
  onClose: () => void
  onSetStatus: (status: string, note?: string) => void
  onSetDeployStage: (deployStage: string | null) => void
  onSetSeverity: (severity: string | null) => void
  onPrev?: () => void
  onNext?: () => void
  hasPrev?: boolean
  hasNext?: boolean
  position?: { index: number; total: number } | null
}) {
  const [expandedImage, setExpandedImage] = useState(false)
  // Set when a REJECTED/REOPENED click is pending a note - shows the
  // inline textarea + confirm/cancel instead of applying immediately,
  // since those two transitions require justification (Hitesh's design).
  const [pendingNoteStatus, setPendingNoteStatus] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  // Parity fix (2 Aug) after reviewing PR #328's full-page version of
  // this pattern: guard against a rapid double swipe/key-press firing
  // onPrev/onNext twice before the panel's content has updated. Lower
  // stakes here than the full-page version (a modal content swap is a
  // synchronous re-render, not a router.push with a real async
  // window), but cheap to add and keeps both implementations
  // genuinely identical in behavior, not just similar.
  const [navGuard, setNavGuard] = useState(false)

  useEffect(() => {
    setExpandedImage(false)
    setNavGuard(false)
    setPendingNoteStatus(null)
    setNoteDraft('')
  }, [item.id])

  const guardedPrev = () => {
    if (navGuard || !onPrev) return
    setNavGuard(true)
    onPrev()
  }
  const guardedNext = () => {
    if (navGuard || !onNext) return
    setNavGuard(true)
    onNext()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      // Ignore arrow keys while typing anywhere (there's no text input in
      // this panel today, but this stays safe if one's ever added) and
      // while an image is expanded (arrows shouldn't fight image viewing
      // even though there's no zoom/pan here yet).
      const target = e.target as HTMLElement | null
      const isTyping = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      if (isTyping) return
      if (e.key === 'ArrowLeft') guardedPrev()
      if (e.key === 'ArrowRight') guardedNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, onPrev, onNext, navGuard])

  // Swipe left/right to move prev/next on mobile (Feedback 2 Aug,
  // Hitesh). Horizontal-delta-dominant threshold, same shape as
  // SiteNav's existing vertical swipe-to-close - only fires once past a
  // clear threshold and only when the gesture is more horizontal than
  // vertical, so it doesn't fight normal vertical scrolling of a long
  // message/changelog.
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

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <style>{`
        .fb-detail-backdrop { position: absolute; inset: 0; background: rgba(14,12,10,0.35); }
        .fb-detail-panel { position: relative; width: 440px; max-width: 100%; height: 100%; background: var(--afa-surface-raised); box-shadow: -8px 0 24px rgba(14,12,10,0.12); overflow-y: auto; }
        @media (max-width: 780px) {
          .fb-detail-panel { width: 100%; }
        }
      `}</style>
      <div className="fb-detail-backdrop" onClick={onClose} />
      <div className="fb-detail-panel" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div style={{ padding: '20px 20px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--afa-taupe)' }}>
                {item.category}
              </span>
              {item.displayId && (
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--afa-terracotta)', fontFamily: 'monospace' }}>
                  {item.displayId}
                </span>
              )}
              {item.fromChatbot && <span style={{ fontSize: '11px', color: 'var(--afa-taupe)' }}>via chatbot</span>}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--afa-text-primary)', lineHeight: 1, padding: '4px' }}
            >
              ×
            </button>
          </div>

          {position && (onPrev || onNext) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <button
                onClick={guardedPrev}
                disabled={!hasPrev}
                aria-label="Previous"
                style={{
                  background: 'var(--afa-surface-raised)',
                  border: '1px solid var(--afa-ink-a13, rgba(14,12,10,0.13))',
                  borderRadius: '999px',
                  width: '32px',
                  height: '32px',
                  fontSize: '16px',
                  cursor: hasPrev ? 'pointer' : 'default',
                  opacity: hasPrev ? 1 : 0.35,
                  color: 'var(--afa-text-primary)',
                }}
              >
                ‹
              </button>
              <span style={{ fontSize: '12px', color: 'var(--afa-taupe)' }}>
                {position.index} of {position.total}
              </span>
              <button
                onClick={guardedNext}
                disabled={!hasNext}
                aria-label="Next"
                style={{
                  background: 'var(--afa-surface-raised)',
                  border: '1px solid var(--afa-ink-a13, rgba(14,12,10,0.13))',
                  borderRadius: '999px',
                  width: '32px',
                  height: '32px',
                  fontSize: '16px',
                  cursor: hasNext ? 'pointer' : 'default',
                  opacity: hasNext ? 1 : 0.35,
                  color: 'var(--afa-text-primary)',
                }}
              >
                ›
              </button>
            </div>
          )}

          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', margin: '0 0 12px', color: 'var(--afa-text-primary)' }}>
            {item.title || item.message.slice(0, 60)}
          </h2>

          <div style={{ fontSize: '14px', color: 'var(--afa-text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: '16px' }}>
            {item.message}
          </div>

          {item.attachmentData && (
            <div style={{ marginBottom: '16px' }}>
              <img
                src={item.attachmentData}
                alt="Attachment"
                onClick={() => setExpandedImage((v) => !v)}
                style={{
                  maxWidth: expandedImage ? '100%' : '220px',
                  maxHeight: expandedImage ? 'none' : '140px',
                  borderRadius: '8px',
                  border: '1px solid rgba(14,12,10,0.1)',
                  cursor: 'pointer',
                  display: 'block',
                }}
              />
            </div>
          )}

          <div style={{ fontSize: '12px', color: 'var(--afa-taupe)', marginBottom: '20px', lineHeight: 1.8 }}>
            <div>Page: {item.pageUrl || '—'}</div>
            <div>
              From:{' '}
              {item.user
                ? `${item.user.displayName || item.user.name || 'Unknown'}${item.user.email ? ` (${item.user.email})` : ''}`
                : 'Guest submission'}
            </div>
            <div>Filed: {fmtDateTime(item.createdAt)}</div>
            <div>Resolved: {fmtDateTime(item.resolvedAt)}</div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: '8px' }}>Status</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {STATUSES.map((s) => (
                <button
                  key={s}
                  disabled={busy}
                  onClick={() => {
                    if (NOTE_REQUIRED_STATUSES.includes(s) && s !== item.status) {
                      setPendingNoteStatus(s)
                      setNoteDraft('')
                    } else {
                      onSetStatus(s)
                    }
                  }}
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '6px 12px',
                    borderRadius: '999px',
                    border: item.status === s ? 'none' : '1px solid rgba(14,12,10,0.15)',
                    background: item.status === s ? 'var(--afa-fill-solid)' : 'transparent',
                    color: item.status === s ? 'var(--afa-on-fill-solid)' : 'var(--afa-text-primary)',
                    cursor: busy ? 'default' : 'pointer',
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  {labelize(s)}
                </button>
              ))}
            </div>
            {pendingNoteStatus && (
              <div style={{ marginTop: '10px', padding: '10px', background: 'var(--afa-surface-raised)', borderRadius: '8px', border: '1px solid rgba(14,12,10,0.1)' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 600, marginBottom: '6px', color: 'var(--afa-text-primary)' }}>
                  {pendingNoteStatus === 'REJECTED' ? 'Reason for rejecting' : 'Comment - what\'s still wrong?'}
                </div>
                <textarea
                  autoFocus
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  rows={3}
                  style={{ width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '8px', borderRadius: '6px', border: '1px solid rgba(14,12,10,0.15)', resize: 'vertical', fontFamily: 'inherit' }}
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button
                    disabled={busy || !noteDraft.trim()}
                    onClick={() => {
                      onSetStatus(pendingNoteStatus, noteDraft.trim())
                      setPendingNoteStatus(null)
                      setNoteDraft('')
                    }}
                    style={{ fontSize: '12px', fontWeight: 600, padding: '6px 14px', borderRadius: '999px', border: 'none', background: 'var(--afa-fill-solid)', color: 'var(--afa-on-fill-solid)', cursor: busy || !noteDraft.trim() ? 'default' : 'pointer', opacity: busy || !noteDraft.trim() ? 0.5 : 1 }}
                  >
                    Confirm
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => { setPendingNoteStatus(null); setNoteDraft('') }}
                    style={{ fontSize: '12px', fontWeight: 600, padding: '6px 14px', borderRadius: '999px', border: '1px solid rgba(14,12,10,0.15)', background: 'transparent', color: 'var(--afa-text-primary)', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {item.status === 'RESOLVED' && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: '8px' }}>
                Deploy Stage
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  disabled={busy}
                  onClick={() => onSetDeployStage(null)}
                  style={{
                    fontSize: '12px', fontWeight: 600, padding: '6px 12px', borderRadius: '999px',
                    border: !item.deployStage ? 'none' : '1px solid rgba(14,12,10,0.15)',
                    background: !item.deployStage ? 'var(--afa-fill-solid)' : 'transparent',
                    color: !item.deployStage ? 'var(--afa-on-fill-solid)' : 'var(--afa-text-primary)',
                    cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
                  }}
                >
                  Unset
                </button>
                {DEPLOY_STAGES.map((ds) => (
                  <button
                    key={ds}
                    disabled={busy}
                    onClick={() => onSetDeployStage(ds)}
                    style={{
                      fontSize: '12px', fontWeight: 600, padding: '6px 12px', borderRadius: '999px',
                      border: item.deployStage === ds ? 'none' : '1px solid rgba(14,12,10,0.15)',
                      background: item.deployStage === ds ? 'var(--afa-sage)' : 'transparent',
                      color: item.deployStage === ds ? 'white' : 'var(--afa-text-primary)',
                      cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
                    }}
                  >
                    {labelize(ds)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: '8px' }}>Severity</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                disabled={busy}
                onClick={() => onSetSeverity(null)}
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '6px 12px',
                  borderRadius: '999px',
                  border: !item.severity ? 'none' : '1px solid rgba(14,12,10,0.15)',
                  background: !item.severity ? 'var(--afa-fill-solid)' : 'transparent',
                  color: !item.severity ? 'var(--afa-on-fill-solid)' : 'var(--afa-text-primary)',
                  cursor: busy ? 'default' : 'pointer',
                  opacity: busy ? 0.6 : 1,
                }}
              >
                Unset
              </button>
              {SEVERITIES.map((sev) => (
                <button
                  key={sev}
                  disabled={busy}
                  onClick={() => onSetSeverity(sev)}
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '6px 12px',
                    borderRadius: '999px',
                    border: item.severity === sev ? 'none' : '1px solid rgba(14,12,10,0.15)',
                    background: item.severity === sev ? SEVERITY_COLORS[sev] : 'transparent',
                    color: item.severity === sev ? 'white' : 'var(--afa-text-primary)',
                    cursor: busy ? 'default' : 'pointer',
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  {labelize(sev)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: '8px' }}>
              History
            </div>
            {item.changeLog.length === 0 && (
              <p style={{ fontSize: '12px', color: 'var(--afa-taupe)' }}>No changes yet.</p>
            )}
            {item.changeLog.map((entry) => (
              <div
                key={entry.id}
                style={{
                  fontSize: '12px',
                  color: 'var(--afa-text-primary)',
                  opacity: 0.75,
                  padding: '8px 0',
                  borderTop: '1px solid rgba(14,12,10,0.06)',
                }}
              >
                <span style={{ fontWeight: 600 }}>{labelize(entry.field)}</span>:{' '}
                {entry.fromValue ? labelize(entry.fromValue) : 'unset'} → {labelize(entry.toValue)}
                <span style={{ color: 'var(--afa-taupe)' }}> · {fmtDateTime(entry.createdAt)}</span>
                {entry.note && (
                  <div style={{ marginTop: '4px', fontStyle: 'italic', opacity: 0.85 }}>"{entry.note}"</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
