'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import { useToast } from '@/components/Toast'

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

export default function EditArtistProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)
  const [bio, setBio] = useState('')
  const [genreInput, setGenreInput] = useState('')
  const [styleTagInput, setStyleTagInput] = useState('')
  const [instagram, setInstagram] = useState('')
  const [youtube, setYoutube] = useState('')
  const [avatar, setAvatar] = useState('')
  const [tagline, setTagline] = useState('')
  const [fullBiography, setFullBiography] = useState('')
  const [journey, setJourney] = useState('')
  const [influences, setInfluences] = useState('')
  const [acknowledgments, setAcknowledgments] = useState('')
  const [goals, setGoals] = useState('')

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
        setGenreInput((data.genre || []).join(', '))
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

  const save = async () => {
    setSaving(true)
    try {
      const [artistRes, userRes] = await Promise.all([
        fetch('/api/artists/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bio,
            genre: genreInput.split(',').map((g) => g.trim()).filter(Boolean),
            styleTag: styleTagInput.split(',').map((s) => s.trim()).filter(Boolean),
            socialLinks: { instagram, youtube },
            tagline,
            fullBiography,
            journey,
            influences,
            acknowledgments,
            goals,
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

  if (status === 'loading' || loading) return (<><SiteNav /><div style={{ padding: '32px' }}>Loading...</div></>)
  if (!session) return <SiteNav />

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '48px 24px' }}>
          <Link href="/dashboard/artist" style={{ fontSize: '14px', color: '#C8441A', textDecoration: 'none', fontWeight: 600 }}>
            ← Back to Dashboard
          </Link>

          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#0E0C0A', marginTop: '16px', marginBottom: '8px' }}>
            Edit Your Profile
          </h1>
          <p style={{ fontSize: '15px', color: '#0E0C0A', opacity: 0.6, marginBottom: '32px' }}>
            This is what organisers see when you apply to their events.
          </p>

          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
            <div style={{ marginBottom: '18px' }}>
              <label style={labelStyle}>Profile Picture <span style={{ fontWeight: 400, opacity: 0.6 }}>(image URL)</span></label>
              <input type="text" value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://..." style={inputStyle} />
              <p style={{ fontSize: '11px', color: '#0E0C0A', opacity: 0.5, marginTop: '4px' }}>
                Paste a link to your photo (e.g. from a cloud drive or image host) - direct file upload isn&apos;t available yet.
              </p>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={labelStyle}>Bio</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} placeholder="Tell organisers about your act" style={{ ...inputStyle, resize: 'vertical' as const }} />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={labelStyle}>Genres <span style={{ fontWeight: 400, opacity: 0.6 }}>(comma separated)</span></label>
              <input type="text" value={genreInput} onChange={(e) => setGenreInput(e.target.value)} placeholder="e.g., Stand-up, Improv" style={inputStyle} />
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
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', marginBottom: '20px', border: '1px solid rgba(14,12,10,0.08)' }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#0E0C0A', marginBottom: '6px' }}>
              Your Background
            </h2>
            <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6, marginBottom: '18px' }}>
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

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={save}
              disabled={saving}
              style={{ fontSize: '14px', fontWeight: 600, color: '#F7F3EE', background: '#C8441A', border: 'none', borderRadius: '8px', padding: '12px 26px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
            <Link href="/dashboard/artist" style={{ fontSize: '14px', color: '#0E0C0A', opacity: 0.6, textDecoration: 'none' }}>
              Cancel
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
