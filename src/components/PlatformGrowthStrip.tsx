'use client'

import { useEffect, useState } from 'react'
import { useLocale } from '@/lib/i18n/translate'

// GEN-2608-004 / FEAT-2607-059: the real-numbers stat row used to live
// as a footer inside the "Tonight, near you" card. Pulled out into its
// own strip per live review - Tonight Near You is a local/temporal
// promise ("here's what's on near you tonight"), while these stats are
// an aggregate, platform-wide, all-time claim ("here's how much of a
// real, growing platform this is"). Bolting one onto the bottom of the
// other read as a non-sequitur once you looked closely. Separate
// moments now, each honest about what it's claiming.
//
// Tagline is Hitesh's own line from two separate Feedback entries
// (FEAT-2607-059, GEN-2608-004) - "Good things grow with time... be
// patient and witness the success together" - tightened to "Good
// things grow with time. Be part of the beginning." (kept his own
// wording as the anchor, cut the passive "be patient" phrasing for an
// active invitation instead). Deliberately leans into being early-stage
// rather than hiding it - matches Hitesh's own instinct in both
// Feedback entries ("as it is beginning... today is just the
// beginning").
//
// Same /api/stats/homepage endpoint TonightNearYou used to call -
// still real counts under the same public-visibility rules (verified
// artists, APPROVED events, non-suspended organisers). A stat that
// fails to load is hidden rather than shown as 0, same reasoning as
// before: 0 would misleadingly read as "no artists" when it just means
// the fetch failed.

export default function PlatformGrowthStrip() {
  const { t: tr } = useLocale()
  const [stats, setStats] = useState<{ artists: number | null; eventsThisMonth: number | null; cities: number | null } | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/stats/homepage')
        if (!res.ok) throw new Error('failed')
        const data = await res.json()
        if (!cancelled) setStats(data)
      } catch {
        if (!cancelled) setStats({ artists: null, eventsThisMonth: null, cities: null })
      }
    })()
    return () => { cancelled = true }
  }, [])

  const statItems = [
    { value: stats?.artists, label: tr.homePage.statArtists },
    { value: stats?.eventsThisMonth, label: tr.homePage.statEventsMonthly },
    { value: stats?.cities, label: tr.homePage.statCities },
  ].filter((s) => s.value != null)

  return (
    <section style={{ background: 'var(--afa-surface-inverse)' }}>
      <div className="growth-strip" style={{ maxWidth: '1360px', margin: '0 auto', padding: '40px 48px' }}>
        <p className="growth-strip-tagline" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(18px, 2.2vw, 24px)', color: '#F7F3EE', margin: 0, lineHeight: 1.4 }}>
          {tr.homePage.growthTagline}
        </p>
        {statItems.length > 0 && (
          <div className="growth-strip-stats" style={{ display: 'flex', gap: '36px', flexShrink: 0 }}>
            {statItems.map((s) => (
              <div key={s.label}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 700, color: '#F7F3EE' }}>
                  {s.value!.toLocaleString('en-IN')}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#a89880', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`
        .growth-strip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 32px;
        }
        @media (max-width: 760px) {
          .growth-strip {
            flex-direction: column;
            align-items: flex-start;
          }
          .growth-strip-stats { gap: 28px; }
        }
      `}</style>
    </section>
  )
}
