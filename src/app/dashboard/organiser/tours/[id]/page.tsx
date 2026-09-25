'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import SiteNav from '@/components/SiteNav'
import BackLink from '@/components/BackLink'
import BrandLoader from '@/components/BrandLoader'
import { useToast } from '@/components/Toast'
import Button from '@/components/ui/Button'

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

const CONSENT_LABEL: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Awaiting response', color: 'var(--afa-gold)' },
  ACCEPTED: { label: 'Accepted', color: 'var(--afa-sage)' },
  DECLINED: { label: 'Declined', color: 'var(--afa-error)' },
}

export default function TourDetailPage() {
  const { status } = useSession()
  const router = useRouter()
  const params = useParams()
  const tourId = params?.id as string
  const { showToast } = useToast()

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
      if (!res.ok) throw new Error('Failed to load Tour')
      const data = await res.json()
      const found = (data.tours || []).find((t: TourDetail) => t.id === tourId)
      if (!found) throw new Error('Tour not found')
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

  if (status === 'loading' || loading) return (<><SiteNav /><BrandLoader /></>)
  if (!tour) return (<><SiteNav /><main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', padding: 'var(--afa-space-48px) var(--afa-space-6)', textAlign: 'center', color: 'var(--afa-text-primary)' }}>Tour not found.</main></>)

  const handleAddStop = async () => {
    if (!stopTitle.trim() || !stopDate || !stopVenueId) {
      showToast('Title, date, and venue are required', 'error')
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
      if (!res.ok) throw new Error(data.error || 'Failed to add stop')
      showToast('Stop added as draft - add lineup, then publish', 'success')
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
      if (!res.ok) throw new Error(data.error || 'Failed to add artist')
      showToast(data.consentStatus === 'ACCEPTED' ? 'Artist added to lineup' : 'Artist added - invite sent, awaiting their confirmation', 'success')
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
      if (!res.ok) throw new Error(data.error || 'Failed to remove artist')
      showToast('Artist removed from lineup', 'success')
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
      if (!res.ok) throw new Error(data.error || 'Failed to publish stop')
      showToast('Stop published', 'success')
      await loadTour()
    } catch (err: any) {
      showToast(err.message, 'error')
    }
  }

  const handleCancelTour = async () => {
    if (!confirm('Cancel this entire Tour? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/tours/${tour.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel: true }),
      })
      if (!res.ok) throw new Error('Failed to cancel Tour')
      showToast('Tour cancelled', 'success')
      await loadTour()
    } catch (err: any) {
      showToast(err.message, 'error')
    }
  }

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'var(--afa-space-32px) var(--afa-space-6) 100px' }}>
        <BackLink href="/dashboard/organiser/tours" label="Back to Tours" />

        <div style={{ marginTop: 'var(--afa-space-5)', marginBottom: 'var(--afa-space-28px)' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-page-title)', fontWeight: 700, color: 'var(--afa-text-primary)' }}>{tour.title}</h1>
          {tour.subject && <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.6, marginTop: 'var(--afa-space-6px)' }}>{tour.subject}</p>}
          {tour.status === 'LIVE' && (
            <a href={`/tours/${tour.slug}`} target="_blank" rel="noreferrer" style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-fill-solid)', display: 'inline-block', marginTop: 'var(--afa-space-2)' }}>
              View public page →
            </a>
          )}
        </div>

        {/* Artist consent status */}
        <div style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-12px)', padding: 'var(--afa-space-5) var(--afa-space-6)', border: '1px solid var(--afa-tint-08)', marginBottom: 'var(--afa-space-6)' }}>
          <h2 style={{ fontSize: 'var(--afa-text-body-lg)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-3)' }}>Artist consent</h2>
          {tour.consents.length === 0 ? (
            <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.6 }}>No artists invited yet - add a stop and place artists in the lineup below.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--afa-space-2)' }}>
              {tour.consents.map((c) => {
                const style = CONSENT_LABEL[c.status]
                return (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--afa-text-ui)' }}>
                    <span>{c.artist.user.displayName || c.artist.user.name}</span>
                    <span style={{ color: style.color, fontWeight: 600 }}>{style.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Stops */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--afa-space-14px)' }}>
          <h2 style={{ fontSize: 'var(--afa-text-lead)', fontWeight: 700, color: 'var(--afa-text-primary)' }}>Stops</h2>
          <Button variant="primary" size="md" fullWidth={false} onClick={() => setShowAddStop((v) => !v)}>
            {showAddStop ? 'Cancel' : '+ Add Stop'}
          </Button>
        </div>

        {showAddStop && (
          <div style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-12px)', padding: 'var(--afa-space-6)', border: '1px solid var(--afa-tint-08)', marginBottom: 'var(--afa-space-5)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--afa-space-14px)', marginBottom: 'var(--afa-space-14px)' }}>
              <div>
                <label style={labelStyle}>Stop title</label>
                <input type="text" value={stopTitle} onChange={(e) => setStopTitle(e.target.value)} placeholder="e.g. Mumbai Night" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Type</label>
                <select value={stopType} onChange={(e) => setStopType(e.target.value)} style={inputStyle}>
                  <option value="STAND_UP">Stand-up</option>
                  <option value="OPEN_MIC">Open Mic</option>
                  <option value="POETRY">Poetry</option>
                  <option value="THEATER">Theater</option>
                  <option value="LINEUP">Lineup</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 'var(--afa-space-14px)' }}>
              <label style={labelStyle}>Description</label>
              <textarea value={stopDescription} onChange={(e) => setStopDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' as const }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--afa-space-14px)', marginBottom: 'var(--afa-space-14px)' }}>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={stopDate} onChange={(e) => setStopDate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Start time</label>
                <input type="time" value={stopStartTime} onChange={(e) => setStopStartTime(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>End time</label>
                <input type="time" value={stopEndTime} onChange={(e) => setStopEndTime(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div style={{ marginBottom: 'var(--afa-space-14px)' }}>
              <label style={labelStyle}>Venue</label>
              <select value={stopVenueId} onChange={(e) => setStopVenueId(e.target.value)} style={inputStyle}>
                <option value="">Select a venue</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}, {v.city}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--afa-space-14px)', marginBottom: 'var(--afa-space-14px)' }}>
              <div>
                <label style={labelStyle}>Total seats</label>
                <input type="number" value={stopSeats} onChange={(e) => setStopSeats(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>
                  <input type="checkbox" checked={stopIsFree} onChange={(e) => setStopIsFree(e.target.checked)} style={{ marginRight: 'var(--afa-space-6px)' }} />
                  Free event
                </label>
              </div>
              {!stopIsFree && (
                <div>
                  <label style={labelStyle}>Ticket price (₹)</label>
                  <input type="number" value={stopPrice} onChange={(e) => setStopPrice(e.target.value)} style={inputStyle} />
                </div>
              )}
            </div>
            <div style={{ borderTop: '1px solid var(--afa-tint-08)', paddingTop: 'var(--afa-space-14px)', marginBottom: 'var(--afa-space-14px)' }}>
              <p style={{ fontSize: 'var(--afa-text-ui)', fontWeight: 600, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-10px)' }}>Open local/beginner slots (optional)</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--afa-space-14px)' }}>
                <div>
                  <label style={labelStyle}>Number of open slots</label>
                  <input type="number" min="0" value={stopOpenSlots} onChange={(e) => setStopOpenSlots(e.target.value)} placeholder="0" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Slot duration (min)</label>
                  <input type="number" value={stopSlotDuration} onChange={(e) => setStopSlotDuration(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Application deadline</label>
                  <input type="date" value={stopDeadline} onChange={(e) => setStopDeadline(e.target.value)} style={inputStyle} />
                </div>
              </div>
            </div>
            <Button
              variant="primary"
              size="lg"
              fullWidth={false}
              onClick={handleAddStop}
              disabled={savingStop}
              style={{ opacity: savingStop ? 0.6 : 1 }}
            >
              {savingStop ? 'Saving...' : 'Save Stop as Draft'}
            </Button>
          </div>
        )}

        {tour.stops.length === 0 ? (
          <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.6 }}>No stops yet.</p>
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
                <div key={stop.id} style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-12px)', padding: 'var(--afa-space-5) var(--afa-space-6)', border: '1px solid var(--afa-tint-08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--afa-space-10px)', gap: 'var(--afa-space-10px)' }}>
                    <div>
                      <h3 style={{ fontSize: 'var(--afa-text-title)', fontWeight: 700, color: 'var(--afa-text-primary)' }}>{stop.title}</h3>
                      <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.6 }}>
                        {new Date(stop.date).toLocaleDateString()} · {stop.venue ? `${stop.venue.name}, ${stop.venue.city}` : 'No venue'}
                      </p>
                    </div>
                    <span style={{ fontSize: 'var(--afa-text-micro)', fontWeight: 700, textTransform: 'uppercase', padding: '5px var(--afa-space-10px)', borderRadius: 'var(--afa-radius-pill)', background: stop.status === 'APPROVED' ? 'rgba(74,103,65,0.12)' : 'rgba(201,151,58,0.15)', color: stop.status === 'APPROVED' ? 'var(--afa-sage)' : 'var(--afa-gold)' }}>
                      {stop.status === 'APPROVED' ? 'Live' : stop.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div style={{ marginBottom: 'var(--afa-space-10px)' }}>
                    <p style={{ fontSize: 'var(--afa-text-small)', fontWeight: 600, color: 'var(--afa-text-primary)', opacity: 0.7, marginBottom: 'var(--afa-space-6px)' }}>Fixed lineup</p>
                    {stop.lineup.length === 0 ? (
                      <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.5 }}>No artists yet.</p>
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
                            Remove
                          </Button>
                        </div>
                      ))
                    )}
                  </div>

                  <div style={{ marginBottom: 'var(--afa-space-14px)' }}>
                    <input
                      type="text"
                      placeholder="Search artist to add..."
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
                          Add
                        </Button>
                      </div>
                    ))}
                  </div>

                  {stop.openSlotCount ? (
                    <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: 'var(--afa-space-10px)' }}>
                      {stop.openSlotCount} open slot{stop.openSlotCount > 1 ? 's' : ''} · {stop.slotDuration}min each
                      {stop.applicationDeadline && ` · applications close ${new Date(stop.applicationDeadline).toLocaleDateString()}`}
                    </p>
                  ) : null}

                  {stop.status !== 'APPROVED' && (
                    <Button
                      variant="success"
                      size="md"
                      fullWidth={false}
                      onClick={() => handlePublishStop(stop.id)}
                    >
                      Publish Stop
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
              Cancel Tour
            </Button>
          </div>
        )}
        </div>
      </main>
    </>
  )
}
