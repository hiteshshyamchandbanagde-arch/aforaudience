"use client"
import { useState } from "react"
import Link from "next/link"
import SiteNav from "@/components/SiteNav"
import AuthPromptSheet from "@/components/AuthPromptSheet"
import { useLocale } from "@/lib/i18n/translate"

interface EventData {
  id: string
  title: string
  date: string
  posterImage: string | null
  lineup: { id: string; artist: { id: string; user: { name: string; displayName: string | null } } }[]
}

function Stars({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div style={{ display: "flex", gap: "6px" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "32px", padding: 0, opacity: value >= n ? 1 : 0.25 }}
        >
          ⭐
        </button>
      ))}
    </div>
  )
}

export default function RatePromptClientPage({
  event,
  canReview,
  existingOverallRating,
  ratedPerformanceIds,
}: {
  event: EventData | null
  canReview: boolean
  existingOverallRating: { rating: number; comment: string | null } | null
  ratedPerformanceIds: string[]
}) {
  const { t: tr } = useLocale()
  const [authOpen, setAuthOpen] = useState(false)

  const [overallRating, setOverallRating] = useState(existingOverallRating?.rating || 0)
  const [overallComment, setOverallComment] = useState(existingOverallRating?.comment || "")
  const [overallSubmitted, setOverallSubmitted] = useState(!!existingOverallRating)
  const [overallSubmitting, setOverallSubmitting] = useState(false)
  const [overallError, setOverallError] = useState("")

  const [showPerformers, setShowPerformers] = useState(false)
  const [ratedIds, setRatedIds] = useState<string[]>(ratedPerformanceIds)
  const [perfDrafts, setPerfDrafts] = useState<Record<string, number>>({})
  const [perfSubmitting, setPerfSubmitting] = useState<string | null>(null)

  const submitOverall = async () => {
    if (overallRating === 0) {
      setOverallError(tr.ratePromptPage.pickRatingFirst)
      return
    }
    setOverallSubmitting(true)
    setOverallError("")
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event!.id, rating: overallRating, comment: overallComment.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 401) {
          setAuthOpen(true)
          return
        }
        throw new Error(data.error || tr.ratePromptPage.submitFailed)
      }
      setOverallSubmitted(true)
      setShowPerformers(true)
    } catch (err: any) {
      setOverallError(err.message)
    } finally {
      setOverallSubmitting(false)
    }
  }

  const submitPerformer = async (performanceId: string) => {
    const rating = perfDrafts[performanceId]
    if (!rating) return
    setPerfSubmitting(performanceId)
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event!.id, performanceId, rating }),
      })
      if (!res.ok) {
        const data = await res.json()
        if (res.status !== 401) throw new Error(data.error || tr.ratePromptPage.submitFailed)
      } else {
        setRatedIds((prev) => [...prev, performanceId])
      }
    } catch {
      // Non-fatal - performer ratings are optional; a quiet failure here
      // just leaves that one artist unrated, not worth a blocking error.
    } finally {
      setPerfSubmitting(null)
    }
  }

  if (!event) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--afa-surface-raised)", fontFamily: "system-ui, sans-serif" }}>
        <SiteNav />
        <div style={{ maxWidth: "500px", margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
          <p style={{ color: "var(--afa-text-primary)", opacity: 0.6 }}>{tr.ratePromptPage.eventNotFound}</p>
        </div>
      </main>
    )
  }

  if (!canReview) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--afa-surface-raised)", fontFamily: "system-ui, sans-serif" }}>
        <SiteNav />
        <div style={{ maxWidth: "500px", margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎤</div>
          <p style={{ fontFamily: "Georgia, serif", fontSize: "20px", fontWeight: 700, color: "var(--afa-text-primary)", marginBottom: "8px" }}>
            {tr.ratePromptPage.checkInRequired}
          </p>
          <Link href={`/events/${event.id}`} style={{ color: "var(--afa-terracotta)", fontSize: "14px", fontWeight: 600 }}>
            {tr.ratePromptPage.viewEventDetails}
          </Link>
        </div>
        <AuthPromptSheet open={authOpen} onClose={() => setAuthOpen(false)} title={tr.ratePromptPage.signInTitle} onSuccess={() => setAuthOpen(false)} />
      </main>
    )
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--afa-surface-raised)", fontFamily: "system-ui, sans-serif" }}>
      <SiteNav />
      <div style={{ maxWidth: "560px", margin: "0 auto", padding: "48px 24px" }}>
        <p style={{ fontSize: "13px", color: "var(--afa-text-primary)", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>{tr.ratePromptPage.howWasIt}</p>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: "28px", fontWeight: 700, color: "var(--afa-text-primary)", marginBottom: "32px" }}>{event.title}</h1>

        {!overallSubmitted ? (
          <div style={{ background: "white", borderRadius: "16px", padding: "28px", marginBottom: "24px", border: "1px solid rgba(245,245,240,0.08)" }}>
            <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--afa-text-primary)", marginBottom: "16px" }}>{tr.ratePromptPage.rateOverall}</p>
            <Stars value={overallRating} onChange={setOverallRating} />
            <textarea
              value={overallComment}
              onChange={(e) => setOverallComment(e.target.value)}
              placeholder={tr.ratePromptPage.commentPlaceholder}
              style={{ width: "100%", marginTop: "16px", padding: "12px", borderRadius: "8px", border: "1px solid rgba(245,245,240,0.15)", fontSize: "14px", fontFamily: "inherit", minHeight: "70px", resize: "vertical" }}
            />
            {overallError && <p style={{ color: "var(--afa-terracotta)", fontSize: "13px", marginTop: "8px" }}>{overallError}</p>}
            <button
              onClick={submitOverall}
              disabled={overallSubmitting}
              style={{ marginTop: "16px", width: "100%", padding: "14px", borderRadius: "8px", border: "none", background: "var(--afa-terracotta)", color: "white", fontSize: "15px", fontWeight: 700, cursor: overallSubmitting ? "default" : "pointer", opacity: overallSubmitting ? 0.6 : 1 }}
            >
              {overallSubmitting ? tr.ratePromptPage.submitting : tr.ratePromptPage.submitRating}
            </button>
          </div>
        ) : (
          <div style={{ background: "white", borderRadius: "16px", padding: "20px 28px", marginBottom: "24px", border: "1px solid rgba(245,245,240,0.08)", display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "24px" }}>✓</span>
            <p style={{ fontSize: "14px", color: "var(--afa-text-primary)" }}>{tr.ratePromptPage.thanksForRating}</p>
          </div>
        )}

        {overallSubmitted && event.lineup.length > 0 && !showPerformers && (
          <button
            onClick={() => setShowPerformers(true)}
            style={{ background: "none", border: "1px solid rgba(245,245,240,0.15)", borderRadius: "8px", padding: "12px 20px", fontSize: "14px", fontWeight: 600, color: "var(--afa-text-primary)", cursor: "pointer" }}
          >
            {tr.ratePromptPage.rateSpecificPerformers}
          </button>
        )}

        {showPerformers && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <p style={{ fontSize: "13px", color: "var(--afa-text-primary)", opacity: 0.55 }}>
              {tr.ratePromptPage.performersHint}
            </p>
            {event.lineup.map((p) => {
              const rated = ratedIds.includes(p.id)
              return (
                <div key={p.id} style={{ background: "white", borderRadius: "12px", padding: "16px 20px", border: "1px solid rgba(245,245,240,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--afa-text-primary)" }}>{p.artist.user.displayName || p.artist.user.name}</span>
                  {rated ? (
                    <span style={{ fontSize: "13px", color: "var(--afa-terracotta)", fontWeight: 600 }}>{tr.ratePromptPage.rated}</span>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ display: "flex", gap: "2px" }}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            onClick={() => setPerfDrafts((prev) => ({ ...prev, [p.id]: n }))}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", padding: 0, opacity: (perfDrafts[p.id] || 0) >= n ? 1 : 0.25 }}
                          >
                            ⭐
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => submitPerformer(p.id)}
                        disabled={!perfDrafts[p.id] || perfSubmitting === p.id}
                        style={{ fontSize: "12px", fontWeight: 700, padding: "6px 12px", borderRadius: "6px", border: "none", background: "var(--afa-fill-solid)", color: "white", cursor: "pointer", opacity: !perfDrafts[p.id] ? 0.4 : 1 }}
                      >
                        {tr.ratePromptPage.rateBtn}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ marginTop: "32px", textAlign: "center" }}>
          <Link href={`/events/${event.id}`} style={{ fontSize: "13px", color: "var(--afa-text-primary)", opacity: 0.5 }}>
            {tr.ratePromptPage.backToEvent}
          </Link>
        </div>
      </div>

      <AuthPromptSheet
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        title={tr.ratePromptPage.signInTitle}
        onSuccess={() => {
          setAuthOpen(false)
          submitOverall()
        }}
      />
    </main>
  )
}
