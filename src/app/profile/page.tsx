'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import BrandLoader from '@/components/BrandLoader'
import GenrePicker from '@/components/GenrePicker'
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner'
import { useLocale } from '@/lib/i18n/translate'

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

// GEN-2608-036: `active` highlights the card someone was routed to via
// the ?role= carry-through (see the useEffect below) - a visible cue that
// this is the specific application they came here for, not just wherever
// scrollIntoView happened to land them.
const cardStyle = (active?: boolean) => ({
  background: 'var(--afa-surface-raised)',
  borderRadius: '12px',
  padding: '24px',
  border: active ? '1.5px solid var(--afa-amber)' : '1px solid rgba(245,245,240,0.08)',
  boxShadow: active ? '0 0 0 4px rgba(201,151,58,0.12)' : 'none',
  marginBottom: '16px',
  transition: 'border-color 400ms ease, box-shadow 400ms ease',
})

function ProfileContent() {
  const { t: tr } = useLocale()
  const { data: session, status, update: updateSession } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Feedback cmrzsmlus - if the person arrived here via the login
  // redirect's ?role= carry-through (originating from a landing-page
  // "Join As X" link), scroll straight to that application card instead
  // of leaving them to find it among three on the page themselves.
  //
  // GEN-2608-036: neither apply action can be fully automatic - Artist
  // needs a genre pick, Organiser needs an org name, and even Venue
  // Owner (no required field) shouldn't silently submit from a link
  // click with no confirming action from the person. So this gets as
  // close to "direct apply" as real required input allows: highlight
  // the exact card (2.5s glow, cleared after) and focus its first
  // input/button so the very next thing the person does is fill that
  // one field and hit the button, instead of scanning three cards to
  // find the one they meant.
  const [highlightedCard, setHighlightedCard] = useState<'artist' | 'organiser' | 'venue' | null>(null)
  useEffect(() => {
    const role = searchParams.get('role')
    if (role !== 'artist' && role !== 'organiser' && role !== 'venue') return
    const el = document.getElementById(`apply-${role}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightedCard(role)
    const focusTimer = setTimeout(() => {
      const focusable = el.querySelector<HTMLElement>('input, button')
      focusable?.focus()
    }, 500)
    const clearTimer = setTimeout(() => setHighlightedCard(null), 2500)
    return () => {
      clearTimeout(focusTimer)
      clearTimeout(clearTimer)
    }
  }, [searchParams])

  const [orgStatus, setOrgStatus] = useState<RoleStatus | null>(null)
  const [venueStatus, setVenueStatus] = useState<RoleStatus | null>(null)
  const [artistStatus, setArtistStatus] = useState<RoleStatus | null>(null)
  const [orgName, setOrgName] = useState('')
  const [genre, setGenre] = useState<string[]>([])
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

  // Feedback cms(profile name-flash) - the heading used to fall back to
  // the login username (available instantly from the session) while
  // /api/users/me was still in flight, then swap to the real display
  // name once it landed - a visible flash on every page load. Not a
  // cross-user leak (confirmed both values always belong to the same
  // signed-in user), just a loading-order issue. This flag lets the
  // heading render a neutral placeholder for that one gap instead.
  const [nameLoaded, setNameLoaded] = useState(false)

  // Display-only currency preference (Option A). Same load/save shape as
  // displayName above - separate state loaded from /api/users/me (not the
  // session cache), its own PATCH, its own saving flag. Real settlement
  // stays INR always; this only changes how amounts are *shown* to this
  // user - see src/lib/money-display.ts.
  const [currencies, setCurrencies] = useState<{ code: string; label: string; symbol: string }[]>([])
  const [displayCurrency, setDisplayCurrency] = useState('INR')
  const [initialDisplayCurrency, setInitialDisplayCurrency] = useState('INR')
  const [savingCurrency, setSavingCurrency] = useState(false)

  // "About You" - optional photo + short bio (session 62, design.md §9.5).
  // Same load/save shape as displayName/displayCurrency above: loaded from
  // /api/users/me, its own PATCH, its own saving flag. Never required -
  // this closes the gap where a person's name+photo already show publicly
  // in ratings/feedback today but there's nowhere to add context to them.
  const [avatar, setAvatar] = useState('')
  const [initialAvatar, setInitialAvatar] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [bio, setBio] = useState('')
  const [initialBio, setInitialBio] = useState('')
  const [savingAbout, setSavingAbout] = useState(false)

  // Live preview for the "My Feedback" card below (2 Aug, Hitesh) -
  // previously a static link with no indication of what's actually in
  // there. Reuses /api/feedback/mine (same data as the full page) but
  // only needs counts here, not the full list.
  const [feedbackSummary, setFeedbackSummary] = useState<{ total: number; open: number } | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const loadStatuses = async () => {
    const [meRes, orgRes, venueRes, artistRes, currenciesRes, feedbackRes] = await Promise.all([
      fetch('/api/users/me'),
      fetch('/api/organisers/status'),
      fetch('/api/venue-owners/status'),
      fetch('/api/artists/status'),
      fetch('/api/display-currencies'),
      fetch('/api/feedback/mine'),
    ])
    if (meRes.ok) {
      const d = await meRes.json()
      const current = d.user?.displayName ?? ''
      setDisplayName(current)
      setInitialDisplayName(current)
      const currentCurrency = d.user?.displayCurrency ?? 'INR'
      setDisplayCurrency(currentCurrency)
      setInitialDisplayCurrency(currentCurrency)
      const currentAvatar = d.user?.avatar ?? ''
      setAvatar(currentAvatar)
      setInitialAvatar(currentAvatar)
      const currentBio = d.user?.bio ?? ''
      setBio(currentBio)
      setInitialBio(currentBio)
    }
    // Set regardless of meRes.ok - if the fetch failed we still want to
    // stop showing the placeholder and fall through to the username,
    // rather than leaving the heading blank forever.
    setNameLoaded(true)
    if (currenciesRes.ok) {
      const d = await currenciesRes.json()
      setCurrencies(d.currencies ?? [])
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
    if (feedbackRes.ok) {
      const d = await feedbackRes.json()
      const items: { status: string }[] = d.items ?? []
      const open = items.filter((it) => it.status !== 'RESOLVED' && it.status !== 'REJECTED').length
      setFeedbackSummary({ total: items.length, open })
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
      if (!res.ok) throw new Error(data.error || tr.profilePage.genericSaveFailed)
      setInitialDisplayName(data.user?.displayName ?? '')
      setMessage(tr.profilePage.displayNameSaved)
      await updateSession()
    } catch (err: any) {
      setError(err.message || tr.profilePage.genericSaveFailed)
    } finally {
      setSavingName(false)
    }
  }

  const saveDisplayCurrency = async () => {
    setSavingCurrency(true)
    setMessage('')
    setError('')
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayCurrency }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || tr.profilePage.genericSaveFailed)
      const saved = data.user?.displayCurrency ?? 'INR'
      setDisplayCurrency(saved)
      setInitialDisplayCurrency(saved)
      setMessage(tr.profilePage.displayCurrencySaved)
    } catch (err: any) {
      setError(err.message || tr.profilePage.genericSaveFailed)
    } finally {
      setSavingCurrency(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return
    setUploadingAvatar(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload/avatar', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || tr.profilePage.uploadFailed)
        return
      }
      setAvatar(data.url)
    } catch {
      setError(tr.profilePage.uploadFailed)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const saveAbout = async () => {
    setSavingAbout(true)
    setMessage('')
    setError('')
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: avatar.trim() || null, bio: bio.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || tr.profilePage.genericSaveFailed)
      setInitialAvatar(data.user?.avatar ?? '')
      setInitialBio(data.user?.bio ?? '')
      setMessage(tr.profilePage.aboutYouSaved)
      await updateSession()
    } catch (err: any) {
      setError(err.message || tr.profilePage.genericSaveFailed)
    } finally {
      setSavingAbout(false)
    }
  }

  useEffect(() => {
    if (session?.user) loadStatuses()
  }, [session])

  // s60-profile-status-stale-no-refetch: loadStatuses only ran on
  // useEffect([session]) - the NextAuth session object doesn't change on
  // ordinary navigation, so a user sitting on this page when their
  // org/venue/artist application gets approved elsewhere saw stale
  // "pending" until a hard refresh or re-login. Refetch on window focus
  // and tab visibility change closes that gap without polling - picks up
  // the change the next time they actually look at the tab, which is
  // when it matters.
  useEffect(() => {
    if (!session?.user) return
    const handleFocus = () => loadStatuses()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadStatuses()
    }
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [session])

  // BUG-2608-020: submitting via the SupportWidget is an in-page overlay,
  // not a real navigation/focus change, so the focus/visibility refetch
  // above never fired for it. The widget broadcasts this event on a
  // successful submit; just reuse the same loadStatuses() the other
  // refetch paths already use so the "My Feedback" count updates without
  // a full reload.
  useEffect(() => {
    if (!session?.user) return
    const handleFeedbackSubmitted = () => loadStatuses()
    window.addEventListener('afa:feedback-submitted', handleFeedbackSubmitted)
    return () => window.removeEventListener('afa:feedback-submitted', handleFeedbackSubmitted)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  const applyOrganiser = async () => {
    if (!orgName.trim()) {
      setError(tr.profilePage.enterOrgNameFirst)
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
      if (!res.ok) throw new Error(data.error || tr.profilePage.submitApplicationFailed)
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
      if (!res.ok) throw new Error(data.error || tr.profilePage.submitApplicationFailed)
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
      if (!res.ok) throw new Error(data.error || tr.profilePage.submitApplicationFailed)
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
      return <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-gold)' }}>{tr.profilePage.pendingApproval}</div>
    }
    if (roleStatus.isActive) {
      return (
        <Link href={DASHBOARD_PATH[kind]} style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-sage)', textDecoration: 'none' }}>
          {tr.profilePage.visitDashboardTemplate.replace('{label}', label)}
        </Link>
      )
    }
    return (
      <button
        onClick={() => switchRole(kind)}
        disabled={switching === kind}
        style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-amber)', background: 'transparent', border: '1.5px solid var(--afa-amber)', borderRadius: '8px', padding: '9px 18px', cursor: switching === kind ? 'default' : 'pointer', opacity: switching === kind ? 0.6 : 1 }}
      >
        {switching === kind ? tr.profilePage.switchingEllipsis : tr.profilePage.approvedSwitchTemplate.replace('{label}', label)}
      </button>
    )
  }

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '48px 24px' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: '4px' }}>
            {nameLoaded ? (initialDisplayName || user?.name || tr.profilePage.fallbackTitle) : '\u00A0'}
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: '4px' }}>{user?.email}</p>
          {user?.code && (
            <p style={{ fontSize: '13px', color: 'var(--afa-text-primary)', opacity: 0.5, marginBottom: '32px', fontFamily: 'monospace' }}>
              {tr.profilePage.loginCodeLabel}<span style={{ fontWeight: 700, letterSpacing: '0.03em' }}>{user.code}</span>
            </p>
          )}

          {message && (
            <SuccessBanner style={{ marginBottom: '20px' }}>{message}</SuccessBanner>
          )}
          {error && (
            <ErrorBanner style={{ marginBottom: '20px' }}>{error}</ErrorBanner>
          )}

          {/* Display name — separate from the login username. Shows on
              tickets, emails, and greetings. Falls back to username if
              blank, so existing users see no change until they set one. */}
          <div style={cardStyle()}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: '6px' }}>
              {tr.profilePage.displayNameHeading}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: '16px' }}>
              {tr.profilePage.displayNameDescPrefix}<strong>{user?.name}</strong>{tr.profilePage.displayNameDescSuffix}
            </p>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={nameLoaded ? tr.profilePage.namePlaceholderLoaded : tr.profilePage.namePlaceholderLoading}
              disabled={!nameLoaded}
              maxLength={120}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(245,245,240,0.15)',
                fontSize: '14px',
                marginBottom: '12px',
                boxSizing: 'border-box' as const,
                opacity: nameLoaded ? 1 : 0.5,
                cursor: nameLoaded ? 'text' : 'default',
              }}
            />
            <button
              onClick={saveDisplayName}
              disabled={savingName || displayName.trim() === initialDisplayName.trim()}
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--afa-on-fill-solid)',
                background: 'var(--afa-amber)',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                cursor: savingName || displayName.trim() === initialDisplayName.trim() ? 'default' : 'pointer',
                opacity: savingName || displayName.trim() === initialDisplayName.trim() ? 0.5 : 1,
              }}
            >
              {savingName ? tr.profilePage.savingEllipsis : tr.profilePage.saveDisplayNameBtn}
            </button>
          </div>

          {/* "About You" - optional photo + short bio (session 62,
              design.md §9.5). Never required. Shown wherever this
              account's name/photo already surface publicly, e.g.
              ratings and feedback on events. */}
          <div style={cardStyle()}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: '6px' }}>
              {tr.profilePage.aboutYouHeading}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: '16px' }}>
              {tr.profilePage.aboutYouDesc}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '14px' }}>
              {avatar && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt={tr.profilePage.profilePreviewAlt} style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(245,245,240,0.1)' }} />
              )}
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--afa-on-fill-solid)', background: 'var(--afa-amber)', padding: '9px 16px', borderRadius: '8px', cursor: uploadingAvatar ? 'default' : 'pointer', opacity: uploadingAvatar ? 0.6 : 1 }}>
                {uploadingAvatar ? tr.profilePage.uploadingLabel : avatar ? tr.profilePage.changePhotoLabel : tr.profilePage.uploadPhotoLabel}
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarUpload} disabled={uploadingAvatar} style={{ display: 'none' }} />
              </label>
            </div>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder={tr.profilePage.bioPlaceholder}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(245,245,240,0.15)', fontSize: '14px', marginBottom: '12px', boxSizing: 'border-box' as const, resize: 'vertical' as const, fontFamily: 'inherit' }}
            />
            <button
              onClick={saveAbout}
              disabled={savingAbout || (avatar === initialAvatar && bio === initialBio)}
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--afa-on-fill-solid)',
                background: 'var(--afa-amber)',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                cursor: savingAbout || (avatar === initialAvatar && bio === initialBio) ? 'default' : 'pointer',
                opacity: savingAbout || (avatar === initialAvatar && bio === initialBio) ? 0.5 : 1,
              }}
            >
              {savingAbout ? tr.profilePage.savingEllipsis : tr.profilePage.saveBtn}
            </button>
          </div>

          {/* Display-only currency preference (Option A). Real settlement
              stays INR always - this only changes how amounts are shown
              to this user (event prices, checkout totals). */}
          <div style={cardStyle()}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: '6px' }}>
              {tr.profilePage.displayCurrencyHeading}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: '16px' }}>
              {tr.profilePage.displayCurrencyDesc}
            </p>
            <select
              value={displayCurrency}
              onChange={(e) => setDisplayCurrency(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(245,245,240,0.15)', fontSize: '14px', marginBottom: '12px', boxSizing: 'border-box' as const, background: 'var(--afa-surface-raised)', color: 'var(--afa-text-primary)' }}
            >
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol} {c.label} ({c.code})
                </option>
              ))}
            </select>
            <button
              onClick={saveDisplayCurrency}
              disabled={savingCurrency || displayCurrency === initialDisplayCurrency}
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--afa-on-fill-solid)',
                background: 'var(--afa-amber)',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                cursor: savingCurrency || displayCurrency === initialDisplayCurrency ? 'default' : 'pointer',
                opacity: savingCurrency || displayCurrency === initialDisplayCurrency ? 0.5 : 1,
              }}
            >
              {savingCurrency ? tr.profilePage.savingEllipsis : tr.profilePage.saveCurrencyBtn}
            </button>
          </div>

          {/* Artist upgrade - no approval needed, unlike Organiser/Venue Owner below */}
          <div id="apply-artist" style={cardStyle(highlightedCard === 'artist')}>
            <p style={{ fontSize: '13px', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: '16px' }}>
              {tr.profilePage.artistUpgradeDesc}
            </p>

            {artistStatus?.hasProfile ? (
              renderRoleStatus(artistStatus, 'artist', tr.profilePage.roleLabelArtist)
            ) : (
              <>
                <div style={{ marginBottom: '12px' }}>
                  <GenrePicker value={genre} onChange={setGenre} />
                </div>
                <button
                  onClick={applyArtist}
                  disabled={applying === 'artist'}
                  style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-on-fill-solid)', background: 'var(--afa-amber)', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', opacity: applying === 'artist' ? 0.6 : 1 }}
                >
                  {applying === 'artist' ? tr.profilePage.settingUpEllipsis : tr.profilePage.becomeArtistBtn}
                </button>
              </>
            )}
          </div>

          {/* Organiser upgrade */}
          <div id="apply-organiser" style={cardStyle(highlightedCard === 'organiser')}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: '6px' }}>
              {tr.profilePage.becomeOrganiserHeading}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: '16px' }}>
              {tr.profilePage.becomeOrganiserDesc}
            </p>

            {orgStatus?.hasProfile ? (
              renderRoleStatus(orgStatus, 'organiser', tr.profilePage.roleLabelOrganiser)
            ) : (
              <>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder={tr.profilePage.orgNamePlaceholder}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(245,245,240,0.15)', fontSize: '14px', marginBottom: '12px', boxSizing: 'border-box' as const }}
                />
                <button
                  onClick={applyOrganiser}
                  disabled={applying === 'organiser'}
                  style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-on-fill-solid)', background: 'var(--afa-amber)', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', opacity: applying === 'organiser' ? 0.6 : 1 }}
                >
                  {applying === 'organiser' ? tr.profilePage.submittingEllipsis : tr.profilePage.applyBtn}
                </button>
              </>
            )}
          </div>

          {/* Venue Owner upgrade */}
          <div id="apply-venue" style={cardStyle(highlightedCard === 'venue')}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: '6px' }}>
              {tr.profilePage.listVenueHeading}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: '16px' }}>
              {tr.profilePage.listVenueDesc}
            </p>

            {venueStatus?.hasProfile ? (
              renderRoleStatus(venueStatus, 'venue', tr.profilePage.roleLabelVenue)
            ) : (
              <button
                onClick={applyVenueOwner}
                disabled={applying === 'venue'}
                style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-on-fill-solid)', background: 'var(--afa-amber)', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', opacity: applying === 'venue' ? 0.6 : 1 }}
              >
                {applying === 'venue' ? tr.profilePage.submittingEllipsis : tr.profilePage.applyBtn}
              </button>
            )}
          </div>

          {/* My Feedback link (session 63) was structurally placed OUTSIDE
              this maxWidth wrapper - the wrapper's closing </div> used to
              sit right here, before the Link, making it a sibling of this
              whole centered column instead of the last card inside it.
              Rendered full-page-width instead of matching every other
              card (caught live by Hitesh, 2 Aug - "UI/UX not
              convincing"). Fixed by moving the close to after the Link. */}
          <Link
            href="/my-feedback"
            style={{
              display: 'block',
              ...cardStyle(),
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div>
                <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: '4px' }}>
                  {tr.profilePage.myFeedbackHeading}
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--afa-text-primary)', opacity: 0.6, margin: 0 }}>
                  {feedbackSummary === null
                    ? tr.profilePage.feedbackSummaryDefault
                    : feedbackSummary.total === 0
                      ? tr.profilePage.feedbackSummaryNone
                      : tr.profilePage.feedbackSummaryReportedTemplate.replace('{total}', String(feedbackSummary.total))
                        + (feedbackSummary.open > 0
                          ? tr.profilePage.feedbackOpenSuffix.replace('{n}', String(feedbackSummary.open))
                          : tr.profilePage.feedbackAllResolvedSuffix)
                        + tr.profilePage.arrowSuffix}
                </p>
              </div>
              {feedbackSummary !== null && feedbackSummary.open > 0 && (
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'var(--afa-on-fill-solid)',
                    background: 'var(--afa-amber)',
                    borderRadius: '999px',
                    padding: '4px 12px',
                  }}
                >
                  {feedbackSummary.open}
                </span>
              )}
            </div>
          </Link>
        </div>
      </main>
    </>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<BrandLoader />}>
      <ProfileContent />
    </Suspense>
  )
}
