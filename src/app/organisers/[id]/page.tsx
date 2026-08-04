"use client"
import { useEffect, useState, use } from "react"
import Link from "next/link"
import SiteNav from "@/components/SiteNav"
import BrandLoader from "@/components/BrandLoader"
import OrganiserFollowButton from "./OrganiserFollowButton"
import { useLocale } from "@/lib/i18n/translate"

interface OrganiserDetail {
  id: string
  orgName: string
  code: string | null
  bio: string | null
  user: { name: string; avatar: string | null }
  events: { id: string; title: string; date: string; venue: { name: string; city: string } | null }[]
}

export default function OrganiserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { t: tr } = useLocale()
  const [organiser, setOrganiser] = useState<OrganiserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch(`/api/organisers/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Organiser not found")
        return res.json()
      })
      .then(setOrganiser)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (<><SiteNav backHref="/events" backLabel={tr.organiserDetailPage.backToEvents} /><BrandLoader /></>)

  if (error || !organiser) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--afa-cream)", fontFamily: "system-ui, sans-serif" }}>
        <SiteNav backHref="/events" backLabel={tr.organiserDetailPage.backToEvents} />
        <div style={{ maxWidth: "760px", margin: "0 auto", padding: "48px 24px" }}>{tr.organiserDetailPage.notFound}</div>
      </main>
    )
  }

  const now = new Date(new Date().toDateString())
  const upcoming = organiser.events.filter((e) => new Date(e.date) >= now)
  const past = organiser.events.filter((e) => new Date(e.date) < now)

  return (
    <main style={{ minHeight: "100vh", background: "var(--afa-cream)", fontFamily: "system-ui, sans-serif" }}>
      <SiteNav backHref="/events" backLabel={tr.organiserDetailPage.backToEvents} />
      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "48px 24px" }}>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: "32px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "6px" }}>
          {organiser.orgName}
        </h1>
        {organiser.code && (
          <p style={{ fontSize: "13px", color: "var(--afa-ink)", opacity: 0.4, marginBottom: "8px" }}>{organiser.code}</p>
        )}

        <OrganiserFollowButton organiserId={organiser.id} />

        {organiser.bio && (
          <p style={{ fontSize: "14px", color: "var(--afa-ink)", opacity: 0.75, lineHeight: 1.6, marginBottom: "28px", maxWidth: "600px" }}>
            {organiser.bio}
          </p>
        )}

        <div style={{ background: "var(--afa-white)", borderRadius: "12px", padding: "28px", border: "1px solid rgba(14,12,10,0.08)" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "16px" }}>
            {tr.organiserDetailPage.eventsByTemplate.replace("{name}", organiser.orgName)}
          </h2>

          {organiser.events.length === 0 ? (
            <p style={{ fontSize: "14px", color: "var(--afa-ink)", opacity: 0.5 }}>{tr.organiserDetailPage.noPublishedEventsYet}</p>
          ) : (
            <>
              {upcoming.length > 0 && (
                <div style={{ marginBottom: past.length > 0 ? "24px" : 0 }}>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--afa-ink)", opacity: 0.5, marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {tr.organiserDetailPage.upcoming}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {upcoming.map((e) => (
                      <Link
                        key={e.id}
                        href={`/events/${e.id}`}
                        style={{ display: "block", padding: "12px 16px", background: "var(--afa-cream)", borderRadius: "8px", textDecoration: "none", color: "var(--afa-ink)" }}
                      >
                        <div style={{ fontSize: "14px", fontWeight: 600 }}>{e.title}</div>
                        <div style={{ fontSize: "12px", opacity: 0.6 }}>
                          {new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          {e.venue && ` · ${e.venue.name}, ${e.venue.city}`}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {past.length > 0 && (
                <div>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--afa-ink)", opacity: 0.5, marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {tr.organiserDetailPage.past}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {past.slice(0, 10).map((e) => (
                      <Link
                        key={e.id}
                        href={`/events/${e.id}`}
                        style={{ display: "block", padding: "12px 16px", background: "var(--afa-cream)", borderRadius: "8px", textDecoration: "none", color: "var(--afa-ink)", opacity: 0.7 }}
                      >
                        <div style={{ fontSize: "14px", fontWeight: 600 }}>{e.title}</div>
                        <div style={{ fontSize: "12px", opacity: 0.6 }}>
                          {new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          {e.venue && ` · ${e.venue.name}, ${e.venue.city}`}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  )
}
