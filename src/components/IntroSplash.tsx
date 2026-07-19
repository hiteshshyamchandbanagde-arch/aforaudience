'use client'

import { useEffect, useState } from 'react'

const SESSION_KEY = 'introShown'

// Timeline (all ms from mount):
//   0    - bottom bar (white) starts sliding/fading in
//   150  - middle bar (amber) starts
//   300  - top bar (orange) starts, each bar takes 260ms so the mark is
//          fully settled by ~560ms
//   750  - icon starts shrinking + fading (350ms) while the wordmark's
//          "A" fades in at the same spot (400ms) - a crossfade dressed
//          up as the big icon "becoming" the small A, not a literal
//          shape morph, but reads as continuous rather than two
//          unrelated beats
//   1150 - "forAudience" starts cascading in letter by letter (35ms
//          stagger, 350ms per letter) - last letter starts at 1500ms
//   1850 - cascade finished, full wordmark visible
//   2500 - held long enough to read
//   2950 - overlay finishes fading out, component unmounts
// Icon sized closer to what Android's own PWA splash shows (a large
// centered glyph) rather than jumping straight to something small -
// per Hitesh's feedback that the size mismatch between the OS splash
// and our original small icon felt like a jarring cut.
const ICON_BAR_DELAYS = { bottom: 0, middle: 150, top: 300 }
const ICON_BAR_DURATION = 260
const ICON_HOLD_END = 750
const ICON_SHRINK_MS = 350
const A_START = 750
const A_IN_MS = 400
const CASCADE_START = A_START + A_IN_MS
const LETTER_STAGGER = 35
const LETTER_DURATION = 350
const REST_OF_WORDMARK = 'forAudience'
const CASCADE_END = CASCADE_START + (REST_OF_WORDMARK.length - 1) * LETTER_STAGGER + LETTER_DURATION
const HOLD_MS = CASCADE_END + 650
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
        @keyframes intro-icon-shrink {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.3); }
        }
        @keyframes intro-letter-in {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
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
            animation: intro-shimmer 1.3s ease-in-out ${A_START + 250}ms both;
          }
        }
      `}</style>

      {/* Icon mark: same three bars as src/app/icon.svg, bottom-up
          reveal, sized close to Android's own PWA splash glyph, then
          shrinks away as the wordmark's "A" fades in at the same spot. */}
      <svg
        viewBox="0 0 64 64"
        style={{
          position: 'absolute',
          width: 'clamp(120px, 34vw, 220px)',
          height: 'clamp(120px, 34vw, 220px)',
          animation: `intro-icon-shrink ${ICON_SHRINK_MS}ms ease ${ICON_HOLD_END}ms both`,
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
          opacity: 0,
          animation: `intro-letter-in 300ms ease-out ${A_START}ms both`,
        }}
      >
        <span
          className="intro-splash-a"
          style={{ animation: `intro-letter-in ${A_IN_MS}ms ease-out ${A_START}ms both` }}
        >
          A
        </span>
        {REST_OF_WORDMARK.split('').map((ch, i) => (
          <span
            key={i}
            style={{
              display: 'inline-block',
              animation: `intro-letter-in ${LETTER_DURATION}ms ease-out ${CASCADE_START + i * LETTER_STAGGER}ms both`,
            }}
          >
            {ch}
          </span>
        ))}
      </div>
    </div>
  )
}
