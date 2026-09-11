'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import SiteNav from '@/components/SiteNav'
import DashboardShell from '@/components/DashboardShell'
import BackLink from '@/components/BackLink'
import BrandLoader from '@/components/BrandLoader'
import SearchInputBox from '@/components/SearchInputBox'

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

  if (status === 'loading' || (loading && users.length === 0)) return (<><SiteNav /><BrandLoader /></>)
  if (!session) return <SiteNav />

  return (
    <>
      <SiteNav />
      <DashboardShell>
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 24px' }}>
          {/* lg:hidden - now redundant on desktop once DashboardShell's sidebar is there; still the only way back on mobile */}
          <div className="lg:hidden">
            <BackLink href="/dashboard/admin/feedback" label="Back to Dashboard" />
          </div>

          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '30px', fontWeight: 700, color: 'var(--afa-text-primary)', marginTop: '12px', marginBottom: '8px' }}>
            Accounts
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--afa-text-secondary)', marginBottom: '20px', maxWidth: '640px' }}>
            Suspending blocks login immediately and hides the account's future events/venues from public
            listings. It does not cancel existing confirmed bookings or already-published events. Fully
            reversible — unsuspend at any time.
          </p>

          <form onSubmit={handleSearchSubmit} className="flex flex-col lg:flex-row" style={{ gap: '10px', marginBottom: '20px' }}>
            <SearchInputBox
              value={search}
              onChange={setSearch}
              placeholder="Search name, display name, or email..."
              className="lg:flex-1"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(245,245,240,0.15)', fontSize: '14px', background: 'var(--afa-surface-page)', color: 'var(--afa-text-primary)' }}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r || 'All roles'}</option>
              ))}
            </select>
            <button
              type="submit"
              style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid rgba(201,151,58,0.4)', background: 'transparent', color: 'var(--afa-amber)', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
            >
              Search
            </button>
          </form>

          {error && <div style={{ fontSize: '13px', color: 'var(--afa-error)', marginBottom: '16px' }}>{error}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {users.length === 0 && !loading && (
              <p style={{ fontSize: '14px', color: 'var(--afa-text-secondary)' }}>No users match.</p>
            )}
            {users.map((u) => (
              <div
                key={u.id}
                style={{
                  background: 'var(--afa-surface-page)', borderRadius: '10px', padding: '16px',
                  border: u.isSuspended ? '1px solid rgba(179,38,30,0.4)' : '1px solid rgba(245,245,240,0.08)',
                }}
              >
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start" style={{ gap: '10px' }}>
                  <div>
                    <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--afa-text-primary)' }}>
                      {u.displayName || u.name}
                      {u.isSuspended && <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 700, color: 'var(--afa-error)', textTransform: 'uppercase' }}>Suspended</span>}
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--afa-text-secondary)' }}>{u.email} · {u.role}</p>
                    {u.isSuspended && u.suspendReason && (
                      <p style={{ fontSize: '12px', color: 'var(--afa-error)', marginTop: '6px' }}>
                        Reason: {u.suspendReason}
                      </p>
                    )}
                  </div>

                  {u.role !== 'ADMIN' && (
                    u.isSuspended ? (
                      <button
                        onClick={() => handleUnsuspend(u.id)}
                        disabled={actioningId === u.id}
                        style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--afa-green-deep)', background: 'transparent', color: 'var(--afa-green-deep)', fontWeight: 700, fontSize: '13px', cursor: 'pointer', flexShrink: 0 }}
                      >
                        Unsuspend
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                        <input
                          value={reasonDraft[u.id] || ''}
                          onChange={(e) => setReasonDraft({ ...reasonDraft, [u.id]: e.target.value })}
                          placeholder="Reason..."
                          style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(245,245,240,0.15)', fontSize: '13px', width: '160px', background: 'var(--afa-surface-inverse)', color: 'var(--afa-text-primary)' }}
                        />
                        <button
                          onClick={() => handleSuspend(u.id)}
                          disabled={actioningId === u.id}
                          style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: 'var(--afa-fill-solid)', color: 'var(--afa-on-fill-solid)', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
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
      </DashboardShell>
    </>
  )
}
