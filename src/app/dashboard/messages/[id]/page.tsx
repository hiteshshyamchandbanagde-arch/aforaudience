'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState, useCallback, useRef } from 'react'
import SiteNav from '@/components/SiteNav'
import BrandLoader from '@/components/BrandLoader'
import { useToast } from '@/components/Toast'
import { useLocale } from '@/lib/i18n/translate'

interface Message {
  id: string
  senderId: string
  body: string
  createdAt: string
}

interface ThreadData {
  conversationId: string
  contextType: string
  label: string | null
  isActive: boolean
  participants: { id: string; name: string; displayName: string | null }[]
  messages: Message[]
}

const POLL_MS = 15000

export default function MessageThreadPage() {
  const { t: tr } = useLocale()
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const conversationId = params?.id as string
  const { showToast } = useToast()

  const [thread, setThread] = useState<ThreadData | null>(null)
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const fetchThread = useCallback(async () => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`)
      if (res.ok) {
        setThread(await res.json())
      } else if (res.status === 403 || res.status === 404) {
        showToast(tr.messageThreadPage.conversationUnavailable, 'error')
        router.push('/dashboard/messages')
      }
    } finally {
      setLoading(false)
    }
    // showToast/router intentionally omitted - stable enough not to
    // need re-subscribing the poll interval on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  useEffect(() => {
    if (status !== 'authenticated' || !conversationId) return
    fetchThread()
    const interval = setInterval(fetchThread, POLL_MS)
    return () => clearInterval(interval)
  }, [status, conversationId, fetchThread])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread?.messages.length])

  const handleSend = async () => {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      })
      if (res.ok) {
        setDraft('')
        await fetchThread()
      } else {
        const data = await res.json().catch(() => ({}))
        showToast(data.error || tr.messageThreadPage.sendFailed, 'error')
      }
    } catch {
      showToast(tr.messageThreadPage.sendFailed, 'error')
    } finally {
      setSending(false)
    }
  }

  if (status === 'loading' || loading || !thread) {
    return (
      <>
        <SiteNav />
        <BrandLoader />
      </>
    )
  }

  const myId = (session?.user as any)?.id as string

  return (
    <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', fontFamily: 'system-ui, sans-serif' }}>
      <SiteNav />
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
        <div style={{ marginBottom: '12px' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '22px', color: 'var(--afa-text-primary)', margin: 0 }}>
            {thread.label ?? tr.messageThreadPage.fallbackTitle}
          </h1>
          {!thread.isActive && (
            <p style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.55, marginTop: '4px' }}>
              {tr.messageThreadPage.closedNotice}
            </p>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '16px' }}>
          {thread.messages.length === 0 && (
            <p style={{ color: 'var(--afa-text-primary)', opacity: 0.5, fontFamily: 'system-ui, sans-serif', fontSize: '14px' }}>
              {tr.messageThreadPage.emptyMessages}
            </p>
          )}
          {thread.messages.map((m) => {
            const mine = m.senderId === myId
            return (
              <div
                key={m.id}
                style={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '75%',
                  background: mine ? 'var(--afa-sage, #4a6741)' : 'rgba(245,245,240,0.06)',
                  color: mine ? '#fff' : 'var(--afa-text-primary)',
                  borderRadius: '14px',
                  padding: '8px 12px',
                  fontFamily: 'system-ui, sans-serif',
                  fontSize: '14px',
                  wordBreak: 'break-word',
                }}
              >
                {m.body}
                <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '4px' }}>
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {thread.isActive ? (
          <div style={{ display: 'flex', gap: '8px', paddingTop: '8px', borderTop: '1px solid rgba(245,245,240,0.1)' }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder={tr.messageThreadPage.inputPlaceholder}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: '20px',
                border: '1px solid rgba(245,245,240,0.2)',
                fontFamily: 'system-ui, sans-serif',
                fontSize: '14px',
                background: 'var(--afa-surface-raised)',
                color: 'var(--afa-text-primary)',
              }}
            />
            <button
              onClick={handleSend}
              disabled={sending || !draft.trim()}
              style={{
                padding: '10px 20px',
                borderRadius: '20px',
                border: 'none',
                background: 'var(--afa-sage, #4a6741)',
                color: '#fff',
                fontWeight: 600,
                cursor: sending || !draft.trim() ? 'default' : 'pointer',
                opacity: sending || !draft.trim() ? 0.6 : 1,
              }}
            >
              {tr.messageThreadPage.sendBtn}
            </button>
          </div>
        ) : null}
      </div>
    </main>
  )
}
