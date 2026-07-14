'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
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
  const [artistStatus, setArtistStatus] = useState<RoleStatus | null>(null)
  const [orgName, setOrgName] = useState('')
  const [genre, setGenre] = useState('')
  const [applying, setApplying] = useState<'organiser' | 'venue' | 'artist' | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Display name lives separately from the login username. Loaded from
  // /api/users/me on mount so we know whether it's blank; edited via
  // PATCH. Deliberately not read from session — the session cache doesn't
  // include displayName (yet) and we want the latest value from the DB.
  const [displayName, setDisplayName] = useState('')
  const [initialDisplayName, setInitialDisplayName] = useState('')
  const [savingName, setSavingName] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const loadStatuses = async () => {
    const [meRes, orgRes, venueRes, artistRes] = await Promise.all([
      fetch('/api/users/me'),
      fetch('/api/organisers/status'),
      fetch('/api/venue-owners/status'),
      fetch('/api/artists/status'),
    ])
    if (meRes.ok) {
      const d = await meRes.json()
      const current = d.user?.displayName ?? ''
      setDisplayName(current)
      setInitialDisplayName(current)
    }
    if (orgRes.ok) {
      const d = await orgRes.json()
      setOrgStatus({ isInRole: d.isOrganiser, isApproved: d.isApproved, hasProfile: d.hasProfile })
    }
    if (venueRes.ok) {
      const d = await venueRes.json()
      setVenueStatus({ isInRole: d.isVenueOwner, isApproved: d.isApproved, hasProfile: d.hasProfile })
    }
    if (artistRes.ok) {
      const d = await artistRes.json()
      setArtistStatus({ isInRole: d.isArtist, isApproved: d.isApproved, hasProfile: d.hasProfile })
    }
  }

  const saveDisplayName = async () => {
    setSavingName(true)
    setMessage('')
    setError('')
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setInitialDisplayName(data.user?.displayName ?? '')
      setMessage('Display name saved.')
    } catch (err: any) {
      setError(err.message || 'Failed to save')
    } finally {
      setSavingName(false)
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

  const applyArtist = async () => {
    setApplying('artist')
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/artists/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genre }),
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

  if (status === 'loading') return (<><SiteNav /><div style={{ padding: '32px' }}>Loading...</div></>)
  if (!session) return <SiteNav />

  const user = session.user as { name?: string | null; email?: string | null; code?: string | null }

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '48px 24px' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#0E0C0A', marginBottom: '4px' }}>
            {initialDisplayName || user?.name || 'Your Profile'}
          </h1>
          <p style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.6, marginBottom: '4px' }}>{user?.email}</p>
          {user?.code && (
            <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.5, marginBottom: '32px', fontFamily: 'monospace' }}>
              Your login code: <span style={{ fontWeight: 700, letterSpacing: '0.03em' }}>{user.code}</span>
            </p>
          )}

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

          {/* Display name — separate from the login username. Shows on
              tickets, emails, and greetings. Falls back to username if
              blank, so existing users see no change until they set one. */}
          <div style={cardStyle}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#0E0C0A', marginBottom: '6px' }}>
              Display name
            </h2>
            <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6, marginBottom: '16px' }}>
              What appears on your tickets and emails. Your login username <strong>{user?.name}</strong> stays the same either way.
            </p>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your full name, e.g. Hitesh Bangade"
              maxLength={120}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(14,12,10,0.15)', fontSize: '14px', marginBottom: '12px', boxSizing: 'border-box' as const }}
            />
            <button
              onClick={saveDisplayName}
              disabled={savingName || displayName.trim() === initialDisplayName.trim()}
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'white',
                background: '#C8441A',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                cursor: savingName || displayName.trim() === initialDisplayName.trim() ? 'default' : 'pointer',
                opacity: savingName || displayName.trim() === initialDisplayName.trim() ? 0.5 : 1,
              }}
            >
              {savingName ? 'Saving…' : 'Save display name'}
            </button>
          </div>

          {/* Artist upgrade - no approval needed, unlike Organiser/Venue Owner below */}
          <div style={cardStyle}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#0E0C0A', marginBottom: '6px' }}>
              I&apos;m an Artist
            </h2>
            <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6, marginBottom: '16px' }}>
              Get discovered, apply to perform at events, and track your growth. Goes live immediately, no approval wait.
            </p>

            {artistStatus?.isInRole ? (
              <Link href="/dashboard/artist" style={{ fontSize: '14px', fontWeight: 600, color: '#4A6741', textDecoration: 'none' }}>
                ✅ Visit your Artist dashboard →
              </Link>
            ) : (
              <>
                <input
                  type="text"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  placeholder="Genres, comma separated (optional) — e.g. Stand-up, Poetry"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(14,12,10,0.15)', fontSize: '14px', marginBottom: '12px', boxSizing: 'border-box' as const }}
                />
                <button
                  onClick={applyArtist}
                  disabled={applying === 'artist'}
                  style={{ fontSize: '14px', fontWeight: 600, color: '#F7F3EE', background: '#C8441A', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', opacity: applying === 'artist' ? 0.6 : 1 }}
                >
                  {applying === 'artist' ? 'Setting up...' : 'Become an Artist'}
                </button>
              </>
            )}
          </div>

          {/* Organiser upgrade */}
          <div style={cardStyle}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#0E0C0A', marginBottom: '6px' }}>
              Become an Organiser
            </h2>
            <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6, marginBottom: '16px' }}>
              Create and publish your own events.
            </p>

            {orgStatus?.isInRole ? (
              orgStatus.isApproved ? (
                <Link href="/dashboard/organiser" style={{ fontSize: '14px', fontWeight: 600, color: '#4A6741', textDecoration: 'none' }}>
                  ✅ Approved — visit your Organiser dashboard →
                </Link>
              ) : (
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#8a6a1f' }}>
                  ⏳ Application pending approval
                </div>
              )
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
              venueStatus.isApproved ? (
                <Link href="/dashboard/venue" style={{ fontSize: '14px', fontWeight: 600, color: '#4A6741', textDecoration: 'none' }}>
                  ✅ Approved — visit your Venue dashboard →
                </Link>
              ) : (
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#8a6a1f' }}>
                  ⏳ Application pending approval
                </div>
              )
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
