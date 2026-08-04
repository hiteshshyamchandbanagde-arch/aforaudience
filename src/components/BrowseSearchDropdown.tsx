"use client"
import { useEffect, useRef, useState } from "react"
import { useLocale } from "@/lib/i18n/translate"

// Wraps a browse page's existing hero search <input> (+ its icon span,
// passed as children) and adds a live results dropdown underneath - same
// "type -> see matches immediately" feedback as the nav SearchBox, but
// without a second filter path: it renders straight from the page's
// already-computed `items` (the same `filtered` array driving the grid
// below), so there's exactly one source of truth for what matches.
//
// Session 65, Hitesh feedback: grid filtering on /events, /artists,
// /venue-owners, /organisers was correct but invisible without scrolling
// past the hero - this closes that gap. See GEN-2608-007 / this session's
// handoff for the "why not just copy the nav dropdown wholesale" call.

interface BrowseSearchDropdownProps<T> {
  query: string
  items: T[]
  getId: (item: T) => string
  renderRow: (item: T) => React.ReactNode
  onSelect: (item: T) => void
  emptyLabel: string // e.g. "events", "artists" - used in "No {emptyLabel} match ..."
  maxVisible?: number
  children: React.ReactNode
  // Opt-in (default false, back-compat with pages not yet Hindi-translated -
  // BUG-2608-041). When true, renders the "No X match Y" wrapper via
  // tr.common.noResultsMatchTemplate instead of the hardcoded English
  // string, so it follows the site's language toggle. Only pass this (and a
  // translated emptyLabel from tr.common.nounX) from pages/components that
  // already call useLocale() for everything else on the page - passing it
  // from a still-all-English page would produce a mixed-language string,
  // which is worse than the plain-English original.
  translate?: boolean
}

export default function BrowseSearchDropdown<T>({
  query,
  items,
  getId,
  renderRow,
  onSelect,
  emptyLabel,
  maxVisible = 6,
  children,
  translate = false,
}: BrowseSearchDropdownProps<T>) {
  const { t: tr } = useLocale()
  const [focused, setFocused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const open = focused && query.trim().length > 0
  const visible = items.slice(0, maxVisible)

  return (
    <div ref={containerRef} style={{ position: "relative" }} onFocusCapture={() => setFocused(true)}>
      {children}
      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0,
            background: "white", borderRadius: "12px", boxShadow: "0 12px 40px rgba(0,0,0,0.16)",
            border: "1px solid rgba(14,12,10,0.08)", zIndex: 50, maxHeight: "360px", overflowY: "auto",
            padding: visible.length ? "8px 0" : "16px 20px", textAlign: "left",
          }}
        >
          {visible.length === 0 ? (
            <div style={{ fontSize: "13.5px", color: "var(--afa-ink)", opacity: 0.5 }}>
              {translate
                ? tr.common.noResultsMatchTemplate.replace("{items}", emptyLabel).replace("{query}", query)
                : <>No {emptyLabel} match &quot;{query}&quot;</>}
            </div>
          ) : (
            visible.map((item) => (
              <button
                key={getId(item)}
                onClick={() => { setFocused(false); onSelect(item) }}
                style={{
                  display: "block", width: "100%", textAlign: "left", padding: "10px 20px",
                  border: "none", background: "transparent", cursor: "pointer", fontSize: "14px",
                  color: "var(--afa-ink)", fontFamily: "system-ui, sans-serif",
                }}
              >
                {renderRow(item)}
              </button>
            ))
          )}
          {items.length > maxVisible && (
            <div style={{ fontSize: "11.5px", color: "var(--afa-ink)", opacity: 0.45, padding: "6px 20px 2px", borderTop: "1px solid rgba(14,12,10,0.06)", marginTop: "4px" }}>
              +{items.length - maxVisible} more below
            </div>
          )}
        </div>
      )}
    </div>
  )
}
