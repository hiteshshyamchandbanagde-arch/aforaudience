'use client'

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import { MOBILE_BREAKPOINT_MAX } from '@/components/mobile/chromeOffsets'

// BUG-2609-068 - a floating button (the support chat bubble) must never
// cover a tappable control. Pages mark their bottom action rows (Save /
// Publish / Cancel ...) with this attribute; while one is in view on
// mobile and overlaps the button's resting spot, the button lifts to sit
// just above the row. If lifting would push it under the top bar, it
// hides until the row scrolls away. No per-page padding.
export const ACTION_ROW_ATTR = 'data-afa-action-row'
// BUG-2609-081 - a page whose form scrolls a little at every phone size
// (login, register) opts in to the short-page rule below with this
// attribute on its container.
export const AVOID_CONTROLS_ATTR = 'data-afa-avoid-controls'
// BUG-2609-081 - floating UI (the chat button and panel, the toast stack)
// carries this attribute so it is never counted as a control to avoid.
export const FLOATING_ATTR = 'data-afa-floating'

const GAP = 8 // px between the row's top edge and the lifted button
export const MIN_TOP = 72 // px; a lifted button above this would sit under MobileTopBar

// BUG-2609-081 rule 4 - what counts as a control on a short page.
const INTERACTIVE_SELECTOR = 'a[href], button, input, select, textarea, [role=button], [tabindex]:not([tabindex="-1"]), label[for]'

export interface ActionRowClearance {
  bottom: number | null // px from the viewport bottom, or null = resting spot
  hidden: boolean
  // BUG-2609-081 rule 3 - true once the page is known to be taller than
  // the viewport, i.e. it needs (and can use) reserved space at its end.
  scrollable: boolean
}

export interface ActionRowClearanceOptions {
  // Rule 4: on a page that cannot scroll (or one marked
  // data-afa-avoid-controls), lift above every visible control under the
  // resting spot, not only marked rows.
  avoidControls?: boolean
  // Rule 2: never hide. If the lift would leave less than MIN_TOP +
  // `headroom` px above the button, stop there instead.
  keepVisible?: boolean
  headroom?: number
}

const RESTING: ActionRowClearance = { bottom: null, hidden: false, scrollable: false }

// 100vh in px. On a phone it is the viewport with the browser bars
// retracted, which is taller than innerHeight while they show - so a
// `min-height: 100vh` page scrolls by the bar's height there and would
// never read as short from innerHeight alone.
let vhProbe: HTMLDivElement | null = null
function largeViewportHeight(): number {
  if (!vhProbe || !vhProbe.isConnected) {
    vhProbe = document.createElement('div')
    vhProbe.setAttribute('aria-hidden', 'true')
    vhProbe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100vh;visibility:hidden;pointer-events:none'
    document.body.appendChild(vhProbe)
  }
  return Math.max(window.innerHeight, vhProbe.offsetHeight)
}

// The page's own content fits the viewport. Body padding is left out: it
// is space reserved for fixed chrome (the tab bar, the chat button), not
// content, and counting it would make the answer depend on rule 3.
function isShortPage(): boolean {
  const pad = parseFloat(getComputedStyle(document.body).paddingBottom) || 0
  return document.documentElement.scrollHeight - pad <= largeViewportHeight() + 1
}

function isVisible(el: Element): boolean {
  if (typeof el.checkVisibility === 'function') return el.checkVisibility({ checkVisibilityCSS: true })
  return getComputedStyle(el).visibility !== 'hidden'
}

// `probeRef` is an invisible element fixed at the button's resting spot
// (same size and offsets), so the resting rect is measured, not guessed,
// even while the real button is lifted.
export function useActionRowClearance(
  probeRef: RefObject<HTMLElement | null>,
  active: boolean,
  { avoidControls = false, keepVisible = false, headroom = 0 }: ActionRowClearanceOptions = {},
): ActionRowClearance {
  const [state, setState] = useState<ActionRowClearance>(RESTING)
  // Options are read through a ref so that changing one (the panel opens)
  // re-measures with the observers already in place. Re-running the effect
  // below would drop the observed rows for a frame and flash the button
  // back to its resting spot.
  const optionsRef = useRef({ avoidControls, keepVisible, headroom })
  const remeasureRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    optionsRef.current = { avoidControls, keepVisible, headroom }
    remeasureRef.current?.()
  }, [avoidControls, keepVisible, headroom])

  useEffect(() => {
    if (!active) return
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_MAX}px)`)
    const visible = new Set<Element>()
    let raf = 0
    let rescan = true
    // Page-level facts only change with layout, not with scroll, so they
    // are re-read on resize / mutation and reused on scroll frames.
    let stale = true
    let short = false
    let avoid = false

    const apply = (next: ActionRowClearance) =>
      setState((prev) => (prev.bottom === next.bottom && prev.hidden === next.hidden && prev.scrollable === next.scrollable ? prev : next))

    const measure = () => {
      raf = 0
      if (rescan) scan()
      const probe = probeRef.current
      if (!probe || !mq.matches) return apply(RESTING)
      const { avoidControls, keepVisible, headroom } = optionsRef.current
      if (stale) {
        stale = false
        short = isShortPage()
        avoid = avoidControls && (short || !!document.querySelector(`[${AVOID_CONTROLS_ATTR}]`))
      }
      const resting: ActionRowClearance = { bottom: null, hidden: false, scrollable: !short }
      if (visible.size === 0 && !avoid) return apply(resting)
      const rest = probe.getBoundingClientRect()
      const rows = [...visible].map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0)
      // Rule 4. Controls wholly below the resting spot (the tab bar) are
      // left out: lifting cannot clear them and they are not under it.
      if (avoid) {
        for (const el of document.querySelectorAll(INTERACTIVE_SELECTOR)) {
          if (el.closest(`[${FLOATING_ATTR}]`)) continue
          const r = el.getBoundingClientRect()
          if (r.width <= 0 || r.height <= 0 || r.top >= rest.bottom || r.bottom <= 0) continue
          if (r.left >= rest.right || r.right <= rest.left || !isVisible(el)) continue
          rows.push(r)
        }
      }
      if (rows.length === 0) return apply(resting)
      const overlaps = (top: number, bottom: number, r: DOMRect) =>
        r.top < bottom + GAP && r.bottom > top - GAP && r.left < rest.right && r.right > rest.left
      // Lift above every row the button would touch; a lifted button can
      // meet a second row stacked above the first, so repeat.
      let top = rest.top
      let bottom = rest.bottom
      let lifted = false
      for (let i = 0; i < rows.length; i++) {
        const hit = rows.filter((r) => overlaps(top, bottom, r))
        if (hit.length === 0) break
        const rowTop = Math.min(...hit.map((r) => r.top))
        bottom = rowTop - GAP
        top = bottom - rest.height
        lifted = true
      }
      if (!lifted) return apply(resting)
      const minTop = MIN_TOP + headroom
      if (top < minTop) {
        if (!keepVisible) return apply({ ...resting, hidden: true })
        // Rule 2: stay on screen as high as the headroom allows, never
        // below the resting spot.
        top = Math.min(minTop, rest.top)
        bottom = top + rest.height
        if (top === rest.top) return apply(resting)
      }
      apply({ ...resting, bottom: Math.round(window.innerHeight - bottom) })
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure)
    }
    const relayout = () => {
      stale = true
      schedule()
    }

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.add(e.target)
        else visible.delete(e.target)
      }
      schedule()
    })
    const observed = new Set<Element>()
    function scan() {
      rescan = false
      const now = new Set(document.querySelectorAll(`[${ACTION_ROW_ATTR}]`))
      for (const el of now) if (!observed.has(el)) { io.observe(el); observed.add(el) }
      for (const el of observed) if (!now.has(el)) { io.unobserve(el); observed.delete(el); visible.delete(el) }
    }
    // Rows mount after data loads (and on client navigation), so rescan,
    // at most once a frame.
    const mo = new MutationObserver(() => {
      rescan = true
      relayout()
    })
    mo.observe(document.body, { childList: true, subtree: true })
    // A short page turns long when content grows without a DOM change the
    // observer above sees (an image loads, a section expands).
    const ro = new ResizeObserver(relayout)
    ro.observe(document.body)
    remeasureRef.current = relayout
    schedule()

    window.addEventListener('scroll', schedule, { passive: true, capture: true })
    window.addEventListener('resize', relayout, { passive: true })
    mq.addEventListener('change', relayout)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      remeasureRef.current = null
      io.disconnect()
      mo.disconnect()
      ro.disconnect()
      window.removeEventListener('scroll', schedule, { capture: true })
      window.removeEventListener('resize', relayout)
      mq.removeEventListener('change', relayout)
    }
  }, [active, probeRef])

  return active ? state : RESTING
}

// BUG-2609-081 - the toast stack rests directly above the chat button's
// resting spot, so when the button lifts it moves into the toasts' band.
// The button publishes whether it is away from its resting spot; the
// toast stack reads it and moves to the top.
let chatButtonLifted = false
const liftListeners = new Set<() => void>()
export function setChatButtonLifted(lifted: boolean) {
  if (chatButtonLifted === lifted) return
  chatButtonLifted = lifted
  for (const l of liftListeners) l()
}
function subscribeLift(listener: () => void) {
  liftListeners.add(listener)
  return () => { liftListeners.delete(listener) }
}
export function useChatButtonLifted(): boolean {
  return useSyncExternalStore(subscribeLift, () => chatButtonLifted, () => false)
}
