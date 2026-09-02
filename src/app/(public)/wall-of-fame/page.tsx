"use client"
import { useEffect, useState, useTransition, type CSSProperties, type ComponentType } from "react"
import { useRouter } from "next/navigation"
import SiteNav from "@/components/SiteNav"
import { ErrorBanner } from "@/components/ErrorBanner"
import { useLocale } from "@/lib/i18n/translate"
import Photo from "@/components/Photo"
import { initials } from "@/components/EventCard"
import { TrophyMark, StarMark } from "@/components/WallOfFameMarks"

interface LeaderboardEntry {
  id: string
  name: string
  avgRating: number
  reviewCount: number
}

interface WallOfFameData {
  month: string
  minReviews: number
  artistOfMonth: { id: string; name: string; avatar: string | null; avgRating: number; reviewCount: number } | null
  eventOfMonth: { id: string; title: string; posterImage: string | null; avgRating: number; reviewCount: number } | null
  topOrganisers: LeaderboardEntry[]
  topVenues: LeaderboardEntry[]
}

// Grid/graph-paper texture overlay - same recipe as VenueNoPhoto.tsx (two
// 1px cream linear-gradients, 22px cell, 4% opacity).
function GridTexture() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        opacity: 0.04,
        backgroundImage:
          "linear-gradient(var(--afa-cream) 1px, transparent 1px), linear-gradient(90deg, var(--afa-cream) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
    />
  )
}

// Circular initials-chip avatar for a winner who hasn't uploaded a photo -
// same PM/AB/RD/NK-style pattern as EventCard.tsx's LineupChips, reusing
// its initials() extraction rather than rebuilding it.
function InitialsChip({ name }: { name: string }) {
  return (
    <div
      style={{
        width: "64px",
        height: "64px",
        borderRadius: "50%",
        background: "rgba(201,151,58,0.18)",
        border: "1.5px solid rgba(201,151,58,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-mono)",
        fontWeight: 600,
        fontSize: "20px",
        color: "var(--afa-amber)",
      }}
    >
      {initials(name)}
    </div>
  )
}

// Of-the-month card header zone (180px), three states: no winner
// (illustrated mark), winner with a photo (Photo.tsx duotone), winner
// without a photo (initials chip) - see build brief for the confirmed
// fallback rule.
function MonthCardHeader({
  badge,
  winnerName,
  photoSrc,
  photoAlt,
  Mark,
}: {
  badge: string
  winnerName: string | null
  photoSrc: string | null
  photoAlt: string
  Mark: ComponentType<{ style?: CSSProperties }>
}) {
  const [photoFailed, setPhotoFailed] = useState(false)
  const hasWinner = winnerName !== null
  const showPhoto = hasWinner && !!photoSrc && !photoFailed

  return (
    <div style={{ position: "relative", height: "180px", overflow: "hidden", background: "var(--afa-surface-raised)" }}>
      <span
        style={{
          position: "absolute",
          left: "16px",
          top: "16px",
          zIndex: 1,
          display: "inline-flex",
          background: "rgba(10,10,10,0.7)",
          backdropFilter: "blur(4px)",
          padding: "6px 10px",
          borderRadius: "2px",
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--afa-amber)",
        }}
      >
        {badge}
      </span>
      {showPhoto ? (
        <Photo src={photoSrc} alt={photoAlt} onError={() => setPhotoFailed(true)} />
      ) : (
        <>
          <GridTexture />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {hasWinner ? <InitialsChip name={winnerName} /> : <Mark style={{ width: "56px", height: "56px", color: "var(--afa-amber)", opacity: 0.55 }} />}
          </div>
        </>
      )}
    </div>
  )
}

export default function WallOfFamePage() {
  const { t: tr } = useLocale()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [data, setData] = useState<WallOfFameData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  // Same click-guard as /events (#261), /artists (#312), /venues (#313) -
  // Top Organisers/Top Venues leaderboard rows had ZERO click target
  // before this (not a guard gap, no navigation existed at all - same
  // bug class as the My Applications cards fixed in #314). Prefixed key
  // ("org:"/"venue:") since both lists share one guard state.
  const [navigatingKey, setNavigatingKey] = useState<string | null>(null)

  const goTo = (key: string, href: string) => {
    if (navigatingKey) return
    setNavigatingKey(key)
    startTransition(() => {
      router.push(href)
    })
  }

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/wall-of-fame")
        if (!res.ok) throw new Error(tr.wallOfFamePage.failedToLoad)
        setData(await res.json())
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const stars = (avg: number) => "★".repeat(Math.round(avg)) + "☆".repeat(5 - Math.round(avg))
  // artistOfMonthBadge/eventOfMonthBadge carry a leading emoji baked into
  // every locale dictionary (src/lib/i18n/dictionaries/*.ts) - out of
  // scope here (this migration touches page.tsx only), so the "no emoji
  // anywhere" rule is applied at render time instead of editing all 11
  // dictionary files.
  const stripLeadingEmoji = (s: string) => s.replace(/^\p{Extended_Pictographic}\s*/u, "")

  return (
    <main style={{ minHeight: "100vh", background: "var(--afa-surface-page)", fontFamily: "system-ui, sans-serif" }}>
      <SiteNav active="wall-of-fame" />

      {/* HERO */}
      <div style={{ background: "var(--afa-surface-inverse)", padding: "56px 48px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 900, color: "var(--afa-text-primary)", marginBottom: "8px", lineHeight: 1.1 }}>
            {tr.wallOfFamePage.heroPrefix}<em style={{ color: "var(--afa-amber)", fontStyle: "italic" }}>{tr.wallOfFamePage.heroEmphasis}</em>
          </div>
          <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.5)" }}>
            {loading ? tr.wallOfFamePage.loading : data ? tr.wallOfFamePage.subtitleTemplate.replace("{month}", data.month) : ""}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "40px 24px 80px" }}>
        {error && (
          <ErrorBanner style={{ marginBottom: "24px" }}>{error}</ErrorBanner>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--afa-text-primary)", opacity: 0.5 }}>{tr.wallOfFamePage.loading}</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
            {/* ARTIST OF THE MONTH */}
            <div
              role={data?.artistOfMonth ? "link" : undefined}
              tabIndex={data?.artistOfMonth ? 0 : undefined}
              aria-busy={navigatingKey === "artist-of-month"}
              onClick={() => data?.artistOfMonth && goTo("artist-of-month", `/artists/${data.artistOfMonth.id}`)}
              onKeyDown={(e) => {
                if (data?.artistOfMonth && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault()
                  goTo("artist-of-month", `/artists/${data.artistOfMonth.id}`)
                }
              }}
              style={{
                position: "relative",
                background: "var(--afa-surface-raised)",
                borderRadius: "3px",
                border: "1px solid rgba(245,245,240,0.1)",
                overflow: "hidden",
                cursor: data?.artistOfMonth ? (navigatingKey ? "default" : "pointer") : "default",
                opacity: navigatingKey && navigatingKey !== "artist-of-month" ? 0.5 : 1,
                transition: "opacity 0.15s ease",
              }}
            >
              {navigatingKey === "artist-of-month" && (
                <div style={{ position: "absolute", inset: 0, zIndex: 2, background: "rgba(10,10,10,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: "22px", height: "22px", borderRadius: "50%", border: "2px solid rgba(245,245,240,0.15)", borderTopColor: "var(--afa-fill-solid)", animation: "afa-spin 0.7s linear infinite" }} />
                  <style>{`@keyframes afa-spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}
              <MonthCardHeader
                badge={stripLeadingEmoji(tr.wallOfFamePage.artistOfMonthBadge)}
                winnerName={data?.artistOfMonth?.name ?? null}
                photoSrc={data?.artistOfMonth?.avatar ?? null}
                photoAlt={data?.artistOfMonth?.name ?? ""}
                Mark={TrophyMark}
              />
              <div style={{ padding: "20px 28px" }}>
                {data?.artistOfMonth ? (
                  <>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 700, color: "var(--afa-text-primary)" }}>{data.artistOfMonth.name}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--afa-text-secondary)", marginTop: "6px" }}>
                      {stars(data.artistOfMonth.avgRating)} {data.artistOfMonth.avgRating.toFixed(1)} · {data.artistOfMonth.reviewCount}{tr.wallOfFamePage.reviewsSuffix}
                    </div>
                  </>
                ) : (
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "18px", color: "var(--afa-text-secondary)" }}>{tr.wallOfFamePage.notEnoughReviews}</div>
                )}
                <p style={{ fontSize: "13px", color: "var(--afa-text-secondary)", opacity: 0.55, lineHeight: 1.6, margin: "12px 0 0" }}>
                  {data?.artistOfMonth
                    ? tr.wallOfFamePage.artistBlurbFilled.replace("{n}", String(data.minReviews))
                    : tr.wallOfFamePage.artistBlurbEmpty.replace("{n}", String(data?.minReviews ?? 3))}
                </p>
                {data?.artistOfMonth && (
                  <span style={{ display: "inline-block", marginTop: "16px", fontSize: "13px", fontWeight: 600, color: "var(--afa-amber)" }}>
                    {tr.wallOfFamePage.viewProfile}
                  </span>
                )}
              </div>
            </div>

            {/* EVENT OF THE MONTH */}
            <div
              role={data?.eventOfMonth ? "link" : undefined}
              tabIndex={data?.eventOfMonth ? 0 : undefined}
              aria-busy={navigatingKey === "event-of-month"}
              onClick={() => data?.eventOfMonth && goTo("event-of-month", `/events/${data.eventOfMonth.id}`)}
              onKeyDown={(e) => {
                if (data?.eventOfMonth && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault()
                  goTo("event-of-month", `/events/${data.eventOfMonth.id}`)
                }
              }}
              style={{
                position: "relative",
                background: "var(--afa-surface-raised)",
                borderRadius: "3px",
                border: "1px solid rgba(245,245,240,0.1)",
                overflow: "hidden",
                cursor: data?.eventOfMonth ? (navigatingKey ? "default" : "pointer") : "default",
                opacity: navigatingKey && navigatingKey !== "event-of-month" ? 0.5 : 1,
                transition: "opacity 0.15s ease",
              }}
            >
              {navigatingKey === "event-of-month" && (
                <div style={{ position: "absolute", inset: 0, zIndex: 2, background: "rgba(10,10,10,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: "22px", height: "22px", borderRadius: "50%", border: "2px solid rgba(245,245,240,0.15)", borderTopColor: "var(--afa-fill-solid)", animation: "afa-spin 0.7s linear infinite" }} />
                </div>
              )}
              <MonthCardHeader
                badge={stripLeadingEmoji(tr.wallOfFamePage.eventOfMonthBadge)}
                winnerName={data?.eventOfMonth?.title ?? null}
                photoSrc={data?.eventOfMonth?.posterImage ?? null}
                photoAlt={data?.eventOfMonth?.title ?? ""}
                Mark={StarMark}
              />
              <div style={{ padding: "20px 28px" }}>
                {data?.eventOfMonth ? (
                  <>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 700, color: "var(--afa-text-primary)" }}>{data.eventOfMonth.title}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--afa-text-secondary)", marginTop: "6px" }}>
                      {stars(data.eventOfMonth.avgRating)} {data.eventOfMonth.avgRating.toFixed(1)} · {data.eventOfMonth.reviewCount}{tr.wallOfFamePage.reviewsSuffix}
                    </div>
                  </>
                ) : (
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "18px", color: "var(--afa-text-secondary)" }}>{tr.wallOfFamePage.notEnoughReviews}</div>
                )}
                <p style={{ fontSize: "13px", color: "var(--afa-text-secondary)", opacity: 0.55, lineHeight: 1.6, margin: "12px 0 0" }}>
                  {data?.eventOfMonth
                    ? tr.wallOfFamePage.eventBlurbFilled.replace("{n}", String(data.minReviews))
                    : tr.wallOfFamePage.eventBlurbEmpty.replace("{n}", String(data?.minReviews ?? 3))}
                </p>
                {data?.eventOfMonth && (
                  <span style={{ display: "inline-block", marginTop: "16px", fontSize: "13px", fontWeight: 600, color: "var(--afa-amber)" }}>
                    {tr.wallOfFamePage.viewEvent}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TOP VENUES / TOP ORGANISERS — all-time leaderboard, separate from the monthly awards above */}
        {!loading && data && (data.topVenues.length > 0 || data.topOrganisers.length > 0) && (
          <div style={{ marginTop: "40px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--afa-amber)", marginBottom: "16px", textAlign: "center" }}>
              {tr.wallOfFamePage.allTimeLeaderboard}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
              <div style={{ background: "var(--afa-surface-raised)", borderRadius: "3px", border: "1px solid rgba(245,245,240,0.1)", padding: "24px 28px" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 700, color: "var(--afa-text-primary)", marginBottom: "16px" }}>{stripLeadingEmoji(tr.wallOfFamePage.topOrganisers)}</div>
                {data.topOrganisers.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "var(--afa-text-secondary)", opacity: 0.5 }}>{tr.wallOfFamePage.noOrganiserReviews.replace("{n}", String(data.minReviews))}</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {data.topOrganisers.map((o, i) => {
                      const key = `org:${o.id}`
                      const isNavigatingThis = navigatingKey === key
                      return (
                        <div
                          key={o.id}
                          role="link"
                          tabIndex={0}
                          aria-busy={isNavigatingThis}
                          onClick={() => goTo(key, `/organisers/${o.id}`)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              goTo(key, `/organisers/${o.id}`)
                            }
                          }}
                          style={{
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            padding: "8px 4px",
                            borderRadius: "6px",
                            borderBottom: i < data.topOrganisers.length - 1 ? "1px solid rgba(245,245,240,0.1)" : "none",
                            cursor: navigatingKey ? "default" : "pointer",
                            opacity: navigatingKey && !isNavigatingThis ? 0.5 : 1,
                            transition: "opacity 0.15s ease, background 0.15s ease",
                          }}
                        >
                          {isNavigatingThis && (
                            <div
                              style={{
                                position: "absolute",
                                inset: 0,
                                zIndex: 2,
                                borderRadius: "6px",
                                background: "rgba(10,10,10,0.7)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <div
                                style={{
                                  width: "18px",
                                  height: "18px",
                                  borderRadius: "50%",
                                  border: "2px solid rgba(245,245,240,0.15)",
                                  borderTopColor: "var(--afa-fill-solid)",
                                  animation: "afa-spin 0.7s linear infinite",
                                }}
                              />
                              <style>{`@keyframes afa-spin { to { transform: rotate(360deg); } }`}</style>
                            </div>
                          )}
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: "16px", fontWeight: 700, color: "var(--afa-amber)", width: "20px" }}>{i + 1}</div>
                          <div style={{ flex: 1, fontSize: "14px", fontWeight: 600, color: "var(--afa-text-primary)" }}>{o.name}</div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--afa-text-secondary)", opacity: 0.6 }}>{o.avgRating.toFixed(1)}★ · {o.reviewCount}</div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div style={{ background: "var(--afa-surface-raised)", borderRadius: "3px", border: "1px solid rgba(245,245,240,0.1)", padding: "24px 28px" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 700, color: "var(--afa-text-primary)", marginBottom: "16px" }}>{stripLeadingEmoji(tr.wallOfFamePage.topVenues)}</div>
                {data.topVenues.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "var(--afa-text-secondary)", opacity: 0.5 }}>{tr.wallOfFamePage.noVenueReviews.replace("{n}", String(data.minReviews))}</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {data.topVenues.map((v, i) => {
                      const key = `venue:${v.id}`
                      const isNavigatingThis = navigatingKey === key
                      return (
                        <div
                          key={v.id}
                          role="link"
                          tabIndex={0}
                          aria-busy={isNavigatingThis}
                          onClick={() => goTo(key, `/venues/${v.id}`)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              goTo(key, `/venues/${v.id}`)
                            }
                          }}
                          style={{
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            padding: "8px 4px",
                            borderRadius: "6px",
                            borderBottom: i < data.topVenues.length - 1 ? "1px solid rgba(245,245,240,0.1)" : "none",
                            cursor: navigatingKey ? "default" : "pointer",
                            opacity: navigatingKey && !isNavigatingThis ? 0.5 : 1,
                            transition: "opacity 0.15s ease, background 0.15s ease",
                          }}
                        >
                          {isNavigatingThis && (
                            <div
                              style={{
                                position: "absolute",
                                inset: 0,
                                zIndex: 2,
                                borderRadius: "6px",
                                background: "rgba(10,10,10,0.7)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <div
                                style={{
                                  width: "18px",
                                  height: "18px",
                                  borderRadius: "50%",
                                  border: "2px solid rgba(245,245,240,0.15)",
                                  borderTopColor: "var(--afa-fill-solid)",
                                  animation: "afa-spin 0.7s linear infinite",
                                }}
                              />
                              <style>{`@keyframes afa-spin { to { transform: rotate(360deg); } }`}</style>
                            </div>
                          )}
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: "16px", fontWeight: 700, color: "var(--afa-amber)", width: "20px" }}>{i + 1}</div>
                          <div style={{ flex: 1, fontSize: "14px", fontWeight: 600, color: "var(--afa-text-primary)" }}>{v.name}</div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--afa-text-secondary)", opacity: 0.6 }}>{v.avgRating.toFixed(1)}★ · {v.reviewCount}</div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
