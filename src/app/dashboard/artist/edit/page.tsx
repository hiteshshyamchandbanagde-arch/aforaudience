'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import { useToast } from '@/components/Toast'
import BrandLoader from '@/components/BrandLoader'
import DashboardShell from '@/components/DashboardShell'
import Button, { variantStyle } from '@/components/ui/Button'
import GenrePicker from '@/components/GenrePicker'
import { PageTitle } from '@/components/dashboard/PageTitle'
import { useLocale } from '@/lib/i18n/translate'

const inputStyle = {
  width: '100%',
  padding: 'var(--afa-space-10px) var(--afa-space-3)',
  borderRadius: 'var(--afa-radius-sm)',
  border: '1px solid var(--afa-border-resting)',
  background: 'var(--afa-surface-raised)',
  fontSize: 'var(--afa-text-body)',
  color: 'var(--afa-text-primary)',
}

const labelStyle = {
  display: 'block',
  fontSize: 'var(--afa-text-ui)',
  fontWeight: 600,
  marginBottom: 'var(--afa-space-6px)',
  color: 'var(--afa-text-primary)',
}

export default function EditArtistProfilePage() {
  const { t: tr } = useLocale()
  const a = tr.artistDashboard
  const chrome = tr.dashboardChrome
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)
  const [bio, setBio] = useState('')
  const [genre, setGenre] = useState<string[]>([])
  const [styleTagInput, setStyleTagInput] = useState('')
  const [instagram, setInstagram] = useState('')
  const [youtube, setYoutube] = useState('')
  const [avatar, setAvatar] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [tagline, setTagline] = useState('')
  const [fullBiography, setFullBiography] = useState('')
  const [journey, setJourney] = useState('')
  const [influences, setInfluences] = useState('')
  const [acknowledgments, setAcknowledgments] = useState('')
  const [goals, setGoals] = useState('')
  // FEAT-2608-047 - each row: city/country required, date/link optional.
  // Local-only `key` for React list identity - not persisted, since a
  // fresh id is assigned per row on every load (full-replace save, same
  // as ticketTiers elsewhere) rather than tracking DB ids client-side.
  const [tourStops, setTourStops] = useState<{ key: string; city: string; country: string; date: string; link: string }[]>([])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const [artistRes, userRes] = await Promise.all([
          fetch('/api/artists/me'),
          fetch('/api/users/me'),
        ])
        if (!artistRes.ok) throw new Error(a.profileLoadFailed)
        const data = await artistRes.json()
        setBio(data.bio || '')
        setGenre(data.genre || [])
        setStyleTagInput((data.styleTag || []).join(', '))
        const links = data.socialLinks || {}
        setInstagram(links.instagram || '')
        setYoutube(links.youtube || '')
        setTagline(data.tagline || '')
        setFullBiography(data.fullBiography || '')
        setJourney(data.journey || '')
        setInfluences(data.influences || '')
        setAcknowledgments(data.acknowledgments || '')
        setGoals(data.goals || '')
        setTourStops(
          (data.tourStops || []).map((t: any, i: number) => ({
            key: `${i}-${t.id || Math.random()}`,
            city: t.city || '',
            country: t.country || '',
            date: t.date ? String(t.date).slice(0, 10) : '',
            link: t.link || '',
          }))
        )

        if (userRes.ok) {
          const userData = await userRes.json()
          setAvatar(userData.user?.avatar || '')
        }
      } catch (err: any) {
        showToast(err.message || a.profileLoadError, 'error')
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchProfile()
    }
  }, [session])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return

    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload/avatar', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || a.uploadFailed, 'error')
        return
      }
      setAvatar(data.url)
      showToast(a.photoUploaded, 'success')
    } catch {
      showToast(a.uploadFailed, 'error')
    } finally {
      setUploadingAvatar(false)
    }
  }

  // FEAT-2608-047 - simple add/update/remove for the local tour-stop
  // rows; the actual save (full-replace) happens in save() below.
  const addTourStop = () => {
    setTourStops((prev) => [...prev, { key: `new-${Date.now()}-${Math.random()}`, city: '', country: '', date: '', link: '' }])
  }
  const updateTourStop = (key: string, field: 'city' | 'country' | 'date' | 'link', value: string) => {
    setTourStops((prev) => prev.map((t) => (t.key === key ? { ...t, [field]: value } : t)))
  }
  const removeTourStop = (key: string) => {
    setTourStops((prev) => prev.filter((t) => t.key !== key))
  }

  const save = async () => {
    setSaving(true)
    try {
      const [artistRes, userRes] = await Promise.all([
        fetch('/api/artists/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bio,
            genre,
            styleTag: styleTagInput.split(',').map((s) => s.trim()).filter(Boolean),
            socialLinks: { instagram, youtube },
            tagline,
            fullBiography,
            journey,
            influences,
            acknowledgments,
            goals,
            tourStops: tourStops
              .filter((t) => t.city.trim() && t.country.trim())
              .map((t) => ({ city: t.city.trim(), country: t.country.trim(), date: t.date || null, link: t.link.trim() || null })),
          }),
        }),
        fetch('/api/users/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatar: avatar.trim() || null }),
        }),
      ])
      if (!artistRes.ok) throw new Error(a.saveFailed)
      if (!userRes.ok) {
        const data = await userRes.json().catch(() => ({}))
        throw new Error(data.error || a.savePhotoFailed)
      }
      showToast(a.profileSaved, 'success')
      router.push('/dashboard/artist')
    } catch (err: any) {
      showToast(err.message || a.saveFailed, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) return (<><SiteNav /><DashboardShell><BrandLoader label={chrome.loading} /></DashboardShell></>)
  if (!session) return (<><SiteNav /><DashboardShell>{null}</DashboardShell></>)

  return (
    <>
      <SiteNav />
      <DashboardShell>
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: 'var(--afa-space-48px) var(--afa-space-6)' }}>
          <PageTitle size="lg" style={{ marginBottom: 'var(--afa-space-2)' }}>
            {a.editTitle}
          </PageTitle>
          <p style={{ fontSize: 'var(--afa-text-body-lg)', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: 'var(--afa-space-32px)' }}>
            {a.editSubtitle}
          </p>

          <div style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-28px)', marginBottom: 'var(--afa-space-5)', border: '1px solid var(--afa-tint-08)' }}>
            <div style={{ marginBottom: 'var(--afa-space-18px)' }}>
              <label style={labelStyle}>{a.profilePicture}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--afa-space-4)', marginBottom: 'var(--afa-space-10px)' }}>
                {avatar && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt={a.profilePreviewAlt} style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--afa-tint-10)' }} />
                )}
                <label style={{ ...variantStyle('outline-neutral', false, 'md'), cursor: uploadingAvatar ? 'default' : 'pointer', opacity: uploadingAvatar ? 0.6 : 1 }}>
                  {uploadingAvatar ? a.uploading : avatar ? a.changePhoto : a.uploadPhoto}
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarUpload} disabled={uploadingAvatar} style={{ display: 'none' }} />
                </label>
              </div>
              <details>
                <summary style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.5, cursor: 'pointer' }}>{a.pasteImageLink}</summary>
                <input type="text" value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://..." style={{ ...inputStyle, marginTop: 'var(--afa-space-2)' }} />
              </details>
            </div>

            <div style={{ marginBottom: 'var(--afa-space-18px)' }}>
              <label style={labelStyle}>{a.bio}</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} placeholder={a.bioPlaceholder} style={{ ...inputStyle, resize: 'vertical' as const }} />
            </div>

            <div style={{ marginBottom: 'var(--afa-space-18px)' }}>
              <label style={labelStyle}>{a.genres}</label>
              <GenrePicker value={genre} onChange={setGenre} />
            </div>

            <div style={{ marginBottom: 'var(--afa-space-18px)' }}>
              <label style={labelStyle}>{a.styleTags} <span style={{ fontWeight: 400, opacity: 0.6 }}>{a.commaSeparated}</span></label>
              <input type="text" value={styleTagInput} onChange={(e) => setStyleTagInput(e.target.value)} placeholder={a.styleTagsPlaceholder} style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--afa-space-18px)' }}>
              <div>
                <label style={labelStyle}>Instagram</label>
                <input type="text" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="https://instagram.com/..." style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>YouTube</label>
                <input type="text" value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="https://youtube.com/..." style={inputStyle} />
              </div>
            </div>
          </div>

          {/* Artist Background - a richer, entirely optional storytelling
              section beyond the short bio above. Nothing here is required. */}
          <div style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-28px)', marginBottom: 'var(--afa-space-5)', border: '1px solid var(--afa-tint-08)' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--afa-text-subtitle)', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-6px)' }}>
              {a.backgroundTitle}
            </h2>
            <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: 'var(--afa-space-18px)' }}>
              {a.backgroundSubtitle}
            </p>

            <div style={{ marginBottom: 'var(--afa-space-18px)' }}>
              <label style={labelStyle}>{a.tagline} <span style={{ fontWeight: 400, opacity: 0.6 }}>{a.taglineHint}</span></label>
              <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={200} placeholder={a.taglinePlaceholder} style={inputStyle} />
            </div>

            <div style={{ marginBottom: 'var(--afa-space-18px)' }}>
              <label style={labelStyle}>{a.fullBiography} <span style={{ fontWeight: 400, opacity: 0.6 }}>{a.fullBiographyHint}</span></label>
              <textarea value={fullBiography} onChange={(e) => setFullBiography(e.target.value)} rows={5} placeholder={a.fullBiographyPlaceholder} style={{ ...inputStyle, resize: 'vertical' as const }} />
            </div>

            <div style={{ marginBottom: 'var(--afa-space-18px)' }}>
              <label style={labelStyle}>{a.journey}</label>
              <textarea value={journey} onChange={(e) => setJourney(e.target.value)} rows={5} placeholder={a.journeyPlaceholder} style={{ ...inputStyle, resize: 'vertical' as const }} />
            </div>

            <div style={{ marginBottom: 'var(--afa-space-18px)' }}>
              <label style={labelStyle}>{a.influences} <span style={{ fontWeight: 400, opacity: 0.6 }}>{a.influencesHint}</span></label>
              <textarea value={influences} onChange={(e) => setInfluences(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} />
            </div>

            <div style={{ marginBottom: 'var(--afa-space-18px)' }}>
              <label style={labelStyle}>{a.thanks} <span style={{ fontWeight: 400, opacity: 0.6 }}>{a.thanksHint}</span></label>
              <textarea value={acknowledgments} onChange={(e) => setAcknowledgments(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} />
            </div>

            <div>
              <label style={labelStyle}>{a.goals}</label>
              <textarea value={goals} onChange={(e) => setGoals(e.target.value)} rows={3} placeholder={a.goalsPlaceholder} style={{ ...inputStyle, resize: 'vertical' as const }} />
            </div>
          </div>

          {/* FEAT-2608-047 (11 Aug) - self-managed tour highlight, so an
              artist can show they perform beyond Pune/India. Purely
              informational - not tied to AFA's booking flow, since these
              shows aren't happening through the platform. */}
          <div style={{ background: 'white', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-6)', border: '1px solid var(--afa-tint-08)', marginBottom: 'var(--afa-space-5)' }}>
            <label style={labelStyle}>{a.tour}</label>
            <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: 'var(--afa-space-4)' }}>
              {a.tourHint}
            </p>
            {tourStops.map((stop) => (
              <div
                key={stop.key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 'var(--afa-space-2)',
                  marginBottom: 'var(--afa-space-10px)',
                  padding: 'var(--afa-space-3)',
                  border: '1px solid var(--afa-tint-08)',
                  borderRadius: 'var(--afa-radius-md)',
                  alignItems: 'start',
                }}
              >
                <input type="text" value={stop.city} onChange={(e) => updateTourStop(stop.key, 'city', e.target.value)} placeholder={a.city} style={inputStyle} />
                <input type="text" value={stop.country} onChange={(e) => updateTourStop(stop.key, 'country', e.target.value)} placeholder={a.country} style={inputStyle} />
                <input type="date" value={stop.date} onChange={(e) => updateTourStop(stop.key, 'date', e.target.value)} style={inputStyle} />
                <input type="url" value={stop.link} onChange={(e) => updateTourStop(stop.key, 'link', e.target.value)} placeholder={a.linkOptional} style={inputStyle} />
                <Button
                  variant="outline-error"
                  size="md"
                  onClick={() => removeTourStop(stop.key)}
                  aria-label={a.removeTourStop}
                >
                  ✕ {a.remove}
                </Button>
              </div>
            ))}
            <Button
              variant="dashed"
              size="md"
              fullWidth={false}
              onClick={addTourStop}
              style={{ marginTop: 'var(--afa-space-1)' }}
            >
              + {a.addTourStop}
            </Button>
          </div>

          <div data-afa-action-row style={{ display: 'flex', gap: 'var(--afa-space-3)', alignItems: 'center' }}>
            <Button
              variant="primary"
              size="lg"
              fullWidth={false}
              onClick={save}
              disabled={saving}
              style={{ opacity: saving ? 0.6 : 1 }}
            >
              {saving ? chrome.saving : a.saveProfile}
            </Button>
            <Link href="/dashboard/artist" style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.6, textDecoration: 'none' }}>
              {chrome.cancel}
            </Link>
          </div>
        </div>
      </main>
      </DashboardShell>
    </>
  )
}
