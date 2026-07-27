// Branded loading indicator - previously used an unrelated "equalizer"
// motif (vertical bars of varying height). Rebuilt (session 39, per
// Hitesh's direct request) to be a pixel-accurate match of the actual
// app icon/logo mark (src/app/icon.svg): three HORIZONTAL bars,
// decreasing in width top-to-bottom (terracotta -> amber -> cream), on
// a dark rounded-square background - not vertical bars, not the same
// colors-per-bar arrangement as before. Same coordinates/proportions as
// icon.svg's 64x64 viewBox, just scaled up. Animated as a staggered
// opacity pulse cascading top to bottom, so it reads as "the logo
// loading in" repeatedly rather than a generic spinner shape.
export default function BrandLoader({ label = 'Loading...' }: { label?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '64px 32px' }}>
      <svg width="56" height="56" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="64" height="64" rx="16" fill="#0E0C0A" />
        <path d="M18 18h28v8H18z" fill="#C8441A">
          <animate attributeName="opacity" values="1;0.35;1" dur="1.2s" begin="0s" repeatCount="indefinite" />
        </path>
        <path d="M18 30h20v8H18z" fill="#C9973A">
          <animate attributeName="opacity" values="1;0.35;1" dur="1.2s" begin="0.2s" repeatCount="indefinite" />
        </path>
        <path d="M18 42h14v8H18z" fill="#F7F3EE">
          <animate attributeName="opacity" values="1;0.35;1" dur="1.2s" begin="0.4s" repeatCount="indefinite" />
        </path>
      </svg>
      {label && (
        <span style={{ fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: 'var(--afa-ink)', opacity: 0.5 }}>
          {label}
        </span>
      )}
    </div>
  )
}
