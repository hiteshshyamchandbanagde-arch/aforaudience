// BUG-2610-027 - every money axis gets round ticks from here. Venue Sales'
// "By venue" axis read ₹0 ₹10K ₹19K ₹29K ₹38K: Recharts split the data
// max (₹38,000) into four equal steps. moneyAxis() picks a round step
// (1, 2, 2.5 or 5 times a power of ten) and ends the axis on the first
// tick at or above the max, so the same data reads ₹0 ₹10K ₹20K ₹30K
// ₹40K. Pass the result straight to a Recharts <XAxis>/<YAxis>:
//
//   <XAxis type="number" {...moneyAxis(max)} />
//
// Pure (no React, no DOM) so scripts/money-axis.test.ts can run it.

const NICE_MULTIPLIERS = [1, 2, 2.5, 5, 10]

/** The smallest round step (1/2/2.5/5 x 10^k, at least ₹1) that is >= raw. */
export function niceStep(raw: number): number {
  if (!(raw > 0)) return 1
  const power = Math.pow(10, Math.floor(Math.log10(raw)))
  for (const m of NICE_MULTIPLIERS) {
    const step = m * power
    // A hair of tolerance so 10000 / 1 stays 10000, not the next step up.
    if (step >= raw * (1 - 1e-9)) return Math.max(1, step)
  }
  return Math.max(1, 10 * power)
}

/**
 * Round ticks from ₹0 up to the first tick >= max, about `count` of them
 * (count - 1 steps). A max of 0 or less gives a single ₹0 tick.
 */
export function niceMoneyTicks(max: number, count = 5): number[] {
  if (!(max > 0)) return [0]
  const step = niceStep(max / Math.max(1, count - 1))
  const top = Math.ceil(max / step - 1e-9) * step
  const ticks: number[] = []
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 100) / 100)
  return ticks
}

/** ₹40K, ₹2.5K, ₹1.5L, ₹2Cr, ₹500: compact, one decimal at most, no trailing ".0". */
export function compactINR(n: number): string {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  const unit = (value: number, suffix: string) => {
    const rounded = Math.round(value * 10) / 10
    return `${sign}₹${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}${suffix}`
  }
  if (abs >= 1e7) return unit(abs / 1e7, 'Cr')
  if (abs >= 1e5) return unit(abs / 1e5, 'L')
  if (abs >= 1e3) return unit(abs / 1e3, 'K')
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`
}

/** Recharts props for a money axis: round ticks, the domain they span, compact labels. */
export function moneyAxis(max: number, count = 5) {
  const ticks = niceMoneyTicks(max, count)
  const top = ticks[ticks.length - 1]
  return {
    ticks,
    domain: [0, top > 0 ? top : 1] as [number, number],
    interval: 0 as const,
    allowDecimals: false,
    tickFormatter: compactINR,
  }
}
