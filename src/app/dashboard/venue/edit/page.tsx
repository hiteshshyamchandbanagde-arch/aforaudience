'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import SiteNav from '@/components/SiteNav'
import BackLink from '@/components/BackLink'
import BrandLoader from '@/components/BrandLoader'

const labelStyle = { display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--afa-text-primary)', marginBottom: '6px' }
const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(14,12,10,0.15)', fontSize: '14px', boxSizing: 'border-box' as const, fontFamily: 'inherit' }

// Session 62, design.md §9.5. First edit surface for VenueOwner - the role
// had no editable fields of its own at all until bio was added this
// session. Powers the new public /venue-owners/[id] bio profile page.
// Avatar lives on User (shared account-level field), same two-request
// pattern as the Organiser/Artist edit pages.
export default function VenueOwnerEditPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [bio, setBio] = useState('')
  const [avatar, setAvatar] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const [ownerRes, userRes] = await Promise.all([
          fetch('/api/venue-owners/me'),
          fetch('/api/users/me'),
        ])
        if (ownerRes.ok) {
          const d = await ownerRes.json()
          setBio(d.bio || '')
        }
        if (userRes.ok) {
          const d = await userRes.json()
          setAvatar(d.user?.avatar || '')
        }
      } catch {
        setError('Failed to load profile')
      } finally {
        setLoading(false)
      }
    }
    if (session?.user) fetchProfile()
  }, [session])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingAvatar(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload/avatar', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Upload failed - please try again.')
        return
      }
      setAvatar(data.url)
    } catch {
      setError('Upload failed - please try again.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const save = async () => {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const [ownerRes, userRes] = await Promise.all([
        fetch('/api/venue-owners/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bio }),
        }),
        fetch('/api/users/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatar: avatar.trim() || null }),
        }),
      ])
      if (!ownerRes.ok) {
        const data = await ownerRes.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save profile')
      }
      if (!userRes.ok) {
        const data = await userRes.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save profile picture')
      }
      setMessage('Profile saved.')
    } catch (err: any) {
      setError(err.message || 'Failed to save profile')
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
          <BackLink href="/dashboard/venue" label="Back to Dashboard" />

          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: 'var(--afa-text-primary)', marginTop: '16px', marginBottom: '8px' }}>
            Edit Your Profile
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: '32px' }}>
            This is what people see on your public Venue Owner page.
          </p>

          {message && (
            <div style={{ padding: '14px 16px', background: 'var(--afa-success-bg)', border: '1px solid #68D391', borderRadius: '8px', color: 'var(--afa-green-dark)', fontSize: '14px', marginBottom: '20px' }}>
              {message}
            </div>
          )}
          {error && (
            <div style={{ padding: '14px 16px', background: 'var(--afa-error-bg)', border: '1px solid var(--afa-error-border)', borderRadius: '8px', color: 'var(--afa-error)', fontSize: '14px', marginBottom: '20px' }}>
              {error}
            </div>
          )}

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
            </div>

            <div>
              <label style={labelStyle}>Bio</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} maxLength={1000} placeholder="Tell people about your venues" style={{ ...inputStyle, resize: 'vertical' as const }} />
            </div>
          </div>

          <button
            onClick={save}
            disabled={saving}
            style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-on-fill-solid)', background: 'var(--afa-terracotta)', border: 'none', borderRadius: '8px', padding: '12px 24px', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </main>
    </>
  )
}
