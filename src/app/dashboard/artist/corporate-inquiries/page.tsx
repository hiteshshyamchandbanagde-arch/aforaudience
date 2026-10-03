'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import SiteNav from '@/components/SiteNav'
import { useToast } from '@/components/Toast'
import Button from '@/components/ui/Button'
import BrandLoader from '@/components/BrandLoader'
import DashboardShell from '@/components/DashboardShell'
import { fillSolidTint, STATUS_TONE } from '@/lib/statusStyle'
import { formatDate } from '@/lib/format-date'
import { useLocale } from '@/lib/i18n/translate'

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
  NEW: { label: 'New', bg: fillSolidTint(0.12), color: 'var(--afa-fill-solid)' },
  CONTACTED: { label: 'Contacted', ...STATUS_TONE.sage },
  CLOSED: { label: 'Closed', bg: 'var(--afa-tint-08)', color: 'var(--afa-text-primary)' },
}

// FEAT-2608-046 - corporate show booking, inquiry-only. This is the
// artist's inbox for inquiries submitted from their public profile
// (CorporateInquiryModal) - status is a lightweight self-managed tracker
// (Mark Contacted / Close), everything past that (negotiation, contract,
// payment) happens off-platform.
export default function CorporateInquiriesPage() {
  const { locale } = useLocale()
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

  if (status === 'loading' || loading) return (<><SiteNav /><DashboardShell><BrandLoader /></DashboardShell></>)
  if (!session) return (<><SiteNav /><DashboardShell>{null}</DashboardShell></>)

  return (
    <>
      <SiteNav />
      <DashboardShell>
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: 'var(--afa-space-48px) var(--afa-space-6)' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-page-title-lg)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-2)' }}>
            Corporate Inquiries
          </h1>
          <p style={{ fontSize: 'var(--afa-text-body-lg)', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: 'var(--afa-space-32px)' }}>
            Direct booking inquiries from companies and private event organisers. Reach out to them directly - AforAudience doesn't handle payment for these.
          </p>

          {inquiries.length === 0 ? (
            <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.5 }}>
              No inquiries yet. They'll show up here when a company sends you a booking request from your public profile.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-14px)' }}>
              {inquiries.map((inq) => {
                const meta = STATUS_META[inq.status]
                return (
                  <div key={inq.id} style={{ background: 'white', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-5)', border: '1px solid var(--afa-tint-08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--afa-space-10px)', marginBottom: 'var(--afa-space-10px)', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-lead)', fontWeight: 700, color: 'var(--afa-text-primary)' }}>{inq.companyName}</div>
                        <div style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.55 }}>{formatDate(inq.createdAt, 'medium', locale)}</div>
                      </div>
                      <span style={{ fontSize: 'var(--afa-text-small)', fontWeight: 600, padding: '5px var(--afa-space-3)', borderRadius: 'var(--afa-radius-pill)', background: meta.bg, color: meta.color }}>{meta.label}</span>
                    </div>

                    <div style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', lineHeight: 1.8, marginBottom: 'var(--afa-space-10px)' }}>
                      <div><strong>Contact:</strong> {inq.contactName} · <a href={`mailto:${inq.contactEmail}`} style={{ color: 'var(--afa-fill-solid)' }}>{inq.contactEmail}</a>{inq.contactPhone ? ` · ${inq.contactPhone}` : ''}</div>
                      {inq.eventType && <div><strong>Event type:</strong> {inq.eventType}</div>}
                      {inq.city && <div><strong>City:</strong> {inq.city}</div>}
                      {inq.preferredDate && <div><strong>Preferred date:</strong> {formatDate(inq.preferredDate, 'medium', locale)}</div>}
                      {inq.budgetRange && <div><strong>Budget:</strong> {inq.budgetRange}</div>}
                    </div>

                    {inq.message && (
                      <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.7, background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-md)', padding: 'var(--afa-space-10px) var(--afa-space-3)', marginBottom: 'var(--afa-space-3)', whiteSpace: 'pre-wrap' }}>
                        {inq.message}
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: 'var(--afa-space-2)', flexWrap: 'wrap' }}>
                      {inq.status !== 'CONTACTED' && (
                        <Button
                          variant="outline-success"
                          size="md"
                          fullWidth={false}
                          onClick={() => updateStatus(inq.id, 'CONTACTED')}
                          disabled={updating === inq.id}
                        >
                          Mark Contacted
                        </Button>
                      )}
                      {inq.status !== 'CLOSED' && (
                        <Button
                          variant="outline-neutral"
                          size="md"
                          fullWidth={false}
                          onClick={() => updateStatus(inq.id, 'CLOSED')}
                          disabled={updating === inq.id}
                        >
                          Close
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
      </DashboardShell>
    </>
  )
}
