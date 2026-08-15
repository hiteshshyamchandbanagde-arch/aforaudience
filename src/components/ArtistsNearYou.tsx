'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useLocale } from '@/lib/i18n/translate'

// The dark "artists near you" rail — pairs with TonightNearYou in the
// homepage hero row (GEN-2608-032, replaces the static HeroRotator "For
// Artists" panel). Same location-resolution + soonest-anywhere fallback
// pattern as TonightNearYou, backed by /api/artists/nearby.

type EventType = 'OPEN_MIC' | 'STAND_UP' | 'POETRY' | 'THEATER' | 'LINEUP'

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

export default function ArtistsNearYou() {
  const { t: tr } = useLocale()
  const [artists, setArtists] = useState<NearbyArtist[] | null>(null)
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
        // Same as TonightNearYou - the API's own soonest-anywhere
        // fallback handles a null city, so this is safe to swallow.
      }

      try {
        const res = await fetch(`/api/artists/nearby${city ? `?city=${encodeURIComponent(city)}` : ''}&limit=4`)
        if (!res.ok) throw new Error('failed')
        const data = await res.json()
        if (!cancelled) {
          setArtists(data.artists || [])
          setMatchedCity(data.matchedCity || null)
        }
      } catch {
        if (!cancelled) setArtists([])
      }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{ background: 'var(--afa-surface-inverse)', padding: '34px 24px', borderRadius: '12px', color: '#F7F3EE', height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid rgba(247,243,238,0.15)' }}>
        <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '14px', margin: 0 }}>{tr.homePage.artistsRailHeading}</h4>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--afa-gold)', letterSpacing: '0.1em' }}>{tr.homePage.artistsRailBadge}</span>
      </div>

      {artists === null && (
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

      {artists !== null && artists.length === 0 && (
        <p style={{ fontSize: '12px', color: '#a89880', lineHeight: 1.6 }}>{tr.homePage.artistsRailEmpty}</p>
      )}

      {artists !== null && artists.length > 0 && (
        <>
          {!matchedCity && (
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

      {artists !== null && (
        <Link
          href="/profile"
          style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: 'auto', paddingTop: '14px', borderTop: '1px solid rgba(247,243,238,0.12)', textDecoration: 'none', color: 'inherit' }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--afa-gold)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {tr.homePage.artistsRailApplyEyebrow}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 700, color: '#F7F3EE' }}>
            <span>{tr.homePage.artistsRailApplyCta}</span>
            <span aria-hidden="true">→</span>
          </span>
        </Link>
      )}
    </div>
  )
}
