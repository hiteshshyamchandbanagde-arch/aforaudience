'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import BackLink from '@/components/BackLink'
import BrandLoader from '@/components/BrandLoader'
import { useToast } from '@/components/Toast'

// /dashboard/admin/artists — session 56, Hitesh's request: a roster view
// with the real signals needed to make Featured/Headliner calls (gigs
// performed, Hype Score, time in scene, organiser avg rating, etc.) rather
// than checking each artist's profile individually or querying the DB
// directly. Featured is fully automatic (see src/lib/scene-status.ts);
// Headliner is the only admin action here, deliberately manual/earned, not
// formula-driven. Poll result (Audience Choice, §6) isn't built yet (step
// 9 of the reputation epic) - omitted until that lands.

interface ArtistRow {
  id: string
  name: string
  avatar: string | null
  sceneStatus: 'NEW_EMERGING' | 'RISING' | 'FEATURED' | 'HEADLINER'
  gigsPerformed: number
  firstGigDate: string | null
  hypeScore: number | null
  hypeScoreShowsUsed: number
  organiserAvgRating: number | null
  organiserRatingCount: number
  verifiedAttendees: number
  repeatAttendees: number
  featuredOrganiserCount: number
  featuredVouchThreshold: number
  isSceneStatusHeadliner: boolean
  headlinerNote: string | null
}

type SortKey = 'name' | 'gigsPerformed' | 'hypeScore' | 'firstGigDate' | 'organiserAvgRating' | 'verifiedAttendees' | 'featuredOrganiserCount'

const TIER_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  NEW_EMERGING: { label: 'New / Emerging', bg: 'rgba(14,12,10,0.06)', color: 'rgba(14,12,10,0.5)' },
  RISING: { label: 'Rising', bg: 'rgba(74,103,65,0.12)', color: 'var(--afa-sage)' },
  FEATURED: { label: 'Featured', bg: 'rgba(201,151,58,0.15)', color: 'var(--afa-gold)' },
  HEADLINER: { label: '★ Headliner', bg: 'var(--afa-gold)', color: 'var(--afa-plum-black)' },
}

function timeInScene(firstGigDate: string | null): string {
  if (!firstGigDate) return 'No shows yet'
  const months = Math.floor((Date.now() - new Date(firstGigDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
  if (months < 1) return 'Under a month'
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`
  const years = Math.floor(months / 12)
  const remMonths = months % 12
  return remMonths > 0 ? `${years}y ${remMonths}mo` : `${years} year${years === 1 ? '' : 's'}`
}

export default function AdminArtistsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [roster, setRoster] = useState<ArtistRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('gigsPerformed')
  const [sortDesc, setSortDesc] = useState(true)
  const [tierFilter, setTierFilter] = useState('')
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({})
  const [expandedNote, setExpandedNote] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const fetchRoster = useCallback(async (q: string) => {
    try {
      const params = new URLSearchParams()
      if (q) params.set('search', q)
      const res = await fetch(`/api/admin/artists?${params.toString()}`)
      if (!res.ok) {
        if (res.status === 403) throw new Error('You do not have access to this page')
        throw new Error('Could not load artist roster')
      }
      const json = await res.json()
      setRoster(json.roster)
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
    fetchRoster(search)
  }, [status, fetchRoster]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    fetchRoster(search)
  }

  const handleHeadlinerToggle = async (artist: ArtistRow) => {
    const granting = !artist.isSceneStatusHeadliner
    if (granting) {
      const ok = confirm(`Grant ${artist.name} Headliner status? This is meant to be earned deliberately, not automatic.`)
      if (!ok) return
    } else {
      const ok = confirm(`Remove ${artist.name}'s Headliner status?`)
      if (!ok) return
    }
    setActioningId(artist.id)
    try {
      const res = await fetch(`/api/admin/artists/${artist.id}/headliner`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headliner: granting, note: granting ? (noteDraft[artist.id] || '') : undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      showToast(granting ? `${artist.name} is now a Headliner.` : `Headliner status removed.`, 'success')
      await fetchRoster(search)
    } catch (err: any) {
      showToast(err.message || 'Update failed', 'error')
    } finally {
      setActioningId(null)
    }
  }

  const filtered = tierFilter ? roster.filter((a) => a.sceneStatus === tierFilter) : roster
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
    else if (sortKey === 'firstGigDate') cmp = (a.firstGigDate || '').localeCompare(b.firstGigDate || '')
    else {
      const av = (a[sortKey] as number | null) ?? -Infinity
      const bv = (b[sortKey] as number | null) ?? -Infinity
      cmp = av - bv
    }
    return sortDesc ? -cmp : cmp
  })

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc((d) => !d)
    else {
      setSortKey(key)
      setSortDesc(true)
    }
  }

  const sortButton = (key: SortKey, label: string) => (
    <button
      onClick={() => toggleSort(key)}
      style={{
        background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
        fontSize: '11px', fontWeight: 700, color: sortKey === key ? 'var(--afa-terracotta)' : 'rgba(14,12,10,0.4)',
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}
    >
      {label}{sortKey === key ? (sortDesc ? ' ↓' : ' ↑') : ''}
    </button>
  )

  if (status === 'loading' || (loading && roster.length === 0)) return (<><SiteNav /><BrandLoader /></>)
  if (!session) return <SiteNav />

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: 'var(--afa-cream)', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '48px 24px 96px' }}>
          <BackLink href="/dashboard/admin/feedback" label="Back to Dashboard" />

          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '30px', fontWeight: 700, color: 'var(--afa-ink)', marginTop: '12px', marginBottom: '8px' }}>
            🎤 Artist Roster
          </h1>
          <p style={{ fontSize: '13px', color: 'rgba(14,12,10,0.6)', marginBottom: '20px', maxWidth: '680px' }}>
            Rising and Featured are fully automatic — thresholds live at{' '}
            <Link href="/dashboard/admin/settings" style={{ color: 'var(--afa-terracotta)', fontWeight: 700 }}>Platform Settings</Link>.
            Headliner is the one manual call here — deliberately not a formula. Organiser ratings are private everywhere except this page, where they're shown to inform your decision.
          </p>

          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search artist name..."
              style={{ flex: '1 1 220px', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(14,12,10,0.15)', fontSize: '14px' }}
            />
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(14,12,10,0.15)', fontSize: '14px' }}
            >
              <option value="">All tiers</option>
              {Object.entries(TIER_STYLE).map(([key, s]) => (
                <option key={key} value={key}>{s.label}</option>
              ))}
            </select>
            <button type="submit" style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: 'var(--afa-terracotta)', color: 'var(--afa-white)', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
              Search
            </button>
          </form>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap', padding: '0 4px' }}>
            {sortButton('name', 'Name')}
            {sortButton('gigsPerformed', 'Gigs')}
            {sortButton('hypeScore', 'Hype Score')}
            {sortButton('firstGigDate', 'Time in Scene')}
            {sortButton('organiserAvgRating', 'Organiser Rating')}
            {sortButton('verifiedAttendees', 'Verified Attendees')}
            {sortButton('featuredOrganiserCount', 'Featured Progress')}
          </div>

          {error && <div style={{ fontSize: '13px', color: 'var(--afa-error)', marginBottom: '16px' }}>{error}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {sorted.length === 0 && !loading && (
              <p style={{ fontSize: '14px', color: 'rgba(14,12,10,0.5)' }}>No artists match.</p>
            )}
            {sorted.map((a) => {
              const tier = TIER_STYLE[a.sceneStatus]
              return (
                <div
                  key={a.id}
                  style={{
                    background: 'var(--afa-white)', borderRadius: '10px', padding: '16px',
                    border: a.isSceneStatusHeadliner ? '1px solid var(--afa-gold)' : '1px solid rgba(14,12,10,0.08)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: a.avatar ? `url(${a.avatar}) center/cover` : 'var(--afa-plum-black)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, flexShrink: 0 }}>
                        {!a.avatar && a.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--afa-ink)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {a.name}
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px', background: tier.bg, color: tier.color, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            {tier.label}
                          </span>
                        </p>
                        <p style={{ fontSize: '12px', color: 'rgba(14,12,10,0.5)', marginTop: '2px' }}>
                          {timeInScene(a.firstGigDate)} in the scene
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                      {a.isSceneStatusHeadliner ? (
                        <button
                          onClick={() => handleHeadlinerToggle(a)}
                          disabled={actioningId === a.id}
                          style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid var(--afa-terracotta)', background: 'var(--afa-white)', color: 'var(--afa-terracotta)', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                        >
                          Remove Headliner
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <input
                            value={noteDraft[a.id] || ''}
                            onChange={(e) => setNoteDraft({ ...noteDraft, [a.id]: e.target.value })}
                            placeholder="Reason (optional)..."
                            style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid rgba(14,12,10,0.15)', fontSize: '12px', width: '160px' }}
                          />
                          <button
                            onClick={() => handleHeadlinerToggle(a)}
                            disabled={actioningId === a.id}
                            style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', background: 'var(--afa-gold)', color: 'var(--afa-plum-black)', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                          >
                            ★ Grant Headliner
                          </button>
                        </div>
                      )}
                      {a.headlinerNote && (
                        <button
                          onClick={() => setExpandedNote(expandedNote === a.id ? null : a.id)}
                          style={{ background: 'transparent', border: 'none', color: 'rgba(14,12,10,0.4)', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          {expandedNote === a.id ? 'Hide note' : 'View note'}
                        </button>
                      )}
                    </div>
                  </div>

                  {expandedNote === a.id && a.headlinerNote && (
                    <p style={{ fontSize: '12px', color: 'var(--afa-ink)', opacity: 0.7, marginTop: '10px', padding: '8px 10px', background: 'rgba(201,151,58,0.08)', borderRadius: '6px' }}>
                      &quot;{a.headlinerNote}&quot;
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(14,12,10,0.06)' }}>
                    <Stat label="Gigs Performed" value={a.gigsPerformed} />
                    <Stat
                      label="Hype Score"
                      value={a.hypeScore !== null ? `🔥 ${a.hypeScore}` : '—'}
                      sub={a.hypeScore !== null ? `${a.hypeScoreShowsUsed} recent show${a.hypeScoreShowsUsed === 1 ? '' : 's'}` : 'Not enough scored shows'}
                    />
                    <Stat
                      label="Organiser Rating"
                      value={a.organiserAvgRating !== null ? `${a.organiserAvgRating.toFixed(1)} / 5` : '—'}
                      sub={a.organiserRatingCount > 0 ? `${a.organiserRatingCount} rating${a.organiserRatingCount === 1 ? '' : 's'}` : 'No ratings yet'}
                    />
                    <Stat
                      label="Verified Attendees"
                      value={a.verifiedAttendees}
                      sub={a.repeatAttendees > 0 ? `${a.repeatAttendees} repeat` : undefined}
                    />
                    <Stat
                      label="Featured Progress"
                      value={`${a.featuredOrganiserCount} / ${a.featuredVouchThreshold}`}
                      sub="distinct organisers"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </>
  )
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: '17px', fontWeight: 700, color: 'var(--afa-ink)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '10px', color: 'var(--afa-ink)', opacity: 0.45, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '3px' }}>
        {label}{sub && <span style={{ opacity: 0.7, textTransform: 'none', letterSpacing: 0 }}> · {sub}</span>}
      </div>
    </div>
  )
}
