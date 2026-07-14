'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import SiteNav from '@/components/SiteNav'

// /dashboard/admin/feedback
//
// Lists all Feedback submissions — from the manual widget form and
// from the chatbot's "I don't know, send this to the team?" fallback.
// Newest first, filterable by status client-side (no server round-trip
// for filtering since the whole list is small at MVP volume).
//
// Kept as its own page rather than a section on the main admin
// dashboard for the same reason /dashboard/admin/settings is separate:
// approvals-queue work and feedback triage are different tasks, mixing
// them on one screen makes both harder to scan.

interface FeedbackItem {
  id: string
  category: string
  message: string
  pageUrl: string | null
  fromChatbot: boolean
  status: string
  createdAt: string
  attachmentData: string | null
  user: { name: string | null; email: string | null; displayName: string | null } | null
}

const CATEGORY_LABELS: Record<string, string> = {
  BUG: 'Bug',
  FEATURE_IDEA: 'Feature idea',
  QUESTION: 'Question',
  GENERAL: 'General',
  OTHER: 'Other',
}

const CATEGORY_COLORS: Record<string, string> = {
  BUG: '#B3261E',
  FEATURE_IDEA: '#4A6741',
  QUESTION: '#C8441A',
  GENERAL: '#8a827a',
  OTHER: '#8a827a',
}

const STATUS_FILTERS = ['ALL', 'NEW', 'REVIEWED', 'RESOLVED']

export default function AdminFeedbackPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [filter, setFilter] = useState<string>('NEW')
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [expandedAttachment, setExpandedAttachment] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/feedback')
    if (res.status === 403) {
      setForbidden(true)
      setLoading(false)
      return
    }
    if (res.ok) {
      const data = await res.json()
      setItems(data.items)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (session?.user) load()
  }, [session])

  const setItemStatus = async (id: string, newStatus: string) => {
    setActioningId(id)
    try {
      await fetch('/api/admin/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      })
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
      )
    } finally {
      setActioningId(null)
    }
  }

  if (status === 'loading' || loading)
    return (
      <>
        <SiteNav />
        <div style={{ padding: '32px' }}>Loading...</div>
      </>
    )
  if (!session) return <SiteNav />

  if (forbidden) {
    return (
      <>
        <SiteNav />
        <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', marginBottom: '12px' }}>
              Admin access only
            </h1>
            <p style={{ color: '#0E0C0A', opacity: 0.6 }}>
              This page is restricted to platform administrators.
            </p>
          </div>
        </main>
      </>
    )
  }

  const visibleItems = filter === 'ALL' ? items : items.filter((i) => i.status === filter)
  const counts = {
    ALL: items.length,
    NEW: items.filter((i) => i.status === 'NEW').length,
    REVIEWED: items.filter((i) => i.status === 'REVIEWED').length,
    RESOLVED: items.filter((i) => i.status === 'RESOLVED').length,
  }

  const cardStyle = {
    background: '#fff',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid rgba(14,12,10,0.08)',
    marginBottom: '12px',
  }

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 24px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: '8px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <h1
              style={{
                fontFamily: 'Georgia, serif',
                fontSize: '32px',
                fontWeight: 700,
                color: '#0E0C0A',
                margin: 0,
              }}
            >
              Feedback
            </h1>
            <a
              href="/dashboard/admin"
              style={{ fontSize: '13px', color: '#C8441A', fontWeight: 700, textDecoration: 'none' }}
            >
              ← Admin
            </a>
          </div>
          <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6, marginBottom: '24px' }}>
            Submitted via the support widget — both the manual form and questions the chatbot
            couldn&apos;t answer.
          </p>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  padding: '6px 14px',
                  borderRadius: '999px',
                  border: filter === f ? 'none' : '1px solid rgba(14,12,10,0.15)',
                  background: filter === f ? '#0E0C0A' : 'transparent',
                  color: filter === f ? '#F7F3EE' : '#0E0C0A',
                  cursor: 'pointer',
                }}
              >
                {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()} ({counts[f as keyof typeof counts]})
              </button>
            ))}
          </div>

          {visibleItems.length === 0 && (
            <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.5 }}>
              Nothing here{filter !== 'ALL' ? ` in ${filter.toLowerCase()}` : ''}.
            </p>
          )}

          {visibleItems.map((item) => (
            <div key={item.id} style={cardStyle}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '16px',
                  marginBottom: '10px',
                }}
              >
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      color: 'white',
                      background: CATEGORY_COLORS[item.category] || '#8a827a',
                      padding: '3px 10px',
                      borderRadius: '999px',
                    }}
                  >
                    {CATEGORY_LABELS[item.category] || item.category}
                  </span>
                  {item.fromChatbot && (
                    <span style={{ fontSize: '11px', color: '#8a827a' }}>via chatbot</span>
                  )}
                  <span style={{ fontSize: '11px', color: '#8a827a' }}>
                    {new Date(item.createdAt).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  {STATUS_FILTERS.filter((s) => s !== 'ALL' && s !== item.status).map((s) => (
                    <button
                      key={s}
                      disabled={actioningId === item.id}
                      onClick={() => setItemStatus(item.id, s)}
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#0E0C0A',
                        background: 'transparent',
                        border: '1px solid rgba(14,12,10,0.15)',
                        borderRadius: '6px',
                        padding: '5px 10px',
                        cursor: 'pointer',
                        opacity: actioningId === item.id ? 0.5 : 1,
                      }}
                    >
                      Mark {s.charAt(0) + s.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ fontSize: '14px', color: '#0E0C0A', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {item.message}
              </div>

              {item.attachmentData && (
                <div style={{ marginTop: '10px' }}>
                  <img
                    src={item.attachmentData}
                    alt="Attachment"
                    onClick={() =>
                      setExpandedAttachment(expandedAttachment === item.id ? null : item.id)
                    }
                    style={{
                      maxWidth: expandedAttachment === item.id ? '100%' : '160px',
                      maxHeight: expandedAttachment === item.id ? 'none' : '100px',
                      borderRadius: '8px',
                      border: '1px solid rgba(14,12,10,0.1)',
                      cursor: 'pointer',
                      display: 'block',
                    }}
                  />
                </div>
              )}

              <div style={{ fontSize: '12px', color: '#8a827a', marginTop: '10px' }}>
                {item.pageUrl && <span>Page: {item.pageUrl}</span>}
                {item.user && (
                  <span>
                    {item.pageUrl ? ' · ' : ''}
                    {item.user.displayName || item.user.name || 'Unknown'}
                    {item.user.email ? ` (${item.user.email})` : ''}
                  </span>
                )}
                {!item.user && (item.pageUrl ? ' · ' : '') + 'Guest submission'}
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  )
}
