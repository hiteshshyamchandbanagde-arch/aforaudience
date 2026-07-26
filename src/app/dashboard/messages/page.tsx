'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import BrandLoader from '@/components/BrandLoader'

interface Thread {
  conversationId: string
  contextType: 'PERFORMANCE' | 'VENUE_BOOKING' | 'BOOKING'
  label: string | null
  isActive: boolean
  otherParticipant: { id: string; name: string; displayName: string | null } | null
  lastMessage: { body: string; createdAt: string; senderId: string } | null
  unread: boolean
  updatedAt: string
}

const CONTEXT_LABEL: Record<Thread['contextType'], string> = {
  PERFORMANCE: 'Lineup',
  VENUE_BOOKING: 'Venue',
  BOOKING: 'Ticket',
}

// v1 scope (design.md §9.4): text-only, ~15-20s polling to match the
// rest of the app's real-time-ish surfaces - no websockets built yet.
const POLL_MS = 15000

export default function MessagesInboxPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations')
      if (res.ok) setThreads(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetchThreads()
    const interval = setInterval(fetchThreads, POLL_MS)
    return () => clearInterval(interval)
  }, [status, fetchThreads])

  if (status === 'loading' || loading) {
    return (
      <>
        <SiteNav />
        <BrandLoader />
      </>
    )
  }

  return (
    <>
      <SiteNav />
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '32px 16px' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '28px', color: 'var(--afa-ink)', marginBottom: '24px' }}>
          Messages
        </h1>

        {threads.length === 0 && (
          <p style={{ color: 'var(--afa-ink)', opacity: 0.6, fontFamily: 'system-ui, sans-serif' }}>
            No conversations yet. Threads open automatically once a spot, venue booking, or ticket is confirmed.
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {threads.map((t) => (
            <Link
              key={t.conversationId}
              href={`/dashboard/messages/${t.conversationId}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 16px',
                borderRadius: '10px',
                border: '1px solid rgba(14,12,10,0.1)',
                background: t.unread ? 'rgba(212,163,60,0.08)' : 'var(--afa-cream, #fff)',
                textDecoration: 'none',
                color: 'var(--afa-ink)',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em', opacity: 0.55 }}>
                    {CONTEXT_LABEL[t.contextType]}
                  </span>
                  {!t.isActive && (
                    <span style={{ fontSize: '11px', opacity: 0.45 }}>· Closed</span>
                  )}
                  {t.unread && (
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--afa-terracotta, #b3261e)' }} />
                  )}
                </div>
                <div style={{ fontWeight: 600, fontFamily: 'system-ui, sans-serif', marginTop: '2px' }}>
                  {t.otherParticipant?.displayName ?? t.otherParticipant?.name ?? 'Unknown'}
                  {t.label && <span style={{ fontWeight: 400, opacity: 0.6 }}> — {t.label}</span>}
                </div>
                {t.lastMessage && (
                  <div
                    style={{
                      fontSize: '13px',
                      opacity: 0.65,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginTop: '2px',
                    }}
                  >
                    {t.lastMessage.body}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
