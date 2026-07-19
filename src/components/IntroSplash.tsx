'use client'

import { useEffect, useState } from 'react'

const SESSION_KEY = 'introShown'

// Timeline (all ms from mount):
//   0    - bottom bar (white) starts sliding/fading in
//   150  - middle bar (amber) starts
//   300  - top bar (orange) starts, each bar takes 260ms so the mark is
//          fully settled by ~560ms
//   950  - icon starts crossfading into the wordmark (300ms fade)
//   950  - wordmark starts its scale-in (600ms) - overlapping the icon's
//          fade-out is the crossfade itself, not two separate beats
//   2250 - wordmark has held long enough to read
//   2700 - overlay finishes fading out, component unmounts
// Deliberately reuses the app's own icon mark (src/app/icon.svg - three
// bars, bottom-up: #F7F3EE, #C9973A, #C8441A) rather than a generic
// spinner, so this continues the same mark Android's own PWA splash
// screen already showed on cold launch instead of feeling like two
// unrelated screens back to back.
const ICON_BAR_DELAYS = { bottom: 0, middle: 150, top: 300 }
const ICON_BAR_DURATION = 260
const WORDMARK_START = 950
const WORDMARK_IN_MS = 600
const HOLD_MS = WORDMARK_START + WORDMARK_IN_MS + 700
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
        @keyframes intro-bar-in {
          0% { opacity: 0; transform: translateX(-10px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes intro-icon-out {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.92); }
        }
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
            animation: intro-shimmer 1.3s ease-in-out ${WORDMARK_START + 200}ms both;
          }
        }
      `}</style>

      {/* Icon mark: same three bars as src/app/icon.svg, bottom-up reveal,
          then crossfades into the wordmark below. Positioned absolutely
          so both layers can overlap during the crossfade window. */}
      <svg
        viewBox="0 0 64 64"
        width="72"
        height="72"
        style={{
          position: 'absolute',
          animation: `intro-icon-out 300ms ease ${WORDMARK_START}ms both`,
        }}
      >
        <rect
          x="18" y="42" width="14" height="8"
          fill="#F7F3EE"
          style={{ animation: `intro-bar-in ${ICON_BAR_DURATION}ms ease-out ${ICON_BAR_DELAYS.bottom}ms both` }}
        />
        <rect
          x="18" y="30" width="20" height="8"
          fill="#C9973A"
          style={{ animation: `intro-bar-in ${ICON_BAR_DURATION}ms ease-out ${ICON_BAR_DELAYS.middle}ms both` }}
        />
        <rect
          x="18" y="18" width="28" height="8"
          fill="#C8441A"
          style={{ animation: `intro-bar-in ${ICON_BAR_DURATION}ms ease-out ${ICON_BAR_DELAYS.top}ms both` }}
        />
      </svg>

      <div
        style={{
          fontFamily: 'Georgia, serif',
          fontSize: 'clamp(36px, 9vw, 64px)',
          fontWeight: 700,
          color: '#F7F3EE',
          animation: `intro-scale-in ${WORDMARK_IN_MS}ms cubic-bezier(0.22, 1, 0.36, 1) ${WORDMARK_START}ms both`,
        }}
      >
        <span className="intro-splash-a">A</span>
        forAudience
      </div>
    </div>
  )
}
