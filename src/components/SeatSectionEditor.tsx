"use client"

import type { CSSProperties } from "react"
import { normalizeWhitespace, normalizeForCompare } from "@/lib/text"

export type SeatSection = {
  id: string
  name: string
  seats: number | ""
  price: number | ""
}

// A row is "complete" once it has a name, a positive seat count, AND an
// explicitly-entered price. Rule (Hitesh, 27 Jul): a row that exists
// must be filled in or removed - it must never be silently dropped OR
// silently default to a value the owner never chose. Price was
// originally left out of this check on the theory that a blank price
// is a valid "Free" section - but that meant a brand-new, completely
// untouched row (price defaults to '') showed the FREE badge instantly,
// before the owner had typed anything at all. Live-caught 28 Jul: the
// badge looked hardcoded because it effectively was - it was declaring
// a state nobody chose. Price now follows the same rule as name/seats:
// the owner must explicitly type an amount, or explicitly type 0 for
// Free. Only an explicit 0 shows the FREE badge (see isFree below).
export function isIncompleteSection(s: SeatSection): boolean {
  return s.name.trim() === '' || !(Number(s.seats) > 0) || s.price === ''
}

export function findIncompleteSections(sections: SeatSection[]): SeatSection[] {
  return sections.filter(isIncompleteSection)
}

// Duplicate section-name detection (added 27 Jul, Hitesh's rule): a GA
// venue has no level concept, so this is simply "no two sections share
// a name" - live-observed 4 sections all named "general" slipping
// straight through to Publish with zero validation. Exported so both
// the create and edit pages can block submit with the same check the
// server now also enforces.
//
// Uses normalizeForCompare (trim + collapse internal whitespace +
// lowercase), not a bare `.trim().toLowerCase()` - live-observed 27 Jul:
// "general 2" and "general    2" (extra internal spaces) trimmed to two
// different strings and both passed as "unique."
export function findDuplicateSectionNames(sections: SeatSection[]): string[] {
  const counts = new Map<string, number>()
  for (const s of sections) {
    const key = normalizeForCompare(s.name)
    if (!key) continue
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return Array.from(counts.entries()).filter(([, c]) => c > 1).map(([name]) => name)
}

type Props = {
  sections: SeatSection[]
  onChange: (sections: SeatSection[]) => void
}

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

export default function SeatSectionEditor({ sections, onChange }: Props) {
  const addSection = () => {
    onChange([...sections, { id: makeId(), name: "", seats: "", price: "" }])
  }

  // Cosmetic `max` attributes on the inputs don't stop anyone from
  // typing past them (these forms use custom onChange handlers, not
  // native form submission - see PR #100's key learning). Left
  // unclamped, a long run of digits parses into a valid but absurd JS
  // number (e.g. a 200-digit string of 1s), which then flows straight
  // into the totals below and renders as unreadable scientific
  // notation. Clamp at the point of state update so the field itself
  // never holds a value beyond what's meaningful.
  const SEATS_MAX = 100000
  const PRICE_MAX = 10000000

  const updateSection = (id: string, field: keyof SeatSection, value: string) => {
    onChange(
      sections.map((s) => {
        if (s.id !== id) return s
        if (field === "name") return { ...s, name: value }
        if (value === "") return { ...s, [field]: "" }
        const num = Number(value)
        if (!Number.isFinite(num)) return s
        const max = field === "seats" ? SEATS_MAX : PRICE_MAX
        return { ...s, [field]: Math.max(0, Math.min(num, max)) }
      })
    )
  }

  // Free toggle (Hitesh, 28 Jul): live-tested the FREE badge floating
  // inside the price textbox and it looked cluttered. Replaced with an
  // explicit checkbox beside the field instead of a badge inside it -
  // checking it sets price to an explicit 0 (still the same "isFree"
  // signal isIncompleteSection/isFree already rely on, so no schema or
  // validation change needed), unchecking clears price back to '' so
  // the owner must explicitly re-enter an amount rather than a stale 0
  // lingering unnoticed.
  const setSectionFree = (id: string, free: boolean) => {
    onChange(
      sections.map((s) => (s.id === id ? { ...s, price: free ? 0 : "" } : s))
    )
  }

  const removeSection = (id: string) => {
    onChange(sections.filter((s) => s.id !== id))
  }

  const totalSeats = sections.reduce((sum, s) => sum + (Number(s.seats) || 0), 0)
  const prices = sections.map((s) => Number(s.price) || 0).filter((p) => p > 0)
  const minPrice = prices.length ? Math.min(...prices) : 0
  const maxPrice = prices.length ? Math.max(...prices) : 0

  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "6px",
    border: "1px solid rgba(14,12,10,0.15)",
    background: "var(--afa-white)",
    fontSize: "14px",
    color: "var(--afa-text-primary)",
  }

  const duplicateNames = new Set(findDuplicateSectionNames(sections))

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {sections.length === 0 && (
          <p style={{ fontSize: "14px", color: "var(--afa-text-primary)", opacity: 0.5, fontStyle: "italic" }}>
            No sections yet. Add one to start designing your seating layout — e.g. "VIP Front Row", "General", "Balcony".
          </p>
        )}

        {sections.map((section, i) => {
          const isDuplicate = section.name.trim() !== '' && duplicateNames.has(normalizeForCompare(section.name))
          // Only warn live once the row has SOME content - a freshly
          // added blank row isn't "incomplete," it's just new. It still
          // blocks Save if left that way (see the parent page's submit
          // check), but nagging the instant "+ Add Seating Section" is
          // clicked would be premature.
          const hasSomeContent = section.name.trim() !== '' || Number(section.seats) > 0 || section.price !== ''
          const isPartial = !isDuplicate && hasSomeContent && isIncompleteSection(section)
          // FREE only reflects an EXPLICIT 0 - a blank price is
          // "incomplete" (amber, see isPartial), not "Free" (amber
          // badge). Conflating the two is what caused the badge to show
          // on untouched rows - see isIncompleteSection's note above.
          const isFree = section.price !== '' && Number(section.price) === 0
          const borderColor = isDuplicate ? 'var(--afa-error)' : isPartial ? 'var(--afa-amber)' : 'rgba(245,245,240,0.08)'
          return (
          <div
            key={section.id}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr auto",
              gap: "10px",
              alignItems: "center",
              padding: "12px",
              background: "var(--afa-surface-raised)",
              borderRadius: "8px",
              border: `1px solid ${borderColor}`,
            }}
          >
            <input
              type="text"
              placeholder={`Section name (e.g. Section ${i + 1})`}
              value={section.name}
              onChange={(e) => updateSection(section.id, "name", e.target.value)}
              onBlur={(e) => {
                // Collapse internal whitespace once typing is done, so a
                // name like "general    2" doesn't persist as a visually
                // distinct "duplicate" of "general 2" - see
                // normalizeForCompare's note on why comparison alone
                // isn't enough.
                const normalized = normalizeWhitespace(e.target.value)
                if (normalized !== e.target.value) updateSection(section.id, "name", normalized)
              }}
              style={{ ...inputStyle, ...(borderColor !== 'rgba(245,245,240,0.08)' ? { border: `1px solid ${borderColor}` } : {}) }}
            />
            <input
              type="number"
              placeholder="Seats"
              min={0}
              max={100000}
              maxLength={6}
              value={section.seats}
              onChange={(e) => updateSection(section.id, "seats", e.target.value)}
              style={{ ...inputStyle, ...(isPartial && !(Number(section.seats) > 0) ? { border: `1px solid ${borderColor}` } : {}) }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--afa-text-primary)", opacity: 0.5, fontSize: "14px" }}>₹</span>
                <input
                  type="number"
                  placeholder="Price"
                  min={0}
                  max={10000000}
                  maxLength={8}
                  value={section.price}
                  disabled={isFree}
                  onChange={(e) => updateSection(section.id, "price", e.target.value)}
                  style={{
                    ...inputStyle,
                    paddingLeft: "26px",
                    ...(isFree ? { opacity: 0.5, background: "rgba(14,12,10,0.04)" } : {}),
                    ...(isPartial && section.price === '' ? { border: `1px solid ${borderColor}` } : {}),
                  }}
                />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--afa-text-primary)", opacity: 0.75, cursor: "pointer", userSelect: "none" }}>
                <input
                  type="checkbox"
                  checked={isFree}
                  onChange={(e) => setSectionFree(section.id, e.target.checked)}
                  style={{ margin: 0 }}
                />
                Free
              </label>
            </div>
            <button
              type="button"
              onClick={() => removeSection(section.id)}
              aria-label="Remove section"
              style={{
                background: "none",
                border: "none",
                color: "var(--afa-terracotta)",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 600,
                padding: "8px",
              }}
            >
              ✕
            </button>
          </div>
          )
        })}
      </div>

      {duplicateNames.size > 0 && (
        <p style={{ marginTop: "10px", fontSize: "13px", color: "var(--afa-error)", fontWeight: 600 }}>
          Section name{duplicateNames.size === 1 ? '' : 's'} "{Array.from(duplicateNames).join('", "')}" {duplicateNames.size === 1 ? 'is' : 'are'} used more than once — each section needs a unique name.
        </p>
      )}

      {(() => {
        const partialCount = sections.filter((s) => {
          const hasSomeContent = s.name.trim() !== '' || Number(s.seats) > 0 || s.price !== ''
          return hasSomeContent && isIncompleteSection(s)
        }).length
        return partialCount > 0 ? (
          <p style={{ marginTop: "10px", fontSize: "13px", color: "var(--afa-amber)", fontWeight: 600 }}>
            {partialCount} row{partialCount === 1 ? '' : 's'} {partialCount === 1 ? 'is' : 'are'} missing a name, seat count, or price (check "Free" for a free section) — fill {partialCount === 1 ? 'it' : 'them'} in or remove {partialCount === 1 ? 'it' : 'them'} with ✕.
          </p>
        ) : null
      })()}

      <button
        type="button"
        onClick={addSection}
        style={{
          marginTop: "14px",
          background: "none",
          border: "1px dashed rgba(245,245,240,0.3)",
          borderRadius: "8px",
          padding: "10px 18px",
          fontSize: "14px",
          fontWeight: 600,
          color: "var(--afa-text-primary)",
          cursor: "pointer",
          width: "100%",
        }}
      >
        + Add Seating Section
      </button>

      {sections.length > 0 && (
        <div
          style={{
            marginTop: "16px",
            display: "flex",
            gap: "24px",
            fontSize: "14px",
            color: "var(--afa-text-primary)",
            padding: "12px 16px",
            background: "rgba(200,68,26,0.06)",
            borderRadius: "8px",
          }}
        >
          <span><strong>{totalSeats}</strong> total seats</span>
          <span>
            <strong>
              {prices.length ? (minPrice === maxPrice ? `₹${minPrice}` : `₹${minPrice}–₹${maxPrice}`) : "—"}
            </strong>{" "}
            per seat
          </span>
        </div>
      )}
    </div>
  )
}
