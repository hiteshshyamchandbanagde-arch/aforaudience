/**
 * Plain accordion built on native <details>/<summary> - no existing FAQ
 * component in the codebase to reuse (checked), and native disclosure
 * needs no click-state JS, so this stays the simplest thing that works.
 * Shared shape (GEN-2608-072) so the Organiser/Venue Owner landing pages
 * queued after this one can reuse it rather than building their own.
 */
export default function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div>
      {items.map((item) => (
        <details
          key={item.q}
          style={{ borderBottom: "1px solid rgba(245,245,240,0.1)", padding: "20px 0" }}
        >
          <summary
            style={{
              cursor: "pointer",
              listStyle: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              fontFamily: "var(--font-display)",
              fontSize: "17px",
              fontWeight: 600,
              color: "var(--afa-text-primary)",
            }}
          >
            {item.q}
            <span aria-hidden style={{ flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: "18px", color: "var(--afa-amber)" }}>+</span>
          </summary>
          <p style={{ marginTop: "14px", marginBottom: 0, maxWidth: "640px", fontFamily: "var(--font-sans)", fontSize: "15px", lineHeight: 1.7, color: "rgba(245,245,240,0.65)" }}>
            {item.a}
          </p>
        </details>
      ))}
      <style>{`
        details > summary { -webkit-appearance: none; }
        details > summary::-webkit-details-marker { display: none; }
        details[open] summary span { transform: rotate(45deg); }
        details summary span { display: inline-block; transition: transform 0.2s ease; }
      `}</style>
    </div>
  )
}
