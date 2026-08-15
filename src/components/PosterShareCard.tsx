'use client'

import { useState } from 'react'

// Session 39 (Feedback ec6e4adf) - shared between organiser and artist
// dashboards. Web Share API (with the image as a file) for the native
// mobile share sheet where supported; falls back to a plain download
// link everywhere else (desktop browsers mostly).
export default function PosterShareCard({ src, filename, title }: { src: string; filename: string; title: string }) {
  const [sharing, setSharing] = useState(false)
  const [error, setError] = useState('')

  const share = async () => {
    setSharing(true)
    setError('')
    try {
      const res = await fetch(src)
      if (!res.ok) throw new Error('Poster not ready yet')
      const blob = await res.blob()
      const file = new File([blob], filename, { type: 'image/png' })

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') setError('Couldn\'t load the poster - please try again.')
    } finally {
      setSharing(false)
    }
  }

  return (
    <div style={{ background: 'var(--afa-surface-raised)', borderRadius: '12px', padding: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
      <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '16px', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: '12px' }}>
        Share Poster
      </h3>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={title}
        style={{ width: '100%', maxWidth: '260px', borderRadius: '8px', border: '1px solid rgba(14,12,10,0.1)', display: 'block', marginBottom: '14px' }}
      />
      <button
        onClick={share}
        disabled={sharing}
        style={{ fontSize: '13px', fontWeight: 600, color: 'var(--afa-on-fill-solid)', background: 'var(--afa-terracotta)', border: 'none', borderRadius: '8px', padding: '9px 18px', cursor: 'pointer', opacity: sharing ? 0.6 : 1 }}
      >
        {sharing ? 'Preparing...' : 'Share / Download'}
      </button>
      {error && <p style={{ fontSize: '12px', color: 'var(--afa-error)', marginTop: '8px' }}>{error}</p>}
    </div>
  )
}
