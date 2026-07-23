"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

interface SearchResults {
  events: { id: string; title: string; date: string; city: string | null }[]
  artists: { id: string; name: string; genre: string | null }[]
  venues: { id: string; name: string; city: string }[]
}

const EMPTY: SearchResults = { events: [], artists: [], venues: [] }

export default function SearchBox() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResults>(EMPTY)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(EMPTY)
      return
    }
    setLoading(true)
    const timeout = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        .then((res) => res.json())
        .then(setResults)
        .catch(() => setResults(EMPTY))
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(timeout)
  }, [query])

  const hasResults = results.events.length > 0 || results.artists.length > 0 || results.venues.length > 0
  const go = (href: string) => {
    setOpen(false)
    setQuery("")
    router.push(href)
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Search events, artists, venues..."
        style={{
          width: "100%", maxWidth: "220px", padding: "8px 14px", borderRadius: "999px",
          border: "1.5px solid rgba(14,12,10,0.15)", fontSize: "13px",
          background: "white", color: "#0E0C0A", outline: "none", boxSizing: "border-box",
        }}
      />
      {open && query.trim().length >= 2 && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, width: "320px",
          background: "white", borderRadius: "12px", boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
          border: "1px solid rgba(14,12,10,0.08)", zIndex: 200, maxHeight: "420px", overflowY: "auto",
          padding: hasResults || loading ? "10px 0" : "16px",
        }}>
          {loading ? (
            <div style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.5, padding: "6px 16px" }}>Searching...</div>
          ) : !hasResults ? (
            <div style={{ fontSize: "13px", color: "#0E0C0A", opacity: 0.5 }}>No results for &quot;{query}&quot;</div>
          ) : (
            <>
              {results.events.length > 0 && (
                <div style={{ marginBottom: "6px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#0E0C0A", opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.05em", padding: "4px 16px" }}>Events</div>
                  {results.events.map((e) => (
                    <button key={e.id} onClick={() => go(`/events/${e.id}`)} style={rowStyle}>
                      <span style={{ fontWeight: 600 }}>{e.title}</span>
                      <span style={{ opacity: 0.5, marginLeft: "8px" }}>{new Date(e.date).toLocaleDateString()}{e.city ? ` · ${e.city}` : ""}</span>
                    </button>
                  ))}
                </div>
              )}
              {results.artists.length > 0 && (
                <div style={{ marginBottom: "6px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#0E0C0A", opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.05em", padding: "4px 16px" }}>Artists</div>
                  {results.artists.map((a) => (
                    <button key={a.id} onClick={() => go(`/artists/${a.id}`)} style={rowStyle}>
                      <span style={{ fontWeight: 600 }}>{a.name}</span>
                      {a.genre && <span style={{ opacity: 0.5, marginLeft: "8px" }}>{a.genre}</span>}
                    </button>
                  ))}
                </div>
              )}
              {results.venues.length > 0 && (
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#0E0C0A", opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.05em", padding: "4px 16px" }}>Venues</div>
                  {results.venues.map((v) => (
                    <button key={v.id} onClick={() => go(`/venues/${v.id}`)} style={rowStyle}>
                      <span style={{ fontWeight: 600 }}>{v.name}</span>
                      <span style={{ opacity: 0.5, marginLeft: "8px" }}>{v.city}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

const rowStyle: React.CSSProperties = {
  display: "block", width: "100%", textAlign: "left", padding: "8px 16px",
  border: "none", background: "transparent", cursor: "pointer", fontSize: "13px", color: "#0E0C0A",
}
