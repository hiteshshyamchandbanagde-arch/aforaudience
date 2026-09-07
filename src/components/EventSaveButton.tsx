'use client'
import { useEffect, useState } from 'react'
import { HeartIcon } from '@/components/icons/EventIcons'

// Mobile Redesign Phase 4b (GEN-2609-007) - self-contained follow/unfollow
// island for a single event, mirroring useVenueFollow's shape
// (VenueFollowButton.tsx) - per-instance fetch-on-mount + toggle, 401 on
// toggle sends to login. Unlike the venue page's two-buttons-one-target
// case, no EventCard instance needs to share state with a sibling, so this
// stays a plain hook rather than being split into a hook + shared-state
// wiring at a parent level.
export function useEventSave(eventId: string) {
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/events/${eventId}/follow`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        setSaved(!!data.following)
        setLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [eventId])

  const toggleSave = async () => {
    if (busy) return undefined
    setBusy(true)
    try {
      const res = await fetch(`/api/events/${eventId}/follow`, { method: 'POST' })
      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(`/events/${eventId}`)}`
        return undefined
      }
      const data = await res.json()
      const nextSaved = !!data.following
      setSaved(nextSaved)
      return nextSaved
    } finally {
      setBusy(false)
    }
  }

  return { saved, busy, loaded, toggleSave }
}

// Backdrop-blur circular heart overlay, per the Figma v2 export's
// EventCard/EventRow (components.tsx) - filled amber when saved, outline
// cream/muted otherwise. `onClick` stops propagation itself since every
// caller so far renders this inside a larger clickable card.
export function EventSaveHeartButton({
  eventId,
  size = 'card',
  onToggled,
}: {
  eventId: string
  size?: 'card' | 'row'
  // Optional - lets a parent list (the /saved page) react to an unsave by
  // removing the row immediately, instead of leaving an unsaved-looking
  // heart sitting in a list titled "Saved" until the next reload. Discover's
  // grid has no such list-membership concept, so it just omits this.
  onToggled?: (saved: boolean) => void
}) {
  const { saved, busy, loaded, toggleSave } = useEventSave(eventId)
  if (!loaded) return null
  const dims = size === 'card' ? 36 : 32
  const iconSize = size === 'card' ? 17 : 16
  return (
    <button
      onClick={async (e) => {
        e.stopPropagation()
        const next = await toggleSave()
        if (next !== undefined) onToggled?.(next)
      }}
      onKeyDown={(e) => {
        // The card this button sits inside (EventCard, and the Tickets
        // poster card) listens for Enter/Space at its own div level via
        // bubbling, to navigate on keyboard activation. Without this,
        // pressing Enter/Space while this button is focused would both
        // toggle save (native <button> keyboard activation) AND navigate
        // away (the outer card's keydown handler, fired by the same
        // bubbling keydown before this button's click is synthesized -
        // stopPropagation() in onClick alone doesn't reach back to that).
        if (e.key === 'Enter' || e.key === ' ') e.stopPropagation()
      }}
      disabled={busy}
      aria-label={saved ? 'Remove from saved' : 'Save event'}
      aria-pressed={saved}
      style={{
        width: dims, height: dims, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(10,10,10,0.55)', backdropFilter: 'blur(4px)',
        border: 'none', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
      }}
    >
      <HeartIcon
        filled={saved}
        style={{ width: iconSize, height: iconSize, color: saved ? 'var(--afa-fill-solid)' : 'var(--afa-text-primary)' }}
      />
    </button>
  )
}
