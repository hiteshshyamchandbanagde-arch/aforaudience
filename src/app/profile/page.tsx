'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import SiteNav from '@/components/SiteNav'

type RoleStatus = { isInRole: boolean; isApproved: boolean; hasProfile: boolean }

const cardStyle = {
  background: '#fff',
  borderRadius: '12px',
  padding: '24px',
  border: '1px solid rgba(14,12,10,0.08)',
  marginBottom: '16px',
}

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [orgStatus, setOrgStatus] = useState<RoleStatus | null>(null)
  const [venueStatus, setVenueStatus] = useState<RoleStatus | null>(null)
  const [orgName, setOrgName] = useState('')
  const [applying, setApplying] = useState<'organiser' | 'venue' | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const loadStatuses = async () => {
    const [orgRes, venueRes] = await Promise.all([
      fetch('/api/organisers/status'),
      fetch('/api/venue-owners/status'),
    ])
    if (orgRes.ok) {
      const d = await orgRes.json()
      setOrgStatus({ isInRole: d.isOrganiser, isApproved: d.isApproved, hasProfile: d.hasProfile })
    }
    if (venueRes.ok) {
      const d = await venueRes.json()
      setVenueStatus({ isInRole: d.isVenueOwner, isApproved: d.isApproved, hasProfile: d.hasProfile })
    }
  }

  useEffect(() => {
    if (session?.user) loadStatuses()
  }, [session])

  const applyOrganiser = async () => {
    if (!orgName.trim()) {
      setError('Enter an organisation or brand name first.')
      return
    }
    setApplying('organiser')
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/organisers/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit application')
      setMessage(data.message)
      await loadStatuses()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setApplying(null)
    }
  }

  const applyVenueOwner = async () => {
    setApplying('venue')
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/venue-owners/apply', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit application')
      setMessage(data.message)
      await loadStatuses()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setApplying(null)
    }
  }

  if (status === 'loading') return (<><SiteNav /><div style={{ padding: '32px' }}>Loading...</div></>)
  if (!session) return <SiteNav />

  const user = session.user as { name?: string | null; email?: string | null }

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '48px 24px' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#0E0C0A', marginBottom: '4px' }}>
            {user?.name || 'Your Profile'}
          </h1>
          <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.6, marginBottom: '32px' }}>{user?.email}</p>

          {message && (
            <div style={{ padding: '14px 16px', background: '#F0FFF4', border: '1px solid #68D391', borderRadius: '8px', color: '#276749', fontSize: '14px', marginBottom: '20px' }}>
              {message}
            </div>
          )}
          {error && (
            <div style={{ padding: '14px 16px', background: '#FDECEA', border: '1px solid #F5C2C0', borderRadius: '8px', color: '#B3261E', fontSize: '14px', marginBottom: '20px' }}>
              {error}
            </div>
          )}

          {/* Organiser upgrade */}
          <div style={cardStyle}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#0E0C0A', marginBottom: '6px' }}>
              Become an Organiser
            </h2>
            <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6, marginBottom: '16px' }}>
              Create and publish your own events.
            </p>

            {orgStatus?.isInRole ? (
              <div style={{ fontSize: '14px', fontWeight: 600, color: orgStatus.isApproved ? '#4A6741' : '#8a6a1f' }}>
                {orgStatus.isApproved ? '✅ Approved — visit your Organiser dashboard' : '⏳ Application pending approval'}
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Organisation or brand name"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(14,12,10,0.15)', fontSize: '14px', marginBottom: '12px', boxSizing: 'border-box' as const }}
                />
                <button
                  onClick={applyOrganiser}
                  disabled={applying === 'organiser'}
                  style={{ fontSize: '14px', fontWeight: 600, color: '#F7F3EE', background: '#C8441A', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', opacity: applying === 'organiser' ? 0.6 : 1 }}
                >
                  {applying === 'organiser' ? 'Submitting...' : 'Apply'}
                </button>
              </>
            )}
          </div>

          {/* Venue Owner upgrade */}
          <div style={cardStyle}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#0E0C0A', marginBottom: '6px' }}>
              List Your Venue
            </h2>
            <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6, marginBottom: '16px' }}>
              Rent out your space and manage bookings.
            </p>

            {venueStatus?.isInRole ? (
              <div style={{ fontSize: '14px', fontWeight: 600, color: venueStatus.isApproved ? '#4A6741' : '#8a6a1f' }}>
                {venueStatus.isApproved ? '✅ Approved — visit your Venue dashboard' : '⏳ Application pending approval'}
              </div>
            ) : (
              <button
                onClick={applyVenueOwner}
                disabled={applying === 'venue'}
                style={{ fontSize: '14px', fontWeight: 600, color: '#F7F3EE', background: '#C8441A', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', opacity: applying === 'venue' ? 0.6 : 1 }}
              >
                {applying === 'venue' ? 'Submitting...' : 'Apply'}
              </button>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
