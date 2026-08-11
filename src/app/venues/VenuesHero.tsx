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
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 3.6vw, 40px)", fontWeight: 700, letterSpacing: "-0.5px", color: "var(--afa-ink)", marginBottom: "10px" }}>
        {tr.venuesPage.heading}
      </h1>
      <p style={{ fontFamily: "var(--font-sans)", fontSize: "15px", color: "var(--afa-ink)", opacity: 0.65, marginBottom: "32px", paddingLeft: "16px", borderLeft: "3px solid var(--afa-terracotta)", maxWidth: "420px", lineHeight: 1.6 }}>
        {tr.venuesPage.subtitle}
      </p>
    </>
  )
}
