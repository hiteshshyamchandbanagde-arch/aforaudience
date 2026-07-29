'use client'

import { useEffect, useState } from 'react'

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
  createdAt: string
}

export interface FeedbackDetailItem {
  id: string
  category: string
  message: string
  pageUrl: string | null
  fromChatbot: boolean
  status: string
  severity: string | null
  title: string | null
  resolvedAt: string | null
  createdAt: string
  attachmentData: string | null
  user: { name: string | null; email: string | null; displayName: string | null } | null
  changeLog: ChangeLogEntry[]
}

const STATUSES = ['NEW', 'REVIEWED', 'TESTED', 'RESOLVED']
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
  return v.charAt(0) + v.slice(1).toLowerCase()
}

export default function FeedbackDetailPanel({
  item,
  busy,
  onClose,
  onSetStatus,
  onSetSeverity,
}: {
  item: FeedbackDetailItem
  busy: boolean
  onClose: () => void
  onSetStatus: (status: string) => void
  onSetSeverity: (severity: string | null) => void
}) {
  const [expandedImage, setExpandedImage] = useState(false)

  useEffect(() => {
    setExpandedImage(false)
  }, [item.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
        .fb-detail-panel { position: relative; width: 440px; max-width: 100%; height: 100%; background: var(--afa-cream); box-shadow: -8px 0 24px rgba(14,12,10,0.12); overflow-y: auto; }
        @media (max-width: 780px) {
          .fb-detail-panel { width: 100%; }
        }
      `}</style>
      <div className="fb-detail-backdrop" onClick={onClose} />
      <div className="fb-detail-panel">
        <div style={{ padding: '20px 20px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--afa-taupe)' }}>
                {item.category}
              </span>
              {item.fromChatbot && <span style={{ fontSize: '11px', color: 'var(--afa-taupe)' }}>via chatbot</span>}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--afa-ink)', lineHeight: 1, padding: '4px' }}
            >
              ×
            </button>
          </div>

          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', margin: '0 0 12px', color: 'var(--afa-ink)' }}>
            {item.title || item.message.slice(0, 60)}
          </h2>

          <div style={{ fontSize: '14px', color: 'var(--afa-ink)', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: '16px' }}>
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
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '8px' }}>Status</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {STATUSES.map((s) => (
                <button
                  key={s}
                  disabled={busy}
                  onClick={() => onSetStatus(s)}
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '6px 12px',
                    borderRadius: '999px',
                    border: item.status === s ? 'none' : '1px solid rgba(14,12,10,0.15)',
                    background: item.status === s ? 'var(--afa-ink)' : 'transparent',
                    color: item.status === s ? 'var(--afa-cream)' : 'var(--afa-ink)',
                    cursor: busy ? 'default' : 'pointer',
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  {labelize(s)}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '8px' }}>Severity</div>
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
                  background: !item.severity ? 'var(--afa-ink)' : 'transparent',
                  color: !item.severity ? 'var(--afa-cream)' : 'var(--afa-ink)',
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
                    color: item.severity === sev ? 'white' : 'var(--afa-ink)',
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
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '8px' }}>
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
                  color: 'var(--afa-ink)',
                  opacity: 0.75,
                  padding: '8px 0',
                  borderTop: '1px solid rgba(14,12,10,0.06)',
                }}
              >
                <span style={{ fontWeight: 600 }}>{labelize(entry.field)}</span>:{' '}
                {entry.fromValue ? labelize(entry.fromValue) : 'unset'} → {labelize(entry.toValue)}
                <span style={{ color: 'var(--afa-taupe)' }}> · {fmtDateTime(entry.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
