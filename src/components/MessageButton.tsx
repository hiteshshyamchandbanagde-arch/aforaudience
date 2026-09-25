'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import Button from '@/components/ui/Button'

interface MessageButtonProps {
  contextType: 'PERFORMANCE' | 'VENUE_BOOKING' | 'BOOKING'
  contextId: string
  label?: string
  style?: React.CSSProperties
  /** GEN-2609-068 - replaces the hardcoded 💬 emoji when provided (the
   * /tickets/ page v6 redesign's secondary-action row uses a real
   * MessageIcon, matching its Download/Cancel siblings, not an emoji).
   * Optional and additive - the two existing call sites (lineup/bookings
   * pages) pass neither `icon` nor `style` and keep their current
   * emoji-prefixed look unchanged. */
  icon?: React.ReactNode
  /** GEN-2609-109 - which shared Button look to use. Defaults to the
   * sage `outline-success` pill every caller had before; /tickets/'s
   * secondary-action row passes `outline-neutral` to match its
   * Download/Cancel siblings (it used to get there by overriding colour/
   * border/padding through `style`, which now only carries layout). */
  variant?: 'outline-success' | 'outline-neutral'
}

// Drop this on any page that has a confirmed Performance / VenueBooking /
// Booking record - it finds-or-creates the thread and takes the user
// straight there. Idempotent server-side, so no need to check "does a
// thread already exist" before rendering this.
export default function MessageButton({ contextType, contextId, label = 'Message', style, icon, variant = 'outline-success' }: MessageButtonProps) {
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
    <Button
      variant={variant}
      size={variant === 'outline-neutral' ? 'sm' : 'pill-sm'}
      fullWidth={false}
      onClick={handleClick}
      disabled={loading}
      style={style}
    >
      {icon ?? '💬'} {label}
    </Button>
  )
}
