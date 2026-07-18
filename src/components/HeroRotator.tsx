'use client'

import { useEffect, useState } from 'react'

const SLIDES = [
  '/hero/slide-1.jpg',
  '/hero/slide-2.jpg',
  '/hero/slide-3.jpg',
  '/hero/slide-4.jpg',
  '/hero/slide-5.jpg',
]

const INTERVAL_MS = 3500

export default function HeroRotator() {
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
        background: '#0E0C0A',
      }}
    >
      {SLIDES.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: active === i ? 1 : 0,
            transition: 'opacity 1200ms ease',
          }}
        />
      ))}
    </div>
  )
}
