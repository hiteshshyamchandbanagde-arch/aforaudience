"use client"
import { useLocale } from "@/lib/i18n/translate"

// Split out of page.tsx (server component - direct prisma/session/cookies
// access, can't call the client-only useLocale hook itself) so the
// heading/subtitle can still pick up the active locale. Established
// pattern for any future server-component page that needs translated
// static text: keep data-fetching concerns in the server component,
// delegate rendering of translatable strings to a small client component
// like this one.
//
// BUG-2608-072 (gap 1) - the original GEN-2608-074 build brief called this
// a "light token-migration pass only" and left the copy/structure alone,
// which was wrong: the eyebrow line, headline (with its italic emphasis
// word), and border-bottom header block are real approved content from the
// Figma Make export (VenuesDirectory.tsx lines ~23-32), not decoration.
// Prefix/emphasis/suffix key split mirrors the existing hero pattern used
// on /artists and /organisers (see artistsPage.heroPrefix etc.).
export default function VenuesHero({ count }: { count: number }) {
  const { t: tr } = useLocale()
  return (
    <header style={{ borderBottom: "1px solid rgba(245,245,240,0.15)", paddingBottom: "40px", marginBottom: "40px" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--afa-amber)" }}>
        {tr.venuesPage.eyebrowDirectory.replace("{count}", String(count))}
      </span>
      <h1 style={{ marginTop: "20px", fontFamily: "var(--font-display)", fontSize: "clamp(44px, 7vw, 80px)", fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 0.95, color: "var(--afa-text-primary)" }}>
        {tr.venuesPage.headingPrefix}
        <em style={{ color: "var(--afa-amber)", fontStyle: "italic", fontWeight: 400 }}>{tr.venuesPage.headingEmphasis}</em>
        {tr.venuesPage.headingSuffix}
      </h1>
      <p style={{ fontFamily: "var(--font-sans)", fontSize: "17px", color: "var(--afa-text-primary)", opacity: 0.65, marginTop: "20px", maxWidth: "420px", lineHeight: 1.6 }}>
        {tr.venuesPage.subtitle}
      </p>
    </header>
  )
}
