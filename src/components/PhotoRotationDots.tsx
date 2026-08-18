import { ROTATE_MS } from "@/hooks/usePhotoRotation"

/**
 * Shared progress-dot row for a crossfading photo hero, extracted from
 * the homepage Hero (GEN-2608-072) alongside PhotoCrossfadeBackdrop /
 * usePhotoRotation, so the Artist landing page's hero reuses the same
 * rotation-progress affordance instead of a parallel copy.
 */
export default function PhotoRotationDots({
  photos,
  active,
  setActive,
  paused,
  reduced,
}: {
  photos: { src: string; alt: string }[]
  active: number
  setActive: (i: number) => void
  paused: boolean
  reduced: boolean
}) {
  if (photos.length < 2) return null
  return (
    <div style={{ marginTop: "56px", display: "flex", alignItems: "center", gap: "10px" }}>
      {photos.map((photo, i) => (
        <button
          key={photo.src}
          aria-label={`Photo ${i + 1} of ${photos.length}`}
          onClick={() => setActive(i)}
          style={{ position: "relative", height: "4px", width: i === active ? "40px" : "16px", borderRadius: "999px", overflow: "hidden", border: "none", padding: 0, cursor: "pointer", transition: "width 0.3s ease", background: "rgba(245,245,240,0.25)" }}
        >
          {i === active && !reduced && !paused && (
            <span style={{ position: "absolute", inset: 0, background: "var(--afa-amber)", transformOrigin: "left", animation: `heroDrawLine ${ROTATE_MS}ms linear` }} />
          )}
          {i === active && (reduced || paused) && (
            <span style={{ position: "absolute", inset: 0, background: "var(--afa-amber)" }} />
          )}
        </button>
      ))}
      <style>{`
        @keyframes heroDrawLine {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
      `}</style>
    </div>
  )
}
