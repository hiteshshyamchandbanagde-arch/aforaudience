'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import SiteNav from '@/components/SiteNav'
import BackLink from '@/components/BackLink'
import { useToast } from '@/components/Toast'
import BrandLoader from '@/components/BrandLoader'

interface Inquiry {
  id: string
  companyName: string
  contactName: string
  contactEmail: string
  contactPhone: string | null
  eventType: string | null
  city: string | null
  preferredDate: string | null
  budgetRange: string | null
  message: string | null
  status: 'NEW' | 'CONTACTED' | 'CLOSED'
  createdAt: string
}

const STATUS_META: Record<Inquiry['status'], { label: string; bg: string; color: string }> = {
  NEW: { label: 'New', bg: 'rgba(200,68,26,0.12)', color: 'var(--afa-terracotta)' },
  CONTACTED: { label: 'Contacted', bg: 'rgba(74,103,65,0.12)', color: 'var(--afa-sage)' },
  CLOSED: { label: 'Closed', bg: 'rgba(245,245,240,0.08)', color: 'var(--afa-text-primary)' },
}

// FEAT-2608-046 - corporate show booking, inquiry-only. This is the
// artist's inbox for inquiries submitted from their public profile
// (CorporateInquiryModal) - status is a lightweight self-managed tracker
// (Mark Contacted / Close), everything past that (negotiation, contract,
// payment) happens off-platform.
export default function CorporateInquiriesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const { showToast } = useToast()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/corporate-inquiries')
        if (!res.ok) throw new Error('Failed to load inquiries')
        setInquiries(await res.json())
      } catch (err: any) {
        showToast(err.message || 'Failed to load inquiries', 'error')
      } finally {
        setLoading(false)
      }
    }
    if (session?.user) fetchData()
  }, [session])

  const updateStatus = async (id: string, newStatus: Inquiry['status']) => {
    setUpdating(id)
    try {
      const res = await fetch(`/api/corporate-inquiries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed to update')
      setInquiries((prev) => prev.map((i) => (i.id === id ? { ...i, status: newStatus } : i)))
    } catch (err: any) {
      showToast(err.message || 'Failed to update', 'error')
    } finally {
      setUpdating(null)
    }
  }

  if (status === 'loading' || loading) return (<><SiteNav /><BrandLoader /></>)
  if (!session) return <SiteNav />

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
          <BackLink href="/dashboard/artist" label="Back to Dashboard" />

          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: 'var(--afa-text-primary)', marginTop: '16px', marginBottom: '8px' }}>
            Corporate Inquiries
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: '32px' }}>
            Direct booking inquiries from companies and private event organisers. Reach out to them directly - AforAudience doesn't handle payment for these.
          </p>

          {inquiries.length === 0 ? (
            <p style={{ fontSize: '14px', color: 'var(--afa-text-primary)', opacity: 0.5 }}>
              No inquiries yet. They'll show up here when a company sends you a booking request from your public profile.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {inquiries.map((inq) => {
                const meta = STATUS_META[inq.status]
                return (
                  <div key={inq.id} style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid rgba(245,245,240,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: 'var(--afa-text-primary)' }}>{inq.companyName}</div>
                        <div style={{ fontSize: '13px', color: 'var(--afa-text-primary)', opacity: 0.55 }}>{new Date(inq.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 600, padding: '5px 12px', borderRadius: '999px', background: meta.bg, color: meta.color }}>{meta.label}</span>
                    </div>

                    <div style={{ fontSize: '14px', color: 'var(--afa-text-primary)', lineHeight: 1.8, marginBottom: '10px' }}>
                      <div><strong>Contact:</strong> {inq.contactName} · <a href={`mailto:${inq.contactEmail}`} style={{ color: 'var(--afa-terracotta)' }}>{inq.contactEmail}</a>{inq.contactPhone ? ` · ${inq.contactPhone}` : ''}</div>
                      {inq.eventType && <div><strong>Event type:</strong> {inq.eventType}</div>}
                      {inq.city && <div><strong>City:</strong> {inq.city}</div>}
                      {inq.preferredDate && <div><strong>Preferred date:</strong> {new Date(inq.preferredDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>}
                      {inq.budgetRange && <div><strong>Budget:</strong> {inq.budgetRange}</div>}
                    </div>

                    {inq.message && (
                      <p style={{ fontSize: '13px', color: 'var(--afa-text-primary)', opacity: 0.7, background: 'var(--afa-surface-raised)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', whiteSpace: 'pre-wrap' }}>
                        {inq.message}
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {inq.status !== 'CONTACTED' && (
                        <button
                          onClick={() => updateStatus(inq.id, 'CONTACTED')}
                          disabled={updating === inq.id}
                          style={{ fontSize: '12px', fontWeight: 600, color: 'var(--afa-sage)', background: 'transparent', border: '1px solid rgba(74,103,65,0.3)', borderRadius: '6px', padding: '7px 14px', cursor: updating === inq.id ? 'default' : 'pointer', opacity: updating === inq.id ? 0.6 : 1 }}
                        >
                          Mark Contacted
                        </button>
                      )}
                      {inq.status !== 'CLOSED' && (
                        <button
                          onClick={() => updateStatus(inq.id, 'CLOSED')}
                          disabled={updating === inq.id}
                          style={{ fontSize: '12px', fontWeight: 600, color: 'var(--afa-text-primary)', opacity: updating === inq.id ? 0.5 : 0.6, background: 'transparent', border: '1px solid rgba(245,245,240,0.15)', borderRadius: '6px', padding: '7px 14px', cursor: updating === inq.id ? 'default' : 'pointer' }}
                        >
                          Close
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
