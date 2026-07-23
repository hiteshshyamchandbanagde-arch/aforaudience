// Branded loading indicator - reuses the same three-bar motif as the
// intro splash and app icon (cream/gold/ember stacking up), but as a
// small, continuously-looping "equalizer" animation suited to an inline
// loading state rather than the splash's one-shot full-screen play.
// Fitting for a live-performance platform - reads like a soundwave
// as much as a spinner. Swapped in for plain "Loading..." text on the
// highest-traffic pages (the four role dashboards + profile); the
// remaining ~27 lower-traffic "Loading..." spots elsewhere in the app
// are a natural follow-on, not done blind in this pass.
export default function BrandLoader({ label = 'Loading...' }: { label?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '64px 32px' }}>
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="22" width="8" height="14" rx="2" fill="#0E0C0A" opacity="0.85">
          <animate attributeName="height" values="14;28;14" dur="1s" begin="0s" repeatCount="indefinite" />
          <animate attributeName="y" values="22;8;22" dur="1s" begin="0s" repeatCount="indefinite" />
        </rect>
        <rect x="16" y="14" width="8" height="22" rx="2" fill="#C9973A">
          <animate attributeName="height" values="22;34;22" dur="1s" begin="0.15s" repeatCount="indefinite" />
          <animate attributeName="y" values="14;2;14" dur="1s" begin="0.15s" repeatCount="indefinite" />
        </rect>
        <rect x="28" y="6" width="8" height="30" rx="2" fill="#C8441A">
          <animate attributeName="height" values="30;18;30" dur="1s" begin="0.3s" repeatCount="indefinite" />
          <animate attributeName="y" values="6;18;6" dur="1s" begin="0.3s" repeatCount="indefinite" />
        </rect>
      </svg>
      {label && (
        <span style={{ fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#0E0C0A', opacity: 0.5 }}>
          {label}
        </span>
      )}
    </div>
  )
}
