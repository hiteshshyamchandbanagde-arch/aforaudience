"use client"

import type { CSSProperties } from "react"
import { normalizeWhitespace, normalizeForCompare } from "@/lib/text"

export type SeatSection = {
  id: string
  name: string
  seats: number | ""
  price: number | ""
}

// A row is "complete" once it has a name and a positive seat count.
// Rule (Hitesh, 27 Jul): a row that exists must be filled in or removed
// - it must never be silently dropped at save time, since that's data
// loss the owner has no way of noticing. Price is intentionally NOT
// required here - a ₹0/blank price is a valid "Free" section (see the
// Free-tag rendering below), not an incomplete one.
export function isIncompleteSection(s: SeatSection): boolean {
  return s.name.trim() === '' || !(Number(s.seats) > 0)
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
    color: "var(--afa-ink)",
  }

  const duplicateNames = new Set(findDuplicateSectionNames(sections))

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {sections.length === 0 && (
          <p style={{ fontSize: "14px", color: "var(--afa-ink)", opacity: 0.5, fontStyle: "italic" }}>
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
          const hasSomeContent = section.name.trim() !== '' || Number(section.seats) > 0
          const isPartial = !isDuplicate && hasSomeContent && isIncompleteSection(section)
          const isFree = section.price === '' || Number(section.price) === 0
          const borderColor = isDuplicate ? 'var(--afa-error)' : isPartial ? 'var(--afa-amber)' : 'rgba(14,12,10,0.08)'
          return (
          <div
            key={section.id}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr auto",
              gap: "10px",
              alignItems: "center",
              padding: "12px",
              background: "var(--afa-cream)",
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
              style={{ ...inputStyle, ...(borderColor !== 'rgba(14,12,10,0.08)' ? { border: `1px solid ${borderColor}` } : {}) }}
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
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--afa-ink)", opacity: 0.5, fontSize: "14px" }}>₹</span>
              <input
                type="number"
                placeholder="Price"
                min={0}
                max={10000000}
                maxLength={8}
                value={section.price}
                onChange={(e) => updateSection(section.id, "price", e.target.value)}
                style={{ ...inputStyle, paddingLeft: "26px", ...(isFree ? { paddingRight: "48px" } : {}) }}
              />
              {isFree && (
                // Rule (Hitesh, 27 Jul): ₹0/blank must never pass through
                // silently - make it visible so an accidental blank price
                // gets corrected before publish, rather than blocking the
                // save outright (a genuinely free section is valid).
                <span
                  style={{
                    position: "absolute",
                    right: "8px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "var(--afa-amber)",
                    background: "var(--afa-amber-tint)",
                    padding: "2px 7px",
                    borderRadius: "4px",
                    letterSpacing: "0.02em",
                  }}
                >
                  FREE
                </span>
              )}
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
          const hasSomeContent = s.name.trim() !== '' || Number(s.seats) > 0
          return hasSomeContent && isIncompleteSection(s)
        }).length
        return partialCount > 0 ? (
          <p style={{ marginTop: "10px", fontSize: "13px", color: "var(--afa-amber)", fontWeight: 600 }}>
            {partialCount} row{partialCount === 1 ? '' : 's'} {partialCount === 1 ? 'is' : 'are'} missing a name or seat count — fill {partialCount === 1 ? 'it' : 'them'} in or remove {partialCount === 1 ? 'it' : 'them'} with ✕.
          </p>
        ) : null
      })()}

      <button
        type="button"
        onClick={addSection}
        style={{
          marginTop: "14px",
          background: "none",
          border: "1px dashed rgba(14,12,10,0.3)",
          borderRadius: "8px",
          padding: "10px 18px",
          fontSize: "14px",
          fontWeight: 600,
          color: "var(--afa-ink)",
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
            color: "var(--afa-ink)",
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
