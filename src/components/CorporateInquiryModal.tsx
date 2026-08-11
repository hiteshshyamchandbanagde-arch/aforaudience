"use client"
import { useState } from "react"
import PresetSelectWithOther from "./PresetSelectWithOther"

type CorporateInquiryModalProps = {
  open: boolean
  onClose: () => void
  artistId: string
  artistName: string
}

const EMPTY_FORM = {
  companyName: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  eventType: "",
  city: "",
  preferredDate: "",
  budgetRange: "",
  message: "",
}

// UX fast-follow (11 Aug) - free text let a test submission through as
// "Ggggggg". A structured range is faster to fill on mobile (tap vs
// type) and keeps the data usable for the artist deciding whether to
// respond, while "Custom" still covers anything outside these bands via
// the same PresetSelectWithOther pattern already used for Dress Code/
// Vibe/Age Limit elsewhere in the app.
const BUDGET_RANGE_PRESETS = [
  "Under ₹25,000",
  "₹25,000 – ₹50,000",
  "₹50,000 – ₹1,00,000",
  "₹1,00,000 – ₹2,50,000",
  "₹2,50,000+",
]

// FEAT-2608-046 - corporate show booking, inquiry-only. No auth required
// to submit (the corporate buyer isn't necessarily an AFA account holder
// at all) - same bottom-sheet pattern as AuthPromptSheet, just a plain
// form instead of a login prompt.
export default function CorporateInquiryModal({ open, onClose, artistId, artistName }: CorporateInquiryModalProps) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [submitted, setSubmitted] = useState(false)

  if (!open) return null

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleClose = () => {
    onClose()
    // Reset after the close animation would run in a real transition -
    // no exit animation here yet, so this is safe to do immediately.
    setForm(EMPTY_FORM)
    setSubmitted(false)
    setError("")
  }

  const handleSubmit = async () => {
    if (!form.companyName.trim() || !form.contactName.trim() || !form.contactEmail.trim()) {
      setError("Company name, your name, and email are required.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/corporate-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistId, ...form }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to submit inquiry")
      }
      setSubmitted(true)
    } catch (err: any) {
      setError(err.message || "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={handleClose} style={{ position: "absolute", inset: 0, background: "rgba(14,12,10,0.45)" }} />

      <div style={{ position: "relative", width: "100%", maxWidth: "480px", background: "var(--afa-cream)", borderRadius: "20px 20px 0 0", padding: "8px 24px 28px", boxShadow: "0 -8px 40px rgba(0,0,0,0.2)", maxHeight: "88vh", overflowY: "auto", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0" }}>
          <div style={{ width: "36px", height: "4px", borderRadius: "2px", background: "rgba(14,12,10,0.15)" }} />
        </div>

        {submitted ? (
          <div style={{ textAlign: "center", padding: "24px 8px" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>✅</div>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "20px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "8px" }}>
              Inquiry sent!
            </h2>
            <p style={{ fontSize: "14px", color: "var(--afa-ink)", opacity: 0.65, lineHeight: 1.6, marginBottom: "20px" }}>
              {artistName} has been notified and will reach out to you directly at the email/phone you provided.
            </p>
            <button
              onClick={handleClose}
              style={{ width: "100%", background: "var(--afa-terracotta)", color: "white", padding: "14px", borderRadius: "10px", border: "none", fontSize: "15px", fontWeight: 700, cursor: "pointer" }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: "18px" }}>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "20px", fontWeight: 700, color: "var(--afa-ink)", marginBottom: "4px" }}>
                Book {artistName} for your event
              </h2>
              <div style={{ fontSize: "13px", color: "var(--afa-ink)", opacity: 0.55 }}>
                For corporate or private events. Sends directly to the artist - no payment happens here.
              </div>
            </div>

            {error && (
              <div style={{ background: "var(--afa-terracotta-tint)", border: "1px solid var(--afa-terracotta)", borderRadius: "8px", padding: "10px 14px", marginBottom: "14px", fontSize: "13px", color: "var(--afa-terracotta)" }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
              {[
                { label: "Company Name *", name: "companyName", type: "text", placeholder: "Acme Corp" },
                { label: "Your Name *", name: "contactName", type: "text", placeholder: "Jane Doe" },
                { label: "Email *", name: "contactEmail", type: "email", placeholder: "you@company.com" },
                { label: "Phone", name: "contactPhone", type: "tel", placeholder: "+91 98765 43210" },
                { label: "Event Type", name: "eventType", type: "text", placeholder: "Annual day, product launch..." },
                { label: "City", name: "city", type: "text", placeholder: "Pune" },
                { label: "Preferred Date", name: "preferredDate", type: "date", placeholder: "" },
              ].map((field) => (
                <div key={field.name}>
                  <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--afa-ink)", opacity: 0.7, display: "block", marginBottom: "5px" }}>
                    {field.label}
                  </label>
                  <input
                    name={field.name}
                    type={field.type}
                    placeholder={field.placeholder}
                    value={form[field.name as keyof typeof form]}
                    onChange={handleChange}
                    style={{ width: "100%", padding: "12px 14px", borderRadius: "8px", border: "1.5px solid rgba(14,12,10,0.15)", fontSize: "14px", color: "var(--afa-ink)", background: "white", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              ))}
              <div>
                <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--afa-ink)", opacity: 0.7, display: "block", marginBottom: "5px" }}>
                  Budget Range
                </label>
                <PresetSelectWithOther
                  value={form.budgetRange}
                  onChange={(value) => setForm((prev) => ({ ...prev, budgetRange: value }))}
                  presets={BUDGET_RANGE_PRESETS}
                  placeholder="e.g. ₹75,000 or 'flexible'"
                  inputStyle={{ width: "100%", padding: "12px 14px", borderRadius: "8px", border: "1.5px solid rgba(14,12,10,0.15)", fontSize: "14px", color: "var(--afa-ink)", background: "white", outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--afa-ink)", opacity: 0.7, display: "block", marginBottom: "5px" }}>
                  Message
                </label>
                <textarea
                  name="message"
                  placeholder="Tell them a bit about the event..."
                  value={form.message}
                  onChange={handleChange}
                  rows={3}
                  style={{ width: "100%", padding: "12px 14px", borderRadius: "8px", border: "1.5px solid rgba(14,12,10,0.15)", fontSize: "14px", color: "var(--afa-ink)", background: "white", outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }}
                />
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{ width: "100%", background: "var(--afa-terracotta)", color: "white", padding: "14px", borderRadius: "10px", border: "none", fontSize: "15px", fontWeight: 700, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1, marginBottom: "10px" }}
            >
              {loading ? "Sending..." : "Send Inquiry"}
            </button>

            <button
              onClick={handleClose}
              style={{ display: "block", width: "100%", background: "transparent", border: "none", color: "var(--afa-ink)", opacity: 0.4, fontSize: "13px", padding: "6px 0 0", cursor: "pointer" }}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  )
}
