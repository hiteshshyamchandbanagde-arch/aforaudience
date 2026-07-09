'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import SiteNav from '@/components/SiteNav'

interface PendingItem {
  type: 'ORGANISER' | 'VENUE_OWNER'
  id: string
  orgName?: string
  bio?: string | null
  user: { name: string; email: string; createdAt: string }
  createdAt: string
}

export default function AdminDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [pending, setPending] = useState<PendingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actingOn, setActingOn] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const fetchPending = async () => {
    try {
      const res = await fetch('/api/admin/approvals')
      if (!res.ok) throw new Error(res.status === 403 ? 'Admins only' : 'Failed to load approvals')
      setPending(await res.json())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user) fetchPending()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  const act = async (item: PendingItem, action: 'approve' | 'reject') => {
    setActingOn(item.id)
    try {
      const res = await fetch('/api/admin/approvals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: item.type, id: item.id, action }),
      })
      if (!res.ok) throw new Error('Action failed')
      setPending((prev) => prev.filter((p) => p.id !== item.id))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActingOn(null)
    }
  }

  if (status === 'loading' || loading) return (<><SiteNav /><div style={{ padding: '32px' }}>Loading...</div></>)
  if (!session) return <SiteNav />

  if (error === 'Admins only') {
    return (
      <>
        <SiteNav />
        <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', marginBottom: '12px' }}>Admins only</h1>
            <p style={{ color: '#0E0C0A', opacity: 0.6 }}>This page is restricted to platform administrators.</p>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 24px' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#0E0C0A', marginBottom: '8px' }}>
            Pending Approvals
          </h1>
          <p style={{ fontSize: '15px', color: '#0E0C0A', opacity: 0.6, marginBottom: '32px' }}>
            {pending.length} application{pending.length === 1 ? '' : 's'} waiting for review
          </p>

          {error && error !== 'Admins only' && (
            <div style={{ padding: '14px 16px', background: '#FDECEA', border: '1px solid #F5C2C0', borderRadius: '8px', color: '#B3261E', fontSize: '14px', marginBottom: '20px' }}>
              {error}
            </div>
          )}

          {pending.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: '12px', padding: '40px', textAlign: 'center', border: '1px solid rgba(14,12,10,0.08)', color: '#0E0C0A', opacity: 0.6 }}>
              Nothing pending right now.
            </div>
          ) : (
            pending.map((item) => (
              <div key={item.id} style={{ background: '#fff', borderRadius: '12px', padding: '22px 24px', marginBottom: '14px', border: '1px solid rgba(14,12,10,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.03em', color: '#C8441A', textTransform: 'uppercase' }}>
                    {item.type === 'ORGANISER' ? 'Organiser' : 'Venue Owner'}
                  </span>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: '#0E0C0A', marginTop: '4px' }}>
                    {item.orgName || item.user.name}
                  </div>
                  <div style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6 }}>
                    {item.user.name} · {item.user.email}
                  </div>
                  {item.bio && <div style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.7, marginTop: '6px' }}>{item.bio}</div>}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => act(item, 'approve')}
                    disabled={actingOn === item.id}
                    style={{ fontSize: '13px', fontWeight: 600, color: '#fff', background: '#4A6741', border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', opacity: actingOn === item.id ? 0.6 : 1 }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => act(item, 'reject')}
                    disabled={actingOn === item.id}
                    style={{ fontSize: '13px', fontWeight: 600, color: '#B3261E', background: 'transparent', border: '1px solid #F5C2C0', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', opacity: actingOn === item.id ? 0.6 : 1 }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </>
  )
}
