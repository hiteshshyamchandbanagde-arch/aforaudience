/**
 * Small env-label pill shown next to the logo.
 * Reads NEXT_PUBLIC_ENV_LABEL:
 *   - "Beta v1" on prod → muted grey pill
 *   - "QA" on preview   → ember-red pill
 *   - unset/empty       → renders nothing (safe fallback)
 * Any label containing "QA" (case-insensitive) gets the ember styling —
 * so future environments like "QA-staging" would still show as clearly non-prod.
 */
export default function EnvBadge() {
  const label = process.env.NEXT_PUBLIC_ENV_LABEL
  if (!label) return null

  const isQA = label.toLowerCase().includes("qa")
  const bg = isQA ? "var(--afa-terracotta)" : "var(--afa-mist)"
  const fg = isQA ? "var(--afa-cream)" : "var(--afa-ink)"

  return (
    <span
      aria-label={`Environment: ${label}`}
      style={{
        display: "inline-block",
        marginLeft: "8px",
        padding: "2px 8px",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.02em",
        color: fg,
        background: bg,
        borderRadius: "999px",
        verticalAlign: "middle",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {label}
    </span>
  )
}