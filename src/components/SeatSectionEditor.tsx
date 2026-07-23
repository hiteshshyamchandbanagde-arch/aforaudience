"use client"

import type { CSSProperties } from "react"

export type SeatSection = {
  id: string
  name: string
  seats: number | ""
  price: number | ""
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

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {sections.length === 0 && (
          <p style={{ fontSize: "14px", color: "var(--afa-ink)", opacity: 0.5, fontStyle: "italic" }}>
            No sections yet. Add one to start designing your seating layout — e.g. "VIP Front Row", "General", "Balcony".
          </p>
        )}

        {sections.map((section, i) => (
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
              border: "1px solid rgba(14,12,10,0.08)",
            }}
          >
            <input
              type="text"
              placeholder={`Section name (e.g. Section ${i + 1})`}
              value={section.name}
              onChange={(e) => updateSection(section.id, "name", e.target.value)}
              style={inputStyle}
            />
            <input
              type="number"
              placeholder="Seats"
              min={0}
              max={100000}
              maxLength={6}
              value={section.seats}
              onChange={(e) => updateSection(section.id, "seats", e.target.value)}
              style={inputStyle}
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
                style={{ ...inputStyle, paddingLeft: "26px" }}
              />
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
        ))}
      </div>

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
