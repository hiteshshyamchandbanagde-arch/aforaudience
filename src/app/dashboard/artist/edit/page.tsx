'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import BackLink from '@/components/BackLink'
import { useToast } from '@/components/Toast'
import BrandLoader from '@/components/BrandLoader'
import GenrePicker from '@/components/GenrePicker'

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '6px',
  border: '1px solid rgba(14,12,10,0.15)',
  background: 'var(--afa-surface-raised)',
  fontSize: '14px',
  color: 'var(--afa-text-primary)',
}

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  marginBottom: '6px',
  color: 'var(--afa-text-primary)',
}

export default function EditArtistProfilePage() {
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
        if (!artistRes.ok) throw new Error('Failed to fetch profile')
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
        showToast(err.message || 'Failed to load profile', 'error')
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
        showToast(data.error || 'Upload failed - please try again.', 'error')
        return
      }
      setAvatar(data.url)
      showToast('Photo uploaded. Save to keep it.', 'success')
    } catch {
      showToast('Upload failed - please try again.', 'error')
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
      if (!artistRes.ok) throw new Error('Failed to save profile')
      if (!userRes.ok) {
        const data = await userRes.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save profile picture')
      }
      showToast('Profile saved.', 'success')
      router.push('/dashboard/artist')
    } catch (err: any) {
      showToast(err.message || 'Failed to save profile', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) return (<><SiteNav /><BrandLoader /></>)
  if (!session) return <SiteNav />

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '48px 24px' }}>
          <BackLink href="/dashboard/artist" label="Back to Dashboard" />

          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: 'var(--afa-text-primary)', marginTop: '16px', marginBottom: '8px' }}>
            Edit Your Profile
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: '32px' }}>
            This is what organisers see when you apply to their events.
          </p>

          <div style={{ background: 'var(--afa-surface-raised)', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
            <div style={{ marginBottom: '18px' }}>
              <label style={labelStyle}>Profile Picture</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '10px' }}>
                {avatar && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="Profile preview" style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(14,12,10,0.1)' }} />
                )}
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--afa-on-fill-solid)', background: 'var(--afa-terracotta)', padding: '9px 16px', borderRadius: '8px', cursor: uploadingAvatar ? 'default' : 'pointer', opacity: uploadingAvatar ? 0.6 : 1 }}>
                  {uploadingAvatar ? 'Uploading...' : avatar ? 'Change Photo' : 'Upload Photo'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarUpload} disabled={uploadingAvatar} style={{ display: 'none' }} />
                </label>
              </div>
              <details>
                <summary style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.5, cursor: 'pointer' }}>Or paste an image link instead</summary>
                <input type="text" value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://..." style={{ ...inputStyle, marginTop: '8px' }} />
              </details>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={labelStyle}>Bio</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} placeholder="Tell organisers about your act" style={{ ...inputStyle, resize: 'vertical' as const }} />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={labelStyle}>Genres</label>
              <GenrePicker value={genre} onChange={setGenre} />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={labelStyle}>Style Tags <span style={{ fontWeight: 400, opacity: 0.6 }}>(comma separated)</span></label>
              <input type="text" value={styleTagInput} onChange={(e) => setStyleTagInput(e.target.value)} placeholder="e.g., Observational, High-energy" style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
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
          <div style={{ background: 'var(--afa-surface-raised)', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: '6px' }}>
              Your Background
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: '18px' }}>
              All optional - share as much or as little of your story as you want.
            </p>

            <div style={{ marginBottom: '18px' }}>
              <label style={labelStyle}>Tagline <span style={{ fontWeight: 400, opacity: 0.6 }}>(one line, shown prominently)</span></label>
              <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={200} placeholder="e.g., Turning everyday chaos into comedy" style={inputStyle} />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={labelStyle}>Full Biography <span style={{ fontWeight: 400, opacity: 0.6 }}>(as long as you&apos;d like)</span></label>
              <textarea value={fullBiography} onChange={(e) => setFullBiography(e.target.value)} rows={5} placeholder="The complete story, beyond the short bio above" style={{ ...inputStyle, resize: 'vertical' as const }} />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={labelStyle}>Your Journey</label>
              <textarea value={journey} onChange={(e) => setJourney(e.target.value)} rows={5} placeholder="How you got started, key moments along the way" style={{ ...inputStyle, resize: 'vertical' as const }} />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={labelStyle}>Influences <span style={{ fontWeight: 400, opacity: 0.6 }}>(who inspired you)</span></label>
              <textarea value={influences} onChange={(e) => setInfluences(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={labelStyle}>Thanks <span style={{ fontWeight: 400, opacity: 0.6 }}>(anyone you&apos;d like to acknowledge)</span></label>
              <textarea value={acknowledgments} onChange={(e) => setAcknowledgments(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} />
            </div>

            <div>
              <label style={labelStyle}>Goals &amp; Ambitions</label>
              <textarea value={goals} onChange={(e) => setGoals(e.target.value)} rows={3} placeholder="Where you want this to go" style={{ ...inputStyle, resize: 'vertical' as const }} />
            </div>
          </div>

          {/* FEAT-2608-047 (11 Aug) - self-managed tour highlight, so an
              artist can show they perform beyond Pune/India. Purely
              informational - not tied to AFA's booking flow, since these
              shows aren't happening through the platform. */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', border: '1px solid rgba(14,12,10,0.08)', marginBottom: '20px' }}>
            <label style={labelStyle}>Tour</label>
            <p style={{ fontSize: '13px', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: '16px' }}>
              Show where else you're performing — city, country, and an optional date or link. Shown on your public profile.
            </p>
            {tourStops.map((stop) => (
              <div
                key={stop.key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '8px',
                  marginBottom: '10px',
                  padding: '12px',
                  border: '1px solid rgba(14,12,10,0.08)',
                  borderRadius: '8px',
                  alignItems: 'start',
                }}
              >
                <input type="text" value={stop.city} onChange={(e) => updateTourStop(stop.key, 'city', e.target.value)} placeholder="City" style={inputStyle} />
                <input type="text" value={stop.country} onChange={(e) => updateTourStop(stop.key, 'country', e.target.value)} placeholder="Country" style={inputStyle} />
                <input type="date" value={stop.date} onChange={(e) => updateTourStop(stop.key, 'date', e.target.value)} style={inputStyle} />
                <input type="url" value={stop.link} onChange={(e) => updateTourStop(stop.key, 'link', e.target.value)} placeholder="Link (optional)" style={inputStyle} />
                <button
                  onClick={() => removeTourStop(stop.key)}
                  aria-label="Remove tour stop"
                  style={{ fontSize: '13px', color: 'var(--afa-error)', background: 'transparent', border: '1px solid var(--afa-error-border)', borderRadius: '6px', padding: '10px 12px', cursor: 'pointer', width: '100%' }}
                >
                  ✕ Remove
                </button>
              </div>
            ))}
            <button
              onClick={addTourStop}
              style={{ fontSize: '13px', fontWeight: 600, color: 'var(--afa-terracotta)', background: 'transparent', border: '1px dashed var(--afa-terracotta)', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', marginTop: '4px' }}
            >
              + Add tour stop
            </button>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={save}
              disabled={saving}
              style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-on-fill-solid)', background: 'var(--afa-terracotta)', border: 'none', borderRadius: '8px', padding: '12px 26px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
            <Link href="/dashboard/artist" style={{ fontSize: '14px', color: 'var(--afa-text-primary)', opacity: 0.6, textDecoration: 'none' }}>
              Cancel
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
