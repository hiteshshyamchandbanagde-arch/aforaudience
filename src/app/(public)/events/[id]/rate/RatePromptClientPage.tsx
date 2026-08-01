"use client"
import { useState } from "react"
import Link from "next/link"
import SiteNav from "@/components/SiteNav"
import AuthPromptSheet from "@/components/AuthPromptSheet"

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
      setOverallError("Pick a rating first")
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
        throw new Error(data.error || "Failed to submit")
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
        if (res.status !== 401) throw new Error(data.error || "Failed to submit")
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
      <main style={{ minHeight: "100vh", background: "var(--afa-cream)", fontFamily: "system-ui, sans-serif" }}>
        <SiteNav />
        <div style={{ maxWidth: "500px", margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
          <p style={{ color: "var(--afa-ink)", opacity: 0.6 }}>Event not found.</p>
        </div>
      </main>
    )
  }

  if (!canReview) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--afa-cream)", fontFamily: "system-ui, sans-serif" }}>
        <SiteNav />
        <div style={{ maxWidth: "500px", margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎤</div>
          <p style={{ fontFamily: "Georgia, serif", fontSize: "20px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "8px" }}>
            You can rate this show once you&apos;ve checked in at the door
          </p>
          <Link href={`/events/${event.id}`} style={{ color: "var(--afa-terracotta)", fontSize: "14px", fontWeight: 600 }}>
            View event details
          </Link>
        </div>
        <AuthPromptSheet open={authOpen} onClose={() => setAuthOpen(false)} title="Sign in to rate this show" onSuccess={() => setAuthOpen(false)} />
      </main>
    )
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--afa-cream)", fontFamily: "system-ui, sans-serif" }}>
      <SiteNav />
      <div style={{ maxWidth: "560px", margin: "0 auto", padding: "48px 24px" }}>
        <p style={{ fontSize: "13px", color: "var(--afa-ink)", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>How was it?</p>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: "28px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "32px" }}>{event.title}</h1>

        {!overallSubmitted ? (
          <div style={{ background: "white", borderRadius: "16px", padding: "28px", marginBottom: "24px", border: "1px solid rgba(14,12,10,0.08)" }}>
            <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--afa-ink)", marginBottom: "16px" }}>Rate the show overall</p>
            <Stars value={overallRating} onChange={setOverallRating} />
            <textarea
              value={overallComment}
              onChange={(e) => setOverallComment(e.target.value)}
              placeholder="Anything you want to add? (optional)"
              style={{ width: "100%", marginTop: "16px", padding: "12px", borderRadius: "8px", border: "1px solid rgba(14,12,10,0.15)", fontSize: "14px", fontFamily: "inherit", minHeight: "70px", resize: "vertical" }}
            />
            {overallError && <p style={{ color: "var(--afa-terracotta)", fontSize: "13px", marginTop: "8px" }}>{overallError}</p>}
            <button
              onClick={submitOverall}
              disabled={overallSubmitting}
              style={{ marginTop: "16px", width: "100%", padding: "14px", borderRadius: "8px", border: "none", background: "var(--afa-terracotta)", color: "white", fontSize: "15px", fontWeight: 700, cursor: overallSubmitting ? "default" : "pointer", opacity: overallSubmitting ? 0.6 : 1 }}
            >
              {overallSubmitting ? "Submitting..." : "Submit rating"}
            </button>
          </div>
        ) : (
          <div style={{ background: "white", borderRadius: "16px", padding: "20px 28px", marginBottom: "24px", border: "1px solid rgba(14,12,10,0.08)", display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "24px" }}>✓</span>
            <p style={{ fontSize: "14px", color: "var(--afa-ink)" }}>Thanks for rating the show.</p>
          </div>
        )}

        {overallSubmitted && event.lineup.length > 0 && !showPerformers && (
          <button
            onClick={() => setShowPerformers(true)}
            style={{ background: "none", border: "1px solid rgba(14,12,10,0.15)", borderRadius: "8px", padding: "12px 20px", fontSize: "14px", fontWeight: 600, color: "var(--afa-ink)", cursor: "pointer" }}
          >
            Want to rate any specific performers?
          </button>
        )}

        {showPerformers && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <p style={{ fontSize: "13px", color: "var(--afa-ink)", opacity: 0.55 }}>
              Optional - only rate who you actually watched. Rating a performer gets you early word on their next show.
            </p>
            {event.lineup.map((p) => {
              const rated = ratedIds.includes(p.id)
              return (
                <div key={p.id} style={{ background: "white", borderRadius: "12px", padding: "16px 20px", border: "1px solid rgba(14,12,10,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--afa-ink)" }}>{p.artist.user.displayName || p.artist.user.name}</span>
                  {rated ? (
                    <span style={{ fontSize: "13px", color: "var(--afa-terracotta)", fontWeight: 600 }}>✓ Rated</span>
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
                        style={{ fontSize: "12px", fontWeight: 700, padding: "6px 12px", borderRadius: "6px", border: "none", background: "var(--afa-ink)", color: "white", cursor: "pointer", opacity: !perfDrafts[p.id] ? 0.4 : 1 }}
                      >
                        Rate
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ marginTop: "32px", textAlign: "center" }}>
          <Link href={`/events/${event.id}`} style={{ fontSize: "13px", color: "var(--afa-ink)", opacity: 0.5 }}>
            Back to event page
          </Link>
        </div>
      </div>

      <AuthPromptSheet
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        title="Sign in to rate this show"
        onSuccess={() => {
          setAuthOpen(false)
          submitOverall()
        }}
      />
    </main>
  )
}
