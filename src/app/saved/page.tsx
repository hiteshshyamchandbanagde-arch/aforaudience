'use client'

import { useEffect, useState, useTransition } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import SiteNav from '@/components/SiteNav'
import BrandLoader from '@/components/BrandLoader'
import { EventRow, type EventItem } from '@/components/EventCard'
import { HeartIcon } from '@/components/icons/EventIcons'

// Mobile Redesign Phase 4b (GEN-2609-007) - replaces the Phase 1
// ComingSoon placeholder now that the real Follow(targetType=EVENT)
// schema + /api/events/saved + /api/events/[id]/follow exist. Guests get
// SiteNav's own sign-in prompt via the same unauthenticated pattern
// already used by /tickets and /profile, rather than a bespoke gate here.
export default function SavedPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [, startTransition] = useTransition()
  const [navigatingId, setNavigatingId] = useState<string | null>(null)

  const goToEvent = (id: string) => {
    if (navigatingId) return
    setNavigatingId(id)
    startTransition(() => {
      router.push(`/events/${id}`)
    })
  }

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login?next=/saved')
  }, [status, router])

  useEffect(() => {
    if (!session?.user) return
    fetch('/api/events/saved')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load saved events')
        return res.json()
      })
      .then(setEvents)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [session])

  if (status === 'loading' || (status === 'authenticated' && loading)) {
    return (<><SiteNav /><BrandLoader /></>)
  }
  if (!session) return <SiteNav />

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-page)', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '48px 24px 96px' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--afa-amber)', marginBottom: 6 }}>
            {events.length} event{events.length === 1 ? '' : 's'} wishlisted
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, color: 'var(--afa-text-primary)', marginBottom: 24 }}>
            Saved
          </h1>

          {error && (
            <p style={{ color: 'var(--afa-error)', fontSize: 14, marginBottom: 20 }}>{error}</p>
          )}

          {events.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '64px 20px 0' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', border: '1px solid rgba(245,245,240,0.1)', background: 'var(--afa-surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--afa-text-muted)' }}>
                <HeartIcon style={{ width: 26, height: 26 }} />
              </div>
              <p style={{ marginTop: 16, fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--afa-text-primary)' }}>
                No saves yet
              </p>
              <p style={{ marginTop: 4, maxWidth: 260, fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.6, color: 'var(--afa-text-secondary)' }}>
                Tap the heart on any event in Discover to keep it here for later.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {events.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  isNavigating={navigatingId === event.id}
                  disabled={navigatingId !== null}
                  onOpen={() => goToEvent(event.id)}
                  onSaveToggled={(saved) => {
                    if (!saved) setEvents((prev) => prev.filter((e) => e.id !== event.id))
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
