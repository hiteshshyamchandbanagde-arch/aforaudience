'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'
import SiteNav from '@/components/SiteNav'
import { useToast } from '@/components/Toast'
import FeedbackTrends from '@/components/admin/FeedbackTrends'
import FeedbackDetailPanel, { type FeedbackDetailItem } from '@/components/admin/FeedbackDetailPanel'
import BrandLoader from '@/components/BrandLoader'

// /dashboard/admin/feedback — Admin Dashboard v1 (design.md §9.1)
//
// Evolves the original simple filtered list into a real feature/bug/idea
// tracker: board view (desktop) / filterable stacked list (mobile),
// category/severity/page/keyword filtering, trend charts, a detail panel
// with changelog history, and self-serve status+severity editing.
//
// Data loading is split into three pieces so the "Show Resolved /
// Rejected" toggle stays a genuine lazy fetch rather than always
// loading everything:
//   - `items`         → everything except RESOLVED/REJECTED (the API's
//                       default, no status param), loaded on mount
//   - `resolvedItems` → RESOLVED + REJECTED (both terminal/closed
//                       states), loaded the first time the toggle is
//                       switched on, cached after that
//   - `trendItems`    → everything (status=ALL), loaded once on mount in
//                       the background - trend charts need the full
//                       picture regardless of what's toggled on screen
//
// Category/severity/page/keyword filtering + sorting stay client-side -
// same reasoning as the original page: the dataset is small at MVP
// volume, no server round-trip needed for that part.

type FeedbackItem = FeedbackDetailItem

interface PendingItem {
  id: string
  orgName?: string
  bio?: string | null
  createdAt: string
  user: { name: string | null; email: string | null; createdAt: string }
}

interface GenreRequestItem {
  id: string
  value: string
  createdAt: string
}

interface EventNoteItem {
  id: string
  title: string
  specialNotes: string | null
  date: string
  organiser: { orgName: string } | null
}

const CATEGORY_LABELS: Record<string, string> = {
  BUG: 'Bug',
  FEATURE_IDEA: 'Feature idea',
  QUESTION: 'Question',
  GENERAL: 'General',
  OTHER: 'Other',
}

const CATEGORY_COLORS: Record<string, string> = {
  BUG: 'var(--afa-error)',
  FEATURE_IDEA: 'var(--afa-sage)',
  QUESTION: 'var(--afa-terracotta)',
  GENERAL: 'var(--afa-taupe)',
  OTHER: 'var(--afa-taupe)',
}

const SEVERITY_COLORS: Record<string, string> = {
  LOW: 'var(--afa-sage)',
  MEDIUM: 'var(--afa-gold)',
  HIGH: 'var(--afa-orange-dark)',
  CRITICAL: 'var(--afa-error)',
}

// Workflow overhaul (session 63, Hitesh's design). Two-field split -
// `status` is the fix lifecycle, `deployStage` is the deploy-promotion
// pipeline (only meaningful once status = RESOLVED). CLOSED_STATUSES
// (RESOLVED + REJECTED) are lazy-loaded behind the "Show Resolved /
// Rejected" toggle, same reasoning as before: the open board is what
// gets checked constantly, closed items are an occasional lookup.
const STATUSES = [
  'NEW', 'UNDER_REVIEW', 'BUILD_QUEUE', 'IN_BUILD', 'BUILD_COMPLETE',
  'IN_TEST', 'REOPENED', 'RESOLVED', 'REJECTED',
]
const CLOSED_STATUSES = ['RESOLVED', 'REJECTED']
const DEPLOY_STAGES = ['DEPLOYED_QA', 'IN_PRODUCT', 'NOTIFIED_USER', 'CLOSED']
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

function labelize(v: string) {
  return v
    .split('_')
    .map((w) => (w === 'QA' ? 'QA' : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(' ')
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' })
}

function AdminFeedbackBoard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()

  const [items, setItems] = useState<FeedbackItem[]>([])
  const [resolvedItems, setResolvedItems] = useState<FeedbackItem[]>([])
  const [resolvedLoaded, setResolvedLoaded] = useState(false)
  const [resolvedLoading, setResolvedLoading] = useState(false)
  const [trendItems, setTrendItems] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [trendsOpen, setTrendsOpen] = useState(true)

  // Pending Approvals - merged in from the old separate /dashboard/admin
  // page (session 39, Feedback f96a1262 unification). Same
  // /api/admin/approvals GET/PATCH, just living alongside the feedback
  // tracker as one admin surface instead of two separate pages.
  const [organisers, setOrganisers] = useState<PendingItem[]>([])
  const [venueOwners, setVenueOwners] = useState<PendingItem[]>([])
  const [approvalsOpen, setApprovalsOpen] = useState(true)
  const [actioningApprovalId, setActioningApprovalId] = useState<string | null>(null)

  // Pending Genre Requests (session 39, PR #224) - "Other" genre
  // submissions awaiting approval before they become a public filter
  // option on /artists. Same collapsible pattern as Approvals/Trends.
  const [genreRequests, setGenreRequests] = useState<GenreRequestItem[]>([])
  const [genreRequestsOpen, setGenreRequestsOpen] = useState(true)
  const [actioningGenreId, setActioningGenreId] = useState<string | null>(null)

  // FEAT-2608-045 (11 Aug) - pending event "special notes" awaiting
  // review before they're shown publicly. Same collapsible pattern as
  // genre requests, but reject requires a reason (Hitesh's call).
  const [eventNotes, setEventNotes] = useState<EventNoteItem[]>([])
  const [eventNotesOpen, setEventNotesOpen] = useState(true)
  const [actioningEventNoteId, setActioningEventNoteId] = useState<string | null>(null)

  const [showResolved, setShowResolved] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [severityFilter, setSeverityFilter] = useState('ALL')
  const [pageFilter, setPageFilter] = useState('')
  const [keyword, setKeyword] = useState('')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'severity'>('newest')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (!session?.user) return
    ;(async () => {
      setLoading(true)
      const [boardRes, trendsRes, approvalsRes, genreRes, eventNotesRes] = await Promise.all([
        fetch('/api/admin/feedback'),
        fetch('/api/admin/feedback?status=ALL'),
        fetch('/api/admin/approvals'),
        fetch('/api/admin/genre-requests'),
        fetch('/api/admin/event-notes'),
      ])
      if (boardRes.status === 403) {
        setForbidden(true)
        setLoading(false)
        return
      }
      if (boardRes.ok) setItems((await boardRes.json()).items)
      if (trendsRes.ok) setTrendItems((await trendsRes.json()).items)
      if (approvalsRes.ok) {
        const approvalsData = await approvalsRes.json()
        setOrganisers(approvalsData.organisers)
        setVenueOwners(approvalsData.venueOwners)
      }
      if (genreRes.ok) setGenreRequests((await genreRes.json()).pending)
      if (eventNotesRes.ok) setEventNotes((await eventNotesRes.json()).pending)
      setLoading(false)
    })()
  }, [session])

  // Command Center deep-link (Feedback cms9ywqy4). First cut (PR #322)
  // only scrolled the desktop board to the relevant column - on mobile,
  // where the board grid is hidden and only the plain stacked list
  // (`filtered`, no status filtering at all) is visible, every tile
  // landed on the exact same screen. Caught live by Hitesh (2 Aug).
  // Fixed properly: `statusFocus` now actually filters the list
  // (mobile and desktop both read `filtered`), with a visible
  // "Showing: X · View full board" banner so it's obvious the view is
  // narrowed, and a real way back to the unfiltered board.
  const [statusFocus, setStatusFocus] = useState<string | null>(null)
  useEffect(() => {
    if (!session?.user || loading) return
    const statusParam = searchParams.get('status')
    const categoryParam = searchParams.get('category')

    if (categoryParam && Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, categoryParam)) {
      setCategoryFilter(categoryParam)
    }

    if (statusParam === 'RESOLVED' || statusParam === 'REJECTED') {
      if (!showResolved) toggleShowResolved()
      setStatusFocus(statusParam)
    } else if (statusParam && statusParam !== 'ALL' && STATUSES.includes(statusParam)) {
      setStatusFocus(statusParam)
    } else if (statusParam === 'ALL' && !showResolved) {
      // "Total reported" - reveal everything, no single-status narrowing.
      toggleShowResolved()
    }
    // Deliberately runs once the board has finished its initial load,
    // not on every searchParams/showResolved change - this is a
    // "where do I land" behavior, not a live filter sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, loading])

  const clearStatusFocus = () => {
    setStatusFocus(null)
    setCategoryFilter('ALL')
    router.replace('/dashboard/admin/feedback')
  }

  const actOnGenreRequest = async (id: string, action: 'approve' | 'reject') => {
    setActioningGenreId(id)
    try {
      const res = await fetch('/api/admin/genre-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast(data.error || 'Failed to update — please try again.', 'error')
        return
      }
      showToast(action === 'approve' ? 'Approved - now visible as a filter option on /artists.' : 'Rejected.', 'success')
      setGenreRequests((prev) => prev.filter((g) => g.id !== id))
    } catch {
      showToast('Failed to update — please try again.', 'error')
    } finally {
      setActioningGenreId(null)
    }
  }

  // FEAT-2608-045 - reject requires a reason (unlike genre requests
  // above), so the organiser knows what to fix rather than just seeing
  // their note silently never appear. window.prompt is a deliberate,
  // minimal choice here - a full modal would be disproportionate for a
  // single required text input in an admin-only moderation queue.
  const actOnEventNote = async (id: string, action: 'approve' | 'reject') => {
    let reason: string | null = null
    if (action === 'reject') {
      reason = window.prompt('Reason for rejecting this note (shown to the organiser):')
      if (reason === null) return // cancelled
      if (!reason.trim()) {
        showToast('A rejection reason is required.', 'error')
        return
      }
    }
    setActioningEventNoteId(id)
    try {
      const res = await fetch('/api/admin/event-notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, reason }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast(data.error || 'Failed to update — please try again.', 'error')
        return
      }
      showToast(action === 'approve' ? 'Approved - now visible on the event page.' : 'Rejected - organiser will see the reason.', 'success')
      setEventNotes((prev) => prev.filter((n) => n.id !== id))
    } catch {
      showToast('Failed to update — please try again.', 'error')
    } finally {
      setActioningEventNoteId(null)
    }
  }

  const actOnApproval = async (type: 'organiser' | 'venueOwner', id: string, action: 'approve' | 'reject') => {
    setActioningApprovalId(id)
    try {
      const res = await fetch('/api/admin/approvals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id, action }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast(data.error || 'Failed to update — please try again.', 'error')
        return
      }
      showToast(action === 'approve' ? 'Approved.' : 'Rejected.', 'success')
      const refreshed = await fetch('/api/admin/approvals')
      if (refreshed.ok) {
        const data = await refreshed.json()
        setOrganisers(data.organisers)
        setVenueOwners(data.venueOwners)
      }
    } catch {
      showToast('Failed to update — please try again.', 'error')
    } finally {
      setActioningApprovalId(null)
    }
  }

  const toggleShowResolved = async () => {
    const next = !showResolved
    setShowResolved(next)
    if (next && !resolvedLoaded) {
      setResolvedLoading(true)
      // Both terminal states loaded together - "Show Resolved / Rejected"
      // is one toggle, not two, since they're both "this is done, nothing
      // more to check" from a board perspective.
      const [resolvedRes, rejectedRes] = await Promise.all([
        fetch('/api/admin/feedback?status=RESOLVED'),
        fetch('/api/admin/feedback?status=REJECTED'),
      ])
      const combined: FeedbackItem[] = []
      if (resolvedRes.ok) combined.push(...(await resolvedRes.json()).items)
      if (rejectedRes.ok) combined.push(...(await rejectedRes.json()).items)
      setResolvedItems(combined)
      setResolvedLoaded(true)
      setResolvedLoading(false)
    }
  }

  const patchItem = async (id: string, body: { status?: string; deployStage?: string | null; note?: string; severity?: string | null }) => {
    setActioningId(id)
    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...body }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast(data.error || 'Update failed — please try again.', 'error')
        return
      }
      const { item: updated, changeLog: newEntries } = await res.json()
      const withChangeLog = (it: FeedbackItem) => ({
        ...it,
        ...updated,
        changeLog: newEntries && newEntries.length > 0 ? [...newEntries, ...it.changeLog] : it.changeLog,
      })

      if (body.status) {
        const current = [...items, ...resolvedItems].find((it) => it.id === id)
        if (current) {
          const movedItem = withChangeLog(current)
          if (CLOSED_STATUSES.includes(body.status)) {
            setItems((prev) => prev.filter((it) => it.id !== id))
            setResolvedItems((prev) => {
              const withoutDup = prev.filter((it) => it.id !== id)
              return resolvedLoaded ? [movedItem, ...withoutDup] : withoutDup
            })
          } else {
            setResolvedItems((prev) => prev.filter((it) => it.id !== id))
            setItems((prev) => {
              const withoutDup = prev.filter((it) => it.id !== id)
              return [movedItem, ...withoutDup]
            })
          }
        }
      } else {
        const merge = (list: FeedbackItem[]) => list.map((it) => (it.id === id ? withChangeLog(it) : it))
        setItems(merge)
        setResolvedItems(merge)
      }
      setTrendItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...updated } : it)))

      if (body.status) showToast(`Marked ${labelize(body.status)}.`, 'success')
      else if (body.deployStage !== undefined) showToast(`Deploy stage set to ${body.deployStage ? labelize(body.deployStage) : 'unset'}.`, 'success')
      else if (body.severity !== undefined) showToast(`Severity set to ${body.severity ? labelize(body.severity) : 'unset'}.`, 'success')
    } catch {
      showToast('Update failed — please try again.', 'error')
    } finally {
      setActioningId(null)
    }
  }

  const allLoadedItems = useMemo(() => {
    const map = new Map<string, FeedbackItem>()
    for (const it of items) map.set(it.id, it)
    if (showResolved) for (const it of resolvedItems) map.set(it.id, it)
    return Array.from(map.values())
  }, [items, resolvedItems, showResolved])

  const filtered = useMemo(() => {
    let list = allLoadedItems.filter((it) => {
      if (statusFocus && it.status !== statusFocus) return false
      if (categoryFilter !== 'ALL' && it.category !== categoryFilter) return false
      if (severityFilter !== 'ALL' && (it.severity || 'NONE') !== severityFilter) return false
      if (pageFilter && !(it.pageUrl || '').toLowerCase().includes(pageFilter.toLowerCase())) return false
      if (keyword) {
        const hay = `${it.title || ''} ${it.message}`.toLowerCase()
        if (!hay.includes(keyword.toLowerCase())) return false
      }
      return true
    })
    const severityRank: Record<string, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 }
    if (sortBy === 'oldest') {
      list = [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    } else if (sortBy === 'severity') {
      list = [...list].sort(
        (a, b) => (severityRank[b.severity || ''] ?? -1) - (severityRank[a.severity || ''] ?? -1)
      )
    } else {
      list = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    return list
  }, [allLoadedItems, statusFocus, categoryFilter, severityFilter, pageFilter, keyword, sortBy])

  const columns = useMemo(() => {
    const cols: Record<string, FeedbackItem[]> = Object.fromEntries(STATUSES.map((s) => [s, []]))
    for (const it of filtered) cols[it.status]?.push(it)
    return cols
  }, [filtered])

  const selectedItem = allLoadedItems.find((it) => it.id === selectedId) || null
  // Feedback (2 Aug, Hitesh): prev/next navigation within the detail
  // panel so reviewing a batch doesn't mean close -> find next card ->
  // reopen every time. Deliberately walks `filtered` (the list as
  // currently filtered/sorted on screen), not the raw loaded set - "next"
  // should mean the next thing you'd actually see, respecting whatever
  // category/severity/status/keyword filter is active. Pilot surface for
  // this pattern (modal detail view = cheapest correct implementation);
  // full-page detail views (Events/Artists/Venues) are a separate,
  // larger effort - carrying list position across a real page
  // navigation - not attempted here.
  const selectedIndex = selectedId ? filtered.findIndex((it) => it.id === selectedId) : -1
  const goToPrev = () => {
    if (selectedIndex > 0) setSelectedId(filtered[selectedIndex - 1].id)
  }
  const goToNext = () => {
    if (selectedIndex >= 0 && selectedIndex < filtered.length - 1) setSelectedId(filtered[selectedIndex + 1].id)
  }

  if (status === 'loading' || loading)
    return (
      <>
        <SiteNav />
        <BrandLoader />
      </>
    )
  if (!session) return <SiteNav />

  if (forbidden) {
    return (
      <>
        <SiteNav />
        <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', marginBottom: '12px' }}>
              Admin access only
            </h1>
            <p style={{ color: 'var(--afa-text-primary)', opacity: 0.6 }}>
              This page is restricted to platform administrators.
            </p>
          </div>
        </main>
      </>
    )
  }

  const inputStyle: React.CSSProperties = {
    fontSize: '13px',
    padding: '7px 10px',
    borderRadius: '8px',
    border: '1px solid rgba(14,12,10,0.15)',
    background: 'var(--afa-white)',
    color: 'var(--afa-text-primary)',
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--afa-white)',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid rgba(14,12,10,0.08)',
    marginBottom: '10px',
    cursor: 'pointer',
  }

  const renderCard = (item: FeedbackItem, showMobileDropdown: boolean) => (
    <div key={item.id} style={cardStyle} onClick={() => setSelectedId(item.id)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '6px', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.03em',
              color: 'white',
              background: CATEGORY_COLORS[item.category] || 'var(--afa-taupe)',
              padding: '2px 8px',
              borderRadius: '999px',
            }}
          >
            {CATEGORY_LABELS[item.category] || item.category}
          </span>
          {item.severity && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: 'white',
                background: SEVERITY_COLORS[item.severity],
                padding: '2px 8px',
                borderRadius: '999px',
              }}
            >
              {labelize(item.severity)}
            </span>
          )}
        </div>
        <span style={{ fontSize: '11px', color: 'var(--afa-taupe)', flexShrink: 0 }}>{timeAgo(item.createdAt)}</span>
      </div>
      <div style={{ fontSize: '13px', color: 'var(--afa-text-primary)', fontWeight: 600, marginBottom: '4px' }}>
        {item.title || item.message.slice(0, 80)}
      </div>
      {item.pageUrl && (
        <div style={{ fontSize: '11px', color: 'var(--afa-taupe)', marginBottom: showMobileDropdown ? '8px' : 0 }}>
          {item.pageUrl}
        </div>
      )}
      {showMobileDropdown && (
        <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: '6px' }}>
          <select
            value={item.status}
            disabled={actioningId === item.id}
            onChange={(e) => {
              const next = e.target.value
              // REJECTED/REOPENED need a note (server enforces this too) -
              // this quick-select has nowhere to type one, so route to
              // the full panel instead of firing a request that'll just
              // bounce with a 400.
              if (next === 'REJECTED' || next === 'REOPENED') {
                setSelectedId(item.id)
                showToast(`Open the detail view to set ${labelize(next)} - it needs a note.`, 'error')
                return
              }
              patchItem(item.id, { status: next })
            }}
            style={{ ...inputStyle, fontSize: '12px', padding: '5px 8px', flex: 1 }}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {labelize(s)}
              </option>
            ))}
          </select>
          <select
            value={item.severity || ''}
            disabled={actioningId === item.id}
            onChange={(e) => patchItem(item.id, { severity: e.target.value || null })}
            style={{ ...inputStyle, fontSize: '12px', padding: '5px 8px', flex: 1 }}
          >
            <option value="">No severity</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {labelize(s)}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )

  return (
    <>
      <SiteNav />
      <style>{`
        .fb-board { display: grid; }
        .fb-mobile-list { display: none; }
        @media (max-width: 780px) {
          .fb-board { display: none; }
          .fb-mobile-list { display: block; }
        }
      `}</style>
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '48px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px', flexWrap: 'wrap', gap: '12px' }}>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: 'var(--afa-text-primary)', margin: 0 }}>
              Admin Dashboard
            </h1>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <a href="/dashboard/admin/settings" style={{ fontSize: '13px', color: 'var(--afa-text-primary)', fontWeight: 600, textDecoration: 'none', padding: '8px 14px', borderRadius: '999px', border: '1px solid rgba(14,12,10,0.15)', background: 'var(--afa-white)' }}>Platform Settings</a>
              <a href="/dashboard/admin/revenue" style={{ fontSize: '13px', color: 'var(--afa-text-primary)', fontWeight: 600, textDecoration: 'none', padding: '8px 14px', borderRadius: '999px', border: '1px solid rgba(14,12,10,0.15)', background: 'var(--afa-white)' }}>Revenue</a>
              <a href="/dashboard/admin/users" style={{ fontSize: '13px', color: 'var(--afa-text-primary)', fontWeight: 600, textDecoration: 'none', padding: '8px 14px', borderRadius: '999px', border: '1px solid rgba(14,12,10,0.15)', background: 'var(--afa-white)' }}>Accounts</a>
              <a href="/dashboard/admin/bookings" style={{ fontSize: '13px', color: 'var(--afa-text-primary)', fontWeight: 600, textDecoration: 'none', padding: '8px 14px', borderRadius: '999px', border: '1px solid rgba(14,12,10,0.15)', background: 'var(--afa-white)' }}>Bookings</a>
              <a href="/dashboard/admin/artists" style={{ fontSize: '13px', color: 'var(--afa-text-primary)', fontWeight: 600, textDecoration: 'none', padding: '8px 14px', borderRadius: '999px', border: '1px solid rgba(14,12,10,0.15)', background: 'var(--afa-white)' }}>Artist Roster</a>
            </div>
          </div>

          {/* Pending Approvals - merged in from the old separate
              /dashboard/admin page (session 39 unification, Feedback
              f96a1262). Collapsible like Trends below, so an admin who
              just wants the feedback board isn't forced to scroll past
              it every time. */}
          <button
            onClick={() => setApprovalsOpen((v) => !v)}
            style={{ fontSize: '12px', fontWeight: 700, color: 'var(--afa-text-primary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginBottom: '10px', opacity: 0.7 }}
          >
            {approvalsOpen ? '▾' : '▸'} Pending Approvals ({organisers.length + venueOwners.length})
          </button>
          {approvalsOpen && (
            <div style={{ marginBottom: '28px' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '16px', fontWeight: 700, marginBottom: '10px' }}>
                Organisers ({organisers.length})
              </h2>
              {organisers.length === 0 && <p style={{ fontSize: '13px', color: 'var(--afa-text-primary)', opacity: 0.5, marginBottom: '18px' }}>Nothing pending.</p>}
              {organisers.map((o) => (
                <div key={o.id} style={{ background: 'var(--afa-white)', borderRadius: '10px', padding: '16px', border: '1px solid rgba(14,12,10,0.08)', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: '200px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>{o.orgName}</div>
                      <div style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.6 }}>{o.user.name} · {o.user.email}</div>
                      {o.bio && <div style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.6, marginTop: '4px' }}>{o.bio}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button disabled={actioningApprovalId === o.id} onClick={() => actOnApproval('organiser', o.id, 'approve')} style={{ fontSize: '13px', fontWeight: 600, color: 'var(--afa-white)', background: 'var(--afa-sage)', border: 'none', borderRadius: '6px', padding: '7px 12px', cursor: 'pointer' }}>Approve</button>
                      <button disabled={actioningApprovalId === o.id} onClick={() => actOnApproval('organiser', o.id, 'reject')} style={{ fontSize: '13px', fontWeight: 600, color: 'var(--afa-error)', background: 'transparent', border: '1px solid var(--afa-error-border)', borderRadius: '6px', padding: '7px 12px', cursor: 'pointer' }}>Reject</button>
                    </div>
                  </div>
                </div>
              ))}

              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '16px', fontWeight: 700, marginTop: '20px', marginBottom: '10px' }}>
                Venue Owners ({venueOwners.length})
              </h2>
              {venueOwners.length === 0 && <p style={{ fontSize: '13px', color: 'var(--afa-text-primary)', opacity: 0.5 }}>Nothing pending.</p>}
              {venueOwners.map((v) => (
                <div key={v.id} style={{ background: 'var(--afa-white)', borderRadius: '10px', padding: '16px', border: '1px solid rgba(14,12,10,0.08)', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: '200px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>{v.user.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.6 }}>{v.user.email}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button disabled={actioningApprovalId === v.id} onClick={() => actOnApproval('venueOwner', v.id, 'approve')} style={{ fontSize: '13px', fontWeight: 600, color: 'var(--afa-white)', background: 'var(--afa-sage)', border: 'none', borderRadius: '6px', padding: '7px 12px', cursor: 'pointer' }}>Approve</button>
                      <button disabled={actioningApprovalId === v.id} onClick={() => actOnApproval('venueOwner', v.id, 'reject')} style={{ fontSize: '13px', fontWeight: 600, color: 'var(--afa-error)', background: 'transparent', border: '1px solid var(--afa-error-border)', borderRadius: '6px', padding: '7px 12px', cursor: 'pointer' }}>Reject</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pending Genre Requests (session 39, PR #224) - approving one
              adds it to /api/genres/approved's list, making it a public
              filter-chip option on /artists. Rejecting keeps it out of
              that shared list. The submitting artist's own profile
              already shows their genre regardless - this only gates the
              GLOBAL filter surface. */}
          <button
            onClick={() => setGenreRequestsOpen((v) => !v)}
            style={{ fontSize: '12px', fontWeight: 700, color: 'var(--afa-text-primary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginBottom: '10px', opacity: 0.7 }}
          >
            {genreRequestsOpen ? '▾' : '▸'} Pending Genre Requests ({genreRequests.length})
          </button>
          {genreRequestsOpen && (
            <div style={{ marginBottom: '28px' }}>
              <p style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.5, marginBottom: '10px' }}>
                New "Other" genre values artists have typed in - already visible on their own profile. Approving adds it as a public filter option on /artists; rejecting keeps it out of that shared list.
              </p>
              {genreRequests.length === 0 && <p style={{ fontSize: '13px', color: 'var(--afa-text-primary)', opacity: 0.5 }}>Nothing pending.</p>}
              {genreRequests.map((g) => (
                <div key={g.id} style={{ background: 'var(--afa-white)', borderRadius: '10px', padding: '16px', border: '1px solid rgba(14,12,10,0.08)', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{g.value}</div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button disabled={actioningGenreId === g.id} onClick={() => actOnGenreRequest(g.id, 'approve')} style={{ fontSize: '13px', fontWeight: 600, color: 'var(--afa-white)', background: 'var(--afa-sage)', border: 'none', borderRadius: '6px', padding: '7px 12px', cursor: 'pointer' }}>Approve</button>
                      <button disabled={actioningGenreId === g.id} onClick={() => actOnGenreRequest(g.id, 'reject')} style={{ fontSize: '13px', fontWeight: 600, color: 'var(--afa-error)', background: 'transparent', border: '1px solid var(--afa-error-border)', borderRadius: '6px', padding: '7px 12px', cursor: 'pointer' }}>Reject</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* FEAT-2608-045 (11 Aug) - pending event "special notes" -
              organiser-authored free text, never auto-visible. Approving
              shows it on the event's public page; rejecting requires a
              reason so the organiser knows what to fix. */}
          <button
            onClick={() => setEventNotesOpen((v) => !v)}
            style={{ fontSize: '12px', fontWeight: 700, color: 'var(--afa-text-primary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginBottom: '10px', opacity: 0.7 }}
          >
            {eventNotesOpen ? '▾' : '▸'} Pending Event Notes ({eventNotes.length})
          </button>
          {eventNotesOpen && (
            <div style={{ marginBottom: '28px' }}>
              <p style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.5, marginBottom: '10px' }}>
                Free-text "special notes" organisers added to an event - never shown publicly until approved here.
              </p>
              {eventNotes.length === 0 && <p style={{ fontSize: '13px', color: 'var(--afa-text-primary)', opacity: 0.5 }}>Nothing pending.</p>}
              {eventNotes.map((n) => (
                <div key={n.id} style={{ background: 'var(--afa-white)', borderRadius: '10px', padding: '16px', border: '1px solid rgba(14,12,10,0.08)', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '2px' }}>{n.title}</div>
                      {n.organiser && <div style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.5, marginBottom: '8px' }}>{n.organiser.orgName}</div>}
                      <div style={{ fontSize: '13px', color: 'var(--afa-text-primary)', opacity: 0.8, lineHeight: 1.5 }}>{n.specialNotes}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button disabled={actioningEventNoteId === n.id} onClick={() => actOnEventNote(n.id, 'approve')} style={{ fontSize: '13px', fontWeight: 600, color: 'var(--afa-white)', background: 'var(--afa-sage)', border: 'none', borderRadius: '6px', padding: '7px 12px', cursor: 'pointer' }}>Approve</button>
                      <button disabled={actioningEventNoteId === n.id} onClick={() => actOnEventNote(n.id, 'reject')} style={{ fontSize: '13px', fontWeight: 600, color: 'var(--afa-error)', background: 'transparent', border: '1px solid var(--afa-error-border)', borderRadius: '6px', padding: '7px 12px', cursor: 'pointer' }}>Reject</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: '4px' }}>
            Feedback
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: '20px' }}>
            Submitted via the support widget — both the manual form and questions the chatbot couldn&apos;t answer.
          </p>

          <button
            onClick={() => setTrendsOpen((v) => !v)}
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--afa-text-primary)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              marginBottom: '10px',
              opacity: 0.7,
            }}
          >
            {trendsOpen ? '▾' : '▸'} Trends
          </button>
          {trendsOpen && <FeedbackTrends items={trendItems} />}

          {statusFocus && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                background: 'var(--afa-orange-tint, #FFF3E6)',
                border: '1px solid var(--afa-ink-a13)',
                borderRadius: '10px',
                padding: '10px 14px',
                marginBottom: '12px',
                fontSize: '13px',
              }}
            >
              <span>
                Showing: <strong>{labelize(statusFocus)}</strong> only ({filtered.length})
              </span>
              <button
                onClick={clearStatusFocus}
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--afa-text-primary)',
                  background: 'var(--afa-white)',
                  border: '1px solid var(--afa-ink-a13)',
                  borderRadius: '999px',
                  padding: '5px 12px',
                  cursor: 'pointer',
                }}
              >
                View full board
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px', alignItems: 'center' }}>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={inputStyle}>
              <option value="ALL">All categories</option>
              {Object.keys(CATEGORY_LABELS).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
            <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} style={inputStyle}>
              <option value="ALL">All severities</option>
              <option value="NONE">No severity</option>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {labelize(s)}
                </option>
              ))}
            </select>
            <input
              placeholder="Page contains…"
              value={pageFilter}
              onChange={(e) => setPageFilter(e.target.value)}
              style={{ ...inputStyle, width: '140px' }}
            />
            <input
              placeholder="Search…"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ ...inputStyle, width: '160px' }}
            />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} style={inputStyle}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="severity">Severity (high → low)</option>
            </select>
            <label style={{ fontSize: '13px', color: 'var(--afa-text-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto', cursor: 'pointer' }}>
              <input type="checkbox" checked={showResolved} onChange={toggleShowResolved} disabled={resolvedLoading} />
              {resolvedLoading ? 'Loading…' : 'Show Resolved / Rejected'}
            </label>
          </div>

          {/* Desktop board - horizontally scrolling now that there are
              up to 9 status columns (was a fixed 3/4-column grid when
              there were only 4 statuses total). Equal-fraction columns
              stopped being readable well before 9. */}
          <div
            className="fb-board"
            style={{
              gridAutoFlow: 'column',
              gridAutoColumns: '220px',
              gap: '16px',
              marginTop: '16px',
              overflowX: 'auto',
              paddingBottom: '8px',
            }}
          >
            {(showResolved ? STATUSES : STATUSES.filter((s) => !CLOSED_STATUSES.includes(s))).map((statusCol) => (
              <div key={statusCol} id={`fb-col-${statusCol}`}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: '10px' }}>
                  {labelize(statusCol)} <span style={{ color: 'var(--afa-taupe)', fontWeight: 400 }}>({columns[statusCol]?.length || 0})</span>
                </div>
                {(columns[statusCol] || []).length === 0 && (
                  <p style={{ fontSize: '12px', color: 'var(--afa-taupe)' }}>Nothing here.</p>
                )}
                {(columns[statusCol] || []).map((item) => renderCard(item, false))}
              </div>
            ))}
          </div>

          {/* Mobile stacked list */}
          <div className="fb-mobile-list" style={{ marginTop: '10px' }}>
            {filtered.length === 0 && (
              <p style={{ fontSize: '14px', color: 'var(--afa-text-primary)', opacity: 0.5 }}>Nothing matches these filters.</p>
            )}
            {filtered.map((item) => renderCard(item, true))}
          </div>
        </div>
      </main>

      {selectedItem && (
        <FeedbackDetailPanel
          item={selectedItem}
          busy={actioningId === selectedItem.id}
          onClose={() => setSelectedId(null)}
          onSetStatus={(s, note) => patchItem(selectedItem.id, { status: s, note })}
          onSetDeployStage={(ds) => patchItem(selectedItem.id, { deployStage: ds })}
          onSetSeverity={(s) => patchItem(selectedItem.id, { severity: s })}
          onPrev={goToPrev}
          onNext={goToNext}
          hasPrev={selectedIndex > 0}
          hasNext={selectedIndex >= 0 && selectedIndex < filtered.length - 1}
          position={selectedIndex >= 0 ? { index: selectedIndex + 1, total: filtered.length } : null}
        />
      )}
    </>
  )
}

export default function AdminFeedbackPage() {
  return (
    <Suspense fallback={<BrandLoader />}>
      <AdminFeedbackBoard />
    </Suspense>
  )
}
