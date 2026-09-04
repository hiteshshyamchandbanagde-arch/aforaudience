// Desktop-only brand panel for the auth pages (Login/Register/Forgot/Reset/Verify).
// Ported from the Figma Make export "Redesign_Authentication_Screens.zip"
// (PhotoPanel in its BrandPanel.tsx) — desktop split-panel decision logged in
// docs/design.md, "Auth Pages — Desktop Brand Panel Redesign" (5 Sep 2026).

// TEMP stock photo (Unsplash, downloaded and re-hosted on Vercel Blob instead
// of hotlinking) — not final AFA event photography. Swap for real AFA photos
// when available; see docs/design.md's "Photo source" note.
const PLACEHOLDER_IMAGE_URL =
  "https://l2eemxcwaimekimk.public.blob.vercel-storage.com/auth/brand-panel-placeholder.jpg"

export default function AuthBrandPanel() {
  return (
    <div className="relative w-full h-full overflow-hidden bg-[var(--afa-surface-page)]">
      {/* Base image — grayscale + luminosity blend sets up the duotone.
          This recipe (luminosity blend + vignettes) is intentionally distinct
          from src/components/Photo.tsx's duotone (flat grayscale/contrast/
          brightness + multiply overlay div, no luminosity blend). Photo.tsx is
          tuned for small in-content thumbnails; this panel is a full-height
          hero background that needs the extra depth/vignetting to keep large
          overlaid text legible. Unifying them would either wash out the
          thumbnails or flatten this panel — kept separate on purpose. */}
      <img
        src={PLACEHOLDER_IMAGE_URL}
        alt="A live crowd at an AforAudience event, arms raised toward a brightly lit stage"
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          filter: "grayscale(100%) contrast(1.2) brightness(0.55)",
          mixBlendMode: "luminosity",
        }}
      />
      {/* Amber multiply overlay — highlights go amber, shadows stay dark */}
      <div
        className="absolute inset-0"
        style={{ background: "var(--afa-amber)", mixBlendMode: "multiply", opacity: 0.7 }}
      />
      {/* Ember accent glow, bottom-left */}
      <div
        className="absolute bottom-0 left-0 w-[60%] h-[40%]"
        style={{
          background:
            "radial-gradient(ellipse at 0% 100%, color-mix(in srgb, var(--afa-fill-solid) 22%, transparent) 0%, transparent 70%)",
        }}
      />
      {/* Top vignette to separate the wordmark from the photo */}
      <div
        className="absolute inset-x-0 top-0 h-48"
        style={{
          background:
            "linear-gradient(to bottom, color-mix(in srgb, var(--afa-surface-page) 85%, transparent) 0%, transparent 100%)",
        }}
      />
      {/* Bottom vignette to lift the tagline */}
      <div
        className="absolute inset-x-0 bottom-0 h-56"
        style={{
          background:
            "linear-gradient(to top, color-mix(in srgb, var(--afa-surface-page) 90%, transparent) 0%, transparent 100%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col justify-between p-10 pointer-events-none">
        <div className="font-serif text-[28px] font-bold text-[var(--afa-text-primary)]">
          <span className="text-[var(--afa-brand-mark)]">A</span>forAudience
        </div>

        <div>
          <p
            className="font-serif font-light text-[var(--afa-text-primary)] leading-[1.15]"
            style={{ fontSize: "2.5rem" }}
          >
            Every show.<br />Every story.
          </p>
          <p className="text-sm text-[var(--afa-text-primary)] opacity-40 mt-3 tracking-wide">
            Comedy · Poetry · Music · Dance
          </p>
        </div>
      </div>
    </div>
  )
}
