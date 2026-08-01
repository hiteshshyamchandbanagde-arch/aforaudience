'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

// Audience Choice voting (§6, session 58). Scoped to Competition Show
// events. Three cases handled: cast a ballot (voting open + eligible),
// see final results (voting closed), or a passive state (not eligible,
// or voting hasn't opened yet). Deliberately NOT labeled "winner"
// anywhere - this is a parallel, separate result from however the
// organiser/panelists declare their own outcome (§6: "kept as a
// separate, parallel result, not a replacement").

interface LineupEntry {
  id: string
  artistName: string
}

interface VoteState {
  lineup: LineupEntry[]
  votingOpensAt: string
  votingClosesAt: string
  isOpen: boolean
  isClosed: boolean
  eligibility: { audienceBookingIds: string[]; isPanelist: boolean; isCelebrity: boolean }
  myVotes: Partial<Record<'AUDIENCE' | 'PANELIST' | 'CELEBRITY', { performanceId: string; rank: number; voterId?: string }[]>>
}

interface ResultsState {
  available: boolean
  votingOpensAt?: string
  votingClosesAt?: string
  isOpen?: boolean
  ranking?: { performanceId: string; artistName: string; blendedScore: number; byCategory: Record<string, number> }[]
  effectiveWeights?: Record<string, number>
  configuredWeights?: { audience: number; panelist: number; celebrity: number }
  voterCounts?: Record<string, number>
}

function Ballot({
  eventId,
  category,
  lineup,
  existing,
  onSubmitted,
  bookingId,
}: {
  eventId: string
  category: 'AUDIENCE' | 'PANELIST' | 'CELEBRITY'
  lineup: LineupEntry[]
  existing?: { performanceId: string; rank: number }[]
  onSubmitted: () => void
  bookingId?: string
}) {
  const existingByRank = new Map((existing || []).map((v) => [v.rank, v.performanceId]))
  const [picks, setPicks] = useState<Record<number, string>>({
    1: existingByRank.get(1) || '',
    2: existingByRank.get(2) || '',
    3: existingByRank.get(3) || '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const alreadyVoted = (existing || []).length > 0

  const handleSubmit = async () => {
    setError('')
    const rankings = [1, 2, 3]
      .filter((r) => picks[r])
      .map((r) => ({ rank: r, performanceId: picks[r] }))
    if (rankings.length === 0) {
      setError('Pick at least a 1st choice.')
      return
    }
    const ids = rankings.map((r) => r.performanceId)
    if (new Set(ids).size !== ids.length) {
      setError('Each performer can only be picked once.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/events/${eventId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, bookingId, rankings }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit vote')
      onSubmitted()
    } catch (err: any) {
      setError(err.message || 'Failed to submit vote')
    } finally {
      setSubmitting(false)
    }
  }

  const label = category === 'AUDIENCE' ? 'Your vote' : category === 'PANELIST' ? 'Your panelist vote' : 'Your celebrity guest vote'

  return (
    <div style={{ background: 'white', borderRadius: '10px', padding: '16px', border: '1px solid rgba(14,12,10,0.08)', marginBottom: '12px' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '10px' }}>
        {label}{alreadyVoted && <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 700, color: 'var(--afa-sage)' }}>✓ Submitted — you can change it until voting closes</span>}
      </div>
      {[1, 2, 3].map((rank) => (
        <div key={rank} style={{ marginBottom: '8px' }}>
          <label style={{ fontSize: '11px', color: 'var(--afa-ink)', opacity: 0.6, display: 'block', marginBottom: '4px' }}>
            {rank === 1 ? '1st choice' : rank === 2 ? '2nd choice (optional)' : '3rd choice (optional)'}
          </label>
          <select
            value={picks[rank]}
            onChange={(e) => setPicks((prev) => ({ ...prev, [rank]: e.target.value }))}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(14,12,10,0.15)', fontSize: '13px' }}
          >
            <option value="">—</option>
            {lineup.map((p) => (
              <option key={p.id} value={p.id}>{p.artistName}</option>
            ))}
          </select>
        </div>
      ))}
      {error && <div style={{ fontSize: '12px', color: 'var(--afa-terracotta)', marginBottom: '8px' }}>{error}</div>}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        style={{ fontSize: '13px', fontWeight: 700, color: 'white', background: 'var(--afa-terracotta)', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.6 : 1 }}
      >
        {submitting ? 'Submitting…' : alreadyVoted ? 'Update vote' : 'Submit vote'}
      </button>
    </div>
  )
}

export default function AudienceChoiceVoting({ eventId, isCompetitionShow }: { eventId: string; isCompetitionShow?: boolean }) {
  const { status } = useSession()
  const [voteState, setVoteState] = useState<VoteState | null>(null)
  const [results, setResults] = useState<ResultsState | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const resultsRes = await fetch(`/api/events/${eventId}/vote/results`)
    if (resultsRes.ok) setResults(await resultsRes.json())

    if (status === 'authenticated') {
      const voteRes = await fetch(`/api/events/${eventId}/vote`)
      if (voteRes.ok) setVoteState(await voteRes.json())
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!isCompetitionShow) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompetitionShow, status])

  if (!isCompetitionShow || loading) return null

  return (
    <div style={{ marginTop: '20px' }}>
      <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: 'var(--afa-ink)', marginBottom: '12px' }}>
        🗳️ Audience Choice
      </h3>

      {results?.available ? (
        <div>
          <p style={{ fontSize: '12px', color: 'var(--afa-ink)', opacity: 0.6, marginBottom: '14px' }}>
            A separate, audience-weighted result — not the organiser's own decision. Blended from Audience/Panelist/Celebrity votes ({results.voterCounts?.AUDIENCE || 0} / {results.voterCounts?.PANELIST || 0} / {results.voterCounts?.CELEBRITY || 0} voters).
          </p>
          {(results.ranking || []).map((r, i) => (
            <div key={r.performanceId} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'white', borderRadius: '10px', padding: '12px 16px', marginBottom: '8px', border: i === 0 ? '1px solid var(--afa-gold)' : '1px solid rgba(14,12,10,0.08)' }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: i === 0 ? 'var(--afa-gold)' : 'var(--afa-ink)', opacity: i === 0 ? 1 : 0.4, width: '28px' }}>
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>{r.artistName}</div>
                <div style={{ fontSize: '11px', opacity: 0.5 }}>Audience {r.byCategory.AUDIENCE} · Panelist {r.byCategory.PANELIST} · Celebrity {r.byCategory.CELEBRITY}</div>
              </div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: '16px', fontWeight: 700 }}>{r.blendedScore}</div>
            </div>
          ))}
        </div>
      ) : results && !results.isOpen ? (
        <p style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.6 }}>Voting opens once the show ends.</p>
      ) : status !== 'authenticated' ? (
        <p style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.6 }}>Log in to vote if you're a checked-in attendee, panelist, or celebrity guest.</p>
      ) : voteState ? (
        voteState.eligibility.isPanelist || voteState.eligibility.isCelebrity || voteState.eligibility.audienceBookingIds.length > 0 ? (
          <div>
            {voteState.eligibility.isPanelist && (
              <Ballot eventId={eventId} category="PANELIST" lineup={voteState.lineup} existing={voteState.myVotes.PANELIST} onSubmitted={load} />
            )}
            {voteState.eligibility.isCelebrity && (
              <Ballot eventId={eventId} category="CELEBRITY" lineup={voteState.lineup} existing={voteState.myVotes.CELEBRITY} onSubmitted={load} />
            )}
            {voteState.eligibility.audienceBookingIds.map((bookingId) => (
              <Ballot
                key={bookingId}
                eventId={eventId}
                category="AUDIENCE"
                lineup={voteState.lineup}
                bookingId={bookingId}
                existing={(voteState.myVotes.AUDIENCE || []).filter((v) => v.voterId === bookingId)}
                onSubmitted={load}
              />
            ))}
          </div>
        ) : (
          <p style={{ fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.6 }}>
            Voting is open for checked-in attendees, accepted panelists, and the celebrity guest.
          </p>
        )
      ) : null}
    </div>
  )
}
