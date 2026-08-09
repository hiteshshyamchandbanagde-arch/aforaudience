'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useLocale } from '@/lib/i18n/translate'

// GEN-2608-032 (session 3rd iteration): combines what were two separate
// hero cards (TonightNearYou + ArtistsNearYou) into one tabbed panel per
// Hitesh's direct request - "near you artist and event must be part of
// one panel". Full list per tab (not a trimmed stacked view) so neither
// category gets shortchanged just to fit both in one card height.
// TonightNearYou.tsx and ArtistsNearYou.tsx are left in the repo,
// unused - not deleted, same pattern as HeroRotator earlier this
// session, in case either standalone card is wanted again later.

type EventType = 'OPEN_MIC' | 'STAND_UP' | 'POETRY' | 'THEATER' | 'LINEUP'

interface UpcomingEvent {
  id: string
  title: string
  type: EventType
  date: string
  startTime: string
  venue: { name: string; city: string } | null
}

interface NearbyArtist {
  id: string
  name: string
  avatar: string | null
  genre: string | null
  isSceneStatusHeadliner: boolean
  eventDate: string
  eventStartTime: string
  eventType: EventType
  city: string | null
}

const TYPE_LABEL: Record<EventType, string> = {
  OPEN_MIC: 'Open Mic',
  STAND_UP: 'Stand-Up',
  POETRY: 'Poetry',
  THEATER: 'Theater',
  LINEUP: 'Lineup',
}

function formatEventDate(iso: string, startTime: string): string {
  const d = new Date(iso)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const isTomorrow = d.toDateString() === tomorrow.toDateString()
  const dayLabel = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
  return `${dayLabel} · ${startTime}`
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('')
}

export default function NearYouTabs() {
  const { t: tr } = useLocale()
  const [tab, setTab] = useState<'events' | 'artists'>('events')

  const [events, setEvents] = useState<UpcomingEvent[] | null>(null)
  const [eventsCity, setEventsCity] = useState<string | null>(null)
  const [artists, setArtists] = useState<NearbyArtist[] | null>(null)
  const [artistsCity, setArtistsCity] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let city: string | null = null
      try {
        const locRes = await fetch('/api/user/location')
        if (locRes.ok) {
          const locData = await locRes.json()
          city = locData?.city || null
        }
      } catch {
        // Both endpoints have their own soonest-anywhere fallback for a
        // null city, so this is safe to swallow.
      }

      try {
        const res = await fetch(`/api/events/upcoming${city ? `?city=${encodeURIComponent(city)}` : ''}&limit=4`)
        if (!res.ok) throw new Error('failed')
        const data = await res.json()
        if (!cancelled) {
          setEvents(data.events || [])
          setEventsCity(data.matchedCity || null)
        }
      } catch {
        if (!cancelled) setEvents([])
      }

      try {
        const res = await fetch(`/api/artists/nearby${city ? `?city=${encodeURIComponent(city)}` : ''}&limit=4`)
        if (!res.ok) throw new Error('failed')
        const data = await res.json()
        if (!cancelled) {
          setArtists(data.artists || [])
          setArtistsCity(data.matchedCity || null)
        }
      } catch {
        if (!cancelled) setArtists([])
      }
    })()
    return () => { cancelled = true }
  }, [])

  const isEvents = tab === 'events'
  const loading = isEvents ? events === null : artists === null

  return (
    <div style={{ background: 'var(--afa-ink)', padding: '34px 24px', borderRadius: '12px', color: '#F7F3EE', height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
        <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '14px', margin: 0 }}>{tr.homePage.nearYouHeading}</h4>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--afa-gold)', letterSpacing: '0.1em' }}>
          {isEvents ? tr.homePage.tonightRailLive : tr.homePage.artistsRailBadge}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid rgba(247,243,238,0.15)' }}>
        <button
          onClick={() => setTab('events')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 6px', fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 700, color: isEvents ? '#F7F3EE' : '#a89880', borderBottom: isEvents ? '2px solid var(--afa-terracotta)' : '2px solid transparent' }}
        >
          {tr.homePage.nearYouTabEvents}
        </button>
        <button
          onClick={() => setTab('artists')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 10px 6px', fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 700, color: !isEvents ? '#F7F3EE' : '#a89880', borderBottom: !isEvents ? '2px solid var(--afa-terracotta)' : '2px solid transparent' }}
        >
          {tr.homePage.nearYouTabArtists}
        </button>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: '38px',
                borderRadius: '6px',
                background: 'linear-gradient(90deg, rgba(247,243,238,0.05) 0%, rgba(247,243,238,0.12) 50%, rgba(247,243,238,0.05) 100%)',
                backgroundSize: '200% 100%',
                animation: 'railShimmer 1.6s ease-in-out infinite',
                animationDelay: `${i * 120}ms`,
              }}
            />
          ))}
          <style>{`@keyframes railShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        </div>
      )}

      {isEvents && events !== null && events.length === 0 && (
        <p style={{ fontSize: '12px', color: '#a89880', lineHeight: 1.6 }}>{tr.homePage.tonightRailEmpty}</p>
      )}
      {!isEvents && artists !== null && artists.length === 0 && (
        <p style={{ fontSize: '12px', color: '#a89880', lineHeight: 1.6 }}>{tr.homePage.artistsRailEmpty}</p>
      )}

      {isEvents && events !== null && events.length > 0 && (
        <>
          {!eventsCity && (
            <p style={{ fontSize: '10.5px', color: '#a89880', marginBottom: '12px', lineHeight: 1.5, fontStyle: 'italic' }}>
              {tr.homePage.tonightRailCityFallbackNote}
            </p>
          )}
          {events.map((ev) => (
            <Link
              key={ev.id}
              href={`/events/${ev.id}`}
              style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '11px 8px', margin: '0 -8px', borderRadius: '6px', borderBottom: '1px solid rgba(247,243,238,0.08)', textDecoration: 'none', color: 'inherit', transition: 'background 150ms ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(247,243,238,0.05)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</div>
                <div style={{ fontSize: '10px', color: '#a89880', fontFamily: 'var(--font-sans)' }}>{TYPE_LABEL[ev.type]}{ev.venue ? ` · ${ev.venue.city}` : ''}</div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--afa-terracotta)', textAlign: 'right', whiteSpace: 'nowrap', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                {formatEventDate(ev.date, ev.startTime)}
              </div>
            </Link>
          ))}
        </>
      )}

      {!isEvents && artists !== null && artists.length > 0 && (
        <>
          {!artistsCity && (
            <p style={{ fontSize: '10.5px', color: '#a89880', marginBottom: '12px', lineHeight: 1.5, fontStyle: 'italic' }}>
              {tr.homePage.artistsRailCityFallbackNote}
            </p>
          )}
          {artists.map((a) => (
            <Link
              key={a.id}
              href={`/artists/${a.id}`}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 8px', margin: '0 -8px', borderRadius: '6px', borderBottom: '1px solid rgba(247,243,238,0.08)', textDecoration: 'none', color: 'inherit', transition: 'background 150ms ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(247,243,238,0.05)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              {a.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.avatar} alt="" style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(247,243,238,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                  {initials(a.name)}
                </div>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                <div style={{ fontSize: '10px', color: '#a89880', fontFamily: 'var(--font-sans)' }}>{TYPE_LABEL[a.eventType]}{a.genre ? ` · ${a.genre}` : ''}</div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--afa-terracotta)', textAlign: 'right', whiteSpace: 'nowrap', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                {formatEventDate(a.eventDate, a.eventStartTime)}
              </div>
            </Link>
          ))}
        </>
      )}
    </div>
  )
}
