"use client"
import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import SiteNav from "@/components/SiteNav"
import BrowseSearchDropdown from "@/components/BrowseSearchDropdown"
import OrganisersGridEmbed from "@/components/OrganisersGridEmbed"
import { EventCard, TYPE_META, type EventItem } from "@/components/EventCard"
import { GridViewIcon, ListViewIcon, TheaterMark, EventTypeIcon } from "@/components/icons/EventIcons"
import SearchInputBox from "@/components/SearchInputBox"
import { useLocale } from "@/lib/i18n/translate"

// Mirrors OrganiserItem in OrganisersGridEmbed.tsx - duplicated locally
// so the hero search (lifted up here, session 65) can type its dropdown
// items without importing a component-internal type.
interface OrganiserItem {
  id: string
  orgName: string
  bio: string | null
  user: { name: string; avatar: string | null }
  _count: { events: number }
}

const TYPE_OPTIONS = Object.keys(TYPE_META)

// Same date+startTime instant-comparison pattern as the booking guard
// (POST /api/bookings) and cancellation routes - kept consistent so
// "past" means the same thing everywhere in the app.
function isPastEvent(e: { date: string; startTime: string }): boolean {
  const [h, m] = e.startTime.split(':').map(Number)
  const eventStart = new Date(e.date)
  eventStart.setHours(h, m, 0, 0)
  return eventStart.getTime() <= Date.now()
}

export default function EventsPage() {
  const router = useRouter()
  const { t: tr } = useLocale()
  const [, startTransition] = useTransition()
  const [navigatingId, setNavigatingId] = useState<string | null>(null)

  const goToEvent = (id: string) => {
    // Guard against rapid repeat clicks: without this, a click that
    // doesn't render anything right away (slow cold-start render, etc.)
    // reads as "nothing happened" and the person clicks again - each
    // extra click was firing a brand new, un-deduped navigation request
    // (confirmed via Vercel runtime logs: 10+ duplicate GETs for the same
    // event id within seconds). This makes the first click visibly
    // "claim" the card and ignores further clicks until it resolves.
    if (navigatingId) return
    setNavigatingId(id)
    startTransition(() => {
      router.push(`/events/${id}`)
    })
  }

  const goToOrganiser = (id: string) => {
    if (navigatingId) return
    setNavigatingId(id)
    startTransition(() => {
      router.push(`/organisers/${id}`)
    })
  }

  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [search, setSearch] = useState("")
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [selectedCity, setSelectedCity] = useState("All Cities")
  const [priceFilter, setPriceFilter] = useState("All")
  // OTH-2608-009: sort control for the events list. "date" preserves the
  // existing default ordering (API returns date-ascending; Past tab
  // reverses it below, same as before this feature existed) so nobody's
  // current experience changes unless they actively pick a different sort.
  const [sortBy, setSortBy] = useState<"date" | "priceLowHigh" | "priceHighLow" | "fillingFast">("date")
  const [view, setView] = useState<"grid" | "list">("grid")
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming")
  // Toggle-based discovery entry point for Organisers (session 62,
  // design.md §9.5) - deliberately not a new top-level nav route.
  // Independent of `view` above (grid/list is an events-only display mode).
  const [contentMode, setContentMode] = useState<"events" | "organisers">("events")
  // Populated via OrganisersGridEmbed's onItemsLoaded callback (session
  // 65) - the embed still owns the /api/organisers fetch, it just also
  // reports the list up so the hero's single shared search box can build
  // its dropdown without a second fetch of the same data.
  const [organisers, setOrganisers] = useState<OrganiserItem[]>([])

  // FEAT-2608-036 fast-follow (2 Aug) - /api/events now accepts ?city= and
  // filters server-side (indexed via Venue_city_idx), so the previous
  // "fetch everything, filter client-side" approach is gone: this effect
  // re-fetches whenever selectedCity changes, and the request only ever
  // carries the events that actually match. Dropdown *options* can't come
  // from this scoped fetch though (narrowing to Pune would leave no way
  // to discover Mumbai exists) - those come from /api/venues/cities
  // instead, which always reflects every city regardless of the current
  // filter.
  const [cities, setCities] = useState<{ city: string; country: string | null; label: string }[]>([])
  useEffect(() => {
    fetch("/api/venues/cities")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data?.cities) setCities(data.cities) })
      .catch(() => {})
  }, [])

  // Resolve the user's default location once and apply it as the initial
  // filter - still just a starting point, freely changed/cleared via the
  // same dropdown as before. Waits on `cities` so it can validate the
  // guess is actually one we have events for before applying it.
  const cityAutoAppliedRef = useRef(false)
  const cityNames = cities.map((c) => c.city)
  useEffect(() => {
    if (cityAutoAppliedRef.current) return
    if (cities.length === 0) return
    cityAutoAppliedRef.current = true
    fetch("/api/user/location")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.city && cityNames.includes(data.city)) {
          setSelectedCity(data.city)
        }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities])

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true)
      try {
        const url = selectedCity === "All Cities" ? "/api/events" : `/api/events?city=${encodeURIComponent(selectedCity)}`
        const res = await fetch(url)
        if (!res.ok) throw new Error("Failed to load events")
        const data = await res.json()
        setEvents(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchEvents()
  }, [selectedCity])

  const filtered = events.filter((e) => {
    const matchSearch =
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      (e.venue?.name || "").toLowerCase().includes(search.toLowerCase())
    const matchType = selectedType === null || e.type === selectedType
    const matchCity = selectedCity === "All Cities" || e.venue?.city === selectedCity
    const matchPrice =
      priceFilter === "All" || (priceFilter === "Free" && e.isFree) || (priceFilter === "Paid" && !e.isFree)
    const matchTab = tab === "upcoming" ? !isPastEvent(e) : isPastEvent(e)
    return matchSearch && matchType && matchCity && matchPrice && matchTab
  })
  if (sortBy === "date") {
    if (tab === "past") {
      // API returns date ascending (soonest-first, right for Upcoming) -
      // Past reads better newest-first, so reverse rather than re-sort
      // from scratch.
      filtered.reverse()
    }
  } else if (sortBy === "priceLowHigh" || sortBy === "priceHighLow") {
    // BUG (caught live by Hitesh's click-test, 11 Aug): a few events are
    // marked isFree=false but have no real ticketPrice set (bad data -
    // the create-event API doesn't require a price when isFree is false,
    // separately flagged as GEN-2608-041). Treating that missing price as
    // ₹0 made these events sort to the very top of "Price: Low to High" -
    // showing up as the "cheapest" event even though their own badge
    // shows "—" (no price to display) instead of a number. Now pushed to
    // the end regardless of sort direction - never shown as a fake deal.
    // Second bug caught live (same click-test pass): the E2E test fixture
    // "Waitlist/Wallet Flow" has isFree=false with ticketPrice explicitly
    // 0 (not null), which `?? Infinity` doesn't catch - only null/
    // undefined trigger a `??` fallback, so a real zero sailed straight
    // through as if it were a genuine ₹0 price. Any non-free event with
    // no truthy price (null OR 0) is equally "no real price to show" -
    // its own badge already renders "—" either way - so both must be
    // treated the same here.
    const price = (e: EventItem) => (e.isFree ? 0 : e.ticketPrice ? e.ticketPrice : Infinity)
    filtered.sort((a, b) => {
      const pa = price(a), pb = price(b)
      if (pa === Infinity && pb === Infinity) return 0
      if (pa === Infinity) return 1
      if (pb === Infinity) return -1
      return sortBy === "priceLowHigh" ? pa - pb : pb - pa
    })
  } else if (sortBy === "fillingFast") {
    // % of seats already booked, descending - surfaces events closest to
    // selling out first, a reasonable proxy for "popular" without needing
    // a dedicated popularity metric.
    const bookedRatio = (e: EventItem) => (e.totalSeats > 0 ? (e.totalSeats - e.availableSeats) / e.totalSeats : 0)
    filtered.sort((a, b) => bookedRatio(b) - bookedRatio(a))
  }

  // Same `search` box drives both modes (session 65 fix) - the hero
  // search is now shared rather than two visually-different boxes for
  // events vs organisers.
  const filteredOrganisers = organisers.filter((o) => o.orgName.toLowerCase().includes(search.toLowerCase()))

  return (
    <main style={{ minHeight: "100vh", background: "var(--afa-surface-page)", fontFamily: "var(--font-sans)" }}>
      <style>{`
        .afa-events-page-container { max-width: 1152px; margin: 0 auto; padding: 56px 24px 112px; }
        @media (min-width: 640px) { .afa-events-page-container { padding: 80px 32px 112px; } }
        .afa-event-card { border: 1px solid rgba(245,245,240,0.1); transition: border-color 0.2s ease, opacity 0.15s ease; }
        .afa-event-card:hover { border-color: rgba(201,151,58,0.3); }
        .afa-event-card-grid .afa-event-card-poster { aspect-ratio: 4 / 5; }
        .afa-event-card-list .afa-event-card-poster { width: 9rem; aspect-ratio: 3 / 4; }
        @media (min-width: 640px) { .afa-event-card-list .afa-event-card-poster { width: 11rem; } }
        @keyframes afa-ping { 75%, 100% { transform: scale(2.2); opacity: 0; } }
        @keyframes afa-spin { to { transform: rotate(360deg); } }
        .afa-events-search-box { flex: 1; min-width: 220px; }
        .afa-events-type-filter { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: rgba(245,245,240,0.4); background: none; border: none; cursor: pointer; transition: color 0.2s ease; display: inline-flex; align-items: center; gap: 8px; padding: 0; }
        .afa-events-type-filter:hover { color: rgba(245,245,240,0.7); }
        .afa-events-type-filter.active { color: var(--afa-amber); }
        .afa-events-mode-tab { font-family: var(--font-display); font-size: 18px; background: none; border: none; cursor: pointer; padding: 0 0 12px; position: relative; color: rgba(245,245,240,0.45); transition: color 0.2s ease; }
        .afa-events-mode-tab:hover { color: rgba(245,245,240,0.7); }
        .afa-events-mode-tab.active { color: var(--afa-cream); }
        .afa-events-mode-tab.active::after { content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: var(--afa-fill-solid); }
        .afa-events-price-filter { font-family: var(--font-mono); font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; background: none; border: none; cursor: pointer; color: rgba(245,245,240,0.4); padding: 0; transition: color 0.2s ease; }
        .afa-events-price-filter:hover { color: rgba(245,245,240,0.7); }
        .afa-events-price-filter.active { color: var(--afa-amber); }
        .afa-events-select { padding: 8px 12px; border-radius: 3px; border: 1px solid rgba(245,245,240,0.15); font-size: 13px; color: var(--afa-text-primary); background: var(--afa-surface-raised); cursor: pointer; outline: none; }
        .afa-events-view-btn { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 2px; border: none; cursor: pointer; background: transparent; color: rgba(245,245,240,0.5); transition: color 0.2s ease, background 0.2s ease; }
        .afa-events-view-btn:hover { color: var(--afa-cream); }
        .afa-events-view-btn.active { background: var(--afa-cream); color: var(--afa-surface-inverse); }
      `}</style>
      <SiteNav active="events" />

      <div className="afa-events-page-container">
        {/* HERO - export EventsDirectory.tsx: eyebrow, display headline with
            an italic amber emphasis word, static evocative subtitle. No
            separate boxed/inverse hero background in the export - the hero
            sits directly on the page. */}
        <header style={{ maxWidth: "760px" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--afa-amber)" }}>
            {contentMode === "organisers"
              ? tr.eventsPage.heroSubtitleOrganisers
              : loading ? tr.eventsPage.loadingEvents : tab === "upcoming" ? tr.eventsPage.countNear.replace("{n}", String(filtered.length)) : tr.eventsPage.countPast.replace("{n}", String(filtered.length))}
          </span>
          <h1 style={{ marginTop: "16px", fontFamily: "var(--font-display)", fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.02, color: "var(--afa-text-primary)" }}>
            {contentMode === "organisers" ? (
              <>{tr.eventsPage.heroPrefixOrganisers}<em style={{ color: "var(--afa-amber)", fontStyle: "italic", fontWeight: 400 }}>{tr.eventsPage.heroEmphasisOrganisers}</em>{tr.eventsPage.heroSuffixOrganisers}</>
            ) : (
              <>{tr.eventsPage.heroPrefixEvents}<em style={{ color: "var(--afa-amber)", fontStyle: "italic", fontWeight: 400 }}>{tr.eventsPage.heroEmphasisEvents}</em>{tr.eventsPage.heroSuffixEvents}</>
            )}
          </h1>
          {contentMode === "events" && (
            <p style={{ marginTop: "20px", maxWidth: "560px", fontSize: "15px", lineHeight: 1.6, color: "rgba(245,245,240,0.6)" }}>
              {tr.eventsPage.heroSubtitleEvents}
            </p>
          )}
        </header>

        {error && (
          <div style={{ padding: "14px 16px", background: "var(--afa-error-bg)", border: "1px solid var(--afa-error-border)", borderRadius: "8px", color: "var(--afa-error)", fontSize: "14px", marginTop: "24px" }}>
            {error}
          </div>
        )}

        {/* EVENTS / ORGANISERS TOGGLE - discovery entry point for the
            public Organiser bio profiles (session 62, design.md §9.5),
            deliberately not a new top-level nav route. Underline-tab
            treatment (not pills) matching the Venues/Owners toggle
            convention elsewhere in the app. */}
        <div style={{ display: "flex", gap: "32px", marginTop: "40px", borderBottom: "1px solid rgba(245,245,240,0.1)" }}>
          <button className={`afa-events-mode-tab${contentMode === "events" ? " active" : ""}`} onClick={() => setContentMode("events")}>
            {tr.eventsPage.toggleEvents}
          </button>
          <button className={`afa-events-mode-tab${contentMode === "organisers" ? " active" : ""}`} onClick={() => setContentMode("organisers")}>
            {tr.eventsPage.toggleOrganisers}
          </button>
        </div>

        {contentMode === "events" && (
          <div style={{ marginTop: "24px" }}>
            <BrowseSearchDropdown
              query={search}
              items={filtered}
              getId={(e) => e.id}
              emptyLabel={tr.common.nounEvents}
              translate
              onSelect={(e) => goToEvent(e.id)}
              renderRow={(e) => (
                <>
                  <span style={{ fontWeight: 600 }}>{e.title}</span>
                  <span style={{ opacity: 0.5, marginLeft: "8px" }}>
                    {new Date(e.date).toLocaleDateString()}{e.venue?.name ? ` · ${e.venue.name}` : ""}
                  </span>
                </>
              )}
            >
              <SearchInputBox
                value={search}
                onChange={setSearch}
                placeholder={tr.eventsPage.searchEventsPlaceholder}
                className="afa-events-search-box"
              />
            </BrowseSearchDropdown>
          </div>
        )}

        {contentMode === "organisers" ? (
          <div style={{ marginTop: "32px" }}>
            {/* Session 65 fix: same hero search box position/styling as
                Events mode - just pointed at organisers. */}
            <BrowseSearchDropdown
              query={search}
              items={filteredOrganisers}
              getId={(o) => o.id}
              emptyLabel={tr.common.nounOrganisers}
              translate
              onSelect={(o) => goToOrganiser(o.id)}
              renderRow={(o) => <span style={{ fontWeight: 600 }}>{o.orgName}</span>}
            >
              <SearchInputBox
                value={search}
                onChange={setSearch}
                placeholder={tr.eventsPage.searchOrganisersPlaceholder}
                className="afa-events-search-box"
                style={{ marginBottom: "24px" }}
              />
            </BrowseSearchDropdown>
            <OrganisersGridEmbed search={search} hideSearchBar onItemsLoaded={setOrganisers} />
          </div>
        ) : (
          <>
            {/* UPCOMING / PAST TAB */}
            <div style={{ display: "flex", gap: "24px", marginTop: "28px" }}>
              {(["upcoming", "past"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="afa-events-price-filter"
                  style={{ fontSize: "13px", color: tab === t ? "var(--afa-amber)" : "rgba(245,245,240,0.4)" }}
                >
                  {t === "upcoming" ? tr.eventsPage.tabUpcoming : tr.eventsPage.tabPast}
                </button>
              ))}
            </div>

            {/* FILTERS */}
            <style>{`
              .events-filters-row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 24px; }
              .events-type-row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 24px; }
              @media (max-width: 780px) {
                .events-filters-row { flex-direction: column; align-items: stretch; }
                .afa-events-select { width: 100%; box-sizing: border-box; }
                .afa-events-view-toggle { display: none; }
              }
            `}</style>
            <div style={{ marginTop: "20px", borderTop: "1px solid rgba(245,245,240,0.1)", paddingTop: "20px" }}>
              <div className="events-type-row" style={{ marginBottom: "16px" }}>
                <button
                  onClick={() => setSelectedType(null)}
                  className={`afa-events-type-filter${selectedType === null ? " active" : ""}`}
                >
                  {tr.eventsPage.filterAllNights}
                </button>
                {TYPE_OPTIONS.map((type) => {
                  const typeKey = type as keyof typeof tr.eventTypes
                  const on = selectedType === type
                  return (
                    <button
                      key={type}
                      onClick={() => setSelectedType(on ? null : type)}
                      className={`afa-events-type-filter${on ? " active" : ""}`}
                    >
                      <EventTypeIcon type={type} style={{ width: "14px", height: "14px", color: "currentColor" }} />
                      {tr.eventTypes[typeKey]}
                    </button>
                  )
                })}
              </div>

              <div className="events-filters-row">
                <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} className="afa-events-select">
                  <option value="All Cities">{tr.eventsPage.filterAllCities}</option>
                  {cities.map((c) => <option key={c.city} value={c.city}>{c.label}</option>)}
                </select>

                <div style={{ display: "flex", gap: "16px" }}>
                  {["All", "Free", "Paid"].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPriceFilter(p)}
                      className={`afa-events-price-filter${priceFilter === p ? " active" : ""}`}
                    >
                      {p === "All" ? tr.eventsPage.filterAll : p === "Free" ? tr.eventsPage.filterFree : tr.eventsPage.filterPaid}
                    </button>
                  ))}
                </div>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="afa-events-select"
                  aria-label={tr.eventsPage.sortLabel}
                >
                  <option value="date">{tr.eventsPage.sortDate}</option>
                  <option value="priceLowHigh">{tr.eventsPage.sortPriceLowHigh}</option>
                  <option value="priceHighLow">{tr.eventsPage.sortPriceHighLow}</option>
                  <option value="fillingFast">{tr.eventsPage.sortFillingFast}</option>
                </select>

                <div className="afa-events-view-toggle" style={{ marginLeft: "auto", display: "flex", gap: "4px", border: "1px solid rgba(245,245,240,0.15)", borderRadius: "3px", padding: "3px" }}>
                  <button onClick={() => setView("grid")} aria-pressed={view === "grid"} aria-label={tr.eventsPage.gridViewLabel} className={`afa-events-view-btn${view === "grid" ? " active" : ""}`}>
                    <GridViewIcon style={{ width: "16px", height: "16px" }} />
                  </button>
                  <button onClick={() => setView("list")} aria-pressed={view === "list"} aria-label={tr.eventsPage.listViewLabel} className={`afa-events-view-btn${view === "list" ? " active" : ""}`}>
                    <ListViewIcon style={{ width: "16px", height: "16px" }} />
                  </button>
                </div>
              </div>
            </div>

            <div style={{ marginTop: "16px", marginBottom: "16px", fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(245,245,240,0.4)" }}>
              {tr.eventsPage.showingCount.replace("{n}", String(filtered.length))}
            </div>

            {/* EVENTS GRID */}
            {loading ? (
              <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--afa-text-primary)", opacity: 0.5 }}>{tr.eventsPage.loadingEvents}</div>
            ) : filtered.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", border: "1px dashed rgba(245,245,240,0.15)", borderRadius: "3px", padding: "96px 20px", textAlign: "center" }}>
                <TheaterMark style={{ width: "40px", height: "40px", color: "rgba(201,151,58,0.6)" }} />
                <p style={{ fontFamily: "var(--font-display)", fontSize: "24px", color: "var(--afa-cream)", margin: 0 }}>
                  {tab === "past" ? tr.eventsPage.emptyNoPastTitle : events.length === 0 ? tr.eventsPage.emptyNoneYetTitle : tr.eventsPage.emptyNoneFoundTitle}
                </p>
                <p style={{ maxWidth: "360px", fontSize: "13px", color: "rgba(245,245,240,0.5)", margin: 0 }}>
                  {tab === "past" ? tr.eventsPage.emptyNoPastSub : events.length === 0 ? tr.eventsPage.emptyNoneYetSub : tr.eventsPage.emptyNoneFoundSub}
                </p>
              </div>
            ) : view === "grid" ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "24px" }}>
                {filtered.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    view="grid"
                    tab={tab}
                    isNavigating={navigatingId === event.id}
                    disabled={navigatingId !== null}
                    onOpen={() => goToEvent(event.id)}
                  />
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {filtered.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    view="list"
                    tab={tab}
                    isNavigating={navigatingId === event.id}
                    disabled={navigatingId !== null}
                    onOpen={() => goToEvent(event.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
