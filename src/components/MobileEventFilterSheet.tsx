"use client"
import { TYPE_META } from "@/components/EventCard"
import { EventTypeIcon } from "@/components/icons/EventIcons"
import { useLocale } from "@/lib/i18n/translate"
import Button from "@/components/ui/Button"
import { FILL_SOLID_TINT, FILL_SOLID_BORDER_TINT } from "@/lib/statusStyle"

// GEN-2609-004 (Mobile Redesign Phase 2) - mobile-only bottom sheet for
// /events' filters (type/city/price/sort), replacing the desktop inline
// filter row below the `lg` breakpoint (matches Phase 1's convention -
// DashboardShell.tsx/MobileTabBar.tsx). Visual structure ported from the
// Figma Make export's FilterSheet.tsx (pill buttons, slide-up sheet,
// Reset + "Show N events" CTA) - wired to this app's real filter state
// (events/page.tsx's own selectedType/selectedCity/priceFilter/sortBy),
// not the prototype's mock city/category/date filters. Desktop keeps its
// existing inline filter row untouched - this component only ever mounts
// below `lg`, where events/page.tsx's own CSS hides that row instead.

const TYPE_OPTIONS = Object.keys(TYPE_META)

type SortOption = "date" | "priceLowHigh" | "priceHighLow" | "fillingFast"

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button
      variant="bare"
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        borderRadius: "999px",
        border: active ? `1px solid ${FILL_SOLID_BORDER_TINT}` : "1px solid rgba(245,245,240,0.15)",
        background: active ? FILL_SOLID_TINT : "var(--afa-surface-raised)",
        color: active ? "var(--afa-fill-solid)" : "rgba(245,245,240,0.7)",
        padding: "8px 14px",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--afa-text-small)",
      }}
    >
      {children}
    </Button>
  )
}

export default function MobileEventFilterSheet({
  onClose,
  resultCount,
  selectedType,
  onSelectType,
  selectedCity,
  onSelectCity,
  cities,
  priceFilter,
  onSelectPrice,
  sortBy,
  onSelectSort,
  onReset,
}: {
  onClose: () => void
  resultCount: number
  selectedType: string | null
  onSelectType: (t: string | null) => void
  selectedCity: string
  onSelectCity: (c: string) => void
  cities: { city: string; country: string | null; label: string }[]
  priceFilter: string
  onSelectPrice: (p: string) => void
  sortBy: SortOption
  onSelectSort: (s: SortOption) => void
  onReset: () => void
}) {
  const { t: tr } = useLocale()

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <Button
        variant="bare"
        aria-label={tr.eventsPage.filterSheetCloseLabel}
        onClick={onClose}
        className="afa-backdrop-mount"
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }}
      >
        {null}
      </Button>
      <div
        className="afa-sheet-mount no-scrollbar"
        style={{
          position: "relative",
          maxHeight: "85vh",
          overflowY: "auto",
          borderTopLeftRadius: "20px",
          borderTopRightRadius: "20px",
          borderTop: "1px solid var(--afa-tint-10)",
          background: "var(--afa-surface-page)",
          paddingBottom: "32px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: "40px", height: "4px", borderRadius: "999px", background: "var(--afa-border-resting)" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 20px 4px" }}>
          <h2 style={{ fontFamily: "var(--font-ui)", fontSize: "var(--afa-text-subtitle)", fontWeight: 700, color: "var(--afa-cream)", margin: 0 }}>
            {tr.eventsPage.filterSheetTitle}
          </h2>
        </div>

        <section style={{ padding: "16px 20px 0" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "var(--afa-text-micro)", textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--afa-amber)", margin: 0 }}>
            {tr.eventsPage.filterAllNights}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px" }}>
            <Pill active={selectedType === null} onClick={() => onSelectType(null)}>
              {tr.eventsPage.filterAllNights}
            </Pill>
            {TYPE_OPTIONS.map((type) => {
              const typeKey = type as keyof typeof tr.eventTypes
              const on = selectedType === type
              return (
                <Pill key={type} active={on} onClick={() => onSelectType(on ? null : type)}>
                  <EventTypeIcon type={type} style={{ width: "13px", height: "13px", color: "currentColor" }} />
                  {tr.eventTypes[typeKey]}
                </Pill>
              )
            })}
          </div>
        </section>

        <section style={{ padding: "20px 20px 0" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "var(--afa-text-micro)", textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--afa-amber)", margin: 0 }}>
            {tr.eventsPage.filterAllCities}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px" }}>
            <Pill active={selectedCity === "All Cities"} onClick={() => onSelectCity("All Cities")}>
              {tr.eventsPage.filterAllCities}
            </Pill>
            {cities.map((c) => (
              <Pill key={c.city} active={selectedCity === c.city} onClick={() => onSelectCity(c.city)}>
                {c.label}
              </Pill>
            ))}
          </div>
        </section>

        <section style={{ padding: "20px 20px 0" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "var(--afa-text-micro)", textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--afa-amber)", margin: 0 }}>
            {tr.eventsPage.filterAll}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px" }}>
            {(["All", "Free", "Paid"] as const).map((p) => (
              <Pill key={p} active={priceFilter === p} onClick={() => onSelectPrice(p)}>
                {p === "All" ? tr.eventsPage.filterAll : p === "Free" ? tr.eventsPage.filterFree : tr.eventsPage.filterPaid}
              </Pill>
            ))}
          </div>
        </section>

        <section style={{ padding: "20px 20px 0" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "var(--afa-text-micro)", textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--afa-amber)", margin: 0 }}>
            {tr.eventsPage.sortLabel}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px" }}>
            {([
              { key: "date", label: tr.eventsPage.sortDate },
              { key: "priceLowHigh", label: tr.eventsPage.sortPriceLowHigh },
              { key: "priceHighLow", label: tr.eventsPage.sortPriceHighLow },
              { key: "fillingFast", label: tr.eventsPage.sortFillingFast },
            ] as const).map((s) => (
              <Pill key={s.key} active={sortBy === s.key} onClick={() => onSelectSort(s.key)}>
                {s.label}
              </Pill>
            ))}
          </div>
        </section>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "28px 20px 0" }}>
          <Button
            variant="bare"
            type="button"
            onClick={onReset}
            style={{
              borderRadius: "999px",
              border: "1px solid var(--afa-border-resting)",
              color: "rgba(245,245,240,0.7)",
              padding: "14px 20px",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--afa-text-small)",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
            }}
          >
            {tr.eventsPage.filterSheetReset}
          </Button>
          <Button type="button" variant="primary" fullWidth={false} onClick={onClose} style={{ flex: 1 }}>
            {tr.eventsPage.showingCount.replace("{n}", String(resultCount))}
          </Button>
        </div>
      </div>
    </div>
  )
}
