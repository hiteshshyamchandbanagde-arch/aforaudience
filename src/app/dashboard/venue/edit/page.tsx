'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import SiteNav from '@/components/SiteNav'
import BackLink from '@/components/BackLink'
import BrandLoader from '@/components/BrandLoader'
import { PageHead, Card, SectionTitle, Label, Field, primaryLinkStyle } from '@/components/dashboard/VenuePortalUI'

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
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-page)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '48px 24px 80px' }}>
          <BackLink href="/dashboard/venue" label="Back to Dashboard" />

          <div style={{ marginTop: '20px' }}>
            <PageHead eyebrow="Public profile" title="Edit Your Profile" description="This is what people see on your public Venue Owner page." />
          </div>

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

          <Card style={{ padding: '28px', marginBottom: '20px' }}>
            <SectionTitle n="01" title="Basic Info" />
            <div style={{ marginBottom: '20px' }}>
              <Label>Profile Picture</Label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
                {avatar && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="Profile preview" style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(245,245,240,0.1)' }} />
                )}
                <label className="avp-btn-primary" style={{ ...primaryLinkStyle, cursor: uploadingAvatar ? 'default' : 'pointer', opacity: uploadingAvatar ? 0.6 : 1 }}>
                  {uploadingAvatar ? 'Uploading...' : avatar ? 'Change Photo' : 'Upload Photo'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarUpload} disabled={uploadingAvatar} style={{ display: 'none' }} />
                </label>
              </div>
            </div>

            <div>
              <Label>Bio</Label>
              <Field as="textarea" value={bio} onChange={(e) => setBio(e.target.value)} rows={4} maxLength={1000} placeholder="Tell people about your venues" />
            </div>
          </Card>

          <button
            onClick={save}
            disabled={saving}
            className="avp-btn-primary"
            style={{ ...primaryLinkStyle, border: 'none', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </main>
    </>
  )
}
