import type { CSSProperties } from 'react'

// BUG-2610-026 - the one place a Recharts <Tooltip> gets its look. Spread
// it into every chart tooltip: <Tooltip {...chartTooltipProps} ... />.
//
// Recharts colours each value line with its series' `fill`/`stroke` prop
// and falls back to black when there is none. Our series set their colour
// through `style` (so admin token edits reach them), which left the value
// black on the dark tooltip box ("Revenue : ₹0" on venue Sales "By venue").
// itemStyle overrides that fallback, so it must always be set here.
// scripts/chart-tooltip.test.ts fails if a <Tooltip> doesn't use this.
export const chartTooltipContentStyle: CSSProperties = {
  background: 'var(--afa-surface-inverse)',
  border: '1px solid var(--afa-tint-12)',
  borderRadius: 'var(--afa-radius-lg)',
  color: 'var(--afa-text-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--afa-text-small)',
}

export const chartTooltipLabelStyle: CSSProperties = {
  color: 'var(--afa-text-secondary)',
}

export const chartTooltipItemStyle: CSSProperties = {
  color: 'var(--afa-text-primary)',
}

export const chartTooltipProps = {
  contentStyle: chartTooltipContentStyle,
  labelStyle: chartTooltipLabelStyle,
  itemStyle: chartTooltipItemStyle,
}
