'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'

interface MessageButtonProps {
  contextType: 'PERFORMANCE' | 'VENUE_BOOKING' | 'BOOKING'
  contextId: string
  label?: string
  style?: React.CSSProperties
}

// Drop this on any page that has a confirmed Performance / VenueBooking /
// Booking record - it finds-or-creates the thread and takes the user
// straight there. Idempotent server-side, so no need to check "does a
// thread already exist" before rendering this.
export default function MessageButton({ contextType, contextId, label = 'Message', style }: MessageButtonProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/conversations/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextType, contextId }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(`/dashboard/messages/${data.conversationId}`)
      } else {
        showToast(data.error || 'Could not open this conversation.', 'error')
      }
    } catch {
      showToast('Could not open this conversation.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        padding: '8px 16px',
        borderRadius: '18px',
        border: '1px solid var(--afa-sage, #4a6741)',
        background: 'transparent',
        color: 'var(--afa-sage, #4a6741)',
        fontFamily: 'system-ui, sans-serif',
        fontWeight: 600,
        fontSize: '13px',
        cursor: loading ? 'default' : 'pointer',
        opacity: loading ? 0.6 : 1,
        ...style,
      }}
    >
      💬 {label}
    </button>
  )
}
