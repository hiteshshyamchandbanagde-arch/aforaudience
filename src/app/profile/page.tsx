'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import SiteNav from '@/components/SiteNav'

const cardStyle = {
  background: '#fff',
  borderRadius: '12px',
  padding: '28px',
  marginBottom: '20px',
  border: '1px solid rgba(14,12,10,0.08)',
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '6px',
  border: '1px solid rgba(14,12,10,0.15)',
  background: '#fff',
  fontSize: '14px',
  color: '#0E0C0A',
  marginBottom: '12px',
}

const buttonStyle = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#F7F3EE',
  background: '#C8441A',
  border: 'none',
  borderRadius: '8px',
  padding: '10px 22px',
  cursor: 'pointer',
}

const ROLE_LABEL: Record<string, string> = {
  AUDIENCE: 'Audience',
  ARTIST: 'Artist',
  ORGANISER: 'Organiser',
  VENUE_OWNER: 'Venue Owner',
  ADMIN: 'Admin',
}

export default function ProfilePage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const [orgName, setOrgName] = useState('')
  const [bio, setBio] = useState('')
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  if (status === 'loading') return (<><SiteNav /><div style={{ padding: '32px' }}>Loading...</div></>)
  if (!session?.user) return <SiteNav />

  const user = session.user as { name?: string | null; email?: string | null; role?: string }
  const isAudience = user.role === 'AUDIENCE'

  const apply = async (role: 'ORGANISER' | 'VENUE_OWNER') => {
    setSubmitting(role)
    setError('')
    setMessage('')

    if (role === 'ORGANISER' && !orgName.trim()) {
      setError('Please enter your organisation name.')
      setSubmitting(null)
      return
    }

    try {
      const res = await fetch('/api/upgrade-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, orgName, bio }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')

      setMessage(data.message)
      // Refresh the session so the nav / dashboard link picks up the new
      // role immediately instead of waiting for the next natural refresh.
      await update()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '48px 24px' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#0E0C0A', marginBottom: '8px' }}>
            Profile
          </h1>
          <p style={{ fontSize: '15px', color: '#0E0C0A', opacity: 0.6, marginBottom: '32px' }}>
            {user.name} · {user.email}
          </p>

          <section style={cardStyle}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#0E0C0A', marginBottom: '8px' }}>
              Account type
            </h2>
            <p style={{ fontSize: '14px', color: '#0E0C0A' }}>
              You're currently registered as <strong>{ROLE_LABEL[user.role || 'AUDIENCE']}</strong>.
            </p>
          </section>

          {message && (
            <div style={{ padding: '14px 16px', background: '#F0FFF4', border: '1px solid #68D391', borderRadius: '8px', color: '#276749', fontSize: '14px', marginBottom: '20px' }}>
              {message}
            </div>
          )}
          {error && (
            <div style={{ padding: '14px 16px', background: '#FDECEA', border: '1px solid #F5C2C0', borderRadius: '8px', color: '#B3261E', fontSize: '14px', marginBottom: '20px' }}>
              {error}
            </div>
          )}

          {isAudience && !message && (
            <>
              <section style={cardStyle}>
                <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#0E0C0A', marginBottom: '6px' }}>
                  Become an Organiser
                </h2>
                <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6, marginBottom: '16px' }}>
                  Create events, book venues, and manage lineups. Subject to Admin approval before you can publish.
                </p>
                <input placeholder="Organisation name *" value={orgName} onChange={(e) => setOrgName(e.target.value)} style={inputStyle} />
                <textarea placeholder="Short bio (optional)" value={bio} onChange={(e) => setBio(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' as const }} />
                <button onClick={() => apply('ORGANISER')} disabled={submitting !== null} style={{ ...buttonStyle, opacity: submitting ? 0.6 : 1 }}>
                  {submitting === 'ORGANISER' ? 'Submitting...' : 'Apply as Organiser'}
                </button>
              </section>

              <section style={cardStyle}>
                <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#0E0C0A', marginBottom: '6px' }}>
                  List Your Venue
                </h2>
                <p style={{ fontSize: '13px', color: '#0E0C0A', opacity: 0.6, marginBottom: '16px' }}>
                  Add your space, set up seating and pricing, and accept booking requests from Organisers. Subject to Admin approval.
                </p>
                <button onClick={() => apply('VENUE_OWNER')} disabled={submitting !== null} style={{ ...buttonStyle, opacity: submitting ? 0.6 : 1 }}>
                  {submitting === 'VENUE_OWNER' ? 'Submitting...' : 'Apply as Venue Owner'}
                </button>
              </section>
            </>
          )}
        </div>
      </main>
    </>
  )
}
