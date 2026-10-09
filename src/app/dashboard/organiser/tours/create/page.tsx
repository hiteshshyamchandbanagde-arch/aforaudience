'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import SiteNav from '@/components/SiteNav'
import BackLink from '@/components/BackLink'
import BrandLoader from '@/components/BrandLoader'
import { useToast } from '@/components/Toast'
import Button from '@/components/ui/Button'
import { PageTitle } from '@/components/dashboard/PageTitle'

const inputStyle = {
  width: '100%',
  padding: 'var(--afa-space-10px) var(--afa-space-3)',
  borderRadius: 'var(--afa-radius-sm)',
  border: '1px solid var(--afa-border-resting)',
  background: 'var(--afa-surface-raised)',
  fontSize: 'var(--afa-text-body)',
  color: 'var(--afa-text-primary)',
}
const labelStyle = { display: 'block', fontSize: 'var(--afa-text-ui)', fontWeight: 600, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-6px)' }

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
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: 'var(--afa-space-32px) var(--afa-space-6) var(--afa-space-80px)' }}>
        <BackLink href="/dashboard/organiser/tours" label="Back to Tours" />

        <PageTitle style={{ marginTop: 'var(--afa-space-5)', marginBottom: 'var(--afa-space-2)' }}>
          Create a Tour
        </PageTitle>
        <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: 'var(--afa-space-28px)' }}>
          Start with the basics. You'll add stops, fixed lineup, and open local slots once the Tour exists.
        </p>

        <div style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-6)', border: '1px solid var(--afa-tint-08)' }}>
          <div style={{ marginBottom: 'var(--afa-space-5)' }}>
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
          <div style={{ marginBottom: 'var(--afa-space-6)' }}>
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
          <Button
            data-afa-action-row
            variant="primary"
            size="lg"
            fullWidth={false}
            onClick={handleCreate}
            disabled={saving}
            style={{ opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Creating...' : 'Create Tour'}
          </Button>
        </div>
        </div>
      </main>
    </>
  )
}
