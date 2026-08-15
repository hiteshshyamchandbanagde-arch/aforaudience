"use client"
import { useLocale } from "@/lib/i18n/translate"

// GEN-2608-015 follow-up: the flat 4-identical-box grid this replaces was
// flagged "boaring" (live feedback, screenshot). This IS a real ordered
// sequence (discover -> book -> get ticket -> rate), so per frontend
// design principles a numbered/connected treatment is earned here, not
// decorative. Built as a genuine flow: one continuous rail runs behind
// all four stations, each colored along a narrative arc (curiosity ->
// commit -> confirm -> celebrate) using only existing --afa-* tokens, no
// new colors introduced. Desktop renders the rail horizontally; a CSS
// media query (no JS/resize listener, matches SiteNav's own pattern)
// swaps it to vertical on mobile/tablet - same DOM, same single line
// element, just re-oriented, so there's no per-item connector math to
// get wrong at odd text-wrap heights.
const STEP_COLOR = ["var(--afa-gold-bright)", "var(--afa-terracotta)", "var(--afa-teal)", "var(--afa-plum)"]

function StepIcon({ index }: { index: number }) {
  const common = { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  switch (index) {
    case 0: // Discover - magnifying glass
      return (
        <svg {...common}>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <line x1="15.3" y1="15.3" x2="20.5" y2="20.5" />
        </svg>
      )
    case 1: // Book - ticket
      return (
        <svg {...common}>
          <path d="M3 8.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.3a2 2 0 0 0 0 4.4V15.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.3a2 2 0 0 0 0-4.4V8.5z" />
          <line x1="13" y1="7" x2="13" y2="17" strokeDasharray="2.2 2.2" />
        </svg>
      )
    case 2: // Get Ticket - scan frame
      return (
        <svg {...common}>
          <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8" />
          <path d="M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8" />
          <path d="M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16" />
          <path d="M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
          <line x1="7" y1="12" x2="17" y2="12" />
        </svg>
      )
    default: // Rate & Tip - star
      return (
        <svg {...common}>
          <path d="M12 3.5l2.47 5.18 5.53.65-4.1 3.86 1.1 5.56L12 15.9l-4.99 2.85 1.1-5.56-4.1-3.86 5.53-.65L12 3.5z" />
        </svg>
      )
  }
}

export default function HowItWorksSection() {
  const { t: tr } = useLocale()
  const steps = [
    { title: tr.homePage.stepDiscoverTitle, desc: tr.homePage.stepDiscoverDesc },
    { title: tr.homePage.stepBookTitle, desc: tr.homePage.stepBookDesc },
    { title: tr.homePage.stepTicketTitle, desc: tr.homePage.stepTicketDesc },
    { title: tr.homePage.stepRateTitle, desc: tr.homePage.stepRateDesc },
  ]

  return (
    <section style={{ padding: "96px 48px 108px", background: "white" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--afa-terracotta)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ width: "24px", height: "1px", background: "var(--afa-terracotta)", display: "inline-block" }}></span>
        {tr.homePage.howItWorksEyebrow}
      </div>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(32px, 3.5vw, 52px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-1px", color: "var(--afa-text-primary)", marginBottom: "72px", maxWidth: "700px" }}>
        {tr.homePage.howItWorksHeadingPrefix}<br /><em style={{ color: "var(--afa-terracotta)" }}>{tr.homePage.howItWorksHeadingEmphasis}</em>
      </h2>

      <div className="steps-rail">
        <span className="steps-rail-line" aria-hidden="true" />
        {steps.map((step, i) => (
          <div className="steps-rail-item" key={step.title}>
            <div className="steps-rail-node" style={{ background: STEP_COLOR[i], color: "white" }}>
              <StepIcon index={i} />
            </div>
            <div className="steps-rail-text">
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 700, color: STEP_COLOR[i], letterSpacing: "0.05em" }}>
                0{i + 1}
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "21px", fontWeight: 700, color: "var(--afa-text-primary)", margin: "6px 0 8px" }}>
                {step.title}
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--afa-text-primary)", opacity: 0.62, lineHeight: 1.65, maxWidth: "260px" }}>
                {step.desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .steps-rail {
          position: relative;
          display: flex;
          flex-direction: row;
          gap: 8px;
        }
        .steps-rail-line {
          position: absolute;
          top: 30px;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(to right, var(--afa-gold-bright), var(--afa-terracotta), var(--afa-teal), var(--afa-plum));
          opacity: 0.3;
          z-index: 0;
        }
        .steps-rail-item {
          flex: 1;
          min-width: 0;
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }
        .steps-rail-node {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 8px 20px rgba(14,12,10,0.14);
        }
        .steps-rail-text { margin-top: 22px; }

        @media (max-width: 860px) {
          .steps-rail {
            flex-direction: column;
            gap: 40px;
          }
          .steps-rail-line {
            top: 30px;
            left: 30px;
            right: auto;
            bottom: 30px;
            width: 2px;
            height: auto;
            background: linear-gradient(to bottom, var(--afa-gold-bright), var(--afa-terracotta), var(--afa-teal), var(--afa-plum));
          }
          .steps-rail-item {
            flex-direction: row;
            align-items: flex-start;
            gap: 22px;
          }
          .steps-rail-text { margin-top: 0; }
        }
      `}</style>
    </section>
  )
}
