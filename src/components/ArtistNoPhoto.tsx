import type { CSSProperties } from "react"
import { GuitarMark, MicMark, BookMask, DanceMark, QuillMark } from "@/components/icons/ArtistIcons"

// No-photo fallback for artist cards/hero (GEN-2608-073). Replaces the old
// circular monogram-letter treatment for artists specifically - venue cards
// keep monogramTone (src/lib/placeholder-image.ts), untouched, out of
// scope here. Per the approved design.md spec: large italic display-serif
// name + a genre-relevant illustrated line-art icon, explicitly never a
// face/stock photo/emoji, so nothing implies a real likeness for an artist
// who hasn't uploaded one.
//
// Renders the matched icon directly (rather than resolving a component
// reference into a variable and rendering `<Mark />`) so this stays a
// plain static component tree - eslint's react-hooks/static-components
// rule flags the variable-holds-a-component pattern as "created during
// render" even when, as here, it only ever selects among a fixed set of
// module-level components.
function ArtistGenreMark({ genres, style }: { genres: string[]; style?: CSSProperties }) {
  const genre = genres[0]
  if (genre === "Music - Acoustic" || genre === "Singing") return <GuitarMark style={style} />
  if (genre === "Stand-up Comedy" || genre === "Spoken Word" || genre === "Rap / Hip-Hop") return <MicMark style={style} />
  if (genre === "Storytelling" || genre === "Theatre / Drama") return <BookMask style={style} />
  if (genre === "Dance") return <DanceMark style={style} />
  // Poetry, Improv, Magic, or an admin-approved free-text "Other" genre -
  // same catch-all role Quill plays in the source Figma export this was
  // ported from.
  return <QuillMark style={style} />
}

interface ArtistNoPhotoProps {
  name: string
  genres: string[]
  caption?: string
  size?: "card" | "hero"
}

export default function ArtistNoPhoto({ name, genres, caption, size = "card" }: ArtistNoPhotoProps) {
  const markSize = size === "hero" ? "180px" : "120px"
  const nameSize = size === "hero" ? "clamp(2.4rem, 5vw, 4rem)" : "clamp(1.4rem, 4vw, 2rem)"

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "var(--afa-surface-page)" }}>
      <ArtistGenreMark
        genres={genres}
        style={{
          position: "absolute",
          top: size === "hero" ? "-10%" : "-15%",
          right: size === "hero" ? "-8%" : "-12%",
          width: markSize,
          height: markSize,
          color: "var(--afa-amber)",
          opacity: 0.22,
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: size === "hero" ? "32px" : "18px" }}>
        {caption && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--afa-amber)", marginBottom: "10px" }}>
            {caption}
          </span>
        )}
        <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 500, fontSize: nameSize, lineHeight: 1, color: "var(--afa-cream)" }}>
          {name}
        </span>
      </div>
    </div>
  )
}

export { ArtistGenreMark }
