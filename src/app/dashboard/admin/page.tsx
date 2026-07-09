'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import SiteNav from '@/components/SiteNav'

interface PendingItem {
  id: string
  orgName?: string
  bio?: string | null
  createdAt: string
  user: { name: string | null; email: string | null; createdAt: string }
}

export default function AdminDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [organisers, setOrganisers] = useState<PendingItem[]>([])
  const [venueOwners, setVenueOwners] = useState<PendingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [actioningId, setActioningId] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/approvals')
    if (res.status === 403) {
      setForbidden(true)
      setLoading(false)
      return
    }
    if (res.ok) {
      const data = await res.json()
      setOrganisers(data.organisers)
      setVenueOwners(data.venueOwners)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (session?.user) load()
  }, [session])

  const act = async (type: 'organiser' | 'venueOwner', id: string, action: 'approve' | 'reject') => {
    setActioningId(id)
    try {
      await fetch('/api/admin/approvals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id, action }),
      })
      await load()
    } finally {
      setActioningId(null)
    }
  }

  if (status === 'loading' || loading) return (<><SiteNav /><div style={{ padding: '32px' }}>Loading...</div></>)
  if (!session) return <SiteNav />

  if (forbidden) {
    return (
      <>
        <SiteNav />
        <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', marginBottom: '12px' }}>Admin access only</h1>
            <p style={{ color: '#0E0C0A', opacity: 0.6 }}>This page is restricted to platform administrators.</p>
          </div>
        </main>
      </>
    )
  }

  const cardStyle = { background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid rgba(14,12,10,0.08)', marginBottom: '12px' }

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 24px' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#0E0C0A', marginBottom: '32px' }}>
            Pending Approvals
          </h1>

          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, marginBottom: '12px' }}>
            Organisers ({organisers.length})
          </h2>
          {organisers.length === 0 && <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.5, marginBottom: '24px' }}>Nothing pending.</p>}
          {organisers.map((o) => (
            <div key={o.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600 }}>{o.orgName}</div>
                  <div style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6 }}>{o.user.name} · {o.user.email}</div>
                  {o.bio && <div style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6, marginTop: '4px' }}>{o.bio}</div>}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button disabled={actioningId === o.id} onClick={() => act('organiser', o.id, 'approve')} style={{ fontSize: '13px', fontWeight: 600, color: '#fff', background: '#4A6741', border: 'none', borderRadius: '6px', padding: '8px 14px', cursor: 'pointer' }}>Approve</button>
                  <button disabled={actioningId === o.id} onClick={() => act('organiser', o.id, 'reject')} style={{ fontSize: '13px', fontWeight: 600, color: '#B3261E', background: 'transparent', border: '1px solid #F5C2C0', borderRadius: '6px', padding: '8px 14px', cursor: 'pointer' }}>Reject</button>
                </div>
              </div>
            </div>
          ))}

          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, marginTop: '32px', marginBottom: '12px' }}>
            Venue Owners ({venueOwners.length})
          </h2>
          {venueOwners.length === 0 && <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.5 }}>Nothing pending.</p>}
          {venueOwners.map((v) => (
            <div key={v.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600 }}>{v.user.name}</div>
                  <div style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6 }}>{v.user.email}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button disabled={actioningId === v.id} onClick={() => act('venueOwner', v.id, 'approve')} style={{ fontSize: '13px', fontWeight: 600, color: '#fff', background: '#4A6741', border: 'none', borderRadius: '6px', padding: '8px 14px', cursor: 'pointer' }}>Approve</button>
                  <button disabled={actioningId === v.id} onClick={() => act('venueOwner', v.id, 'reject')} style={{ fontSize: '13px', fontWeight: 600, color: '#B3261E', background: 'transparent', border: '1px solid #F5C2C0', borderRadius: '6px', padding: '8px 14px', cursor: 'pointer' }}>Reject</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  )
}
