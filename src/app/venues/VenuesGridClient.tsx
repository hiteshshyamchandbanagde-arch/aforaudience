"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

interface VenueItem {
  id: string
  name: string
  city: string
  capacity: number
  priceRangeLabel: string | null
}

export default function VenuesGridClient({ venues }: { venues: VenueItem[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [navigatingId, setNavigatingId] = useState<string | null>(null)

  // Same click-guard as /events (PR #261) and /artists (PR #312) - a
  // plain Link gives no click feedback, so a click that doesn't render
  // anything right away reads as "nothing happened" and invites repeat
  // clicks, each firing a fresh un-deduped navigation. Standing rule (1
  // Aug): every tile/card must open in a single click - this closes the
  // same gap here proactively rather than waiting for a live report.
  const goToVenue = (id: string) => {
    if (navigatingId) return
    setNavigatingId(id)
    startTransition(() => {
      router.push(`/venues/${id}`)
    })
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
      {venues.map((v) => {
        const isNavigatingThis = navigatingId === v.id
        return (
          <div
            key={v.id}
            role="link"
            tabIndex={0}
            aria-busy={isNavigatingThis}
            onClick={() => goToVenue(v.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                goToVenue(v.id)
              }
            }}
            style={{
              position: "relative",
              display: "block",
              background: "var(--afa-white)",
              borderRadius: "12px",
              padding: "22px",
              border: "1px solid rgba(14,12,10,0.08)",
              cursor: navigatingId ? "default" : "pointer",
              opacity: navigatingId && !isNavigatingThis ? 0.5 : 1,
              transition: "opacity 0.15s ease",
            }}
          >
            {isNavigatingThis && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 2,
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.7)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    border: "3px solid rgba(14,12,10,0.15)",
                    borderTopColor: "var(--afa-terracotta)",
                    animation: "afa-spin 0.7s linear infinite",
                  }}
                />
                <style>{`@keyframes afa-spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "19px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "4px" }}>
              {v.name}
            </h2>
            <p style={{ fontSize: "13px", color: "var(--afa-ink)", opacity: 0.6, marginBottom: "14px" }}>{v.city}</p>
            <div style={{ display: "flex", gap: "18px", fontSize: "13px", color: "var(--afa-ink)" }}>
              <span><strong>{v.capacity}</strong> seats</span>
              {v.priceRangeLabel && <span style={{ color: "var(--afa-terracotta)", fontWeight: 700 }}>{v.priceRangeLabel}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
