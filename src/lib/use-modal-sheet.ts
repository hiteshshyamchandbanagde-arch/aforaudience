'use client'

import { useEffect, useRef, type RefObject } from 'react'

// BUG-2609-065 - the app's sheets and modals are hand-rolled (a fixed
// wrapper, a scrim, a panel), and none of them kept keyboard focus
// inside itself: on /events with the filter sheet open, Tab walked the
// page behind the sheet first. One shared hook rather than a Radix
// Dialog migration, so nothing changes visually.
//
// Given `open`, a ref to the sheet's PANEL (not the wrapper that also
// holds the scrim) and `onClose`, while open it:
//   (a) moves focus into the panel - the first focusable element, else
//       the panel itself (given tabIndex -1);
//   (b) keeps Tab / Shift+Tab inside the panel;
//   (c) calls onClose on Esc;
//   (d) on close, returns focus to whatever had it before opening;
//   (e) gives the panel role="dialog", aria-modal="true" and an
//       accessible name when the markup doesn't already set them (the
//       name comes from the panel's first heading, else `label`).
//
// `modal: false` is for a banner that appears on its own and leaves the
// page usable (InstallPrompt): it gets the role, the name and Esc while
// focus is inside it, but focus is never moved or trapped.
//
// A panel that is display:none when it opens (one of two CSS-switched
// layouts, or a `lg:hidden` sheet on desktop) is left alone, so a
// component can call this once per layout and only the visible one acts.

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function isVisible(el: HTMLElement) {
  return el.getClientRects().length > 0
}

function focusableIn(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isVisible)
}

// Open modal panels, oldest first. Only the last one answers Esc and
// Tab, so a sheet opened over another sheet closes on its own.
const openModals: HTMLElement[] = []
let titleIdCounter = 0

export function useModalSheet(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  onClose?: () => void,
  options: { label?: string; modal?: boolean } = {},
) {
  const { label, modal = true } = options
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const el = ref.current
    if (!el || !isVisible(el)) return

    const added: string[] = []
    const setIfMissing = (name: string, value: string) => {
      if (el.hasAttribute(name)) return
      el.setAttribute(name, value)
      added.push(name)
    }
    setIfMissing('role', 'dialog')
    if (modal) {
      setIfMissing('aria-modal', 'true')
      setIfMissing('tabindex', '-1')
    }
    if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby')) {
      const heading = el.querySelector<HTMLElement>('h1, h2, h3')
      if (heading) {
        if (!heading.id) heading.id = `afa-sheet-title-${++titleIdCounter}`
        setIfMissing('aria-labelledby', heading.id)
      } else if (label) {
        setIfMissing('aria-label', label)
      }
    }

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (modal) {
      openModals.push(el)
      const first = focusableIn(el)[0] ?? el
      first.focus({ preventScroll: true })
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement
      if (modal ? openModals[openModals.length - 1] !== el : !el.contains(active)) return
      if (e.key === 'Escape') {
        if (!onCloseRef.current) return
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !modal) return
      const items = focusableIn(el)
      if (items.length === 0) {
        e.preventDefault()
        el.focus({ preventScroll: true })
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const inside = el.contains(active)
      if (e.shiftKey) {
        if (!inside || active === first || active === el) {
          e.preventDefault()
          last.focus()
        }
      } else if (!inside || active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      for (const name of added) el.removeAttribute(name)
      if (!modal) return
      const i = openModals.lastIndexOf(el)
      if (i !== -1) openModals.splice(i, 1)
      // Only hand focus back if it was still in the sheet (or was dropped
      // to <body> because the sheet has just unmounted) - never pull it
      // away from something the person moved to on purpose.
      const active = document.activeElement
      const lostOrInside = !active || active === document.body || el.contains(active)
      if (previous && previous.isConnected && lostOrInside) previous.focus({ preventScroll: true })
    }
  }, [open, ref, modal, label])
}
