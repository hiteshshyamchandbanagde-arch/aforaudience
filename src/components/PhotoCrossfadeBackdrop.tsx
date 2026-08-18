import Photo from "@/components/Photo"

/**
 * Shared absolute-positioned crossfade layer + gradient overlays + empty-
 * state fallback, extracted from the homepage Hero (GEN-2608-072) so the
 * Artist landing page's hero reuses the same visual treatment instead of
 * a parallel copy. Palette-only empty-state gradient (--afa-ink,
 * --afa-surface-inverse, --afa-amber) - same technique FourRooms.tsx's
 * room panels already reuse.
 */
export default function PhotoCrossfadeBackdrop({
  photos,
  active,
}: {
  photos: { src: string; alt: string }[]
  active: number
}) {
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {photos.length > 0 ? (
        photos.map((photo, i) => (
          <div key={photo.src} style={{ position: "absolute", inset: 0, opacity: i === active ? 1 : 0, transition: "opacity 1600ms ease-in-out" }}>
            <Photo src={photo.src} alt={photo.alt} />
          </div>
        ))
      ) : (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(140% 140% at 18% 0%, var(--afa-ink) 0%, var(--afa-surface-inverse) 60%), linear-gradient(135deg, rgba(201,151,58,0.08) 0%, rgba(201,151,58,0) 50%)",
          }}
        />
      )}
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, var(--afa-surface-inverse) 5%, rgba(10,10,10,0.45) 45%, rgba(10,10,10,0.7) 100%)" }} />
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(10,10,10,0.85), rgba(10,10,10,0) 55%)" }} />
    </div>
  )
}
