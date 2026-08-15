'use client'

import { useEffect, useState } from 'react'
import { useLocale } from '@/lib/i18n/translate'

// Curated still images only. The previous set included an AI-generated
// looping video (visibly watermarked by the generation tool) and stills
// that misrepresented the platform - a stadium-scale concert crowd, a
// Western contemporary dance shot, and a photo with another business's
// real, legible signage in frame. All four removed (GEN-2608-035).
// Remaining slides are generic enough not to overclaim scale, geography,
// or borrow someone else's brand. Placeholder until real event/artist
// photos are available to replace this with authentic platform content.
const SLIDES: string[] = [
  '/hero/slide-1.jpg',
  '/hero/slide-3.jpg',
  '/hero/slide-5.jpg',
  '/hero/slide-7.jpg',
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
  const { t: tr } = useLocale()
  const [active, setActive] = useState(0)

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
        background: 'var(--afa-fill-solid)',
      }}
    >
      {SLIDES.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src} src={src} alt="" style={layerStyle(active === i)} />
      ))}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(245,245,240,0.7) 0%, rgba(245,245,240,0.1) 40%, rgba(245,245,240,0) 55%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'absolute', left: '24px', right: '24px', top: '20px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.1em', color: 'var(--afa-peach)', textTransform: 'uppercase', marginBottom: '6px' }}>
          {tr.homePage.heroRotatorEyebrow}
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '19px', color: 'var(--afa-on-fill-solid)', lineHeight: 1.3 }}>
          {tr.homePage.heroRotatorTagline}
        </div>
      </div>
    </div>
  )
}
