'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import SiteNav from '@/components/SiteNav'
import BackLink from '@/components/BackLink'
import BrandLoader from '@/components/BrandLoader'
import { useToast } from '@/components/Toast'
import Button from '@/components/ui/Button'
import { STATUS_TONE } from '@/lib/statusStyle'
import { formatDate } from '@/lib/format-date'
import { useLocale, type Dictionary } from '@/lib/i18n/translate'
import { countText } from '@/lib/i18n/plural'
import { useConfirm } from '@/components/ConfirmDialog'
import { PageTitle } from '@/components/dashboard/PageTitle'

const inputStyle = {
  width: '100%',
  padding: 'var(--afa-space-10px) var(--afa-space-3)',
  borderRadius: 'var(--afa-radius-sm)',
  border: '1px solid var(--afa-border-resting)',
  background: 'var(--afa-surface-raised)',
  fontSize: 'var(--afa-text-body)',
  color: 'var(--afa-text-primary)',
}
const labelStyle = { display: 'block', fontSize: 'var(--afa-text-ui)', fontWeight: 600, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-6px)' }

interface Consent {
  id: string
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED'
  artist: { id: string; user: { name: string; displayName: string | null } }
}
interface Stop {
  id: string
  title: string
  date: string
  status: string
  venue: { name: string; city: string } | null
  openSlotCount: number | null
  slotDuration: number | null
  applicationDeadline: string | null
  lineup: { artistId: string; artist: { user: { name: string; displayName: string | null } } }[]
}
interface TourDetail {
  id: string
  title: string
  subject: string | null
  slug: string
  status: string
  consents: Consent[]
  stops: Stop[]
}
interface VenueOption { id: string; name: string; city: string }
interface ArtistOption { id: string; user: { name: string; displayName: string | null } }

// GEN-2610-007 - labels in the UI language; the stored status stays English.
type ToursText = Dictionary['organiserDashboard']['tours']
const CONSENT_LABEL: Record<string, { label: keyof ToursText; color: string }> = {
  PENDING: { label: 'consentPending', color: 'var(--afa-amber)' },
  ACCEPTED: { label: 'consentAccepted', color: 'var(--afa-sage-bright)' },
  DECLINED: { label: 'consentDeclined', color: 'var(--afa-error-bright)' },
}
const STOP_STATUS: Record<string, keyof Dictionary['organiserDashboard']['yourEvents']> = {
  DRAFT: 'statusDraft',
  PENDING_APPROVAL: 'statusPending',
  CANCELLED: 'statusCancelled',
  COMPLETED: 'statusCompleted',
}
const STOP_TYPES = ['STAND_UP', 'OPEN_MIC', 'POETRY', 'THEATER', 'LINEUP'] as const

export default function TourDetailPage() {
  const { locale, t: tr } = useLocale()
  const o = tr.organiserDashboard.tours
  const { status } = useSession()
  const router = useRouter()
  const params = useParams()
  const tourId = params?.id as string
  const { showToast } = useToast()
  const confirm = useConfirm()

  const [tour, setTour] = useState<TourDetail | null>(null)
  const [venues, setVenues] = useState<VenueOption[]>([])
  const [artists, setArtists] = useState<ArtistOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddStop, setShowAddStop] = useState(false)
  const [savingStop, setSavingStop] = useState(false)

  const [stopTitle, setStopTitle] = useState('')
  const [stopDescription, setStopDescription] = useState('')
  const [stopType, setStopType] = useState('STAND_UP')
  const [stopDate, setStopDate] = useState('')
  const [stopStartTime, setStopStartTime] = useState('19:00')
  const [stopEndTime, setStopEndTime] = useState('21:00')
  const [stopVenueId, setStopVenueId] = useState('')
  const [stopSeats, setStopSeats] = useState('80')
  const [stopIsFree, setStopIsFree] = useState(false)
  const [stopPrice, setStopPrice] = useState('')
  const [stopOpenSlots, setStopOpenSlots] = useState('')
  const [stopSlotDuration, setStopSlotDuration] = useState('10')
  const [stopDeadline, setStopDeadline] = useState('')

  const [artistSearch, setArtistSearch] = useState<Record<string, string>>({})
  const [addingArtist, setAddingArtist] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const loadTour = async () => {
    try {
      // BUG-2608-051: explicit no-store since this is always called
      // right after a mutation (add/remove artist, publish, cancel) -
      // this refetch must never be served from any HTTP cache layer.
      const res = await fetch('/api/tours/mine', { cache: 'no-store' })
      if (!res.ok) throw new Error(o.loadFailed)
      const data = await res.json()
      const found = (data.tours || []).find((t: TourDetail) => t.id === tourId)
      if (!found) throw new Error(o.notFound)
      setTour(found)
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (status !== 'authenticated' || !tourId) return
    loadTour()
    fetch('/api/venues').then((r) => r.json()).then(setVenues).catch(() => {})
    fetch('/api/artists').then((r) => r.json()).then(setArtists).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, tourId])

  if (status === 'loading' || loading) return (<><SiteNav /><BrandLoader label={tr.dashboardChrome.loading} /></>)
  if (!tour) return (<><SiteNav /><main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', padding: 'var(--afa-space-48px) var(--afa-space-6)', textAlign: 'center', color: 'var(--afa-text-primary)' }}>{o.notFoundPage}</main></>)

  const handleAddStop = async () => {
    if (!stopTitle.trim() || !stopDate || !stopVenueId) {
      showToast(o.stopRequired, 'error')
      return
    }
    setSavingStop(true)
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: stopTitle,
          description: stopDescription || stopTitle,
          type: stopType,
          date: stopDate,
          startTime: stopStartTime,
          endTime: stopEndTime,
          venueId: stopVenueId,
          totalSeats: stopSeats,
          isFree: stopIsFree,
          ticketPrice: stopIsFree ? null : stopPrice,
          tourId: tour.id,
          openSlotCount: stopOpenSlots || null,
          slotDuration: stopOpenSlots ? stopSlotDuration : null,
          applicationDeadline: stopDeadline || null,
          publish: false,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || o.addStopFailed)
      showToast(o.stopAdded, 'success')
      setShowAddStop(false)
      setStopTitle(''); setStopDescription(''); setStopDate(''); setStopVenueId(''); setStopOpenSlots(''); setStopDeadline('')
      await loadTour()
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setSavingStop(false)
    }
  }

  const handleAddArtist = async (stopId: string, artistId: string) => {
    setAddingArtist(stopId)
    try {
      const res = await fetch(`/api/events/${stopId}/tour-lineup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || o.addArtistFailed)
      showToast(data.consentStatus === 'ACCEPTED' ? o.artistAdded : o.artistInvited, 'success')
      await loadTour()
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setAddingArtist(null)
    }
  }

  const handleRemoveArtist = async (stopId: string, artistId: string) => {
    try {
      const res = await fetch(`/api/events/${stopId}/tour-lineup?artistId=${artistId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || o.removeArtistFailed)
      showToast(o.artistRemoved, 'success')
      await loadTour()
    } catch (err: any) {
      showToast(err.message, 'error')
    }
  }

  const handlePublishStop = async (stopId: string) => {
    try {
      const res = await fetch(`/api/events/${stopId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publish: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || o.publishFailed)
      showToast(o.stopPublished, 'success')
      await loadTour()
    } catch (err: any) {
      showToast(err.message, 'error')
    }
  }

  const handleCancelTour = async () => {
    if (!(await confirm({ title: o.cancelConfirmTitle, body: o.cancelConfirmBody, confirmLabel: o.cancelTour, cancelLabel: o.keepTour, destructive: true }))) return
    try {
      const res = await fetch(`/api/tours/${tour.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel: true }),
      })
      if (!res.ok) throw new Error(o.cancelFailed)
      showToast(o.tourCancelled, 'success')
      await loadTour()
    } catch (err: any) {
      showToast(err.message, 'error')
    }
  }

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'var(--afa-space-32px) var(--afa-space-6) 100px' }}>{/* token-ok(spacing-literal): 100px used under 10 times, no exact token (GEN-2609-107) */}
        <BackLink href="/dashboard/organiser/tours" label={o.backToTours} />

        <div style={{ marginTop: 'var(--afa-space-5)', marginBottom: 'var(--afa-space-28px)' }}>
          <PageTitle>{tour.title}</PageTitle>
          {tour.subject && <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.6, marginTop: 'var(--afa-space-6px)' }}>{tour.subject}</p>}
          {tour.status === 'LIVE' && (
            <a href={`/tours/${tour.slug}`} target="_blank" rel="noreferrer" style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-fill-solid)', display: 'inline-block', marginTop: 'var(--afa-space-2)' }}>
              {o.viewPublicPage}
            </a>
          )}
        </div>

        {/* Artist consent status */}
        <div style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-5) var(--afa-space-6)', border: '1px solid var(--afa-tint-08)', marginBottom: 'var(--afa-space-6)' }}>
          <h2 style={{ fontSize: 'var(--afa-text-body-lg)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-3)' }}>{o.consentTitle}</h2>
          {tour.consents.length === 0 ? (
            <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.6 }}>{o.noConsents}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-2)' }}>
              {tour.consents.map((c) => {
                const style = CONSENT_LABEL[c.status]
                return (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--afa-text-ui)' }}>
                    <span>{c.artist.user.displayName || c.artist.user.name}</span>
                    <span style={{ color: style.color, fontWeight: 600 }}>{o[style.label]}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Stops */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--afa-space-14px)' }}>
          <h2 style={{ fontSize: 'var(--afa-text-lead)', fontWeight: 700, color: 'var(--afa-text-primary)' }}>{o.stops}</h2>
          <Button variant="primary" size="md" fullWidth={false} onClick={() => setShowAddStop((v) => !v)}>
            {showAddStop ? o.cancel : o.addStop}
          </Button>
        </div>

        {showAddStop && (
          <div style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-6)', border: '1px solid var(--afa-tint-08)', marginBottom: 'var(--afa-space-5)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--afa-space-14px)', marginBottom: 'var(--afa-space-14px)' }}>
              <div>
                <label style={labelStyle}>{o.stopTitle}</label>
                <input type="text" value={stopTitle} onChange={(e) => setStopTitle(e.target.value)} placeholder={o.stopTitlePlaceholder} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{o.type}</label>
                <select value={stopType} onChange={(e) => setStopType(e.target.value)} style={inputStyle}>
                  {STOP_TYPES.map((t) => (
                    <option key={t} value={t}>{tr.eventTypes[t]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 'var(--afa-space-14px)' }}>
              <label style={labelStyle}>{o.description}</label>
              <textarea value={stopDescription} onChange={(e) => setStopDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' as const }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--afa-space-14px)', marginBottom: 'var(--afa-space-14px)' }}>
              <div>
                <label style={labelStyle}>{o.date}</label>
                <input type="date" value={stopDate} onChange={(e) => setStopDate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{o.startTime}</label>
                <input type="time" value={stopStartTime} onChange={(e) => setStopStartTime(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{o.endTime}</label>
                <input type="time" value={stopEndTime} onChange={(e) => setStopEndTime(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div style={{ marginBottom: 'var(--afa-space-14px)' }}>
              <label style={labelStyle}>{o.venue}</label>
              <select value={stopVenueId} onChange={(e) => setStopVenueId(e.target.value)} style={inputStyle}>
                <option value="">{o.selectVenue}</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}, {v.city}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--afa-space-14px)', marginBottom: 'var(--afa-space-14px)' }}>
              <div>
                <label style={labelStyle}>{o.totalSeats}</label>
                <input type="number" value={stopSeats} onChange={(e) => setStopSeats(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>
                  <input type="checkbox" checked={stopIsFree} onChange={(e) => setStopIsFree(e.target.checked)} style={{ marginRight: 'var(--afa-space-6px)' }} />
                  {o.freeEvent}
                </label>
              </div>
              {!stopIsFree && (
                <div>
                  <label style={labelStyle}>{o.ticketPrice}</label>
                  <input type="number" value={stopPrice} onChange={(e) => setStopPrice(e.target.value)} style={inputStyle} />
                </div>
              )}
            </div>
            <div style={{ borderTop: '1px solid var(--afa-tint-08)', paddingTop: 'var(--afa-space-14px)', marginBottom: 'var(--afa-space-14px)' }}>
              <p style={{ fontSize: 'var(--afa-text-ui)', fontWeight: 600, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-10px)' }}>{o.openSlotsTitle}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--afa-space-14px)' }}>
                <div>
                  <label style={labelStyle}>{o.openSlotsCount}</label>
                  <input type="number" min="0" value={stopOpenSlots} onChange={(e) => setStopOpenSlots(e.target.value)} placeholder="0" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>{o.slotDuration}</label>
                  <input type="number" value={stopSlotDuration} onChange={(e) => setStopSlotDuration(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>{o.applicationDeadline}</label>
                  <input type="date" value={stopDeadline} onChange={(e) => setStopDeadline(e.target.value)} style={inputStyle} />
                </div>
              </div>
            </div>
            <Button
              data-afa-action-row
              variant="primary"
              size="lg"
              fullWidth={false}
              onClick={handleAddStop}
              disabled={savingStop}
              style={{ opacity: savingStop ? 0.6 : 1 }}
            >
              {savingStop ? o.saving : o.saveStopDraft}
            </Button>
          </div>
        )}

        {tour.stops.length === 0 ? (
          <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.6 }}>{o.noStops}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-4)' }}>
            {tour.stops.map((stop) => {
              const filteredArtists = artists.filter((a) => {
                const q = (artistSearch[stop.id] || '').toLowerCase()
                const name = (a.user.displayName || a.user.name || '').toLowerCase()
                const alreadyIn = stop.lineup.some((l) => l.artistId === a.id)
                return q.length > 0 && name.includes(q) && !alreadyIn
              })
              return (
                <div key={stop.id} style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-5) var(--afa-space-6)', border: '1px solid var(--afa-tint-08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--afa-space-10px)', gap: 'var(--afa-space-10px)' }}>
                    <div>
                      <h3 style={{ fontSize: 'var(--afa-text-title)', fontWeight: 700, color: 'var(--afa-text-primary)' }}>{stop.title}</h3>
                      <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.6 }}>
                        {formatDate(stop.date, 'medium', locale)} · {stop.venue ? `${stop.venue.name}, ${stop.venue.city}` : o.noVenue}
                      </p>
                    </div>
                    <span style={{ fontSize: 'var(--afa-text-micro)', fontWeight: 700, textTransform: 'uppercase', padding: '5px var(--afa-space-10px)', borderRadius: 'var(--afa-radius-pill)', background: (stop.status === 'APPROVED' ? STATUS_TONE.sage : STATUS_TONE.gold).bg, color: (stop.status === 'APPROVED' ? STATUS_TONE.sage : STATUS_TONE.gold).color }}>{/* token-ok(spacing-literal): 5px odd value, no exact token (GEN-2609-107) */}
                      {stop.status === 'APPROVED' ? o.statusLive : STOP_STATUS[stop.status] ? tr.organiserDashboard.yourEvents[STOP_STATUS[stop.status]] : stop.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div style={{ marginBottom: 'var(--afa-space-10px)' }}>
                    <p style={{ fontSize: 'var(--afa-text-small)', fontWeight: 600, color: 'var(--afa-text-primary)', opacity: 0.7, marginBottom: 'var(--afa-space-6px)' }}>{o.fixedLineup}</p>
                    {stop.lineup.length === 0 ? (
                      <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.5 }}>{o.noArtists}</p>
                    ) : (
                      stop.lineup.map((l) => (
                        <div key={l.artistId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--afa-text-ui)', padding: 'var(--afa-space-1) 0' }}>
                          <span>{l.artist.user.displayName || l.artist.user.name}</span>
                          <Button
                            variant="outline-error"
                            size="sm"
                            fullWidth={false}
                            onClick={() => handleRemoveArtist(stop.id, l.artistId)}
                          >
                            {o.remove}
                          </Button>
                        </div>
                      ))
                    )}
                  </div>

                  <div style={{ marginBottom: 'var(--afa-space-14px)' }}>
                    <input
                      type="text"
                      placeholder={o.searchArtist}
                      value={artistSearch[stop.id] || ''}
                      onChange={(e) => setArtistSearch((prev) => ({ ...prev, [stop.id]: e.target.value }))}
                      style={{ ...inputStyle, marginBottom: 'var(--afa-space-6px)' }}
                    />
                    {filteredArtists.slice(0, 5).map((a) => (
                      <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--afa-text-ui)', padding: 'var(--afa-space-6px) 0' }}>
                        <span>{a.user.displayName || a.user.name}</span>
                        <Button
                          variant="primary"
                          size="sm"
                          fullWidth={false}
                          onClick={() => handleAddArtist(stop.id, a.id)}
                          disabled={addingArtist === stop.id}
                        >
                          {o.add}
                        </Button>
                      </div>
                    ))}
                  </div>

                  {stop.openSlotCount ? (
                    <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: 'var(--afa-space-10px)' }}>
                      {countText(locale, stop.openSlotCount, o.openSlotsOne, o.openSlotsOther).replace('{min}', String(stop.slotDuration))}
                      {stop.applicationDeadline && o.applicationsClose.replace('{date}', formatDate(stop.applicationDeadline, 'medium', locale))}
                    </p>
                  ) : null}

                  {stop.status !== 'APPROVED' && (
                    <Button
                      variant="success"
                      size="md"
                      fullWidth={false}
                      onClick={() => handlePublishStop(stop.id)}
                    >
                      {o.publishStop}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {tour.status !== 'CANCELLED' && tour.status !== 'COMPLETED' && (
          <div style={{ marginTop: 'var(--afa-space-32px)', paddingTop: 'var(--afa-space-5)', borderTop: '1px solid var(--afa-tint-08)' }}>
            <Button
              variant="outline-error"
              size="md"
              fullWidth={false}
              onClick={handleCancelTour}
            >
              {o.cancelTour}
            </Button>
          </div>
        )}
        </div>
      </main>
    </>
  )
}
