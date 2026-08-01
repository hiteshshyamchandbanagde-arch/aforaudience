'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import SiteNav from '@/components/SiteNav'
import BrandLoader from '@/components/BrandLoader'

type FeedbackCategory = 'BUG' | 'FEATURE_IDEA' | 'QUESTION' | 'GENERAL' | 'OTHER'
type FeedbackStatus = 'NEW' | 'REVIEWED' | 'RESOLVED'

type FeedbackItem = {
  id: string
  title: string | null
  message: string
  category: FeedbackCategory
  status: FeedbackStatus
  createdAt: string
  resolvedAt: string | null
}

const CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  BUG: 'Bug',
  FEATURE_IDEA: 'Feature idea',
  QUESTION: 'Question',
  GENERAL: 'General',
  OTHER: 'Other',
}

const STATUS_STYLE: Record<FeedbackStatus, { label: string; bg: string; fg: string }> = {
  NEW: { label: 'Submitted', bg: 'rgba(14,12,10,0.08)', fg: '#0E0C0A' },
  REVIEWED: { label: 'In review', bg: '#FFF3E6', fg: '#C2410C' },
  RESOLVED: { label: 'Resolved', bg: '#E8F5E9', fg: '#2E7D32' },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function MyFeedbackPage() {
  const { status: sessionStatus } = useSession()
  const router = useRouter()
  const [items, setItems] = useState<FeedbackItem[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.replace('/login?callbackUrl=/my-feedback')
    }
  }, [sessionStatus, router])

  useEffect(() => {
    if (sessionStatus !== 'authenticated') return
    let cancelled = false
    fetch('/api/feedback/mine')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load')
        return res.json()
      })
      .then((data) => {
        if (!cancelled) setItems(data.items ?? [])
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your feedback right now. Please try again shortly.')
      })
    return () => {
      cancelled = true
    }
  }, [sessionStatus])

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
            {items.map((item) => {
              const statusStyle = STATUS_STYLE[item.status]
              return (
                <div
                  key={item.id}
                  style={{
                    background: 'var(--afa-white)',
                    borderRadius: '12px',
                    padding: '18px 20px',
                    border: '1px solid rgba(14,12,10,0.08)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(14,12,10,0.5)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        {CATEGORY_LABEL[item.category]} · {formatDate(item.createdAt)}
                      </div>
                      <p style={{ margin: '6px 0 0', fontSize: '15px', color: 'var(--afa-black, #0E0C0A)', wordBreak: 'break-word' }}>
                        {item.title || item.message}
                      </p>
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
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
