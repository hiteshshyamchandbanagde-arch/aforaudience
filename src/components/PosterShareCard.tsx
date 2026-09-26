'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'

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
    <div style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', padding: '20px', border: '1px solid var(--afa-tint-08)' }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-title)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: '12px' }}>
        Share Poster
      </h3>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={title}
        style={{ width: '100%', maxWidth: '260px', borderRadius: 'var(--afa-radius-md)', border: '1px solid var(--afa-tint-10)', display: 'block', marginBottom: '14px' }}
      />
      <Button
        variant="primary"
        size="md"
        fullWidth={false}
        onClick={share}
        disabled={sharing}
        style={{ opacity: sharing ? 0.6 : 1 }}
      >
        {sharing ? 'Preparing...' : 'Share / Download'}
      </Button>
      {error && <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-error-bright)', marginTop: '8px' }}>{error}</p>}
    </div>
  )
}
