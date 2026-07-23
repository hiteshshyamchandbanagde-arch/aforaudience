'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import { useToast } from '@/components/Toast'

interface VenueOption {
  id: string
  name: string
  city: string
  capacity: number
}

interface EventDetail {
  id: string
  title: string
  description: string
  type: string
  status: string
  date: string
  startTime: string
  endTime: string
  isFree: boolean
  ticketPrice: number | null
  totalSeats: number
  dresscode?: string | null
  vibe?: string | null
  surpriseAct: boolean
  plusOnesRequired: number
  defaultCompensationType: 'FREE' | 'PAID' | 'BUY_IN'
  defaultFeeAmount: number | null
  defaultBuyInAmount: number | null
  venue: { id: string } | null
  venueBooking: { amount: number; fromDate: string; toDate: string } | null
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '6px',
  border: '1px solid rgba(14,12,10,0.15)',
  background: 'var(--afa-white)',
  fontSize: '14px',
  color: 'var(--afa-ink)',
}

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  marginBottom: '6px',
  color: 'var(--afa-ink)',
}

const EVENT_TYPES = ['OPEN_MIC', 'STAND_UP', 'POETRY', 'THEATER', 'LINEUP']

function toDateInputValue(dateStr: string) {
  return new Date(dateStr).toISOString().slice(0, 10)
}

export default function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const [event, setEvent] = useState<EventDetail | null>(null)
  const [venues, setVenues] = useState<VenueOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    title: '', description: '', type: 'OPEN_MIC', date: '', startTime: '', endTime: '',
    totalSeats: '', dresscode: '', vibe: '',
  })
  const [isFree, setIsFree] = useState(true)
  const [ticketPrice, setTicketPrice] = useState('')
  const [surpriseAct, setSurpriseAct] = useState(false)
  const [plusOnesRequired, setPlusOnesRequired] = useState('0')
  const [defaultCompensationType, setDefaultCompensationType] = useState<'FREE' | 'PAID' | 'BUY_IN'>('FREE')
  const [defaultFeeAmount, setDefaultFeeAmount] = useState('')
  const [defaultBuyInAmount, setDefaultBuyInAmount] = useState('')
  const [venueId, setVenueId] = useState('')
  const [bookingAmount, setBookingAmount] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventRes, venuesRes] = await Promise.all([
          fetch(`/api/events/${id}/owner`),
          fetch('/api/venues'),
        ])
        if (!eventRes.ok) {
          if (eventRes.status === 403) throw new Error('You do not have access to this event')
          throw new Error('Event not found')
        }
        const data: EventDetail = await eventRes.json()
        setEvent(data)
        setFormData({
          title: data.title,
          description: data.description,
          type: data.type,
          date: toDateInputValue(data.date),
          startTime: data.startTime,
          endTime: data.endTime,
          totalSeats: String(data.totalSeats),
          dresscode: data.dresscode || '',
          vibe: data.vibe || '',
        })
        setIsFree(data.isFree)
        setTicketPrice(data.ticketPrice != null ? String(data.ticketPrice) : '')
        setSurpriseAct(data.surpriseAct)
        setPlusOnesRequired(String(data.plusOnesRequired ?? 0))
        setDefaultCompensationType(data.defaultCompensationType || 'FREE')
        setDefaultFeeAmount(data.defaultFeeAmount != null ? String(data.defaultFeeAmount) : '')
        setDefaultBuyInAmount(data.defaultBuyInAmount != null ? String(data.defaultBuyInAmount) : '')
        setVenueId(data.venue?.id || '')
        setBookingAmount(data.venueBooking?.amount != null ? String(data.venueBooking.amount) : '')

        if (venuesRes.ok) {
          setVenues(await venuesRes.json())
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, id])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Same clamp-on-change discipline as the create page's equivalent field -
  // client-side is decorative, PATCH /api/events/[id] validates independently.
  const handlePlusOnesRequiredChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target
    if (value === '') {
      setPlusOnesRequired('')
      return
    }
    const num = Number(value)
    if (!Number.isFinite(num)) return
    setPlusOnesRequired(String(Math.max(0, Math.min(num, 20))))
  }

  const save = async (publishOverride?: boolean) => {
    setSaving(true)

    try {
      const res = await fetch(`/api/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          isFree,
          ticketPrice: isFree ? null : ticketPrice,
          surpriseAct,
          plusOnesRequired: plusOnesRequired ? Number(plusOnesRequired) : 0,
          defaultCompensationType,
          defaultFeeAmount: defaultCompensationType === 'PAID' ? defaultFeeAmount : null,
          defaultBuyInAmount: defaultCompensationType === 'BUY_IN' ? defaultBuyInAmount : null,
          ...(publishOverride !== undefined ? { publish: publishOverride } : {}),
        }),
      })

      if (!res.ok) throw new Error('Failed to update event')

      // Venue booking is a separate resource, so it's updated as its own request.
      if (venueId && (!event?.venue || event.venue.id !== venueId)) {
        const vbRes = await fetch('/api/venue-bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            venueId,
            eventId: id,
            fromDate: formData.date,
            toDate: formData.date,
            amount: bookingAmount,
          }),
        })
        if (!vbRes.ok) {
          const vbData = await vbRes.json().catch(() => ({}))
          if (vbData.reason === 'PHONE_NOT_VERIFIED') {
            router.push(`/verify-phone?next=${encodeURIComponent(`/dashboard/organiser/events/${id}/edit`)}`)
            return
          }
          throw new Error(vbData.error || 'Failed to book venue')
        }
      }

      showToast('Event saved.', 'success')
      router.push(`/dashboard/organiser/events/${id}`)
    } catch (err: any) {
      showToast(err.message || 'Failed to save event', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) return (<><SiteNav /><div style={{ padding: '32px' }}>Loading...</div></>)
  if (!session) return <SiteNav />
  if (error && !event) return (<><SiteNav /><div style={{ padding: '32px', color: 'var(--afa-error)' }}>{error}</div></>)
  if (!event) return (<><SiteNav /><div style={{ padding: '32px' }}>Event not found</div></>)

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: 'var(--afa-cream)', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
          <Link href={`/dashboard/organiser/events/${id}`} style={{ fontSize: '14px', color: 'var(--afa-terracotta)', textDecoration: 'none', fontWeight: 600 }}>
            ← Back to Event
          </Link>

          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: 'var(--afa-ink)', marginTop: '16px', marginBottom: '8px' }}>
            Edit Event
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '32px' }}>
            Update your event details, seats, pricing, and venue.
          </p>

          <form onSubmit={(e) => e.preventDefault()}>
            <section style={{ background: 'var(--afa-white)', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '20px' }}>
                Event Details
              </h2>

              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Title *</label>
                <input type="text" name="title" value={formData.title} onChange={handleChange} style={inputStyle} required />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Description *</label>
                <textarea name="description" value={formData.description} onChange={handleChange} rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }}>
                <div>
                  <label style={labelStyle}>Event Type *</label>
                  <select name="type" value={formData.type} onChange={handleChange} style={inputStyle}>
                    {EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>{t.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Date *</label>
                  <input type="date" name="date" value={formData.date} onChange={handleChange} style={inputStyle} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }}>
                <div>
                  <label style={labelStyle}>Start Time *</label>
                  <input type="time" name="startTime" value={formData.startTime} onChange={handleChange} style={inputStyle} required />
                </div>
                <div>
                  <label style={labelStyle}>End Time *</label>
                  <input type="time" name="endTime" value={formData.endTime} onChange={handleChange} style={inputStyle} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                <div>
                  <label style={labelStyle}>Dress Code</label>
                  <input type="text" name="dresscode" value={formData.dresscode} onChange={handleChange} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Vibe</label>
                  <input type="text" name="vibe" value={formData.vibe} onChange={handleChange} style={inputStyle} />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '18px', fontSize: '14px', color: 'var(--afa-ink)' }}>
                <input type="checkbox" checked={surpriseAct} onChange={(e) => setSurpriseAct(e.target.checked)} />
                This event includes a surprise act
              </label>
            </section>

            <section style={{ background: 'var(--afa-white)', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '20px' }}>
                Seats & Ticket Price
              </h2>

              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Total Seats *</label>
                <input type="number" name="totalSeats" value={formData.totalSeats} onChange={handleChange} min="1" style={inputStyle} required />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Require a &quot;+1&quot; per artist <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></label>
                <input type="number" value={plusOnesRequired} onChange={handlePlusOnesRequiredChange} min="0" max="20" style={{ ...inputStyle, maxWidth: '120px' }} />
                <p style={{ fontSize: '11px', color: 'var(--afa-ink)', opacity: 0.5, marginTop: '4px' }}>
                  Each artist in the lineup must have this many audience members confirm support - included in their spot fee. Set to 0 if not required.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '20px', marginBottom: '14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--afa-ink)' }}>
                  <input type="radio" checked={isFree} onChange={() => setIsFree(true)} /> Free entry
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--afa-ink)' }}>
                  <input type="radio" checked={!isFree} onChange={() => setIsFree(false)} /> Paid entry
                </label>
              </div>

              {!isFree && (
                <div>
                  <label style={labelStyle}>Ticket Price (₹)</label>
                  <input type="number" value={ticketPrice} onChange={(e) => setTicketPrice(e.target.value)} min="0" style={inputStyle} />
                </div>
              )}
            </section>

            <section style={{ background: 'var(--afa-white)', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '6px' }}>
                Artist Payment Terms
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '18px' }}>
                Shown to Artists before they apply. You can still negotiate a different amount with a specific artist when approving their application.
              </p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                {([
                  { value: 'FREE', label: 'Free / Exposure' },
                  { value: 'PAID', label: 'Paid' },
                  { value: 'BUY_IN', label: 'Buy-in (pay to play)' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDefaultCompensationType(opt.value)}
                    style={{
                      padding: '8px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                      border: defaultCompensationType === opt.value ? '2px solid var(--afa-terracotta)' : '1px solid rgba(14,12,10,0.15)',
                      background: defaultCompensationType === opt.value ? 'rgba(200,68,26,0.08)' : 'var(--afa-white)',
                      color: defaultCompensationType === opt.value ? 'var(--afa-terracotta)' : 'var(--afa-ink)',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {defaultCompensationType === 'PAID' && (
                <input type="number" value={defaultFeeAmount} onChange={(e) => setDefaultFeeAmount(e.target.value)} min="0" placeholder="Fee per artist (₹)" style={{ ...inputStyle, maxWidth: '200px' }} />
              )}
              {defaultCompensationType === 'BUY_IN' && (
                <input type="number" value={defaultBuyInAmount} onChange={(e) => setDefaultBuyInAmount(e.target.value)} min="0" placeholder="Buy-in amount (₹)" style={{ ...inputStyle, maxWidth: '200px' }} />
              )}
            </section>

            <section style={{ background: 'var(--afa-white)', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '6px' }}>
                Venue
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '18px' }}>
                Changing the venue sends a new booking request.
              </p>

              <div style={{ marginBottom: venueId ? '18px' : 0 }}>
                <label style={labelStyle}>Venue</label>
                <select value={venueId} onChange={(e) => setVenueId(e.target.value)} style={inputStyle}>
                  <option value="">No venue selected</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>{v.name} — {v.city} ({v.capacity} seats)</option>
                  ))}
                </select>
              </div>

              {venueId && (
                <div>
                  <label style={labelStyle}>Offer Amount (₹)</label>
                  <input type="number" value={bookingAmount} onChange={(e) => setBookingAmount(e.target.value)} min="0" style={inputStyle} />
                </div>
              )}
            </section>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={saving}
                onClick={() => save(event.status === 'APPROVED' ? true : undefined)}
                style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-cream)', background: 'var(--afa-terracotta)', border: 'none', borderRadius: '8px', padding: '12px 26px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Saving...' : event.status === 'APPROVED' ? 'Save Changes' : 'Save & Publish'}
              </button>
              {event.status !== 'APPROVED' && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => save(false)}
                  style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-ink)', background: 'transparent', border: '1px solid rgba(14,12,10,0.2)', borderRadius: '8px', padding: '12px 26px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
                >
                  Save as Draft
                </button>
              )}
              <Link href={`/dashboard/organiser/events/${id}`} style={{ fontSize: '14px', color: 'var(--afa-ink)', opacity: 0.6, textDecoration: 'none' }}>
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </main>
    </>
  )
}
