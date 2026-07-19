'use client'

import { useEffect, useState } from 'react'

const SESSION_KEY = 'introShown'
// Timings: in 600ms, hold 700ms, out 450ms - kept snappy since, unlike
// Netflix, this plays in front of a free product every session start
// rather than a paid one people are settled in for. Long enough to read
// as a "moment", short enough not to feel like a tax on repeat visits.
const HOLD_MS = 600 + 700
const TOTAL_MS = HOLD_MS + 450

export default function IntroSplash() {
  // Three-state, not boolean: null while we haven't yet decided (avoids
  // an SSR/client mismatch - sessionStorage doesn't exist on the server,
  // so the server always renders nothing and the client decides after
  // mount). 'in' plays the animation; false renders nothing.
  const [phase, setPhase] = useState<'in' | 'out' | null>(null)

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const alreadyShown = sessionStorage.getItem(SESSION_KEY)

    if (alreadyShown || reducedMotion) {
      // Reduced-motion preference skips the animation entirely rather
      // than playing a "toned down" version - this is purely decorative
      // branding, so the safest a11y call is to just not show it.
      sessionStorage.setItem(SESSION_KEY, '1')
      return
    }

    sessionStorage.setItem(SESSION_KEY, '1')
    document.body.style.overflow = 'hidden'
    setPhase('in')

    const outTimer = setTimeout(() => setPhase('out'), HOLD_MS)
    const doneTimer = setTimeout(() => {
      setPhase(null)
      document.body.style.overflow = ''
    }, TOTAL_MS)

    return () => {
      clearTimeout(outTimer)
      clearTimeout(doneTimer)
      document.body.style.overflow = ''
    }
  }, [])

  if (!phase) return null

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#0E0C0A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: phase === 'out' ? 0 : 1,
        transition: 'opacity 450ms ease',
        pointerEvents: 'none',
      }}
    >
      <style>{`
        @keyframes intro-scale-in {
          0% { opacity: 0; transform: scale(0.82); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes intro-shimmer {
          0%, 40% { background-position: -120% 0; }
          100% { background-position: 220% 0; }
        }
        .intro-splash-a {
          color: #C8441A;
        }
        @supports (background-clip: text) or (-webkit-background-clip: text) {
          .intro-splash-a {
            background: linear-gradient(90deg, #C8441A 0%, #C8441A 35%, #FF8A5C 50%, #C8441A 65%, #C8441A 100%);
            background-size: 300% 100%;
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            animation: intro-shimmer 1.3s ease-in-out 200ms both;
          }
        }
      `}</style>
      <div
        style={{
          fontFamily: 'Georgia, serif',
          fontSize: 'clamp(36px, 9vw, 64px)',
          fontWeight: 700,
          color: '#F7F3EE',
          animation: 'intro-scale-in 600ms cubic-bezier(0.22, 1, 0.36, 1) both',
        }}
      >
        <span className="intro-splash-a">A</span>
        forAudience
      </div>
    </div>
  )
}
