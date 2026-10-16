'use client'

import { useEffect } from 'react'

// Tickets B (Hitesh phone pass, 13-14 Oct) - with the cancel sheet open on
// a phone, the page behind it scrolled. While `active`, the page itself
// can't scroll (overflow hidden on <html> and <body>, which iOS Safari 16+
// honours too); on release the old styles come back and the page is put
// back at the scroll position it had when the lock started. Counted, so
// two sheets open at once only unlock when the last one closes. The
// scrollbar's width is padded back on desktop so the page doesn't shift.

let locks = 0
let saved: { html: string; body: string; padding: string; x: number; y: number } | null = null

function lock() {
  locks++
  if (locks > 1) return
  const html = document.documentElement
  const body = document.body
  saved = { html: html.style.overflow, body: body.style.overflow, padding: body.style.paddingRight, x: window.scrollX, y: window.scrollY }
  const scrollbar = window.innerWidth - html.clientWidth
  html.style.overflow = 'hidden'
  body.style.overflow = 'hidden'
  if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`
}

function unlock() {
  locks = Math.max(0, locks - 1)
  if (locks > 0 || !saved) return
  const { html, body, padding, x, y } = saved
  saved = null
  document.documentElement.style.overflow = html
  document.body.style.overflow = body
  document.body.style.paddingRight = padding
  window.scrollTo(x, y)
}

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    lock()
    return unlock
  }, [active])
}
