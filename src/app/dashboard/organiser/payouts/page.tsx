'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import SiteNav from '@/components/SiteNav'
import BackLink from '@/components/BackLink'
import BrandLoader from '@/components/BrandLoader'
import { useToast } from '@/components/Toast'

interface PayoutStatus {
  linked: boolean
  accountId: string | null
  status: string | null
  refreshError?: boolean
  enabled?: boolean
}

const STATUS_COPY: Record<string, { label: string; color: string; detail: string }> = {
  created: {
    label: 'Created, not yet activated',
    color: 'var(--afa-gold)',
    detail: 'Bank details are still being verified on Razorpay\u2019s side. This can take a moment in test mode — refresh to check again.',
  },
  activated: {
    label: 'Activated',
    color: 'var(--afa-sage)',
    detail: 'Your account is ready to receive direct payouts. Future ticket sales will split automatically — the booking fee stays with the platform, your share transfers straight to this account.',
  },
  verification_failed: {
    label: 'Verification failed',
    color: 'var(--afa-error)',
    detail: 'Razorpay couldn\u2019t verify the bank details on this account. Check the account in the Razorpay Dashboard and re-link once it\u2019s fixed.',
  },
  under_review: {
    label: 'Under review',
    color: 'var(--afa-gold)',
    detail: 'Razorpay is reviewing this account. Refresh to check again shortly.',
  },
}

export default function OrganiserPayoutsPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [payout, setPayout] = useState<PayoutStatus | null>(null)
  const [accountIdInput, setAccountIdInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') router.push('/login')
  }, [sessionStatus, router])

  const fetchPayout = async () => {
    try {
      const res = await fetch('/api/organiser/payout-account')
      if (!res.ok) throw new Error('Failed to load payout account status')
      setPayout(await res.json())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user) fetchPayout()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  const linkAccount = async () => {
    if (!accountIdInput.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/organiser/payout-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: accountIdInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to link account')
      setPayout(data)
      setAccountIdInput('')
      showToast('Payout account linked.', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to link account', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (sessionStatus === 'loading' || loading) return (<><SiteNav /><BrandLoader /></>)
  if (!session) return <SiteNav />

  const statusInfo = payout?.status ? STATUS_COPY[payout.status] : null

  return (
    <>
      <SiteNav />
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '48px 24px' }}>
          <BackLink href="/dashboard/organiser" label="Back to Dashboard" />

          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '28px', fontWeight: 700, color: 'var(--afa-text-primary)', marginTop: '16px', marginBottom: '8px' }}>
            Direct Payouts
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: '28px' }}>
            Link your Razorpay account so ticket revenue settles straight to you — AforAudience only ever keeps the small audience booking fee, never a cut of your ticket price.
          </p>

          {error && (
            <div style={{ padding: '14px 16px', background: 'var(--afa-error-bg)', border: '1px solid var(--afa-error-border)', borderRadius: '8px', color: 'var(--afa-error)', fontSize: '14px', marginBottom: '20px' }}>
              {error}
            </div>
          )}

          <div style={{ background: 'var(--afa-surface-raised)', borderRadius: '12px', padding: '28px', border: '1px solid rgba(245,245,240,0.08)', marginBottom: '20px' }}>
            {payout?.linked ? (
              <>
                <p style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.5, marginBottom: '4px' }}>Linked account</p>
                <p style={{ fontSize: '15px', fontFamily: 'monospace', color: 'var(--afa-text-primary)', marginBottom: '16px' }}>{payout.accountId}</p>

                <p style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.5, marginBottom: '4px' }}>Status</p>
                <p style={{ fontSize: '17px', fontWeight: 700, color: statusInfo?.color || 'var(--afa-text-primary)', marginBottom: '8px' }}>
                  {statusInfo?.label || payout.status}
                </p>
                {statusInfo?.detail && (
                  <p style={{ fontSize: '13px', color: 'var(--afa-text-primary)', opacity: 0.7, marginBottom: '20px' }}>{statusInfo.detail}</p>
                )}
                {payout.refreshError && (
                  <p style={{ fontSize: '13px', color: 'var(--afa-gold)', marginBottom: '20px' }}>
                    Couldn't refresh the latest status from Razorpay just now — showing the last known value.
                  </p>
                )}

                <button
                  onClick={() => { setLoading(true); fetchPayout() }}
                  style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-text-primary)', background: 'transparent', border: '1px solid rgba(245,245,240,0.2)', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}
                >
                  Refresh status
                </button>
              </>
            ) : payout?.enabled === false ? (
              <>
                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-text-primary)', marginBottom: '8px' }}>Direct payouts aren't available right now</p>
                <p style={{ fontSize: '13px', color: 'var(--afa-text-primary)', opacity: 0.75, lineHeight: 1.6 }}>
                  Automatic split payouts aren't currently supported on the platform. Ticket revenue is settled to organisers manually for now — no action needed from you. Reach out via support if you have questions.
                </p>
              </>
            ) : (
              <>
                <p style={{ fontSize: '14px', color: 'var(--afa-text-primary)', marginBottom: '16px' }}>No payout account linked yet.</p>
                <ol style={{ fontSize: '13px', color: 'var(--afa-text-primary)', opacity: 0.75, paddingLeft: '20px', marginBottom: '20px', lineHeight: 1.7 }}>
                  <li>On the Razorpay Dashboard (test mode), go to <strong>Route → Accounts → Add Account</strong></li>
                  <li>Fill in your business/bank details (dummy data is fine in test mode — no KYC docs needed)</li>
                  <li>Copy the account ID it generates (starts with <code>acc_</code>) and paste it below</li>
                </ol>

                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--afa-text-primary)', display: 'block', marginBottom: '6px' }}>
                  Razorpay account ID
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    value={accountIdInput}
                    onChange={(e) => setAccountIdInput(e.target.value)}
                    placeholder="acc_XXXXXXXXXXXXXX"
                    style={{ flex: 1, fontSize: '14px', fontFamily: 'monospace', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(245,245,240,0.2)' }}
                  />
                  <button
                    onClick={linkAccount}
                    disabled={saving || !accountIdInput.trim()}
                    style={{ fontSize: '14px', fontWeight: 600, color: 'var(--afa-on-fill-solid)', background: 'var(--afa-terracotta)', border: 'none', padding: '10px 22px', borderRadius: '8px', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}
                  >
                    {saving ? 'Linking…' : 'Link account'}
                  </button>
                </div>
              </>
            )}
          </div>

          {payout?.enabled !== false && (
            <p style={{ fontSize: '12px', color: 'var(--afa-text-primary)', opacity: 0.5 }}>
              Test mode only for now — no real money moves. Once your business completes real KYC with Razorpay later, the same account works for live payouts with no changes needed here.
            </p>
          )}
        </div>
      </main>
    </>
  )
}
