// Display-only currency conversion (Option A, session 47, 30 Jul).
//
// Every amount in this app is stored, validated, charged, and settled in
// INR - always. This file ONLY changes how a rupee amount is *shown* to a
// user who has picked a different display currency in their profile; it
// never changes what anyone is actually charged. Real multi-currency
// settlement ("Option B") is explicitly out of scope - see design.md §9.
//
// Rates come from DisplayCurrencyRate, an admin-edited table (not a live
// FX feed) - same shape as the existing audienceBookingFee admin setting.
// Deliberate v1 choice: this is cosmetic, so rate precision to the minute
// doesn't matter, and it avoids a new external API dependency this early.

export interface DisplayCurrency {
  code: string
  label: string
  symbol: string
  rateFromINR: number
}

/**
 * Format an INR rupee amount (not paise) for display, converting to the
 * given currency if it isn't INR. Always shows the real INR amount
 * alongside a non-INR conversion, in parentheses, so it's never ambiguous
 * that INR is what's actually charged/settled.
 */
export function formatDisplayMoney(amountINR: number, currency?: DisplayCurrency | null): string {
  const inrFormatted = `₹${amountINR.toLocaleString('en-IN')}`

  if (!currency || currency.code === 'INR') {
    return inrFormatted
  }

  const converted = amountINR * currency.rateFromINR
  const convertedFormatted = converted.toLocaleString('en-US', {
    maximumFractionDigits: converted < 10 ? 2 : 0,
  })

  return `${currency.symbol}${convertedFormatted} (${inrFormatted})`
}

/** Fallback list used only if the DisplayCurrencyRate table can't be reached client-side. */
export const DEFAULT_DISPLAY_CURRENCY: DisplayCurrency = {
  code: 'INR',
  label: 'Indian Rupee',
  symbol: '₹',
  rateFromINR: 1,
}
