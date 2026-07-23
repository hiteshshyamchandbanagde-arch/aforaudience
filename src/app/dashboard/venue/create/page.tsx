'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import { useToast } from '@/components/Toast'
import SeatSectionEditor, { SeatSection } from '@/components/SeatSectionEditor'

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

export default function CreateVenuePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { showToast } = useToast()
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const fail = (message: string) => {
    setError(message)
    showToast(message, 'error')
  }
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    acousticRating: '',
    mapsUrl: '',
  })
  const [facilitiesInput, setFacilitiesInput] = useState('')
  const [sections, setSections] = useState<SeatSection[]>([
    { id: makeId(), name: '', seats: '', price: '' },
  ])

  // Decouples venue creation from the GA section/price form - an owner
  // who plans to use Numbered Seating shouldn't have to invent a
  // throwaway section just to get past this form. They still need SOME
  // capacity number for listing/search purposes until they build the
  // real seat map, so we ask for one plain number instead.
  const [seatingChoice, setSeatingChoice] = useState<'GENERAL_ADMISSION' | 'NUMBERED'>('GENERAL_ADMISSION')
  const [approxCapacity, setApproxCapacity] = useState('')

  // §4.5 - rental rate the Organiser pays to book this venue, separate
  // from the section ticket prices above (which are for the audience).
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

  // Draft persistence across the verify-phone redirect (bug: form state
  // was purely in-memory, so clicking "Verify now" mid-fill and coming
  // back via /verify-phone?next=... remounted this page empty). Restored
  // once on mount, kept fresh on every change, cleared on successful
  // submit. sessionStorage (not localStorage) so it doesn't linger across
  // unrelated tabs/sessions once this tab is closed.
  const DRAFT_KEY = 'afa:venueCreateDraft'
  const [draftRestored, setDraftRestored] = useState(false)

  useEffect(() => {
    if (draftRestored) return
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY)
      if (raw) {
        const draft = JSON.parse(raw)
        if (draft.formData) setFormData(draft.formData)
        if (typeof draft.facilitiesInput === 'string') setFacilitiesInput(draft.facilitiesInput)
        if (Array.isArray(draft.sections)) setSections(draft.sections)
        if (draft.seatingChoice) setSeatingChoice(draft.seatingChoice)
        if (typeof draft.approxCapacity === 'string') setApproxCapacity(draft.approxCapacity)
        if (draft.rateType) setRateType(draft.rateType)
        if (typeof draft.hourlyRate === 'string') setHourlyRate(draft.hourlyRate)
        if (typeof draft.dailyRate === 'string') setDailyRate(draft.dailyRate)
        if (typeof draft.minDurationHours === 'string') setMinDurationHours(draft.minDurationHours)
        if (typeof draft.useDayOverrides === 'boolean') setUseDayOverrides(draft.useDayOverrides)
        if (draft.dayRates) setDayRates(draft.dayRates)
        showToast('Restored your in-progress venue details.', 'success')
      }
    } catch {
      // Corrupt/unreadable draft - ignore and start fresh rather than block the page.
    } finally {
      setDraftRestored(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!draftRestored) return // don't overwrite a saved draft with pre-restore defaults
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        formData, facilitiesInput, sections, seatingChoice, approxCapacity,
        rateType, hourlyRate, dailyRate, minDurationHours, useDayOverrides, dayRates,
      }))
    } catch {
      // Storage full/unavailable - not worth surfacing to the user mid-fill.
    }
  }, [draftRestored, formData, facilitiesInput, sections, seatingChoice, approxCapacity, rateType, hourlyRate, dailyRate, minDurationHours, useDayOverrides, dayRates])

  const clearDraft = () => {
    try { sessionStorage.removeItem(DRAFT_KEY) } catch { /* noop */ }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Same class of bug as the Seating & Pricing totals (PR #102): the
  // input's `max` attribute is cosmetic on these custom-submit forms,
  // so it doesn't stop anyone typing past it. Clamp on change instead.
  const handleAcousticRatingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target
    if (value === '') {
      setFormData((prev) => ({ ...prev, acousticRating: '' }))
      return
    }
    const num = Number(value)
    if (!Number.isFinite(num)) return
    const clamped = Math.max(0, Math.min(num, 5))
    setFormData((prev) => ({ ...prev, acousticRating: String(clamped) }))
  }

  const submit = async (publish: boolean) => {
    setSaving(true)
    setError('')

    const requiredFields: [string, string][] = [
      ['name', 'Venue Name'],
      ['address', 'Address'],
      ['city', 'City'],
    ]
    const missing = requiredFields
      .filter(([key]) => !String(formData[key as keyof typeof formData]).trim())
      .map(([, label]) => label)
    if (missing.length > 0) {
      fail(`Please fill in the required fields: ${missing.join(', ')}.`)
      setSaving(false)
      return
    }

    const validSections = sections.filter((s) => s.name.trim() && Number(s.seats) > 0)

    if (seatingChoice === 'GENERAL_ADMISSION' && validSections.length === 0) {
      fail('Add at least one seating section with a name and seat count.')
      setSaving(false)
      return
    }
    if (seatingChoice === 'NUMBERED' && !(Number(approxCapacity) > 0)) {
      fail('Enter an approximate seating capacity (you\'ll build the real seat-by-seat layout after creating this venue).')
      setSaving(false)
      return
    }

    if (rateType === 'HOURLY' && (!hourlyRate || Number(hourlyRate) <= 0)) {
      fail('Set an hourly rental rate.')
      setSaving(false)
      return
    }
    if (rateType === 'DAILY' && (!dailyRate || Number(dailyRate) <= 0)) {
      fail('Set a daily rental rate.')
      setSaving(false)
      return
    }

    try {
      const dayRatesPayload = useDayOverrides && rateType !== 'FLEXIBLE'
        ? Object.entries(dayRates)
            .filter(([, v]) => v && Number(v) > 0)
            .map(([dayOfWeek, v]) => ({
              dayOfWeek,
              ...(rateType === 'HOURLY' ? { hourlyRate: Number(v) } : { dailyRate: Number(v) }),
            }))
        : []

      const res = await fetch('/api/venues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          acousticRating: formData.acousticRating ? parseFloat(formData.acousticRating) : null,
          facilities: facilitiesInput.split(',').map((f) => f.trim()).filter(Boolean),
          seatingMode: seatingChoice,
          seatMap: seatingChoice === 'GENERAL_ADMISSION' ? { sections: validSections } : undefined,
          capacity: seatingChoice === 'NUMBERED' ? Number(approxCapacity) : undefined,
          rateType,
          hourlyRate: rateType === 'HOURLY' && hourlyRate ? Number(hourlyRate) : null,
          dailyRate: rateType === 'DAILY' && dailyRate ? Number(dailyRate) : null,
          minDurationHours: minDurationHours ? Number(minDurationHours) : null,
          dayRates: dayRatesPayload,
          publish,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create venue')
      }

      const newVenue = await res.json()
      clearDraft()
      const isVerified = (session?.user as any)?.isVerified
      if (!publish && !isVerified) {
        showToast('Saved as draft. Kindly verify your mobile number to publish this without hassle.', 'info')
      }
      router.push(`/dashboard/venue/${newVenue.id}`)
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
      <main style={{ minHeight: '100vh', background: 'var(--afa-cream)', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
          <Link href="/dashboard/venue" style={{ fontSize: '14px', color: 'var(--afa-terracotta)', textDecoration: 'none', fontWeight: 600 }}>
            ← Back to Venues
          </Link>

          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: 'var(--afa-ink)', marginTop: '16px', marginBottom: '8px' }}>
            Register Your Venue
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '32px' }}>
            Add your space, design its seating layout, and set your prices per section.
          </p>

          {error && (
            <div style={{ padding: '14px 16px', background: 'var(--afa-error-bg)', border: '1px solid var(--afa-error-border)', borderRadius: '8px', color: 'var(--afa-error)', fontSize: '14px', marginBottom: '24px' }}>
              {error}
            </div>
          )}

          <form onSubmit={(e) => e.preventDefault()}>
            {/* Basic details */}
            <section style={{ background: 'var(--afa-white)', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '20px' }}>
                Basic Details
              </h2>

              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Venue Name *</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="e.g., The Grand Theater" style={inputStyle} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }}>
                <div>
                  <label style={labelStyle}>Address *</label>
                  <input type="text" name="address" value={formData.address} onChange={handleChange} placeholder="e.g., 123 Main Street" style={inputStyle} required />
                </div>
                <div>
                  <label style={labelStyle}>City *</label>
                  <input type="text" name="city" value={formData.city} onChange={handleChange} placeholder="e.g., Mumbai" style={inputStyle} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }}>
                <div>
                  <label style={labelStyle}>Facilities <span style={{ fontWeight: 400, opacity: 0.6 }}>(comma separated)</span></label>
                  <input type="text" value={facilitiesInput} onChange={(e) => setFacilitiesInput(e.target.value)} placeholder="e.g., Parking, Bar, AC" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Acoustic Rating <span style={{ fontWeight: 400, opacity: 0.6 }}>(0-5)</span></label>
                  <input type="number" name="acousticRating" value={formData.acousticRating} onChange={handleAcousticRatingChange} placeholder="e.g., 4.5" min="0" max="5" step="0.5" maxLength={3} style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Google Maps Link <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></label>
                <input type="url" name="mapsUrl" value={formData.mapsUrl} onChange={handleChange} placeholder="e.g., https://maps.app.goo.gl/..." style={inputStyle} />
                <p style={{ fontSize: '12px', color: 'var(--afa-ink)', opacity: 0.5, marginTop: '6px' }}>
                  Paste a share link from Google Maps for an exact pin. If left blank, we'll use your address to build directions.
                </p>
              </div>
            </section>

            {/* Rental rate - what an Organiser pays to book this venue, separate from audience ticket prices */}
            <section style={{ background: 'var(--afa-white)', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '6px' }}>
                Rental Rate
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '18px' }}>
                What Organisers pay to book your space - separate from the ticket prices audiences pay, which you set per section above.
              </p>

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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '8px' }}>
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

            {/* Seating & pricing */}
            <section style={{ background: 'var(--afa-white)', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '6px' }}>
                Seating & Pricing
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '14px' }}>
                How is this venue's seating arranged?
              </p>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
                <button
                  type="button"
                  onClick={() => setSeatingChoice('GENERAL_ADMISSION')}
                  style={{ padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: seatingChoice === 'GENERAL_ADMISSION' ? 'none' : '1px solid rgba(14,12,10,0.15)', background: seatingChoice === 'GENERAL_ADMISSION' ? 'var(--afa-ink)' : 'var(--afa-white)', color: seatingChoice === 'GENERAL_ADMISSION' ? 'var(--afa-cream)' : 'var(--afa-ink)' }}
                >
                  Section-based (General Admission)
                </button>
                <button
                  type="button"
                  onClick={() => setSeatingChoice('NUMBERED')}
                  style={{ padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: seatingChoice === 'NUMBERED' ? 'none' : '1px solid rgba(14,12,10,0.15)', background: seatingChoice === 'NUMBERED' ? 'var(--afa-ink)' : 'var(--afa-white)', color: seatingChoice === 'NUMBERED' ? 'var(--afa-cream)' : 'var(--afa-ink)' }}
                >
                  Numbered seats — I'll build this after
                </button>
              </div>

              {seatingChoice === 'GENERAL_ADMISSION' && (
                <>
                  <p style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '18px' }}>
                    Design your own layout — add as many sections as you like (e.g. "VIP Front Row", "General", "Balcony") and set a price for each.
                  </p>
                  <SeatSectionEditor sections={sections} onChange={setSections} />
                </>
              )}

              {seatingChoice === 'NUMBERED' && (
                <div>
                  <p style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '14px' }}>
                    You'll place real, numbered seats on a canvas shaped like your venue from the Seat Map Builder once this venue is created. For now, just give an approximate total capacity — used for listings until your real layout is saved.
                  </p>
                  <label style={labelStyle}>Approximate total capacity</label>
                  <input
                    type="number"
                    min={1}
                    value={approxCapacity}
                    onChange={(e) => setApproxCapacity(e.target.value)}
                    placeholder="e.g. 250"
                    style={{ ...inputStyle, maxWidth: '160px' }}
                  />
                </div>
              )}
            </section>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {seatingChoice === 'GENERAL_ADMISSION' && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => submit(true)}
                  style={{
                    fontSize: '14px', fontWeight: 600, color: 'var(--afa-cream)', background: 'var(--afa-terracotta)',
                    border: 'none', borderRadius: '8px', padding: '12px 26px', cursor: 'pointer', opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? 'Publishing...' : 'Publish Venue'}
                </button>
              )}
              <button
                type="button"
                disabled={saving}
                onClick={() => submit(false)}
                style={{
                  fontSize: '14px', fontWeight: 600, color: 'var(--afa-ink)', background: 'transparent',
                  border: '1px solid rgba(14,12,10,0.2)', borderRadius: '8px', padding: '12px 26px', cursor: 'pointer', opacity: saving ? 0.6 : 1,
                }}
              >
                Save as Draft
              </button>
              <Link href="/dashboard/venue" onClick={clearDraft} style={{ fontSize: '14px', color: 'var(--afa-ink)', opacity: 0.6, textDecoration: 'none', marginLeft: '4px' }}>
                Cancel
              </Link>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--afa-ink)', opacity: 0.5, marginTop: '14px' }}>
              {seatingChoice === 'GENERAL_ADMISSION'
                ? 'Published venues appear immediately on the public Explore Venues page. Drafts stay private until you publish them.'
                : "Numbered venues save as a draft here. Once you've built and saved a real seat map in the Seat Map Builder, you can publish from the venue's Edit page — organisers need real zones to price against, so publishing happens after the map is real."}
            </p>
          </form>
        </div>
      </main>
    </>
  )
}
