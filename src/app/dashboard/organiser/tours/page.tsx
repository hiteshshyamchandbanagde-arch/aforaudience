'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import BackLink from '@/components/BackLink'
import BrandLoader from '@/components/BrandLoader'
import DashboardShell from '@/components/DashboardShell'
import { ErrorBanner } from '@/components/ErrorBanner'

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
  DRAFT: { bg: 'rgba(245,245,240,0.08)', color: 'var(--afa-text-primary)', label: 'Draft' },
  PENDING_CONSENT: { bg: 'rgba(201,151,58,0.15)', color: 'var(--afa-gold)', label: 'Awaiting artist consent' },
  LIVE: { bg: 'rgba(74,103,65,0.12)', color: 'var(--afa-sage)', label: 'Live' },
  CANCELLED: { bg: 'rgba(179,38,30,0.1)', color: 'var(--afa-error)', label: 'Cancelled' },
  COMPLETED: { bg: 'rgba(245,245,240,0.08)', color: 'var(--afa-text-primary)', label: 'Completed' },
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
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px 80px' }}>
        <BackLink href="/dashboard/organiser" label="Back to Dashboard" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '28px', fontWeight: 700, color: 'var(--afa-text-primary)' }}>Tours</h1>
            <p style={{ fontSize: '14px', color: 'var(--afa-text-primary)', opacity: 0.6, marginTop: '4px' }}>
              A Tour wraps a series of stops under one umbrella so audiences know they're the same run of shows.
            </p>
          </div>
          <Link
            href="/dashboard/organiser/tours/create"
            style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-on-fill-solid)', background: 'var(--afa-terracotta)', textDecoration: 'none', padding: '12px 22px', borderRadius: '8px', whiteSpace: 'nowrap' }}
          >
            + Create Tour
          </Link>
        </div>

        {error && (
          <ErrorBanner style={{ marginBottom: '24px' }}>{error}</ErrorBanner>
        )}

        {tours.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px', background: 'var(--afa-surface-raised)', borderRadius: '12px', border: '1px solid rgba(245,245,240,0.08)' }}>
            <p style={{ fontSize: '17px', color: 'var(--afa-text-primary)', marginBottom: '8px' }}>No Tours yet</p>
            <p style={{ fontSize: '14px', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: '20px' }}>
              Create a Tour to group a series of stops under one shared page for your audience.
            </p>
            <Link
              href="/dashboard/organiser/tours/create"
              style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-on-fill-solid)', background: 'var(--afa-terracotta)', textDecoration: 'none', padding: '12px 24px', borderRadius: '8px' }}
            >
              Create Tour
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {tours.map((tour) => {
              const statusStyle = STATUS_STYLE[tour.status] || STATUS_STYLE.DRAFT
              const pendingConsents = tour.consents.filter((c) => c.status === 'PENDING').length
              const liveStops = tour.stops.filter((s) => s.status === 'APPROVED').length
              return (
                <div
                  key={tour.id}
                  onClick={() => router.push(`/dashboard/organiser/tours/${tour.id}`)}
                  style={{ background: 'var(--afa-surface-raised)', borderRadius: '12px', padding: '24px', border: '1px solid rgba(245,245,240,0.08)', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', gap: '10px' }}>
                    <div>
                      <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '19px', fontWeight: 700, color: 'var(--afa-text-primary)' }}>{tour.title}</h3>
                      {tour.subject && (
                        <p style={{ fontSize: '13px', color: 'var(--afa-text-primary)', opacity: 0.6, marginTop: '2px' }}>{tour.subject}</p>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                        padding: '5px 10px', borderRadius: '999px', background: statusStyle.bg, color: statusStyle.color, whiteSpace: 'nowrap',
                      }}
                    >
                      {statusStyle.label}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--afa-text-primary)', flexWrap: 'wrap' }}>
                    <span><strong>{tour.stops.length}</strong> stop{tour.stops.length !== 1 ? 's' : ''}</span>
                    <span><strong>{liveStops}</strong> live</span>
                    {pendingConsents > 0 && (
                      <span style={{ color: 'var(--afa-terracotta)', fontWeight: 600 }}>{pendingConsents} awaiting response</span>
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
