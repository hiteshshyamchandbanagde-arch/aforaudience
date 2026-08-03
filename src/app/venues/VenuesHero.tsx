"use client"
import { useLocale } from "@/lib/i18n/translate"

// Split out of page.tsx (server component - direct prisma/session/cookies
// access, can't call the client-only useLocale hook itself) so the
// heading/subtitle can still pick up the active locale. Established
// pattern for any future server-component page that needs translated
// static text: keep data-fetching concerns in the server component,
// delegate rendering of translatable strings to a small client component
// like this one.
export default function VenuesHero() {
  const { t: tr } = useLocale()
  return (
    <>
      <h1 style={{ fontFamily: "Georgia, serif", fontSize: "32px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "8px" }}>
        {tr.venuesPage.heading}
      </h1>
      <p style={{ fontSize: "15px", color: "var(--afa-ink)", opacity: 0.6, marginBottom: "32px" }}>
        {tr.venuesPage.subtitle}
      </p>
    </>
  )
}
