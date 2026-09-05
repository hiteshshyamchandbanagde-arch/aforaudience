'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import BackLink from '@/components/BackLink'
import { useToast } from '@/components/Toast'
import SeatSectionEditor, { SeatSection, findDuplicateSectionNames, findIncompleteSections } from '@/components/SeatSectionEditor'
import FacilitiesPicker from '@/components/FacilitiesPicker'
import BrandLoader from '@/components/BrandLoader'
import CityAutocomplete from '@/components/CityAutocomplete'
import HelpIcon from '@/components/HelpIcon'
import { buildDirectionsUrl } from '@/lib/maps-url'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import DashboardShell from '@/components/DashboardShell'
import { PageHead, Card, SectionTitle, Button, ErrorBanner, IconSection, IconSeatGlyph, IconCheck } from '@/components/dashboard/VenuePortalUI'

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1px solid rgba(245,245,240,0.08)',
  background: '#171717',
  fontSize: '14px',
  fontFamily: 'var(--font-sans)',
  color: 'var(--afa-text-primary)',
  boxSizing: 'border-box' as const,
}

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 500,
  marginBottom: '8px',
  color: 'var(--afa-text-secondary)',
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
    state: '',
    country: '',
    lat: '',
    lng: '',
    placeId: '',
    acousticRating: '',
    mapsUrl: '',
  })
  const [facilities, setFacilities] = useState<string[]>([])
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
        if (Array.isArray(draft.facilities)) setFacilities(draft.facilities)
        else if (typeof draft.facilitiesInput === 'string') {
          // Backward-compat: a draft saved before this component existed
          // stored a comma-separated string, not an array.
          setFacilities(draft.facilitiesInput.split(',').map((f: string) => f.trim()).filter(Boolean))
        }
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
        formData, facilities, sections, seatingChoice, approxCapacity,
        rateType, hourlyRate, dailyRate, minDurationHours, useDayOverrides, dayRates,
      }))
    } catch {
      // Storage full/unavailable - not worth surfacing to the user mid-fill.
    }
  }, [draftRestored, formData, facilities, sections, seatingChoice, approxCapacity, rateType, hourlyRate, dailyRate, minDurationHours, useDayOverrides, dayRates])

  const clearDraft = () => {
    try { sessionStorage.removeItem(DRAFT_KEY) } catch { /* noop */ }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
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

    // Rule (Hitesh, 27 Jul): a section row that exists must be filled in
    // or removed by the owner - it must never be silently dropped at
    // save time, since that's data loss with zero feedback (owner adds
    // 5 sections, one has a typo'd blank name, it vanishes with no
    // warning). Validate the FULL list, not a filtered subset.
    if (seatingChoice === 'GENERAL_ADMISSION') {
      if (sections.length === 0) {
        fail('Add at least one seating section with a name and seat count.')
        setSaving(false)
        return
      }
      const incomplete = findIncompleteSections(sections)
      if (incomplete.length > 0) {
        fail(`${incomplete.length} section${incomplete.length === 1 ? '' : 's'} ${incomplete.length === 1 ? 'is' : 'are'} missing a name, seat count, or price (check "Free" for a free section) - fill ${incomplete.length === 1 ? 'it' : 'them'} in or remove ${incomplete.length === 1 ? 'it' : 'them'} with the ✕ button before saving.`)
        setSaving(false)
        return
      }
      const duplicateSectionNames = findDuplicateSectionNames(sections)
      if (duplicateSectionNames.length > 0) {
        fail(`Section name${duplicateSectionNames.length === 1 ? '' : 's'} "${duplicateSectionNames.join('", "')}" ${duplicateSectionNames.length === 1 ? 'is' : 'are'} used more than once - each section needs a unique name.`)
        setSaving(false)
        return
      }
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
          facilities,
          seatingMode: seatingChoice,
          seatMap: seatingChoice === 'GENERAL_ADMISSION' ? { sections } : undefined,
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

  if (status === 'loading') return (<><SiteNav /><DashboardShell><BrandLoader /></DashboardShell></>)
  if (!session) return (<><SiteNav /><DashboardShell>{null}</DashboardShell></>)

  return (
    <>
      <SiteNav />
      <DashboardShell>
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-page)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '780px', margin: '0 auto', padding: '48px 24px 80px' }}>
          <BackLink href="/dashboard/venue" label="Back to Venues" />

          <div style={{ marginTop: '20px' }}>
            <PageHead eyebrow="New listing" title="Register Venue" description="Add your space, design its seating layout, and set your prices per section." />
          </div>

          {error && (
            <ErrorBanner style={{ marginBottom: '24px' }}>{error}</ErrorBanner>
          )}

          <form onSubmit={(e) => e.preventDefault()}>
            {/* Basic details */}
            <Card style={{ padding: '28px', marginBottom: '20px' }}>
              <SectionTitle n="01" title="Basic Details" />

              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Venue Name *</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="e.g., The Grand Theater" style={inputStyle} required />
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
                    placeholder="e.g., The Grand Theater, or 123 Main Street"
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
                    placeholder="e.g., Mumbai"
                  />
                  {(formData.state || formData.country) && (
                    <p style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.55, marginTop: '4px' }}>
                      {[formData.state, formData.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </div>

              {/* Directly after Address/City/State/Country - keeps every
                  location-identity field grouped as one visual block,
                  before Facilities/Acoustic Rating which are a different
                  category (session 38, PR #212, Hitesh's call). Two
                  render states: read-only auto-derived link once Address
                  autocomplete has resolved (lat/lng present), or the
                  original editable paste-a-link input for manually-typed
                  addresses - Get Directions works either way, this field
                  is purely an accuracy upgrade in the manual case. */}
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
                      style={{ ...inputStyle, display: 'inline-flex', alignItems: 'center', textDecoration: 'none', color: 'var(--afa-amber)', fontWeight: 600 }}
                    >
                      📍 Directions
                    </a>
                    <p style={{ fontSize: '12px', color: 'var(--afa-text-muted)', marginTop: '6px' }}>
                      Derived automatically from the address you picked above. Edit the address to change it.
                    </p>
                  </>
                ) : (
                  <>
                    <input type="url" name="mapsUrl" value={formData.mapsUrl} onChange={handleChange} placeholder="e.g., https://maps.app.goo.gl/..." style={inputStyle} />
                    <p style={{ fontSize: '12px', color: 'var(--afa-text-muted)', marginTop: '6px' }}>
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
                <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--afa-text-muted)' }}>Not Rated Yet</p>
                <p style={{ fontSize: '12px', color: 'var(--afa-text-muted)', marginTop: '4px' }}>
                  Based on real feedback from Artists and Organisers who've performed/booked here - not self-reported.
                </p>
              </div>
            </Card>

            {/* Rental rate - what an Organiser pays to book this venue, separate from audience ticket prices */}
            <Card style={{ padding: '28px', marginBottom: '20px' }}>
              <SectionTitle n="02" title="Rental Rate" />
              <p style={{ fontSize: '13px', color: 'var(--afa-text-secondary)', marginTop: '-8px', marginBottom: '18px' }}>
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
                      border: rateType === t ? '1px solid var(--afa-amber)' : '1px solid rgba(245,245,240,0.08)',
                      background: rateType === t ? 'rgba(201,151,58,0.12)' : '#171717',
                      color: rateType === t ? 'var(--afa-amber)' : 'var(--afa-text-primary)',
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
                <p style={{ fontSize: '13px', color: 'var(--afa-text-secondary)' }}>
                  No fixed rate published. Organisers will send you a duration and date, and you'll respond with a quote before it's confirmed.
                </p>
              )}

              {rateType !== 'FLEXIBLE' && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(245,245,240,0.08)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--afa-text-primary)', marginBottom: useDayOverrides ? '14px' : 0 }}>
                    <input type="checkbox" checked={useDayOverrides} onChange={(e) => setUseDayOverrides(e.target.checked)} />
                    Charge differently on specific days <span style={{ fontWeight: 400, opacity: 0.6 }}>(e.g., a weekend premium)</span>
                  </label>

                  {useDayOverrides && (
                    <div>
                      <p style={{ fontSize: '12px', color: 'var(--afa-text-muted)', marginBottom: '10px' }}>
                        Leave a day blank to use your base rate above for that day.
                      </p>
                      {(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const).map((day) => (
                        <div key={day} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(245,245,240,0.05)' }}>
                          <span style={{ fontSize: '13px', color: 'var(--afa-text-primary)' }}>{day.charAt(0) + day.slice(1).toLowerCase()}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--afa-text-muted)' }}>₹</span>
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
            </Card>

            {/* Seating & pricing */}
            <Card style={{ padding: '28px', marginBottom: '20px' }}>
              <SectionTitle n="03" title="Seating & Pricing" />

              {/* Warm radial glow behind this key moment - matches the
                  entry-choice treatment on the Figma export's Seating &
                  Pricing fork (GEN-2608-082). Negative side/bottom margin
                  bleeds it to the card's own edges; top stays flush under
                  SectionTitle. */}
              <div className="afa-glow-orange" style={{ margin: '0 -28px -28px', padding: '4px 28px 28px', borderRadius: '0 0 12px 12px' }}>
                <p style={{ fontSize: '13px', color: 'var(--afa-text-secondary)', marginBottom: '2px' }}>
                  How is this venue's seating arranged? Pick how your audience will choose where to sit.
                </p>
                <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '15px', color: 'var(--afa-amber)', marginTop: '6px', marginBottom: '20px' }}>
                  &ldquo;every seat is a decision about the room&rdquo;
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                  <PathCard
                    title="General Admission"
                    icon={<IconSection size={20} />}
                    active={seatingChoice === 'GENERAL_ADMISSION'}
                    onClick={() => setSeatingChoice('GENERAL_ADMISSION')}
                    consequence="Audience picks a section, not a specific seat."
                    points={['Fastest to set up', 'Great for standing rooms & open floors']}
                  />
                  <PathCard
                    title="Numbered Seats"
                    icon={<IconSeatGlyph size={20} />}
                    active={seatingChoice === 'NUMBERED'}
                    onClick={() => setSeatingChoice('NUMBERED')}
                    consequence="Audience picks their exact seat on a map."
                    points={['Live seat-map builder', 'Set an approximate capacity now, refine after']}
                  />
                </div>

                {seatingChoice === 'GENERAL_ADMISSION' && (
                  <>
                    <p style={{ fontSize: '13px', color: 'var(--afa-text-secondary)', marginBottom: '18px' }}>
                      Design your own layout — add as many sections as you like (e.g. "VIP Front Row", "General", "Balcony") and set a price for each.
                    </p>
                    <SeatSectionEditor sections={sections} onChange={setSections} />
                  </>
                )}

                {seatingChoice === 'NUMBERED' && (
                  <div>
                    <p style={{ fontSize: '13px', color: 'var(--afa-text-secondary)', marginBottom: '14px' }}>
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
              </div>
            </Card>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              {seatingChoice === 'GENERAL_ADMISSION' && (
                <Button type="button" disabled={saving} onClick={() => submit(true)} style={{ padding: '12px 26px', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Publishing...' : 'Publish Venue'}
                </Button>
              )}
              <Button variant="outline" type="button" disabled={saving} onClick={() => submit(false)} style={{ padding: '12px 26px', opacity: saving ? 0.6 : 1 }}>
                Save as Draft
              </Button>
              <Link href="/dashboard/venue" onClick={clearDraft} style={{ fontSize: '14px', color: 'var(--afa-text-secondary)', textDecoration: 'none', marginLeft: '4px' }}>
                Cancel
              </Link>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--afa-text-muted)', marginTop: '14px' }}>
              {seatingChoice === 'GENERAL_ADMISSION'
                ? 'Published venues appear immediately on the public Explore Venues page. Drafts stay private until you publish them.'
                : "Numbered venues save as a draft here. Once you've built and saved a real seat map in the Seat Map Builder, you can publish from the venue's Edit page — organisers need real sections to price against, so publishing happens after the map is real."}
            </p>
          </form>
        </div>
      </main>
      </DashboardShell>
    </>
  )
}

// Seating & Pricing fork card (GEN-2608-082, ported from the Figma export's
// PathCard). Unlike Figma's mock - a one-way "choose a path" navigation into
// the next wizard step - this is a real toggle between two form states on
// the same page, so the active card shows "Selected" instead of Figma's
// always-navigate "Choose this →", and either card can be re-selected at
// any time.
function PathCard({
  title,
  icon,
  consequence,
  points,
  active,
  onClick,
}: {
  title: string
  icon: React.ReactNode
  consequence: string
  points: string[]
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`afa-path-card${active ? ' afa-path-card-active afa-card-lift' : ''}`}
      style={{
        textAlign: 'left',
        borderRadius: '12px',
        border: active ? '1px solid rgba(255,90,54,0.5)' : '1px solid rgba(245,245,240,0.12)',
        background: active ? undefined : 'var(--afa-surface-page)',
        padding: '20px',
        cursor: 'pointer',
        transition: 'border-color 150ms, transform 150ms',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            background: active ? 'rgba(255,90,54,0.2)' : 'rgba(245,245,240,0.08)',
            color: active ? 'var(--afa-fill-solid)' : 'var(--afa-text-secondary)',
          }}
        >
          {icon}
        </span>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 500, color: 'var(--afa-text-primary)', margin: 0 }}>
          {title}
        </h3>
      </div>
      <p style={{ marginTop: '14px', fontSize: '13.5px', color: 'var(--afa-text-primary)', opacity: 0.85 }}>{consequence}</p>
      <ul style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '5px', listStyle: 'none', padding: 0 }}>
        {points.map((p) => (
          <li key={p} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', color: 'var(--afa-text-secondary)' }}>
            <IconCheck size={12} style={{ color: 'var(--afa-text-muted)' }} />
            {p}
          </li>
        ))}
      </ul>
      <span style={{ display: 'inline-block', marginTop: '14px', fontSize: '13px', fontWeight: 600, color: active ? 'var(--afa-fill-solid)' : 'var(--afa-text-secondary)' }}>
        {active ? '✓ Selected' : 'Choose this →'}
      </span>
    </button>
  )
}
