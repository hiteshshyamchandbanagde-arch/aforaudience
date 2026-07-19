'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'

interface UserRow {
  id: string
  name: string
  displayName: string | null
  email: string
  role: string
  isSuspended: boolean
  suspendedAt: string | null
  suspendReason: string | null
  createdAt: string
}

const ROLES = ['', 'AUDIENCE', 'ARTIST', 'ORGANISER', 'VENUE_OWNER', 'ADMIN']

export default function AdminUsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [reasonDraft, setReasonDraft] = useState<Record<string, string>>({})

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const fetchUsers = useCallback(async (q: string, r: string) => {
    try {
      const params = new URLSearchParams()
      if (q) params.set('search', q)
      if (r) params.set('role', r)
      const res = await fetch(`/api/admin/users?${params.toString()}`)
      if (!res.ok) {
        if (res.status === 403) throw new Error('You do not have access to this page')
        throw new Error('Could not load users')
      }
      const json = await res.json()
      setUsers(json.users)
      setError('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') return
    setLoading(true)
    fetchUsers(search, role)
  }, [status, fetchUsers]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    fetchUsers(search, role)
  }

  const handleSuspend = async (userId: string) => {
    const reason = (reasonDraft[userId] || '').trim()
    if (!reason) {
      alert('Please enter a reason before suspending.')
      return
    }
    setActioningId(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}/suspend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspended: true, reason }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Failed to suspend')
        return
      }
      await fetchUsers(search, role)
    } finally {
      setActioningId(null)
    }
  }

  const handleUnsuspend = async (userId: string) => {
    if (!confirm('Unsuspend this account? They will be able to log in again immediately.')) return
    setActioningId(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}/suspend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspended: false }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Failed to unsuspend')
        return
      }
      await fetchUsers(search, role)
    } finally {
      setActioningId(null)
    }
  }

  if (status === 'loading' || (loading && users.length === 0)) return (<><SiteNav /><div style={{ padding: '32px' }}>Loading...</div></>)
  if (!session) return <SiteNav />

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 24px' }}>
          <Link href="/dashboard/admin" style={{ fontSize: '14px', color: '#C8441A', textDecoration: 'none', fontWeight: 600 }}>
            ← Back to dashboard
          </Link>

          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '30px', fontWeight: 700, color: '#0E0C0A', marginTop: '12px', marginBottom: '8px' }}>
            🚩 Accounts
          </h1>
          <p style={{ fontSize: '13px', color: 'rgba(14,12,10,0.6)', marginBottom: '20px', maxWidth: '640px' }}>
            Suspending blocks login immediately and hides the account's future events/venues from public
            listings. It does not cancel existing confirmed bookings or already-published events. Fully
            reversible — unsuspend at any time.
          </p>

          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, display name, or email..."
              style={{ flex: '1 1 240px', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(14,12,10,0.15)', fontSize: '14px' }}
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(14,12,10,0.15)', fontSize: '14px' }}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r || 'All roles'}</option>
              ))}
            </select>
            <button type="submit" style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#C8441A', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
              Search
            </button>
          </form>

          {error && <div style={{ fontSize: '13px', color: '#B3261E', marginBottom: '16px' }}>{error}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {users.length === 0 && !loading && (
              <p style={{ fontSize: '14px', color: 'rgba(14,12,10,0.5)' }}>No users match.</p>
            )}
            {users.map((u) => (
              <div
                key={u.id}
                style={{
                  background: '#fff', borderRadius: '10px', padding: '16px',
                  border: u.isSuspended ? '1px solid #C8441A' : '1px solid rgba(14,12,10,0.08)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <p style={{ fontSize: '15px', fontWeight: 700, color: '#0E0C0A' }}>
                      {u.displayName || u.name}
                      {u.isSuspended && <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 700, color: '#C8441A', textTransform: 'uppercase' }}>Suspended</span>}
                    </p>
                    <p style={{ fontSize: '13px', color: 'rgba(14,12,10,0.6)' }}>{u.email} · {u.role}</p>
                    {u.isSuspended && u.suspendReason && (
                      <p style={{ fontSize: '12px', color: '#C8441A', marginTop: '6px' }}>
                        Reason: {u.suspendReason}
                      </p>
                    )}
                  </div>

                  {u.role !== 'ADMIN' && (
                    u.isSuspended ? (
                      <button
                        onClick={() => handleUnsuspend(u.id)}
                        disabled={actioningId === u.id}
                        style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #4A6741', background: '#fff', color: '#4A6741', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                      >
                        Unsuspend
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input
                          value={reasonDraft[u.id] || ''}
                          onChange={(e) => setReasonDraft({ ...reasonDraft, [u.id]: e.target.value })}
                          placeholder="Reason..."
                          style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(14,12,10,0.15)', fontSize: '13px', width: '160px' }}
                        />
                        <button
                          onClick={() => handleSuspend(u.id)}
                          disabled={actioningId === u.id}
                          style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#C8441A', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                        >
                          Suspend
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  )
}
