'use client'

import { useEffect, useState } from 'react'

type Slide =
  | { type: 'image'; src: string }
  | { type: 'video'; mp4: string; webm: string; poster: string }

const SLIDES: Slide[] = [
  { type: 'video', mp4: '/hero/hero-loop.mp4', webm: '/hero/hero-loop.webm', poster: '/hero/hero-poster.jpg' },
  { type: 'image', src: '/hero/slide-1.jpg' },
  { type: 'image', src: '/hero/slide-2.jpg' },
  { type: 'image', src: '/hero/slide-3.jpg' },
  { type: 'image', src: '/hero/slide-4.jpg' },
  { type: 'image', src: '/hero/slide-5.jpg' },
  { type: 'image', src: '/hero/slide-6.jpg' },
  { type: 'image', src: '/hero/slide-7.jpg' },
]

const INTERVAL_MS = 3500

const layerStyle = (isActive: boolean): React.CSSProperties => ({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  opacity: isActive ? 1 : 0,
  transition: 'opacity 1200ms ease',
})

export default function HeroRotator() {
  const [active, setActive] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setActive((i) => (i + 1) % SLIDES.length)
    }, INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      className="hero-rotator"
      style={{
        position: 'relative',
        width: '100%',
        borderRadius: '16px',
        overflow: 'hidden',
        background: '#0E0C0A',
      }}
    >
      {SLIDES.map((slide, i) => {
        if (slide.type === 'video') {
          // Respect reduced-motion preference: render the static poster instead of an autoplaying video
          if (reducedMotion) {
            // eslint-disable-next-line @next/next/no-img-element
            return <img key="hero-video-poster" src={slide.poster} alt="" style={layerStyle(active === i)} />
          }
          return (
            <video
              key="hero-video"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              poster={slide.poster}
              style={layerStyle(active === i)}
            >
              <source src={slide.webm} type="video/webm" />
              <source src={slide.mp4} type="video/mp4" />
            </video>
          )
        }
        // eslint-disable-next-line @next/next/no-img-element
        return <img key={slide.src} src={slide.src} alt="" style={layerStyle(active === i)} />
      })}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(14,12,10,0.7) 0%, rgba(14,12,10,0.1) 40%, rgba(14,12,10,0) 55%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'absolute', left: '24px', right: '24px', top: '20px' }}>
        <div style={{ fontFamily: 'monospace', fontSize: '11px', letterSpacing: '0.1em', color: '#F5A26E', textTransform: 'uppercase', marginBottom: '6px' }}>
          For artists
        </div>
        <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '19px', color: '#F7F3EE', lineHeight: 1.3 }}>
          Your best performance, featured here.
        </div>
      </div>
    </div>
  )
}
