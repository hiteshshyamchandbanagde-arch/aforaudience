'use client'

import { useEffect } from 'react'

// Feedback cms7d4k7y - <input type="number"> changes its value when the
// mouse wheel scrolls while the field is focused (standard browser
// behavior, not app-specific) - easy to trigger by accident just
// scrolling the page past a focused fee/price/quantity field. Rather
// than patching all 11+ number inputs across the app individually, one
// global capture-phase listener blurs whichever number input currently
// has focus before the wheel event can reach it and change the value.
// Passive: false + no preventDefault means the page still scrolls
// normally - only the input's own value-changing wheel handling is
// avoided, by removing focus from it first.
export default function NumberInputWheelGuard() {
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const el = document.activeElement
      if (el instanceof HTMLInputElement && el.type === 'number') {
        el.blur()
      }
    }
    document.addEventListener('wheel', handleWheel, { passive: true })
    return () => document.removeEventListener('wheel', handleWheel)
  }, [])

  return null
}
