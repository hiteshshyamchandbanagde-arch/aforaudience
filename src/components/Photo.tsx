import type { CSSProperties } from "react"

// Permanent amber/sepia duotone treatment for event photography, per the
// V2 design spec (docs/design.md §9.1). Grayscale + contrast + brightness
// on the base image, with a warm amber field multiplied over it at ~48% -
// deliberately NOT hover/group-hover gated (a bug found in the website
// Figma Make export's own card, confirmed against the mobile export's
// correct reference implementation, which renders identically at rest).
//
// Fills its nearest positioned ancestor by default (position: absolute,
// inset: 0) - wrap it in a sized `position: relative` container and layer
// any overlay content (badges, text) on top, same as a plain <img> would
// have been used.
export default function Photo({
  src,
  alt,
  style,
}: {
  src: string | null | undefined
  alt: string
  style?: CSSProperties
}) {
  if (!src) return null
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", ...style }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "grayscale(1) contrast(1.25) brightness(0.9)",
        }}
      />
      <div
        aria-hidden
        style={{ position: "absolute", inset: 0, backgroundColor: "#C9973A", opacity: 0.48, mixBlendMode: "multiply" }}
      />
    </div>
  )
}
