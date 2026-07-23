"use client"
import { useState, useEffect } from "react"
import Link from "next/link"

interface Rasa {
  emoji: string
  name: string
  sanskrit: string
  accent: string // hex color used to theme the CTA section when selected
}

const RASAS: Rasa[] = [
  { emoji: "❤️", name: "Shringara", sanskrit: "Love", accent: "var(--afa-pink-dark)" },
  { emoji: "😂", name: "Hasya", sanskrit: "Laughter", accent: "var(--afa-gold-bright)" },
  { emoji: "😢", name: "Karuna", sanskrit: "Sorrow", accent: "var(--afa-blue)" },
  { emoji: "⚡", name: "Raudra", sanskrit: "Fury", accent: "var(--afa-error)" },
  { emoji: "🦁", name: "Vira", sanskrit: "Courage", accent: "var(--afa-terracotta)" },
  { emoji: "😨", name: "Bhayanaka", sanskrit: "Fear", accent: "var(--afa-indigo-gray)" },
  { emoji: "🤢", name: "Bibhatsa", sanskrit: "Disgust", accent: "var(--afa-olive)" },
  { emoji: "🤩", name: "Adbhuta", sanskrit: "Wonder", accent: "var(--afa-purple)" },
  { emoji: "🕊️", name: "Shanta", sanskrit: "Peace", accent: "var(--afa-teal)" },
]

const STORAGE_KEY = "afa-mood-theme"

// Reuses the existing Navarasa grid (previously static, no click behavior
// despite already being styled cursor:pointer) as a real "set your mood"
// theme picker - the extra feature Hitesh asked for. Deliberately scoped:
// this codebase uses hardcoded hex colors inline everywhere rather than
// CSS variables, so a true site-wide re-theme would mean refactoring
// every component - a bigger, separate undertaking. This applies the
// chosen mood's accent color to the CTA section directly below, a real
// and visible "different theme based on mood" effect without that risk.
// Persisted in localStorage so it works for anonymous visitors too and
// is remembered on return visits.
export default function MoodThemeSection() {
  const [selected, setSelected] = useState<Rasa | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const match = RASAS.find((r) => r.name === saved)
      if (match) setSelected(match)
    }
  }, [])

  const choose = (rasa: Rasa) => {
    setSelected(rasa)
    localStorage.setItem(STORAGE_KEY, rasa.name)
  }

  const accent = selected?.accent || "var(--afa-terracotta)"

  return (
    <>
      {/* NAVARASA */}
      <section style={{ padding: "100px 48px", background: "white", textAlign: "center" }}>
        <div style={{ fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--afa-terracotta)", marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
          <span style={{ width: "24px", height: "1px", background: "var(--afa-terracotta)", display: "inline-block" }}></span>
          Ancient Indian Wisdom
        </div>
        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(32px, 3.5vw, 52px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-1px", color: "var(--afa-ink)", marginBottom: "16px" }}>
          Find art by <em style={{ color: "var(--afa-terracotta)" }}>Navarasa</em>
        </h2>
        <p style={{ fontFamily: "system-ui, sans-serif", fontSize: "17px", fontWeight: 300, color: "var(--afa-ink)", opacity: 0.6, maxWidth: "560px", margin: "0 auto 16px", lineHeight: 1.7 }}>
          The 9 emotions of Indian classical art. Search events by the feeling you want to experience tonight.
        </p>
        <p style={{ fontFamily: "system-ui, sans-serif", fontSize: "13px", color: "var(--afa-ink)", opacity: 0.45, marginBottom: "40px" }}>
          Tap a mood to set your vibe for this visit.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(70px, 1fr))", gap: "8px", maxWidth: "900px", margin: "0 auto" }}>
          {RASAS.map((rasa) => (
            <div
              key={rasa.name}
              onClick={() => choose(rasa)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "20px 8px", borderRadius: "10px", cursor: "pointer",
                background: selected?.name === rasa.name ? `${rasa.accent}14` : "transparent",
                border: selected?.name === rasa.name ? `1.5px solid ${rasa.accent}` : "1.5px solid transparent",
                transition: "background 0.15s, border-color 0.15s",
              }}
            >
              <div style={{ fontSize: "32px" }}>{rasa.emoji}</div>
              <div style={{ fontFamily: "Georgia, serif", fontSize: "12px", fontWeight: 700, color: "var(--afa-ink)" }}>{rasa.name}</div>
              <div style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: 500, color: "var(--afa-ink)", opacity: 0.65 }}>{rasa.sanskrit}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA - themed by the selected mood, defaults to the original ember-red */}
      <section style={{ background: accent, textAlign: "center", padding: "100px 48px", transition: "background 0.3s" }}>
        <div style={{ fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)", marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
          <span style={{ width: "24px", height: "1px", background: "rgba(255,255,255,0.5)", display: "inline-block" }}></span>
          Join AforAudience
        </div>
        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(32px, 3.5vw, 52px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-1px", color: "white", marginBottom: "16px" }}>
          The stage is set.<br />Are you ready?
        </h2>
        <p style={{ fontFamily: "system-ui, sans-serif", fontSize: "18px", color: "rgba(255,255,255,0.75)", maxWidth: "540px", margin: "0 auto 44px", lineHeight: 1.7 }}>
          Join thousands of artists, organisers, venue owners and art lovers already on the platform.
        </p>
        <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/events" style={{ background: "white", color: accent, padding: "16px 36px", borderRadius: "6px", fontSize: "15px", fontWeight: 700, textDecoration: "none" }}>
            Find an Event Tonight
          </Link>
          <Link href="/profile" style={{ background: "transparent", color: "white", padding: "16px 36px", borderRadius: "6px", fontSize: "15px", fontWeight: 500, textDecoration: "none", border: "2px solid rgba(255,255,255,0.4)" }}>
            Join as Artist
          </Link>
        </div>
      </section>
    </>
  )
}
