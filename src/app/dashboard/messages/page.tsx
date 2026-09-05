'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import BrandLoader from '@/components/BrandLoader'
import DashboardShell from '@/components/DashboardShell'
import { useLocale } from '@/lib/i18n/translate'

function initials(name: string) {
  return name.charAt(0).toUpperCase() || '?'
}

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

// v1 scope (design.md §9.4): text-only, ~15-20s polling to match the
// rest of the app's real-time-ish surfaces - no websockets built yet.
const POLL_MS = 15000

export default function MessagesInboxPage() {
  const { t: tr } = useLocale()
  const { data: session, status } = useSession()
  const router = useRouter()
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)

  const CONTEXT_LABEL: Record<Thread['contextType'], string> = {
    PERFORMANCE: tr.messagesInboxPage.contextLineup,
    VENUE_BOOKING: tr.messagesInboxPage.contextVenue,
    BOOKING: tr.messagesInboxPage.contextTicket,
  }

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
      <DashboardShell>
        <main style={{ minHeight: '100vh', background: 'var(--afa-surface-page)', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ maxWidth: '760px', padding: '32px 24px' }}>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '28px', color: 'var(--afa-text-primary)', marginBottom: '24px' }}>
              {tr.messagesInboxPage.heading}
            </h1>

            {threads.length === 0 && (
              <p style={{ color: 'var(--afa-text-primary)', opacity: 0.6, fontFamily: 'system-ui, sans-serif' }}>
                {tr.messagesInboxPage.emptyState}
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {threads.map((t) => {
                const name = t.otherParticipant?.displayName ?? t.otherParticipant?.name ?? tr.messagesInboxPage.unknownParticipant
                return (
                  <Link
                    key={t.conversationId}
                    href={`/dashboard/messages/${t.conversationId}`}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '16px',
                      borderRadius: '12px',
                      border: t.unread ? '1px solid rgba(201,151,58,0.18)' : '1px solid rgba(245,245,240,0.06)',
                      background: t.unread ? 'rgba(201,151,58,0.07)' : 'var(--afa-surface-raised)',
                      textDecoration: 'none',
                      color: 'var(--afa-text-primary)',
                    }}
                  >
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '13px',
                        fontWeight: 700,
                        background: 'rgba(245,245,240,0.08)',
                        color: 'var(--afa-text-primary)',
                      }}
                    >
                      {initials(name)}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
                        {/* Type tag: single amber treatment for all 3 context types
                            (BUG-2609-003 / Figma Make review) - differentiated by
                            label text only, not by color. */}
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 500,
                            letterSpacing: '0.04em',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(201,151,58,0.15)',
                            color: 'var(--afa-amber)',
                          }}
                        >
                          {CONTEXT_LABEL[t.contextType]}
                        </span>
                        {!t.isActive && (
                          <span style={{ fontSize: '11px', color: 'var(--afa-text-primary)', opacity: 0.45 }}>{tr.messagesInboxPage.closedLabel}</span>
                        )}
                        {t.unread && (
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--afa-amber)' }} />
                        )}
                      </div>
                      <div style={{ fontWeight: t.unread ? 600 : 500, fontFamily: 'system-ui, sans-serif', fontSize: '13px' }}>
                        {name}
                        {t.label && <span style={{ fontWeight: 400, opacity: 0.6 }}> — {t.label}</span>}
                      </div>
                      {t.lastMessage && (
                        <div
                          style={{
                            fontSize: '12.5px',
                            opacity: 0.6,
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
                )
              })}
            </div>
          </div>
        </main>
      </DashboardShell>
    </>
  )
}
