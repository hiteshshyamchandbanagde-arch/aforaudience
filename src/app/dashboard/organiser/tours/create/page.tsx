'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import SiteNav from '@/components/SiteNav'
import BackLink from '@/components/BackLink'
import BrandLoader from '@/components/BrandLoader'
import { useToast } from '@/components/Toast'

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '6px',
  border: '1px solid rgba(245,245,240,0.15)',
  background: 'var(--afa-surface-raised)',
  fontSize: '14px',
  color: 'var(--afa-text-primary)',
}
const labelStyle = { display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--afa-text-primary)', marginBottom: '6px' }

export default function CreateTourPage() {
  const { status } = useSession()
  const router = useRouter()
  const { showToast } = useToast()
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  if (status === 'loading') return (<><SiteNav /><BrandLoader /></>)

  const handleCreate = async () => {
    if (!title.trim()) {
      showToast('Tour title is required', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/tours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, subject }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create Tour')
      showToast('Tour created', 'success')
      router.push(`/dashboard/organiser/tours/${data.tour.id}`)
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SiteNav />
      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 24px 80px' }}>
        <BackLink href="/dashboard/organiser/tours" label="Back to Tours" />

        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '26px', fontWeight: 700, color: 'var(--afa-text-primary)', marginTop: '20px', marginBottom: '8px' }}>
          Create a Tour
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: '28px' }}>
          Start with the basics. You'll add stops, fixed lineup, and open local slots once the Tour exists.
        </p>

        <div style={{ background: 'var(--afa-surface-raised)', borderRadius: '12px', padding: '24px', border: '1px solid rgba(245,245,240,0.08)' }}>
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Tour title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Monsoon Comedy Circuit 2026"
              maxLength={120}
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label style={labelStyle}>Subject (optional)</label>
            <textarea
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="A short description of what this Tour is"
              maxLength={500}
              rows={4}
              style={{ ...inputStyle, resize: 'vertical' as const }}
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={saving}
            style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-on-fill-solid)', background: 'var(--afa-terracotta)', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Creating...' : 'Create Tour'}
          </button>
        </div>
      </main>
    </>
  )
}
