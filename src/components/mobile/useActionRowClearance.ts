'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { MOBILE_BREAKPOINT_MAX } from '@/components/mobile/chromeOffsets'

// BUG-2609-068 - a floating button (the support chat bubble) must never
// cover a tappable control. Pages mark their bottom action rows (Save /
// Publish / Cancel ...) with this attribute; while one is in view on
// mobile and overlaps the button's resting spot, the button lifts to sit
// just above the row. If lifting would push it under the top bar, it
// hides until the row scrolls away. No per-page padding.
export const ACTION_ROW_ATTR = 'data-afa-action-row'

const GAP = 8 // px between the row's top edge and the lifted button
export const MIN_TOP = 72 // px; a lifted button above this would sit under MobileTopBar

export interface ActionRowClearance {
  bottom: number | null // px from the viewport bottom, or null = resting spot
  hidden: boolean
}

export interface ActionRowClearanceOptions {
  // Rule 2: never hide. If the lift would leave less than MIN_TOP +
  // `headroom` px above the button, stop there instead.
  keepVisible?: boolean
  headroom?: number
}

const RESTING: ActionRowClearance = { bottom: null, hidden: false }

// `probeRef` is an invisible element fixed at the button's resting spot
// (same size and offsets), so the resting rect is measured, not guessed,
// even while the real button is lifted.
export function useActionRowClearance(
  probeRef: RefObject<HTMLElement | null>,
  active: boolean,
  { keepVisible = false, headroom = 0 }: ActionRowClearanceOptions = {},
): ActionRowClearance {
  const [state, setState] = useState<ActionRowClearance>(RESTING)
  // Options are read through a ref so that changing one (the panel opens)
  // re-measures with the observers already in place. Re-running the effect
  // below would drop the observed rows for a frame and flash the button
  // back to its resting spot.
  const optionsRef = useRef({ keepVisible, headroom })
  const remeasureRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    optionsRef.current = { keepVisible, headroom }
    remeasureRef.current?.()
  }, [keepVisible, headroom])

  useEffect(() => {
    if (!active) return
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_MAX}px)`)
    const visible = new Set<Element>()
    let raf = 0
    let rescan = true

    const apply = (next: ActionRowClearance) =>
      setState((prev) => (prev.bottom === next.bottom && prev.hidden === next.hidden ? prev : next))

    const measure = () => {
      raf = 0
      if (rescan) scan()
      const probe = probeRef.current
      if (!probe || !mq.matches) return apply(RESTING)
      const { keepVisible, headroom } = optionsRef.current
      if (visible.size === 0) return apply(RESTING)
      const rest = probe.getBoundingClientRect()
      const rows = [...visible].map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0)
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
      if (!lifted) return apply(RESTING)
      const minTop = MIN_TOP + headroom
      if (top < minTop) {
        if (!keepVisible) return apply({ bottom: null, hidden: true })
        // Rule 2: stay on screen as high as the headroom allows, never
        // below the resting spot.
        top = Math.min(minTop, rest.top)
        bottom = top + rest.height
        if (top === rest.top) return apply(RESTING)
      }
      apply({ bottom: Math.round(window.innerHeight - bottom), hidden: false })
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure)
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
      schedule()
    })
    mo.observe(document.body, { childList: true, subtree: true })
    remeasureRef.current = schedule
    schedule()

    window.addEventListener('scroll', schedule, { passive: true, capture: true })
    window.addEventListener('resize', schedule, { passive: true })
    mq.addEventListener('change', schedule)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      remeasureRef.current = null
      io.disconnect()
      mo.disconnect()
      window.removeEventListener('scroll', schedule, { capture: true })
      window.removeEventListener('resize', schedule)
      mq.removeEventListener('change', schedule)
    }
  }, [active, probeRef])

  return active ? state : RESTING
}
