'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useLocale } from '@/lib/i18n/translate'

// The dark "tonight, near you" rail for the Editorial Split homepage
// hero (resumes BUG-2607-036 + FEAT-2607-028, FEAT-2608-030). Fetches
// the visitor's resolved location the same way LocationChip does (GET
// /api/user/location - profile > cookie > IP-geo detection), then the
// next few upcoming events near that city via /api/events/upcoming.
// Falls back to "soonest anywhere" if there's nothing near the visitor
// yet, rather than showing an empty rail - see the API route comment
// for why.

type EventType = 'OPEN_MIC' | 'STAND_UP' | 'POETRY' | 'THEATER' | 'LINEUP'

interface UpcomingEvent {
  id: string
  title: string
  type: EventType
  date: string
  startTime: string
  venue: { name: string; city: string } | null
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

export default function TonightNearYou() {
  const { t: tr } = useLocale()
  const [events, setEvents] = useState<UpcomingEvent[] | null>(null)
  const [matchedCity, setMatchedCity] = useState<string | null>(null)

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
        // Location unresolved - the upcoming-events endpoint handles a
        // null city with its own soonest-anywhere fallback, so this is
        // safe to swallow rather than surface to the visitor.
      }

      try {
        const res = await fetch(`/api/events/upcoming${city ? `?city=${encodeURIComponent(city)}` : ''}&limit=4`)
        if (!res.ok) throw new Error('failed')
        const data = await res.json()
        if (!cancelled) {
          setEvents(data.events || [])
          setMatchedCity(data.matchedCity || null)
        }
      } catch {
        if (!cancelled) setEvents([])
      }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{ background: 'var(--afa-ink)', padding: '34px 24px', borderRadius: '12px', color: '#F7F3EE' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid rgba(247,243,238,0.15)' }}>
        <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '14px', margin: 0 }}>{tr.homePage.tonightRailHeading}</h4>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--afa-gold)', letterSpacing: '0.1em' }}>{tr.homePage.tonightRailLive}</span>
      </div>

      {events === null && (
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

      {events !== null && events.length === 0 && (
        <p style={{ fontSize: '12px', color: '#a89880', lineHeight: 1.6 }}>{tr.homePage.tonightRailEmpty}</p>
      )}

      {events !== null && events.length > 0 && (
        <>
          {!matchedCity && (
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

      <div style={{ display: 'flex', gap: '20px', marginTop: '18px', paddingTop: '14px', borderTop: '1px solid rgba(247,243,238,0.15)' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 700 }}>2,400+</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#a89880', textTransform: 'uppercase' }}>{tr.homePage.statArtists}</div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 700 }}>840+</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#a89880', textTransform: 'uppercase' }}>{tr.homePage.statEventsMonthly}</div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 700 }}>120+</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#a89880', textTransform: 'uppercase' }}>{tr.homePage.statCities}</div>
        </div>
      </div>
    </div>
  )
}
