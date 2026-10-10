'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import { useToast } from '@/components/Toast'
import SeatSectionEditor, { SeatSection, findDuplicateSectionNames, findIncompleteSections } from '@/components/SeatSectionEditor'
import FacilitiesPicker from '@/components/FacilitiesPicker'
import BrandLoader from '@/components/BrandLoader'
import CityAutocomplete from '@/components/CityAutocomplete'
import HelpIcon from '@/components/HelpIcon'
import { buildDirectionsUrl } from '@/lib/maps-url'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import DashboardShell from '@/components/DashboardShell'
import { PageHead, Card, SectionTitle, ErrorBanner, IconSection, IconSeatGlyph, IconCheck } from '@/components/dashboard/VenuePortalUI'
import SharedButton from '@/components/ui/Button'
import { SELECTED, SELECTED_BG } from '@/lib/statusStyle'
import { Icon, INLINE_ICON_STYLE } from '@/components/Icon'
import { useLocale } from '@/lib/i18n/translate'
import { countText } from '@/lib/i18n/plural'

const inputStyle = {
  width: '100%',
  padding: 'var(--afa-space-10px) var(--afa-space-14px)',
  borderRadius: 'var(--afa-radius-md)',
  border: '1px solid var(--afa-tint-08)',
  background: 'var(--afa-surface-inverse)',
  fontSize: 'var(--afa-text-body)',
  fontFamily: 'var(--font-sans)',
  color: 'var(--afa-text-primary)',
  boxSizing: 'border-box' as const,
}

const labelStyle = {
  display: 'block',
  fontSize: 'var(--afa-text-ui)',
  fontWeight: 500,
  marginBottom: 'var(--afa-space-2)',
  color: 'var(--afa-text-secondary)',
}

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

/** The weekday's name in the UI language (5 Jan 2026 is a Monday). */
function weekdayName(locale: string, index: number) {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 5 + index)))
}

export default function CreateVenuePage() {
  const { locale, t: tr } = useLocale()
  const vc = tr.venueDashboard.venueCreate
  const ve = tr.venueDashboard.venueEdit
  const view = tr.venueDashboard.venueView
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
        showToast(vc.draftRestored, 'success')
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
      ['name', vc.fieldName],
      ['address', vc.fieldAddress],
      ['city', vc.fieldCity],
    ]
    const missing = requiredFields
      .filter(([key]) => !String(formData[key as keyof typeof formData]).trim())
      .map(([, label]) => label)
    if (missing.length > 0) {
      fail(vc.requiredFields.replace('{fields}', missing.join(', ')))
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
        fail(ve.noSectionsError)
        setSaving(false)
        return
      }
      const incomplete = findIncompleteSections(sections)
      if (incomplete.length > 0) {
        fail(countText(locale, incomplete.length, ve.incompleteSectionsOne, ve.incompleteSectionsOther))
        setSaving(false)
        return
      }
      const duplicateSectionNames = findDuplicateSectionNames(sections)
      if (duplicateSectionNames.length > 0) {
        fail(countText(locale, duplicateSectionNames.length, tr.venueDashboard.venueForm.duplicateNamesOne, tr.venueDashboard.venueForm.duplicateNamesOther).replace('{names}', duplicateSectionNames.join('", "')))
        setSaving(false)
        return
      }
    }
    if (seatingChoice === 'NUMBERED' && !(Number(approxCapacity) > 0)) {
      fail(vc.approxCapacityError)
      setSaving(false)
      return
    }

    if (rateType === 'HOURLY' && (!hourlyRate || Number(hourlyRate) <= 0)) {
      fail(ve.setHourlyRate)
      setSaving(false)
      return
    }
    if (rateType === 'DAILY' && (!dailyRate || Number(dailyRate) <= 0)) {
      fail(ve.setDailyRate)
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
        throw new Error(data.error || vc.createFailed)
      }

      const newVenue = await res.json()
      clearDraft()
      const isVerified = (session?.user as any)?.isVerified
      if (!publish && !isVerified) {
        showToast(vc.draftUnverified, 'info')
      }
      router.push(`/dashboard/venue/${newVenue.id}`)
    } catch (err: any) {
      fail(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading') return (<><SiteNav /><DashboardShell><BrandLoader label={tr.dashboardChrome.loading} /></DashboardShell></>)
  if (!session) return (<><SiteNav /><DashboardShell>{null}</DashboardShell></>)

  return (
    <>
      <SiteNav />
      <DashboardShell>
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-page)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '780px', margin: '0 auto', padding: 'var(--afa-space-48px) var(--afa-space-6) var(--afa-space-80px)' }}>
          <div>
            <PageHead eyebrow={vc.eyebrow} title={vc.title} description={vc.description} />
          </div>

          {error && (
            <ErrorBanner style={{ marginBottom: 'var(--afa-space-6)' }}>{error}</ErrorBanner>
          )}

          <form onSubmit={(e) => e.preventDefault()}>
            {/* Basic details */}
            <Card style={{ padding: 'var(--afa-space-28px)', marginBottom: 'var(--afa-space-5)' }}>
              <SectionTitle n="01" title={ve.basicDetails} />

              <div style={{ marginBottom: 'var(--afa-space-18px)' }}>
                <label style={labelStyle}>{ve.venueName}</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder={vc.namePlaceholder} style={inputStyle} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--afa-space-18px)', marginBottom: 'var(--afa-space-18px)' }}>
                <div>
                  <label style={labelStyle}>{ve.address}</label>
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
                    placeholder={vc.addressPlaceholder}
                  />
                </div>
                <div>
                  <label style={labelStyle}>{ve.city}</label>
                  <CityAutocomplete
                    value={formData.city}
                    onChange={(city) => setFormData((prev) => ({ ...prev, city, state: '', country: '' }))}
                    onResolved={(loc) =>
                      setFormData((prev) => ({ ...prev, city: loc.city || prev.city, state: loc.state ?? '', country: loc.country ?? '' }))
                    }
                    inputStyle={inputStyle}
                    placeholder={vc.cityPlaceholder}
                  />
                  {(formData.state || formData.country) && (
                    <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.55, marginTop: 'var(--afa-space-1)' }}>
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
              <div style={{ marginBottom: 'var(--afa-space-18px)' }}>
                <label style={labelStyle}>{ve.mapsLink}</label>
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
                      <Icon name="pin" size={14} style={INLINE_ICON_STYLE} />&nbsp;{ve.directions}
                    </a>
                    <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-muted)', marginTop: 'var(--afa-space-6px)' }}>
                      {ve.mapsDerived}
                    </p>
                  </>
                ) : (
                  <>
                    <input type="url" name="mapsUrl" value={formData.mapsUrl} onChange={handleChange} placeholder={ve.mapsPlaceholder} style={inputStyle} />
                    <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-muted)', marginTop: 'var(--afa-space-6px)' }}>
                      {ve.mapsOptional}
                    </p>
                  </>
                )}
              </div>

              <div style={{ marginBottom: 'var(--afa-space-18px)' }}>
                <label style={labelStyle}>{view.facilities}</label>
                <FacilitiesPicker value={facilities} onChange={setFacilities} />
              </div>

              <div>
                <label style={labelStyle}>{view.acousticRating} <span style={{ fontWeight: 400, opacity: 0.6 }}>(0-5)</span></label>
                <p style={{ fontSize: 'var(--afa-text-body-lg)', fontWeight: 600, color: 'var(--afa-text-muted)' }}>{view.notRatedYet}</p>
                <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-muted)', marginTop: 'var(--afa-space-1)' }}>
                  {ve.acousticNote}
                </p>
              </div>
            </Card>

            {/* Rental rate - what an Organiser pays to book this venue, separate from audience ticket prices */}
            <Card style={{ padding: 'var(--afa-space-28px)', marginBottom: 'var(--afa-space-5)' }}>
              <SectionTitle n="02" title={ve.rentalRate} />
              <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-secondary)', marginTop: 'calc(-1 * var(--afa-space-2))', marginBottom: 'var(--afa-space-18px)' }}>
                {ve.rentalRateNote}
              </p>

              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center' }}>
                {ve.rateType}
                <HelpIcon text={ve.rateTypeHelp} />
              </label>
              <div style={{ display: 'flex', gap: 'var(--afa-space-2)', marginBottom: 'var(--afa-space-18px)' }}>
                {(['HOURLY', 'DAILY', 'FLEXIBLE'] as const).map((t) => (
                  <SharedButton
                    variant="toggle-box"
                    size="md"
                    fullWidth={false}
                    selected={rateType === t}
                    key={t}
                    type="button"
                    onClick={() => setRateType(t)}
                    style={{ flex: 1 }}
                  >
                    {t === 'HOURLY' ? ve.hourly : t === 'DAILY' ? ve.daily : ve.flexible}
                  </SharedButton>
                ))}
              </div>

              {rateType === 'HOURLY' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--afa-space-18px)', marginBottom: 'var(--afa-space-2)' }}>
                  <div>
                    <label style={labelStyle}>{ve.ratePerHour}</label>
                    <input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} min="0" placeholder={ve.ratePerHourPlaceholder} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>{ve.minDuration}</label>
                    <input type="number" value={minDurationHours} onChange={(e) => setMinDurationHours(e.target.value)} min="1" placeholder={ve.minDurationPlaceholder} style={inputStyle} />
                  </div>
                </div>
              )}

              {rateType === 'DAILY' && (
                <div style={{ marginBottom: 'var(--afa-space-2)' }}>
                  <label style={labelStyle}>{ve.ratePerDay}</label>
                  <input type="number" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} min="0" placeholder={ve.ratePerDayPlaceholder} style={{ ...inputStyle, maxWidth: '240px' }} />
                </div>
              )}

              {rateType === 'FLEXIBLE' && (
                <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-secondary)' }}>
                  {ve.flexibleNote}
                </p>
              )}

              {rateType !== 'FLEXIBLE' && (
                <div style={{ marginTop: 'var(--afa-space-4)', paddingTop: 'var(--afa-space-4)', borderTop: '1px solid var(--afa-tint-08)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--afa-space-2)', fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', marginBottom: useDayOverrides ? 'var(--afa-space-14px)' : 0 }}>
                    <input type="checkbox" checked={useDayOverrides} onChange={(e) => setUseDayOverrides(e.target.checked)} />
                    {ve.dayOverrides} <span style={{ fontWeight: 400, opacity: 0.6 }}>{ve.dayOverridesHint}</span>
                  </label>

                  {useDayOverrides && (
                    <div>
                      <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-muted)', marginBottom: 'var(--afa-space-10px)' }}>
                        {ve.dayOverridesNote}
                      </p>
                      {(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const).map((day, dayIndex) => (
                        <div key={day} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--afa-space-2) 0', borderBottom: '1px solid var(--afa-tint-04)' }}>
                          <span style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)' }}>{weekdayName(locale, dayIndex)}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--afa-space-1)' }}>
                            <span style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-muted)' }}>₹</span>
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
            <Card style={{ padding: 'var(--afa-space-28px)', marginBottom: 'var(--afa-space-5)' }}>
              <SectionTitle n="03" title={ve.seatingPricing} />

              {/* Warm radial glow behind this key moment - matches the
                  entry-choice treatment on the Figma export's Seating &
                  Pricing fork (GEN-2608-082). Negative side/bottom margin
                  bleeds it to the card's own edges; top stays flush under
                  SectionTitle. */}
              <div className="afa-glow-orange" style={{ margin: '0 calc(-1 * var(--afa-space-28px)) calc(-1 * var(--afa-space-28px))', padding: 'var(--afa-space-1) var(--afa-space-28px) var(--afa-space-28px)', borderRadius: 'var(--afa-radius-sharp) var(--afa-radius-sharp) var(--afa-radius-lg) var(--afa-radius-lg)' }}>
                <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-secondary)', marginBottom: 'var(--afa-space-2px)' }}>
                  {vc.seatingQuestion}
                </p>
                <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'var(--afa-text-body-lg)', color: 'var(--afa-amber)', marginTop: 'var(--afa-space-6px)', marginBottom: 'var(--afa-space-5)' }}>
                  &ldquo;{vc.seatingQuote}&rdquo;
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 'var(--afa-space-14px)', marginBottom: 'var(--afa-space-5)' }}>
                  <PathCard
                    title={vc.gaTitle}
                    icon={<IconSection size={20} />}
                    active={seatingChoice === 'GENERAL_ADMISSION'}
                    onClick={() => setSeatingChoice('GENERAL_ADMISSION')}
                    consequence={vc.gaConsequence}
                    points={[vc.gaPoint1, vc.gaPoint2]}
                    selectedLabel={vc.selected}
                    chooseLabel={vc.chooseThis}
                  />
                  <PathCard
                    title={vc.numberedTitle}
                    icon={<IconSeatGlyph size={20} />}
                    active={seatingChoice === 'NUMBERED'}
                    onClick={() => setSeatingChoice('NUMBERED')}
                    consequence={vc.numberedConsequence}
                    points={[vc.numberedPoint1, vc.numberedPoint2]}
                    selectedLabel={vc.selected}
                    chooseLabel={vc.chooseThis}
                  />
                </div>

                {seatingChoice === 'GENERAL_ADMISSION' && (
                  <>
                    <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-secondary)', marginBottom: 'var(--afa-space-18px)' }}>
                      {vc.gaIntro}
                    </p>
                    <SeatSectionEditor sections={sections} onChange={setSections} />
                  </>
                )}

                {seatingChoice === 'NUMBERED' && (
                  <div>
                    <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-secondary)', marginBottom: 'var(--afa-space-14px)' }}>
                      {vc.numberedIntro}
                    </p>
                    <label style={labelStyle}>{vc.approxCapacity}</label>
                    <input
                      type="number"
                      min={1}
                      value={approxCapacity}
                      onChange={(e) => setApproxCapacity(e.target.value)}
                      placeholder={vc.approxCapacityPlaceholder}
                      style={{ ...inputStyle, maxWidth: '160px' }}
                    />
                  </div>
                )}
              </div>
            </Card>

            {/* Actions */}
            <div data-afa-action-row style={{ display: 'flex', gap: 'var(--afa-space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
              {seatingChoice === 'GENERAL_ADMISSION' && (
                <SharedButton variant="solid" size="md" fullWidth={false} type="button" disabled={saving} onClick={() => submit(true)}>
                  {saving ? vc.publishing : view.publishVenue}
                </SharedButton>
              )}
              <SharedButton variant="outline-neutral" size="md" fullWidth={false} type="button" disabled={saving} onClick={() => submit(false)}>
                {ve.saveDraft}
              </SharedButton>
              <Link href="/dashboard/venue" onClick={clearDraft} style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-secondary)', textDecoration: 'none', marginLeft: 'var(--afa-space-1)' }}>
                {tr.dashboardChrome.cancel}
              </Link>
            </div>
            <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-muted)', marginTop: 'var(--afa-space-14px)' }}>
              {seatingChoice === 'GENERAL_ADMISSION'
                ? vc.gaFootnote
                : vc.numberedFootnote}
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
  selectedLabel,
  chooseLabel,
}: {
  title: string
  icon: React.ReactNode
  consequence: string
  points: string[]
  active: boolean
  onClick: () => void
  selectedLabel: string
  chooseLabel: string
}) {
  return (
    <SharedButton
      variant="card"
      fullWidth={false}
      selected={active}
      type="button"
      onClick={onClick}
      className={`afa-path-card${active ? ' afa-path-card-active afa-card-lift' : ''}`}
      style={{ transition: 'border-color 150ms, transform 150ms' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--afa-space-3)' }}>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            borderRadius: 'var(--afa-radius-md)',
            // GEN-2609-118 - the chosen seating path is a selected state: amber.
            background: active ? SELECTED_BG : 'var(--afa-tint-08)',
            color: active ? SELECTED : 'var(--afa-text-secondary)',
          }}
        >
          {icon}
        </span>
        <h3 style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--afa-text-title)', fontWeight: 500, color: 'var(--afa-text-primary)', margin: 0 }}>
          {title}
        </h3>
      </div>
      <p style={{ marginTop: 'var(--afa-space-14px)', fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.85 }}>{consequence}</p>
      <ul style={{ marginTop: 'var(--afa-space-10px)', display: 'flex', flexDirection: 'column', gap: '5px', listStyle: 'none', padding: 0 }}>{/* token-ok(spacing-literal): 5px odd value, no exact token (GEN-2609-107) */}
        {points.map((p) => (
          <li key={p} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-secondary)' }}>{/* token-ok(spacing-literal): 7px odd value, no exact token (GEN-2609-107) */}
            <IconCheck size={12} style={{ color: 'var(--afa-text-muted)' }} />
            {p}
          </li>
        ))}
      </ul>
      <span style={{ display: 'inline-block', marginTop: 'var(--afa-space-14px)', fontSize: 'var(--afa-text-ui)', fontWeight: 600, color: active ? SELECTED : 'var(--afa-text-secondary)' }}>
        {active ? selectedLabel : chooseLabel}
      </span>
    </SharedButton>
  )
}
