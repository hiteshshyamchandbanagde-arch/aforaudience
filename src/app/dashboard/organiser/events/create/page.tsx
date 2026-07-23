'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import { useToast } from '@/components/Toast'

interface SeatSection {
  id?: string
  name: string
  seats: number
  price: number
}

interface VenueDayRate {
  dayOfWeek: string
  hourlyRate: number | null
  dailyRate: number | null
}

interface VenueOption {
  id: string
  name: string
  city: string
  capacity: number
  seatMap?: { sections?: SeatSection[] } | null
  seatingMode?: 'GENERAL_ADMISSION' | 'NUMBERED'
  seats?: { tierLabel: string }[]
  zonePrices?: { level: string; zoneName: string; suggestedPrice: number | null }[]
  rateType?: 'HOURLY' | 'DAILY' | 'FLEXIBLE' | null
  hourlyRate?: number | null
  dailyRate?: number | null
  minDurationHours?: number | null
  dayRates?: VenueDayRate[]
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '6px',
  border: '1px solid rgba(14,12,10,0.15)',
  background: '#fff',
  fontSize: '14px',
  color: '#0E0C0A',
}

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  marginBottom: '6px',
  color: '#0E0C0A',
}

const EVENT_TYPES = ['OPEN_MIC', 'STAND_UP', 'POETRY', 'THEATER', 'LINEUP']
// Generous but real-world cap, same reasoning as MAX_EVENT_SEATS server-side
// (src/app/api/events/route.ts) - no legitimate lineup approaches this,
// it's here purely to stop a fat-fingered huge number from reaching the
// DB unclamped.
const MAX_PERFORMERS = 500

export default function CreateEventPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { showToast } = useToast()
  const [venues, setVenues] = useState<VenueOption[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  // Surfaces an error both inline (existing banner, kept for context/
  // accessibility) and as a toast (visible without scrolling back up -
  // this form is long and the submit button sits well below the fold).
  const fail = (message: string) => {
    setError(message)
    showToast(message, 'error')
  }

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'OPEN_MIC',
    date: '',
    startTime: '',
    endTime: '',
    totalSeats: '',
    dresscode: '',
    vibe: '',
  })
  const [isFree, setIsFree] = useState(true)
  const [ticketPrice, setTicketPrice] = useState('')
  const [surpriseAct, setSurpriseAct] = useState(false)
  const [venueId, setVenueId] = useState('')
  const [bookingAmount, setBookingAmount] = useState('')
  // §4.5 - performer economics + booking cap, Event-level (E8/E9/E13)
  const [maxPerformers, setMaxPerformers] = useState('')
  const [applicationApprovalMode, setApplicationApprovalMode] = useState<'MANUAL' | 'AUTO'>('MANUAL')
  const [maxSeatsPerBooking, setMaxSeatsPerBooking] = useState('4')

  // Same class of bug as the Seating & Pricing totals (PR #102): the
  // input's `max` attribute is cosmetic on this custom-submit form,
  // so it doesn't stop anyone typing past it - the label right below
  // promises "1-10" but nothing enforced that at the field itself.
  const handleMaxSeatsPerBookingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target
    if (value === '') {
      setMaxSeatsPerBooking('')
      return
    }
    const num = Number(value)
    if (!Number.isFinite(num)) return
    setMaxSeatsPerBooking(String(Math.max(1, Math.min(num, 10))))
  }
  // Same class of bug as PR #100/#102/#103 (unbounded numeric inputs) -
  // this field was missed in those passes. A user typed an enormous
  // number here (1e18), which had no server-side cap and no client-side
  // clamp, and crashed prisma.event.create() with a Postgres integer
  // overflow instead of a real validation message. Found via a live
  // feedback report + Vercel runtime error correlation, not code review.
  const handleMaxPerformersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target
    if (value === '') {
      setMaxPerformers('')
      return
    }
    const num = Number(value)
    if (!Number.isFinite(num)) return
    setMaxPerformers(String(Math.max(1, Math.min(num, MAX_PERFORMERS))))
  }
  const [platformFee, setPlatformFee] = useState<number | null>(null)
  const [plusOnesRequired, setPlusOnesRequired] = useState('0')
  // Same clamp-on-change discipline as maxSeatsPerBooking/maxPerformers
  // above - unbounded numeric inputs have crashed prisma.event.create()
  // before (PR #100-103), server-side cap exists too, this is just the UX
  // half. 20 is a generous ceiling - no realistic open-mic circuit needs
  // more mandatory supporters than that per artist.
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
  // §4.5 - per-section ticket pricing. Keyed by section name, since the
  // Organiser only ever edits price here - section names/capacities stay
  // owned by the Venue Owner's own seat map.
  const [tierPrices, setTierPrices] = useState<Record<string, string>>({})

  const selectedVenue = venues.find((v) => v.id === venueId)
  // GA: unchanged, reads the Venue Owner's own seatMap.sections. NUMBERED:
  // that field is dead weight for these venues (never populated by the
  // seat-map builder) - real pricing sections come from Seat.tierLabel
  // (the zone) grouped into counts, with VenueZonePrice as a starting
  // suggested price the organiser can still override below, same as GA.
  // Known simplification: zones are aggregated by name across ALL levels
  // - a same-named zone on two different levels merges into one priced
  // tier here. Level-aware event pricing is a separate follow-up.
  const numberedZoneSections: SeatSection[] =
    selectedVenue?.seatingMode === 'NUMBERED'
      ? Object.entries(
          (selectedVenue.seats || []).reduce<Record<string, number>>((acc, s) => {
            acc[s.tierLabel] = (acc[s.tierLabel] || 0) + 1
            return acc
          }, {})
        ).map(([zoneName, seatCount]) => ({
          name: zoneName,
          seats: seatCount,
          price: selectedVenue.zonePrices?.find((z) => z.zoneName === zoneName)?.suggestedPrice || 0,
        }))
      : []
  const venueSections =
    selectedVenue?.seatingMode === 'NUMBERED'
      ? numberedZoneSections
      : selectedVenue?.seatMap?.sections?.filter((s) => s.name && s.seats) || []
  const usingTierPricing = venueSections.length > 0

  // §4.5 - suggested rental amount, computed from the venue's own published
  // rate rather than asking the Organiser to guess a number blind. Only
  // possible for Hourly/Daily venues, which have an actual rate to compute
  // from - Flexible venues don't publish one, that's the whole point.
  const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
  const eventDayOfWeek = formData.date ? DAY_NAMES[new Date(formData.date + 'T00:00:00').getDay()] : null
  const dayOverride = selectedVenue?.dayRates?.find((d) => d.dayOfWeek === eventDayOfWeek)

  const durationHours = (() => {
    if (!formData.startTime || !formData.endTime) return null
    const [sh, sm] = formData.startTime.split(':').map(Number)
    const [eh, em] = formData.endTime.split(':').map(Number)
    let mins = (eh * 60 + em) - (sh * 60 + sm)
    if (mins <= 0) mins += 24 * 60 // crosses midnight
    return mins / 60
  })()

  let suggestedAmount: number | null = null
  let suggestedAmountNote = ''
  if (selectedVenue?.rateType === 'HOURLY') {
    const rate = dayOverride?.hourlyRate || selectedVenue.hourlyRate
    if (rate && durationHours) {
      const billedHours = Math.max(durationHours, selectedVenue.minDurationHours || 0)
      suggestedAmount = Math.round(rate * billedHours)
      suggestedAmountNote = `₹${rate}/hr × ${billedHours} hr${selectedVenue.minDurationHours && billedHours > durationHours ? ` (min ${selectedVenue.minDurationHours}hr)` : ''}${dayOverride?.hourlyRate ? ` — ${eventDayOfWeek?.charAt(0)}${eventDayOfWeek?.slice(1).toLowerCase()} rate` : ''}`
    }
  } else if (selectedVenue?.rateType === 'DAILY') {
    const rate = dayOverride?.dailyRate || selectedVenue.dailyRate
    if (rate) {
      suggestedAmount = rate
      suggestedAmountNote = `Day rate${dayOverride?.dailyRate ? ` — ${eventDayOfWeek?.charAt(0)}${eventDayOfWeek?.slice(1).toLowerCase()}` : ''}`
    }
  }

  useEffect(() => {
    if (suggestedAmount !== null) setBookingAmount(String(suggestedAmount))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedAmount])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    const fetchVenues = async () => {
      try {
        const res = await fetch('/api/venues')
        if (res.ok) {
          const data = await res.json()
          setVenues(data)
        }
      } catch {
        // Venue picker is optional; fail quietly and let the organiser create without one.
      }
    }
    fetchVenues()

    const fetchPlatformFee = async () => {
      try {
        const res = await fetch('/api/platform-settings')
        if (res.ok) setPlatformFee((await res.json()).flatVenueBookingFee)
      } catch {
        // Non-critical - the fee just won't show, booking still works.
      }
    }
    fetchPlatformFee()
  }, [])

  useEffect(() => {
    if (venueSections.length > 0) {
      const initial: Record<string, string> = {}
      venueSections.forEach((s) => {
        initial[s.name] = s.price ? String(s.price) : ''
      })
      setTierPrices(initial)
    } else {
      setTierPrices({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const submit = async (publish: boolean) => {
    setSaving(true)
    setError('')

    const totalSeatsValue = usingTierPricing
      ? String(venueSections.reduce((sum, s) => sum + (Number(s.seats) || 0), 0))
      : formData.totalSeats

    const requiredFields: [unknown, string][] = [
      [formData.title, 'Title'],
      [formData.description, 'Description'],
      [formData.date, 'Date'],
      [formData.startTime, 'Start time'],
      [formData.endTime, 'End time'],
      [totalSeatsValue, 'Total seats'],
    ]
    const missing = requiredFields.filter(([value]) => !value).map(([, label]) => label)
    if (missing.length > 0) {
      fail(`Please fill in the required fields: ${missing.join(', ')}.`)
      setSaving(false)
      return
    }

    if (usingTierPricing && !isFree) {
      const missingPrice = venueSections.some((s) => !tierPrices[s.name] || Number(tierPrices[s.name]) <= 0)
      if (missingPrice) {
        fail('Please set a price for every section.')
        setSaving(false)
        return
      }
    }

    const ticketTiers = usingTierPricing && !isFree
      ? venueSections.map((s) => ({
          sectionName: s.name,
          price: Number(tierPrices[s.name]),
          totalSeats: Number(s.seats),
        }))
      : undefined

    const seatsCap = Number(maxSeatsPerBooking)
    if (!seatsCap || seatsCap < 1 || seatsCap > 10) {
      fail('Max seats per booking must be between 1 and 10.')
      setSaving(false)
      return
    }

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          totalSeats: totalSeatsValue,
          isFree,
          ticketPrice: isFree || usingTierPricing ? null : ticketPrice,
          ticketTiers,
          surpriseAct,
          venueId: venueId || null,
          bookingAmount: venueId ? bookingAmount : null,
          maxPerformers: maxPerformers ? Number(maxPerformers) : null,
          applicationApprovalMode,
          maxSeatsPerBooking: seatsCap,
          plusOnesRequired: plusOnesRequired ? Number(plusOnesRequired) : 0,
          publish,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create event')
      }

      const newEvent = await res.json()
      const isVerified = (session?.user as any)?.isVerified
      if (!publish && !isVerified) {
        showToast('Saved as draft. Kindly verify your mobile number to publish this without hassle.', 'info')
      } else if (publish && venueId) {
        showToast('Event submitted — pending venue owner confirmation before it goes live.', 'info')
      }
      router.push(`/dashboard/organiser/events/${newEvent.id}`)
    } catch (err: any) {
      fail(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading') return (<><SiteNav /><div style={{ padding: '32px' }}>Loading...</div></>)
  if (!session) return <SiteNav />

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
          <Link href="/dashboard/organiser" style={{ fontSize: '14px', color: '#C8441A', textDecoration: 'none', fontWeight: 600 }}>
            ← Back to Events
          </Link>

          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#0E0C0A', marginTop: '16px', marginBottom: '8px' }}>
            Create an Event
          </h1>
          <p style={{ fontSize: '15px', color: '#0E0C0A', opacity: 0.6, marginBottom: '32px' }}>
            Set up your event details, book a venue, and publish when ready.
          </p>

          {error && (
            <div style={{ padding: '14px 16px', background: '#FDECEA', border: '1px solid #F5C2C0', borderRadius: '8px', color: '#B3261E', fontSize: '14px', marginBottom: '24px' }}>
              {error}
            </div>
          )}

          <form onSubmit={(e) => e.preventDefault()}>
            {/* Event details */}
            <section style={{ background: '#fff', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#0E0C0A', marginBottom: '20px' }}>
                Event Details
              </h2>

              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Title *</label>
                <input type="text" name="title" value={formData.title} onChange={handleChange} placeholder="e.g., Friday Night Open Mic" style={inputStyle} required />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Description *</label>
                <textarea name="description" value={formData.description} onChange={handleChange} placeholder="Tell your audience what to expect" rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} required />
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
                  <input type="text" name="dresscode" value={formData.dresscode} onChange={handleChange} placeholder="e.g., Casual" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Vibe</label>
                  <input type="text" name="vibe" value={formData.vibe} onChange={handleChange} placeholder="e.g., Chill, intimate" style={inputStyle} />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '18px', fontSize: '14px', color: '#0E0C0A' }}>
                <input type="checkbox" checked={surpriseAct} onChange={(e) => setSurpriseAct(e.target.checked)} />
                This event includes a surprise act
              </label>
            </section>

            {/* Venue booking - moved before pricing since section pricing depends on the selected venue's seat map */}
            <section style={{ background: '#fff', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#0E0C0A', marginBottom: '6px' }}>
                Book a Venue
              </h2>
              <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6, marginBottom: '18px' }}>
                Optional — you can add this later. Booking requests are sent as pending until the venue owner responds.
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
                  {selectedVenue?.rateType === 'FLEXIBLE' || !selectedVenue?.rateType ? (
                    <>
                      <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6, marginBottom: '10px' }}>
                        {selectedVenue?.rateType === 'FLEXIBLE'
                          ? "This venue uses flexible, negotiated pricing — no fixed rate published. Propose an amount below; the venue owner can confirm or come back with a different number."
                          : "This venue hasn't set a rental rate yet — propose an amount to offer."}
                      </p>
                      <label style={labelStyle}>Offer Amount (₹) <span style={{ fontWeight: 400, opacity: 0.6 }}>— what you'll pay the venue</span></label>
                      <input type="number" value={bookingAmount} onChange={(e) => setBookingAmount(e.target.value)} min="0" placeholder="e.g., 5000" style={inputStyle} />
                    </>
                  ) : (
                    <>
                      <div style={{ background: '#F7F3EE', borderRadius: '8px', padding: '12px 14px', marginBottom: '10px' }}>
                        <div style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.6, marginBottom: '2px' }}>
                          {selectedVenue.rateType === 'HOURLY' ? 'Hourly rate' : 'Daily rate'}
                          {suggestedAmountNote && ` · ${suggestedAmountNote}`}
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: '#0E0C0A' }}>
                          {suggestedAmount !== null ? `₹${suggestedAmount.toLocaleString('en-IN')}` : 'Set your event date & time to calculate'}
                        </div>
                      </div>
                      <label style={labelStyle}>Offer Amount (₹) <span style={{ fontWeight: 400, opacity: 0.6 }}>— pre-filled from the venue's rate, editable</span></label>
                      <input type="number" value={bookingAmount} onChange={(e) => setBookingAmount(e.target.value)} min="0" placeholder="e.g., 5000" style={inputStyle} />
                    </>
                  )}
                  {platformFee !== null && platformFee > 0 && (
                    <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.55, marginTop: '10px' }}>
                      + ₹{platformFee.toLocaleString('en-IN')} platform booking fee, charged on top of the rental amount when this booking is confirmed.
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* Seats & pricing */}
            <section style={{ background: '#fff', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#0E0C0A', marginBottom: '20px' }}>
                Seats & Ticket Price
              </h2>

              <div style={{ display: 'flex', gap: '20px', marginBottom: '18px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#0E0C0A' }}>
                  <input type="radio" checked={isFree} onChange={() => setIsFree(true)} /> Free entry
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#0E0C0A' }}>
                  <input type="radio" checked={!isFree} onChange={() => setIsFree(false)} /> Paid entry
                </label>
              </div>

              {usingTierPricing ? (
                <div>
                  <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6, marginBottom: '14px' }}>
                    Sections and seat counts come from {selectedVenue?.name}'s seat map — you only set the price per section for this event.
                  </p>
                  {venueSections.map((s) => (
                    <div key={s.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 0', borderBottom: '1px solid rgba(14,12,10,0.06)' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#0E0C0A' }}>{s.name}</div>
                        <div style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.5 }}>{s.seats} seats</div>
                      </div>
                      {!isFree ? (
                        <input
                          type="number"
                          value={tierPrices[s.name] || ''}
                          onChange={(e) => setTierPrices((prev) => ({ ...prev, [s.name]: e.target.value }))}
                          min="0"
                          placeholder="₹ price"
                          style={{ ...inputStyle, width: '120px' }}
                        />
                      ) : (
                        <span style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.5 }}>Free</span>
                      )}
                    </div>
                  ))}
                  <p style={{ fontSize: '12px', color: '#0E0C0A', opacity: 0.5, marginTop: '14px' }}>
                    Total capacity: {venueSections.reduce((sum, s) => sum + (Number(s.seats) || 0), 0)} seats across {venueSections.length} section{venueSections.length === 1 ? '' : 's'}
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: '18px' }}>
                    <label style={labelStyle}>Total Seats *</label>
                    <input type="number" name="totalSeats" value={formData.totalSeats} onChange={handleChange} min="1" placeholder="e.g., 50" style={inputStyle} required />
                  </div>
                  {!isFree && (
                    <div>
                      <label style={labelStyle}>Ticket Price (₹)</label>
                      <input type="number" value={ticketPrice} onChange={(e) => setTicketPrice(e.target.value)} min="0" placeholder="e.g., 199" style={inputStyle} />
                    </div>
                  )}
                </>
              )}
            </section>

            {/* Lineup & approvals */}
            <section style={{ background: '#fff', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#0E0C0A', marginBottom: '18px' }}>
                Lineup &amp; Approvals
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }}>
                <div>
                  <label style={labelStyle}>Max Performers <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></label>
                  <input type="number" value={maxPerformers} onChange={handleMaxPerformersChange} min="1" max={MAX_PERFORMERS} maxLength={3} placeholder="e.g., 6" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Max Seats Per Booking</label>
                  <input type="number" value={maxSeatsPerBooking} onChange={handleMaxSeatsPerBookingChange} min="1" max="10" maxLength={2} style={inputStyle} />
                  <p style={{ fontSize: '11px', color: '#0E0C0A', opacity: 0.5, marginTop: '4px' }}>1–10, applies across all sections combined per booking.</p>
                </div>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Require a &quot;+1&quot; per artist <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></label>
                <input type="number" value={plusOnesRequired} onChange={handlePlusOnesRequiredChange} min="0" max="20" maxLength={2} placeholder="0" style={{ ...inputStyle, maxWidth: '120px' }} />
                <p style={{ fontSize: '11px', color: '#0E0C0A', opacity: 0.5, marginTop: '4px' }}>
                  Each artist in the lineup must have this many audience members confirm they're coming to support them - included in the artist&apos;s spot fee, no extra charge. Set to 0 if not required.
                </p>
              </div>

              <div>
                <label style={labelStyle}>Artist Application Approval</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['MANUAL', 'AUTO'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setApplicationApprovalMode(mode)}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                        border: applicationApprovalMode === mode ? '2px solid #C8441A' : '1px solid rgba(14,12,10,0.15)',
                        background: applicationApprovalMode === mode ? 'rgba(200,68,26,0.08)' : '#fff',
                        color: applicationApprovalMode === mode ? '#C8441A' : '#0E0C0A',
                      }}
                    >
                      {mode === 'MANUAL' ? 'Manual — I review each one' : 'Auto — verified artists only'}
                    </button>
                  ))}
                </div>
                {applicationApprovalMode === 'AUTO' && (
                  <p style={{ fontSize: '11px', color: '#0E0C0A', opacity: 0.5, marginTop: '6px' }}>
                    Applications auto-accept as free/exposure slots up to your Max Performers cap. You can still edit compensation per performer afterward.
                  </p>
                )}
              </div>
            </section>

            {/* Actions */}
            {venueId && (
              <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6, marginBottom: '12px' }}>
                Since you've attached a venue, this event goes to <strong>Pending</strong> when published, not live yet -
                it'll go public automatically once the venue owner confirms your booking request.
              </p>
            )}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                type="button"
                disabled={saving}
                onClick={() => submit(true)}
                style={{ fontSize: '14px', fontWeight: 600, color: '#F7F3EE', background: '#C8441A', border: 'none', borderRadius: '8px', padding: '12px 26px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Publishing...' : 'Publish Event'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => submit(false)}
                style={{ fontSize: '14px', fontWeight: 600, color: '#0E0C0A', background: 'transparent', border: '1px solid rgba(14,12,10,0.2)', borderRadius: '8px', padding: '12px 26px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
              >
                Save as Draft
              </button>
              <Link href="/dashboard/organiser" style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.6, textDecoration: 'none', marginLeft: '4px' }}>
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </main>
    </>
  )
}
