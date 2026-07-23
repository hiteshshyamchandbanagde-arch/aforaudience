'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import BrandLoader from '@/components/BrandLoader'

type RoleStatus = { hasProfile: boolean; isApproved: boolean; isActive: boolean }

const DASHBOARD_PATH: Record<'artist' | 'organiser' | 'venue', string> = {
  artist: '/dashboard/artist',
  organiser: '/dashboard/organiser',
  venue: '/dashboard/venue',
}
const SWITCH_ROLE_VALUE: Record<'artist' | 'organiser' | 'venue', string> = {
  artist: 'ARTIST',
  organiser: 'ORGANISER',
  venue: 'VENUE_OWNER',
}

const cardStyle = {
  background: 'var(--afa-white)',
  borderRadius: '12px',
  padding: '24px',
  border: '1px solid rgba(14,12,10,0.08)',
  marginBottom: '16px',
}

export default function ProfilePage() {
  const { data: session, status, update: updateSession } = useSession()
  const router = useRouter()

  const [orgStatus, setOrgStatus] = useState<RoleStatus | null>(null)
  const [venueStatus, setVenueStatus] = useState<RoleStatus | null>(null)
  const [artistStatus, setArtistStatus] = useState<RoleStatus | null>(null)
  const [orgName, setOrgName] = useState('')
  const [genre, setGenre] = useState('')
  const [applying, setApplying] = useState<'organiser' | 'venue' | 'artist' | null>(null)
  const [switching, setSwitching] = useState<'organiser' | 'venue' | 'artist' | null>(null)
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
      setOrgStatus({ hasProfile: d.hasProfile, isApproved: d.isApproved, isActive: d.isActive })
    }
    if (venueRes.ok) {
      const d = await venueRes.json()
      setVenueStatus({ hasProfile: d.hasProfile, isApproved: d.isApproved, isActive: d.isActive })
    }
    if (artistRes.ok) {
      const d = await artistRes.json()
      setArtistStatus({ hasProfile: d.hasProfile, isApproved: d.isApproved, isActive: d.isActive })
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
      await updateSession()
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
      await updateSession()
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
      await updateSession()
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
      await updateSession()
      await loadStatuses()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setApplying(null)
    }
  }

  // Switches the active role to one the user already holds an approved
  // profile for - the second half of multi-role support. Applying never
  // silently changes the active role past the first-role case; this is
  // the explicit action that does, and only for roles already approved.
  const switchRole = async (kind: 'organiser' | 'venue' | 'artist') => {
    setSwitching(kind)
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/users/me/switch-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: SWITCH_ROLE_VALUE[kind] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to switch role')
      await updateSession()
      router.push(DASHBOARD_PATH[kind])
    } catch (err: any) {
      setError(err.message)
      setSwitching(null)
    }
  }

  if (status === 'loading') return (<><SiteNav /><BrandLoader /></>)
  if (!session) return <SiteNav />

  const user = session.user as { name?: string | null; email?: string | null; code?: string | null }

  // Small, reusable status block covering the four states any of the
  // three role cards below can be in: no profile, pending approval,
  // active (visit its own dashboard), or approved-but-not-active (switch
  // to it). Artist never has a pending state (isApproved always true once
  // hasProfile is true).
  const renderRoleStatus = (
    roleStatus: RoleStatus | null,
    kind: 'organiser' | 'venue' | 'artist',
    label: string
  ) => {
    if (!roleStatus?.hasProfile) return null
    if (!roleStatus.isApproved) {
      return <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-gold)' }}>⏳ Application pending approval</div>
    }
    if (roleStatus.isActive) {
      return (
        <Link href={DASHBOARD_PATH[kind]} style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-sage)', textDecoration: 'none' }}>
          ✅ Visit your {label} dashboard →
        </Link>
      )
    }
    return (
      <button
        onClick={() => switchRole(kind)}
        disabled={switching === kind}
        style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-terracotta)', background: 'transparent', border: '1.5px solid var(--afa-terracotta)', borderRadius: '8px', padding: '9px 18px', cursor: switching === kind ? 'default' : 'pointer', opacity: switching === kind ? 0.6 : 1 }}
      >
        {switching === kind ? 'Switching...' : `✅ Approved — Switch to your ${label} dashboard`}
      </button>
    )
  }

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: 'var(--afa-cream)', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '48px 24px' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '4px' }}>
            {initialDisplayName || user?.name || 'Your Profile'}
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '4px' }}>{user?.email}</p>
          {user?.code && (
            <p style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.5, marginBottom: '32px', fontFamily: 'monospace' }}>
              Your login code: <span style={{ fontWeight: 700, letterSpacing: '0.03em' }}>{user.code}</span>
            </p>
          )}

          {message && (
            <div style={{ padding: '14px 16px', background: 'var(--afa-success-bg)', border: '1px solid #68D391', borderRadius: '8px', color: 'var(--afa-green-dark)', fontSize: '14px', marginBottom: '20px' }}>
              {message}
            </div>
          )}
          {error && (
            <div style={{ padding: '14px 16px', background: 'var(--afa-error-bg)', border: '1px solid var(--afa-error-border)', borderRadius: '8px', color: 'var(--afa-error)', fontSize: '14px', marginBottom: '20px' }}>
              {error}
            </div>
          )}

          {/* Display name — separate from the login username. Shows on
              tickets, emails, and greetings. Falls back to username if
              blank, so existing users see no change until they set one. */}
          <div style={cardStyle}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '6px' }}>
              Display name
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '16px' }}>
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
                background: 'var(--afa-terracotta)',
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
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '6px' }}>
              I&apos;m an Artist
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '16px' }}>
              Get discovered, apply to perform at events, and track your growth. Goes live immediately, no approval wait.
            </p>

            {artistStatus?.hasProfile ? (
              renderRoleStatus(artistStatus, 'artist', 'Artist')
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
                  style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-cream)', background: 'var(--afa-terracotta)', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', opacity: applying === 'artist' ? 0.6 : 1 }}
                >
                  {applying === 'artist' ? 'Setting up...' : 'Become an Artist'}
                </button>
              </>
            )}
          </div>

          {/* Organiser upgrade */}
          <div style={cardStyle}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '6px' }}>
              Become an Organiser
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '16px' }}>
              Create and publish your own events.
            </p>

            {orgStatus?.hasProfile ? (
              renderRoleStatus(orgStatus, 'organiser', 'Organiser')
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
                  style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-cream)', background: 'var(--afa-terracotta)', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', opacity: applying === 'organiser' ? 0.6 : 1 }}
                >
                  {applying === 'organiser' ? 'Submitting...' : 'Apply'}
                </button>
              </>
            )}
          </div>

          {/* Venue Owner upgrade */}
          <div style={cardStyle}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '6px' }}>
              List Your Venue
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '16px' }}>
              Rent out your space and manage bookings.
            </p>

            {venueStatus?.hasProfile ? (
              renderRoleStatus(venueStatus, 'venue', 'Venue')
            ) : (
              <button
                onClick={applyVenueOwner}
                disabled={applying === 'venue'}
                style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-cream)', background: 'var(--afa-terracotta)', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', opacity: applying === 'venue' ? 0.6 : 1 }}
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
