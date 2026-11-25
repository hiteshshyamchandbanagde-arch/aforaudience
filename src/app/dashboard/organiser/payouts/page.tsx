'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import SiteNav from '@/components/SiteNav'
import BrandLoader from '@/components/BrandLoader'
import DashboardShell from '@/components/DashboardShell'
import { useToast } from '@/components/Toast'
import { ErrorBanner } from '@/components/ErrorBanner'
import Button from '@/components/ui/Button'
import { PageTitle } from '@/components/dashboard/PageTitle'
import { useLocale, type Dictionary } from '@/lib/i18n/translate'

interface PayoutStatus {
  linked: boolean
  accountId: string | null
  status: string | null
  refreshError?: boolean
  enabled?: boolean
}

// GEN-2610-007 - label and detail in the UI language; the stored status stays as Razorpay sends it.
type PayoutsText = Dictionary['organiserDashboard']['payouts']
const STATUS_COPY: Record<string, { label: keyof PayoutsText; color: string; detail: keyof PayoutsText }> = {
  created: { label: 'statusCreated', color: 'var(--afa-amber)', detail: 'statusCreatedDetail' },
  activated: { label: 'statusActivated', color: 'var(--afa-sage-bright)', detail: 'statusActivatedDetail' },
  verification_failed: { label: 'statusVerificationFailed', color: 'var(--afa-error-bright)', detail: 'statusVerificationFailedDetail' },
  under_review: { label: 'statusUnderReview', color: 'var(--afa-amber)', detail: 'statusUnderReviewDetail' },
}

/** Splits a template at {key} and puts the node in its place. */
function fill(text: string, key: string, node: React.ReactNode) {
  const [before, after = ''] = text.split(`{${key}}`)
  return <>{before}{node}{after}</>
}

export default function OrganiserPayoutsPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const { showToast } = useToast()
  const { t: tr } = useLocale()
  const o = tr.organiserDashboard.payouts
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
      if (!res.ok) throw new Error(o.loadFailed)
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
      if (!res.ok) throw new Error(data.error || o.linkFailed)
      setPayout(data)
      setAccountIdInput('')
      showToast(o.linked, 'success')
    } catch (err: any) {
      showToast(err.message || o.linkFailed, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (sessionStatus === 'loading' || loading) return (<><SiteNav /><DashboardShell><BrandLoader label={tr.dashboardChrome.loading} /></DashboardShell></>)
  if (!session) return (<><SiteNav /><DashboardShell>{null}</DashboardShell></>)

  const statusInfo = payout?.status ? STATUS_COPY[payout.status] : null

  return (
    <>
      <SiteNav />
      <DashboardShell>
      <main style={{ minHeight: '100vh', background: 'var(--afa-surface-raised)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: 'var(--afa-space-48px) var(--afa-space-6)' }}>
          <PageTitle style={{ marginBottom: 'var(--afa-space-2)' }}>
            {o.title}
          </PageTitle>
          <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', opacity: 0.6, marginBottom: 'var(--afa-space-28px)' }}>
            {o.subtitle}
          </p>

          {error && (
            <ErrorBanner style={{ marginBottom: 'var(--afa-space-5)' }}>{error}</ErrorBanner>
          )}

          <div style={{ background: 'var(--afa-surface-raised)', borderRadius: 'var(--afa-radius-lg)', padding: 'var(--afa-space-28px)', border: '1px solid var(--afa-tint-08)', marginBottom: 'var(--afa-space-5)' }}>
            {payout?.linked ? (
              <>
                <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.5, marginBottom: 'var(--afa-space-1)' }}>{o.linkedAccount}</p>
                <p style={{ fontSize: 'var(--afa-text-body-lg)', fontFamily: 'var(--font-mono)', color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-4)' }}>{payout.accountId}</p>

                <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.5, marginBottom: 'var(--afa-space-1)' }}>{o.status}</p>
                <p style={{ fontSize: 'var(--afa-text-title)', fontWeight: 700, color: statusInfo?.color || 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-2)' }}>
                  {statusInfo ? o[statusInfo.label] : payout.status}
                </p>
                {statusInfo?.detail && (
                  <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.7, marginBottom: 'var(--afa-space-5)' }}>{o[statusInfo.detail]}</p>
                )}
                {payout.refreshError && (
                  <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-amber)', marginBottom: 'var(--afa-space-5)' }}>
                    {o.refreshError}
                  </p>
                )}

                <Button
                  variant="outline-neutral"
                  size="lg"
                  fullWidth={false}
                  onClick={() => { setLoading(true); fetchPayout() }}
                >
                  {o.refreshStatus}
                </Button>
              </>
            ) : payout?.enabled === false ? (
              <>
                <p style={{ fontSize: 'var(--afa-text-body)', fontWeight: 600, color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-2)' }}>{o.unavailableTitle}</p>
                <p style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.75, lineHeight: 1.6 }}>
                  {o.unavailableBody}
                </p>
              </>
            ) : (
              <>
                <p style={{ fontSize: 'var(--afa-text-body)', color: 'var(--afa-text-primary)', marginBottom: 'var(--afa-space-4)' }}>{o.noAccount}</p>
                <ol style={{ fontSize: 'var(--afa-text-ui)', color: 'var(--afa-text-primary)', opacity: 0.75, paddingLeft: 'var(--afa-space-5)', marginBottom: 'var(--afa-space-5)', lineHeight: 1.7 }}>
                  <li>{fill(o.step1, 'path', <strong>Route → Accounts → Add Account</strong>)}</li>
                  <li>{o.step2}</li>
                  <li>{fill(o.step3, 'prefix', <code>acc_</code>)}</li>
                </ol>

                <label style={{ fontSize: 'var(--afa-text-ui)', fontWeight: 600, color: 'var(--afa-text-primary)', display: 'block', marginBottom: 'var(--afa-space-6px)' }}>
                  {o.accountIdLabel}
                </label>
                <div style={{ display: 'flex', gap: 'var(--afa-space-10px)' }}>
                  <input
                    type="text"
                    value={accountIdInput}
                    onChange={(e) => setAccountIdInput(e.target.value)}
                    placeholder="acc_XXXXXXXXXXXXXX"
                    style={{ flex: 1, fontSize: 'var(--afa-text-body)', fontFamily: 'var(--font-mono)', padding: 'var(--afa-space-10px) var(--afa-space-3)', borderRadius: 'var(--afa-radius-md)', border: '1px solid var(--afa-tint-20)', background: 'var(--afa-surface-raised)', color: 'var(--afa-text-primary)' }}
                  />
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth={false}
                    onClick={linkAccount}
                    disabled={saving || !accountIdInput.trim()}
                    style={{ opacity: saving ? 0.6 : 1 }}
                  >
                    {saving ? o.linking : o.linkAccount}
                  </Button>
                </div>
              </>
            )}
          </div>

          {payout?.enabled !== false && (
            <p style={{ fontSize: 'var(--afa-text-small)', color: 'var(--afa-text-primary)', opacity: 0.5 }}>
              {o.testModeNote}
            </p>
          )}
        </div>
      </main>
      </DashboardShell>
    </>
  )
}
