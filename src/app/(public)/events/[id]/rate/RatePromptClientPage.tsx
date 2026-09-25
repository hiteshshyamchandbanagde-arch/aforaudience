"use client"
import { useState } from "react"
import Link from "next/link"
import SiteNav from "@/components/SiteNav"
import AuthPromptSheet from "@/components/AuthPromptSheet"
import Button from "@/components/ui/Button"
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
        <Button
          key={n}
          variant="bare"
          type="button"
          onClick={() => onChange(n)}
          aria-label={`Rate ${n} star${n === 1 ? "" : "s"}`}
          style={{ fontSize: "var(--afa-text-page-title-lg)", lineHeight: 1, padding: 0, color: value >= n ? "var(--afa-amber)" : "rgba(245,245,240,0.25)" }}
        >
          {value >= n ? "★" : "☆"}
        </Button>
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
      <main style={{ minHeight: "100vh", background: "var(--afa-surface-page)", fontFamily: "var(--font-sans)" }}>
        <SiteNav />
        <div style={{ maxWidth: "500px", margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
          <p style={{ color: "var(--afa-text-primary)", opacity: 0.6 }}>{tr.ratePromptPage.eventNotFound}</p>
        </div>
      </main>
    )
  }

  if (!canReview) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--afa-surface-page)", fontFamily: "var(--font-sans)" }}>
        <SiteNav />
        <div style={{ maxWidth: "500px", margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--afa-text-subtitle)", fontWeight: 700, color: "var(--afa-text-primary)", marginBottom: "8px" }}>
            {tr.ratePromptPage.checkInRequired}
          </p>
          <Link href={`/events/${event.id}`} style={{ color: "var(--afa-amber)", fontSize: "var(--afa-text-body)", fontWeight: 600 }}>
            {tr.ratePromptPage.viewEventDetails}
          </Link>
        </div>
        <AuthPromptSheet open={authOpen} onClose={() => setAuthOpen(false)} title={tr.ratePromptPage.signInTitle} onSuccess={() => setAuthOpen(false)} />
      </main>
    )
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--afa-surface-page)", fontFamily: "var(--font-sans)" }}>
      <SiteNav />
      <div style={{ maxWidth: "560px", margin: "0 auto", padding: "48px 24px" }}>
        <p style={{ fontSize: "var(--afa-text-ui)", color: "var(--afa-text-primary)", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>{tr.ratePromptPage.howWasIt}</p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--afa-text-page-title)", fontWeight: 700, color: "var(--afa-text-primary)", marginBottom: "32px" }}>{event.title}</h1>

        {!overallSubmitted ? (
          <div style={{ background: "var(--afa-surface-raised)", borderRadius: "3px", padding: "28px", marginBottom: "24px", border: "1px solid var(--afa-tint-10)" }}>
            <p style={{ fontSize: "var(--afa-text-body-lg)", fontWeight: 600, color: "var(--afa-text-primary)", marginBottom: "16px" }}>{tr.ratePromptPage.rateOverall}</p>
            <Stars value={overallRating} onChange={setOverallRating} />
            <textarea
              value={overallComment}
              onChange={(e) => setOverallComment(e.target.value)}
              placeholder={tr.ratePromptPage.commentPlaceholder}
              style={{ width: "100%", marginTop: "16px", padding: "12px", borderRadius: "8px", border: "1px solid var(--afa-border-resting)", fontSize: "var(--afa-text-body)", fontFamily: "inherit", minHeight: "70px", resize: "vertical", background: "var(--afa-surface-raised)", color: "var(--afa-text-primary)" }}
            />
            {overallError && <p style={{ color: "var(--afa-error)", fontSize: "var(--afa-text-ui)", marginTop: "8px" }}>{overallError}</p>}
            <Button
              variant="solid"
              size="lg"
              onClick={submitOverall}
              disabled={overallSubmitting}
              style={{ marginTop: "16px" }}
            >
              {overallSubmitting ? tr.ratePromptPage.submitting : tr.ratePromptPage.submitRating}
            </Button>
          </div>
        ) : (
          <div style={{ background: "var(--afa-surface-raised)", borderRadius: "3px", padding: "20px 28px", marginBottom: "24px", border: "1px solid var(--afa-tint-10)", display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "var(--afa-text-heading)", color: "var(--afa-amber)" }}>✓</span>
            <p style={{ fontSize: "var(--afa-text-body)", color: "var(--afa-text-primary)" }}>{tr.ratePromptPage.thanksForRating}</p>
          </div>
        )}

        {overallSubmitted && event.lineup.length > 0 && !showPerformers && (
          <Button
            variant="outline-neutral"
            size="lg"
            fullWidth={false}
            onClick={() => setShowPerformers(true)}
          >
            {tr.ratePromptPage.rateSpecificPerformers}
          </Button>
        )}

        {showPerformers && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <p style={{ fontSize: "var(--afa-text-ui)", color: "var(--afa-text-primary)", opacity: 0.55 }}>
              {tr.ratePromptPage.performersHint}
            </p>
            {event.lineup.map((p) => {
              const rated = ratedIds.includes(p.id)
              return (
                <div key={p.id} style={{ background: "var(--afa-surface-raised)", borderRadius: "3px", padding: "16px 20px", border: "1px solid var(--afa-tint-10)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
                  <span style={{ fontSize: "var(--afa-text-body)", fontWeight: 600, color: "var(--afa-text-primary)" }}>{p.artist.user.displayName || p.artist.user.name}</span>
                  {rated ? (
                    <span style={{ fontSize: "var(--afa-text-ui)", color: "var(--afa-amber)", fontWeight: 600 }}>{tr.ratePromptPage.rated}</span>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ display: "flex", gap: "2px" }}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Button
                            key={n}
                            variant="bare"
                            onClick={() => setPerfDrafts((prev) => ({ ...prev, [p.id]: n }))}
                            aria-label={`Rate ${n} star${n === 1 ? "" : "s"}`}
                            style={{ fontSize: "var(--afa-text-title)", lineHeight: 1, padding: 0, color: (perfDrafts[p.id] || 0) >= n ? "var(--afa-amber)" : "rgba(245,245,240,0.25)" }}
                          >
                            {(perfDrafts[p.id] || 0) >= n ? "★" : "☆"}
                          </Button>
                        ))}
                      </div>
                      <Button
                        variant="solid"
                        size="sm"
                        fullWidth={false}
                        onClick={() => submitPerformer(p.id)}
                        disabled={!perfDrafts[p.id] || perfSubmitting === p.id}
                      >
                        {tr.ratePromptPage.rateBtn}
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ marginTop: "32px", textAlign: "center" }}>
          <Link href={`/events/${event.id}`} style={{ fontSize: "var(--afa-text-ui)", color: "var(--afa-text-primary)", opacity: 0.5 }}>
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
