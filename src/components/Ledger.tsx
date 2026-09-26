"use client"

import { type ReactNode } from "react"
import { useLocale } from "@/lib/i18n/translate"

function FeeRow({ label, value, accent, muted, bold }: { label: string; value: string; accent?: boolean; muted?: boolean; bold?: boolean }) {
  const color = accent ? "var(--afa-fill-solid)" : muted ? "rgba(245,245,240,0.5)" : "var(--afa-text-primary)"
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--afa-space-6)", padding: "4px 0" }}>
      <span style={{ color: "rgba(245,245,240,0.6)" }}>{label}</span>
      <span style={{ color, fontWeight: bold ? 700 : 400 }}>{value}</span>
    </div>
  )
}

/**
 * Zero-commission / tax-transparency block (stat cards + itemized ₹500
 * example + locked tax disclaimer), extracted from the homepage (PR #488,
 * BUG-2608-070) so the Artist landing page's "honest money" section
 * (GEN-2608-072) reuses the exact same visual language instead of
 * building new stat-card markup. `eyebrow`/`headline` are caller-supplied
 * so each page's surrounding prose can differ; the stats, breakdown, and
 * disclaimer text are fixed - same real numbers and locked copy
 * everywhere this appears.
 */
export default function Ledger({ eyebrow, headline }: { eyebrow: string; headline: ReactNode }) {
  const { t: tr } = useLocale()
  return (
    <div className="ledger-grid" style={{ gap: "32px", alignItems: "center", background: "var(--afa-surface-raised)", borderRadius: "var(--afa-radius-xl)", padding: "36px" }}>
      <style>{`
        .ledger-grid { display: grid; grid-template-columns: 1.4fr 1fr; }
        .ledger-stats { flex-wrap: wrap; }
        @media (max-width: 700px) {
          .ledger-grid { grid-template-columns: 1fr; }
        }
      `}</style>
      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--afa-text-micro)", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--afa-amber)", marginBottom: "var(--afa-space-3)" }}>
          {eyebrow}
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "var(--afa-text-subheading)", lineHeight: 1.35, color: "var(--afa-text-primary)" }}>
          {headline}
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "var(--afa-text-small)", lineHeight: 1.6, color: "rgba(245,245,240,0.5)", borderLeft: "2px solid rgba(201,151,58,0.5)", paddingLeft: "var(--afa-space-4)", marginTop: "var(--afa-space-5)", maxWidth: "420px" }}>
          {tr.homePage.feeTaxDisclaimer}
        </p>
        <div className="ledger-stats" style={{ display: "flex", gap: "32px", marginTop: "var(--afa-space-6)" }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--afa-text-page-title-lg)", color: "var(--afa-fill-solid)" }}>0%</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--afa-text-micro)", color: "rgba(245,245,240,0.6)" }}>{tr.homePage.feeCommissionLabel}</div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--afa-text-page-title-lg)", color: "var(--afa-fill-solid)" }}>0%</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--afa-text-micro)", color: "rgba(245,245,240,0.6)" }}>{tr.homePage.feeHiddenFeesLabel}</div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--afa-text-page-title-lg)", color: "var(--afa-fill-solid)" }}>100%</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--afa-text-micro)", color: "rgba(245,245,240,0.6)" }}>{tr.homePage.feeArtistVenueShareLabel}</div>
          </div>
        </div>
      </div>
      <div style={{ background: "var(--afa-surface-inverse)", borderRadius: "var(--afa-radius-lg)", padding: "var(--afa-space-5)", fontFamily: "var(--font-mono)", fontSize: "var(--afa-text-ui)" }}>
        <FeeRow label={tr.homePage.feeBaseLabel} value="₹500" />
        <FeeRow label={tr.homePage.feeArtistVenueShareLabel} value="100%" accent />
        <FeeRow label={tr.homePage.feeCommissionLabel} value="₹0" accent />
        <div style={{ height: "1px", background: "var(--afa-tint-10)", margin: "10px 0" }} />
        <FeeRow label={tr.homePage.feeBookingFeeLabel} value="₹30" muted />
        <FeeRow label={tr.homePage.feeYouPayLabel} value="₹530" bold />
      </div>
    </div>
  )
}
