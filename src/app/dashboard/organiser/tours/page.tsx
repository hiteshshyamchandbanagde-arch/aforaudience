'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import SiteNav from '@/components/SiteNav'
import BrandLoader from '@/components/BrandLoader'
import DashboardShell from '@/components/DashboardShell'
import { ErrorBanner } from '@/components/ErrorBanner'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { STATUS_TONE } from '@/lib/statusStyle'

interface TourItem {
  id: string
  title: string
  subject: string | null
  slug: string
  status: 'DRAFT' | 'PENDING_CONSENT' | 'LIVE' | 'CANCELLED' | 'COMPLETED'
  consents: { status: string; artist: { user: { name: string; displayName: string | null } } }[]
  stops: { id: string; status: string; date: string }[]
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  DRAFT: { bg: 'var(--afa-tint-08)', color: 'var(--afa-text-primary)', label: 'Draft' },
  PENDING_CONSENT: { ...STATUS_TONE.gold, label: 'Awaiting artist consent' },
  LIVE: { ...STATUS_TONE.sage, label: 'Live' },
  CANCELLED: { ...STATUS_TONE.error, label: 'Cancelled' },
  COMPLETED: { bg: 'var(--afa-tint-08)', color: 'var(--afa-text-primary)', label: 'Completed' },
}

// Tour by Organiser (12 Aug) - management list. Distinct from the public
// /tours/[slug] landing page, which only ever shows bookable stops; this
// view surfaces DRAFT/PENDING_CONSENT tours too so the organiser can see
// exactly what's still blocking a launch.
export default function OrganiserToursPage() {
  const { status } = useSession()
  const router = useRouter()
  const [tours, setTours] = useState<TourItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/tours/mine')
        if (!res.ok) throw new Error('Failed to load your Tours')
        const data = await res.json()
        setTours(data.tours || [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    if (status === 'authenticated') load()
  }, [status])

  if (status === 'loading' || loading) return (<><SiteNav /><DashboardShell><BrandLoader /></DashboardShell></>)

  return (
    <>
      <SiteNav />
      <DashboardShell>
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: 'var(--afa-space-32px) var(--afa-space-6) var(--afa-space-80px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--afa-space-28px)', flexWrap: 'wrap', gap: 'var(--afa-space-3)' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-page-title)', fontWeight: 700, color: 'var(--afa-text-primary)' }}>Tours</h1>
            <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.6, marginTop: 'var(--afa-space-1)' }}>
              A Tour wraps a series of stops under one umbrella so audiences know they're the same run of shows.
            </p>
          </div>
          <Button variant="primary" size="lg" fullWidth={false} href="/dashboard/organiser/tours/create" style={{ whiteSpace: 'nowrap' }}>
            + Create Tour
          </Button>
        </div>

        {error && (
          <ErrorBanner style={{ marginBottom: 'var(--afa-space-6)' }}>{error}</ErrorBanner>
        )}

        {tours.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--afa-space-64px) var(--afa-space-6)', background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', border: '1px solid var(--afa-tint-08)' }}>
            <p style={{ fontSize: 'var(--afa-text-title)', color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-2)' }}>No Tours yet</p>
            <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: 'var(--afa-space-5)' }}>
              Create a Tour to group a series of stops under one shared page for your audience.
            </p>
            <Button variant="primary" size="lg" fullWidth={false} href="/dashboard/organiser/tours/create">
              Create Tour
            </Button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--afa-space-5)' }}>
            {tours.map((tour) => {
              const statusStyle = STATUS_STYLE[tour.status] || STATUS_STYLE.DRAFT
              const pendingConsents = tour.consents.filter((c) => c.status === 'PENDING').length
              const liveStops = tour.stops.filter((s) => s.status === 'APPROVED').length
              return (
                <div
                  key={tour.id}
                  onClick={() => router.push(`/dashboard/organiser/tours/${tour.id}`)}
                  style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-6)', border: '1px solid var(--afa-tint-08)', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--afa-space-14px)', gap: 'var(--afa-space-10px)' }}>
                    <div>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-subtitle)', fontWeight: 700, color: 'var(--afa-text-primary)' }}>{tour.title}</h3>
                      {tour.subject && (
                        <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.6, marginTop: 'var(--afa-space-2px)' }}>{tour.subject}</p>
                      )}
                    </div>
                    <Badge tone={statusStyle}>{statusStyle.label}</Badge>
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--afa-space-4)', fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', flexWrap: 'wrap' }}>
                    <span><strong>{tour.stops.length}</strong> stop{tour.stops.length !== 1 ? 's' : ''}</span>
                    <span><strong>{liveStops}</strong> live</span>
                    {pendingConsents > 0 && (
                      <span style={{ color: 'var(--afa-fill-solid)', fontWeight: 600 }}>{pendingConsents} awaiting response</span>
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
