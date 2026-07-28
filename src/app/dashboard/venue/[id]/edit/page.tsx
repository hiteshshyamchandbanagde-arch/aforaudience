'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import BackLink from '@/components/BackLink'
import SeatSectionEditor, { SeatSection, findDuplicateSectionNames, findIncompleteSections } from '@/components/SeatSectionEditor'
import FacilitiesPicker from '@/components/FacilitiesPicker'
import { useToast } from '@/components/Toast'
import BrandLoader from '@/components/BrandLoader'
import CityAutocomplete from '@/components/CityAutocomplete'
import HelpIcon from '@/components/HelpIcon'
import { buildDirectionsUrl } from '@/lib/maps-url'
import AddressAutocomplete from '@/components/AddressAutocomplete'

interface Venue {
  id: string
  name: string
  address: string
  city: string
  state?: string | null
  country?: string | null
  lat?: number | null
  lng?: number | null
  placeId?: string | null
  capacity: number
  facilities: string[]
  acousticRating?: number
  mapsUrl?: string | null
  seatMap?: { sections?: SeatSection[] } | null
  isApproved: boolean
  seatingMode: 'GENERAL_ADMISSION' | 'NUMBERED'
  rateType?: 'HOURLY' | 'DAILY' | 'FLEXIBLE' | null
  hourlyRate?: number | null
  dailyRate?: number | null
  minDurationHours?: number | null
  dayRates?: { dayOfWeek: string; hourlyRate: number | null; dailyRate: number | null }[]
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

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

export default function VenueEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const [venue, setVenue] = useState<Venue | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({ name: '', address: '', city: '', state: '', country: '', lat: '', lng: '', placeId: '', acousticRating: '', mapsUrl: '' })
  const [facilities, setFacilities] = useState<string[]>([])
  const [sections, setSections] = useState<SeatSection[]>([])
  const [rateType, setRateType] = useState<'HOURLY' | 'DAILY' | 'FLEXIBLE'>('FLEXIBLE')
  const [hourlyRate, setHourlyRate] = useState('')
  const [dailyRate, setDailyRate] = useState('')
  const [minDurationHours, setMinDurationHours] = useState('')
  const [useDayOverrides, setUseDayOverrides] = useState(false)
  const [dayRates, setDayRates] = useState<Record<string, string>>({
    MONDAY: '', TUESDAY: '', WEDNESDAY: '', THURSDAY: '', FRIDAY: '', SATURDAY: '', SUNDAY: '',
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    const fetchVenue = async () => {
      try {
        const res = await fetch(`/api/venues/${id}/owner`)
        if (!res.ok) {
          if (res.status === 403) throw new Error('You do not have access to this venue')
          throw new Error('Venue not found')
        }
        const data: Venue = await res.json()
        setVenue(data)
        setFormData({
          name: data.name,
          address: data.address,
          city: data.city,
          state: data.state || '',
          country: data.country || '',
          lat: data.lat != null ? String(data.lat) : '',
          lng: data.lng != null ? String(data.lng) : '',
          placeId: data.placeId || '',
          acousticRating: data.acousticRating != null ? String(data.acousticRating) : '',
          mapsUrl: data.mapsUrl || '',
        })
        setFacilities(data.facilities || [])
        setSections(
          data.seatMap?.sections && data.seatMap.sections.length > 0
            ? data.seatMap.sections
            : [{ id: makeId(), name: '', seats: '', price: '' }]
        )
        setRateType(data.rateType || 'FLEXIBLE')
        setHourlyRate(data.hourlyRate != null ? String(data.hourlyRate) : '')
        setDailyRate(data.dailyRate != null ? String(data.dailyRate) : '')
        setMinDurationHours(data.minDurationHours != null ? String(data.minDurationHours) : '')
        if (data.dayRates && data.dayRates.length > 0) {
          setUseDayOverrides(true)
          setDayRates((prev) => {
            const next = { ...prev }
            for (const d of data.dayRates!) {
              const val = data.rateType === 'HOURLY' ? d.hourlyRate : d.dailyRate
              if (val != null) next[d.dayOfWeek] = String(val)
            }
            return next
          })
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchVenue()
    }
  }, [session, id])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const save = async (publishOverride?: boolean) => {
    setSaving(true)

    // Rule (Hitesh, 27 Jul): same as venue creation - a section row that
    // exists must be filled in or removed by the owner, never silently
    // dropped at save time.
    if (venue?.seatingMode === 'GENERAL_ADMISSION') {
      if (sections.length === 0) {
        showToast('Add at least one seating section with a name and seat count.', 'error')
        setSaving(false)
        return
      }
      const incomplete = findIncompleteSections(sections)
      if (incomplete.length > 0) {
        showToast(`${incomplete.length} section${incomplete.length === 1 ? '' : 's'} ${incomplete.length === 1 ? 'is' : 'are'} missing a name or seat count - fill ${incomplete.length === 1 ? 'it' : 'them'} in or remove ${incomplete.length === 1 ? 'it' : 'them'} with the ✕ button before saving.`, 'error')
        setSaving(false)
        return
      }
    }
    // Same decoupling as venue creation (PR #146) - a NUMBERED venue's
    // real seat structure lives in Seat Map Builder, not this GA section
    // editor. This form was never updated for that when #146 shipped,
    // so editing a NUMBERED venue was incorrectly forced through GA
    // section validation regardless of seatingMode.
    const duplicateSectionNames = findDuplicateSectionNames(sections)
    if (venue?.seatingMode === 'GENERAL_ADMISSION' && duplicateSectionNames.length > 0) {
      showToast(`Section name${duplicateSectionNames.length === 1 ? '' : 's'} "${duplicateSectionNames.join('", "')}" ${duplicateSectionNames.length === 1 ? 'is' : 'are'} used more than once - each section needs a unique name.`, 'error')
      setSaving(false)
      return
    }

    if (rateType === 'HOURLY' && (!hourlyRate || Number(hourlyRate) <= 0)) {
      showToast('Set an hourly rental rate.', 'error')
      setSaving(false)
      return
    }
    if (rateType === 'DAILY' && (!dailyRate || Number(dailyRate) <= 0)) {
      showToast('Set a daily rental rate.', 'error')
      setSaving(false)
      return
    }

    const dayRatesPayload = useDayOverrides && rateType !== 'FLEXIBLE'
      ? Object.entries(dayRates)
          .filter(([, v]) => v && Number(v) > 0)
          .map(([dayOfWeek, v]) => ({
            dayOfWeek,
            ...(rateType === 'HOURLY' ? { hourlyRate: Number(v) } : { dailyRate: Number(v) }),
          }))
      : []

    try {
      const res = await fetch(`/api/venues/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          acousticRating: formData.acousticRating ? parseFloat(formData.acousticRating) : null,
          facilities,
          seatMap: venue?.seatingMode === 'GENERAL_ADMISSION' ? { sections } : undefined,
          rateType,
          hourlyRate: rateType === 'HOURLY' && hourlyRate ? Number(hourlyRate) : null,
          dailyRate: rateType === 'DAILY' && dailyRate ? Number(dailyRate) : null,
          minDurationHours: minDurationHours ? Number(minDurationHours) : null,
          dayRates: dayRatesPayload,
          ...(publishOverride !== undefined ? { publish: publishOverride } : {}),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update venue')
      }

      showToast('Venue saved.', 'success')
      router.push(`/dashboard/venue/${id}`)
    } catch (err: any) {
      showToast(err.message || 'Failed to update venue', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) return (<><SiteNav /><BrandLoader /></>)
  if (!session) return <SiteNav />
  if (error && !venue) return (<><SiteNav /><div style={{ padding: '32px', color: 'var(--afa-error)' }}>{error}</div></>)
  if (!venue) return (<><SiteNav /><div style={{ padding: '32px' }}>Venue not found</div></>)

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: 'var(--afa-cream)', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
          <BackLink href={`/dashboard/venue/${id}`} label="Back to Venue" />

          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: 'var(--afa-ink)', marginTop: '16px', marginBottom: '8px' }}>
            Edit Venue
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '32px' }}>
            Update your venue details and seating layout.
          </p>

          <form onSubmit={(e) => e.preventDefault()}>
            <section style={{ background: 'var(--afa-white)', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '20px' }}>
                Basic Details
              </h2>

              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Venue Name *</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} style={inputStyle} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px', marginBottom: '18px' }}>
                <div>
                  <label style={labelStyle}>Address *</label>
                  <AddressAutocomplete
                    value={formData.address}
                    onChange={(address) => setFormData((prev) => ({ ...prev, address }))}
                    onManualEdit={() => setFormData((prev) => ({ ...prev, lat: '', lng: '', placeId: '' }))}
                    onResolved={(loc) =>
                      setFormData((prev) => ({
                        ...prev,
                        city: loc.city || prev.city,
                        state: loc.state ?? prev.state,
                        country: loc.country ?? prev.country,
                        lat: loc.lat != null ? String(loc.lat) : prev.lat,
                        lng: loc.lng != null ? String(loc.lng) : prev.lng,
                        placeId: loc.placeId ?? prev.placeId,
                      }))
                    }
                    inputStyle={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>City *</label>
                  <CityAutocomplete
                    value={formData.city}
                    onChange={(city) => setFormData((prev) => ({ ...prev, city, state: '', country: '' }))}
                    onResolved={(loc) =>
                      setFormData((prev) => ({ ...prev, city: loc.city || prev.city, state: loc.state ?? '', country: loc.country ?? '' }))
                    }
                    inputStyle={inputStyle}
                  />
                  {(formData.state || formData.country) && (
                    <p style={{ fontSize: '12px', color: 'var(--afa-ink)', opacity: 0.55, marginTop: '4px' }}>
                      {[formData.state, formData.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </div>

              {/* Moved directly after Address/City/State/Country (PR #212) -
                  see venue create page for the full rationale. */}
              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Google Maps Link</label>
                {formData.lat && formData.lng ? (
                  <>
                    <a
                      href={buildDirectionsUrl({
                        placeId: formData.placeId,
                        lat: formData.lat ? Number(formData.lat) : null,
                        lng: formData.lng ? Number(formData.lng) : null,
                        address: formData.address,
                        city: formData.city,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ ...inputStyle, display: 'inline-flex', alignItems: 'center', textDecoration: 'none', color: 'var(--afa-terracotta)', fontWeight: 600 }}
                    >
                      📍 Directions
                    </a>
                    <p style={{ fontSize: '12px', color: 'var(--afa-ink)', opacity: 0.5, marginTop: '6px' }}>
                      Derived automatically from the address you picked above. Edit the address to change it.
                    </p>
                  </>
                ) : (
                  <>
                    <input type="url" name="mapsUrl" value={formData.mapsUrl} onChange={handleChange} placeholder="e.g., https://maps.app.goo.gl/..." style={inputStyle} />
                    <p style={{ fontSize: '12px', color: 'var(--afa-ink)', opacity: 0.5, marginTop: '6px' }}>
                      Optional - improves accuracy. Get Directions still works from your address either way.
                    </p>
                  </>
                )}
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Facilities</label>
                <FacilitiesPicker value={facilities} onChange={setFacilities} />
              </div>

              <div>
                <label style={labelStyle}>Acoustic Rating <span style={{ fontWeight: 400, opacity: 0.6 }}>(0-5)</span></label>
                <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--afa-ink)', opacity: 0.5 }}>Not Rated Yet</p>
                <p style={{ fontSize: '12px', color: 'var(--afa-ink)', opacity: 0.5, marginTop: '4px' }}>
                  Based on real feedback from Artists and Organisers who've performed/booked here - not self-reported.
                </p>
              </div>
            </section>

            {/* Rental Rate - was entirely missing from this edit form until
                now (session 39 finding, Hitesh) - an owner had no way to
                update their rate, including day-wise overrides, after
                venue creation. Mirrors venue create page's section exactly. */}
            <section style={{ background: 'var(--afa-white)', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '6px' }}>
                Rental Rate
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '18px' }}>
                What Organisers pay to book your space - separate from the ticket prices audiences pay, which you set per section above.
              </p>

              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center' }}>
                Rate Type
                <HelpIcon text={'Hourly and Daily publish a fixed rate. Flexible means no fixed rate - Organisers send you a date and duration, and you respond with a quote before it\'s confirmed.'} />
              </label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
                {(['HOURLY', 'DAILY', 'FLEXIBLE'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setRateType(t)}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                      border: rateType === t ? '2px solid var(--afa-terracotta)' : '1px solid rgba(14,12,10,0.15)',
                      background: rateType === t ? 'rgba(200,68,26,0.08)' : 'var(--afa-white)',
                      color: rateType === t ? 'var(--afa-terracotta)' : 'var(--afa-ink)',
                    }}
                  >
                    {t === 'HOURLY' ? 'Hourly' : t === 'DAILY' ? 'Daily' : 'Flexible'}
                  </button>
                ))}
              </div>

              {rateType === 'HOURLY' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px', marginBottom: '8px' }}>
                  <div>
                    <label style={labelStyle}>Rate per hour (₹) *</label>
                    <input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} min="0" placeholder="e.g., 2500" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Minimum duration (hours)</label>
                    <input type="number" value={minDurationHours} onChange={(e) => setMinDurationHours(e.target.value)} min="1" placeholder="e.g., 3" style={inputStyle} />
                  </div>
                </div>
              )}

              {rateType === 'DAILY' && (
                <div style={{ marginBottom: '8px' }}>
                  <label style={labelStyle}>Rate per day (₹) *</label>
                  <input type="number" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} min="0" placeholder="e.g., 15000" style={{ ...inputStyle, maxWidth: '240px' }} />
                </div>
              )}

              {rateType === 'FLEXIBLE' && (
                <p style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.6 }}>
                  No fixed rate published. Organisers will send you a duration and date, and you'll respond with a quote before it's confirmed.
                </p>
              )}

              {rateType !== 'FLEXIBLE' && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(14,12,10,0.06)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--afa-ink)', marginBottom: useDayOverrides ? '14px' : 0 }}>
                    <input type="checkbox" checked={useDayOverrides} onChange={(e) => setUseDayOverrides(e.target.checked)} />
                    Charge differently on specific days <span style={{ fontWeight: 400, opacity: 0.6 }}>(e.g., a weekend premium)</span>
                  </label>

                  {useDayOverrides && (
                    <div>
                      <p style={{ fontSize: '12px', color: 'var(--afa-ink)', opacity: 0.5, marginBottom: '10px' }}>
                        Leave a day blank to use your base rate above for that day.
                      </p>
                      {(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const).map((day) => (
                        <div key={day} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(14,12,10,0.05)' }}>
                          <span style={{ fontSize: '13px', color: 'var(--afa-ink)' }}>{day.charAt(0) + day.slice(1).toLowerCase()}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--afa-ink)', opacity: 0.5 }}>₹</span>
                            <input
                              type="number"
                              value={dayRates[day]}
                              onChange={(e) => setDayRates((prev) => ({ ...prev, [day]: e.target.value }))}
                              min="0"
                              placeholder={rateType === 'HOURLY' ? hourlyRate || '—' : dailyRate || '—'}
                              style={{ ...inputStyle, width: '110px' }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            <section style={{ background: 'var(--afa-white)', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '6px' }}>
                Seating & Pricing
              </h2>

              {venue.seatingMode === 'GENERAL_ADMISSION' && (
                <>
                  <p style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '18px' }}>
                    Add, edit, or remove sections freely — capacity updates automatically.
                  </p>
                  <SeatSectionEditor sections={sections} onChange={setSections} />

                  <div style={{ marginTop: '20px', padding: '16px', borderRadius: '10px', background: 'var(--afa-cream-tint-1)', border: '1px solid rgba(14,12,10,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--afa-ink)' }}>Have real numbered seats instead?</div>
                      <div style={{ fontSize: '12px', color: 'var(--afa-ink)', opacity: 0.6 }}>
                        Section pricing above is for General Admission. Use the Seat Map builder to lay out individual numbered seats on a canvas matching your venue's shape.
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/venue/${id}/seat-map`}
                      style={{ flexShrink: 0, fontSize: '13px', fontWeight: 700, color: 'var(--afa-cream)', background: 'var(--afa-ink)', textDecoration: 'none', padding: '10px 18px', borderRadius: '8px', whiteSpace: 'nowrap' }}
                    >
                      Open Seat Map Builder →
                    </Link>
                  </div>
                </>
              )}

              {venue.seatingMode === 'NUMBERED' && (
                <div style={{ padding: '16px', borderRadius: '10px', background: 'var(--afa-cream-tint-1)', border: '1px solid rgba(14,12,10,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--afa-ink)' }}>This venue uses Numbered Seating</div>
                    <div style={{ fontSize: '12px', color: 'var(--afa-ink)', opacity: 0.6 }}>
                      Seats, rows, and sections are managed entirely in the Seat Map Builder — nothing to fill in here. Capacity ({venue.capacity} seats) reflects your saved seat map.
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/venue/${id}/seat-map`}
                    style={{ flexShrink: 0, fontSize: '13px', fontWeight: 700, color: 'var(--afa-cream)', background: 'var(--afa-ink)', textDecoration: 'none', padding: '10px 18px', borderRadius: '8px', whiteSpace: 'nowrap' }}
                  >
                    Open Seat Map Builder →
                  </Link>
                </div>
              )}
            </section>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={saving}
                onClick={() => save(true)}
                style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-cream)', background: 'var(--afa-terracotta)', border: 'none', borderRadius: '8px', padding: '12px 26px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Saving...' : venue.isApproved ? 'Save Changes' : 'Save & Publish'}
              </button>
              {venue.isApproved ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => save(false)}
                  style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-ink)', background: 'transparent', border: '1px solid rgba(14,12,10,0.2)', borderRadius: '8px', padding: '12px 26px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
                >
                  Save & Unpublish
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => save(undefined)}
                  style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-ink)', background: 'transparent', border: '1px solid rgba(14,12,10,0.2)', borderRadius: '8px', padding: '12px 26px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
                >
                  Save as Draft
                </button>
              )}
              <Link href={`/dashboard/venue/${id}`} style={{ fontSize: '14px', color: 'var(--afa-ink)', opacity: 0.6, textDecoration: 'none' }}>
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </main>
    </>
  )
}
