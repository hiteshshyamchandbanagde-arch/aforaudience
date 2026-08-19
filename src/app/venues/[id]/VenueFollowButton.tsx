"use client"
import { useEffect, useState } from "react"
import { useLocale } from "@/lib/i18n/translate"
import { BellIcon, BellOffIcon, PlusIcon } from "@/components/icons/VenueIcons"

// Small, self-contained island of interactivity - the venue detail page
// itself is a server component with no other client-side state, so this
// stays isolated rather than converting the whole page.
//
// GEN-2608-074 - token-migrated off --afa-terracotta onto the locked
// system, and replaced the 🔔/🔕 emoji notify-toggle icon with real
// line-art (BellIcon/BellOffIcon) - caught during the redesign audit,
// not previously flagged as its own bug.
//
// BUG-2608-072 (gap 5) - the export has a SECOND, full-width "Follow this
// venue" CTA in the detail page's sidebar, distinct from this compact
// header button but controlling the exact same follow relationship. The
// fetch/toggle logic used to live entirely inside this component with its
// own local state; if it stayed that way with a second self-contained
// instance in the sidebar, clicking one button wouldn't update the other
// until a full page reload (each has its own state, both hit the same
// API, but neither refetches after the other's toggle). Pulled the
// fetch/toggle logic out into useVenueFollow so VenueDetailClient can call
// it once and hand the shared state down to both button instances.
// venueId is nullable so VenueDetailClient can call this hook
// unconditionally (Rules of Hooks) even before it knows whether the venue
// prop is null - the effect/toggles just no-op until a real id shows up.
export function useVenueFollow(venueId: string | null) {
  const [following, setFollowing] = useState(false)
  const [notifyEnabled, setNotifyEnabledState] = useState(true)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!venueId) return
    fetch(`/api/venues/${venueId}/follow`)
      .then((res) => res.json())
      .then((data) => {
        setFollowing(data.following)
        setNotifyEnabledState(data.notifyEnabled)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [venueId])

  const toggleFollow = async () => {
    if (busy || !venueId) return
    setBusy(true)
    try {
      const res = await fetch(`/api/venues/${venueId}/follow`, { method: "POST" })
      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(`/venues/${venueId}`)}`
        return
      }
      const data = await res.json()
      setFollowing(data.following)
      setNotifyEnabledState(data.notifyEnabled)
    } finally {
      setBusy(false)
    }
  }

  const toggleNotify = async () => {
    if (busy || !venueId) return
    setBusy(true)
    try {
      const next = !notifyEnabled
      const res = await fetch(`/api/venues/${venueId}/follow`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyEnabled: next }),
      })
      const data = await res.json()
      setNotifyEnabledState(data.notifyEnabled)
    } finally {
      setBusy(false)
    }
  }

  return { following, notifyEnabled, busy, loaded, toggleFollow, toggleNotify }
}

export type VenueFollowState = ReturnType<typeof useVenueFollow>

// Compact header button (unchanged behavior/copy - only the corner radius
// changed, see gap 7: export's Follow buttons are sharp-edged, this used
// to be a rounded-999px pill).
export function VenueFollowHeaderButton({ state }: { state: VenueFollowState }) {
  const { t: tr } = useLocale()
  const { following, notifyEnabled, busy, loaded, toggleFollow, toggleNotify } = state

  if (!loaded) return null

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "28px" }}>
      <style>{`.afa-follow-cta:hover { filter: brightness(1.1); }`}</style>
      <button
        onClick={toggleFollow}
        disabled={busy}
        className="afa-follow-cta"
        style={{
          padding: "10px 20px",
          border: following ? "1.5px solid var(--afa-fill-solid)" : "none",
          background: following ? "transparent" : "var(--afa-fill-solid)",
          color: following ? "var(--afa-fill-solid)" : "var(--afa-on-fill-solid)",
          fontSize: "13px",
          fontWeight: 600,
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {following ? tr.venueDetailPage.following : tr.venueDetailPage.follow}
      </button>
      {following && (
        <button
          onClick={toggleNotify}
          disabled={busy}
          aria-label={notifyEnabled ? tr.venueDetailPage.muteNotifications : tr.venueDetailPage.enableNotifications}
          title={notifyEnabled ? tr.venueDetailPage.notificationsOnTitle : tr.venueDetailPage.notificationsOffTitle}
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "50%",
            border: "1.5px solid rgba(245,245,240,0.2)",
            background: notifyEnabled ? "rgba(201,151,58,0.18)" : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {notifyEnabled ? (
            <BellIcon style={{ width: "15px", height: "15px", color: "var(--afa-amber)" }} />
          ) : (
            <BellOffIcon style={{ width: "15px", height: "15px", color: "var(--afa-text-primary)", opacity: 0.6 }} />
          )}
        </button>
      )}
    </div>
  )
}

// Sidebar CTA (BUG-2608-072 gap 5, new) - VenueDetail.tsx lines ~169-180:
// full-width, plus-icon before the label when not following, caption
// underneath. Shares state with the header button via useVenueFollow so
// the two never show conflicting follow state.
export function VenueFollowSidebarCta({ state }: { state: VenueFollowState }) {
  const { t: tr } = useLocale()
  const { following, busy, loaded, toggleFollow } = state

  if (!loaded) return null

  return (
    <div style={{ marginTop: "20px" }}>
      <style>{`.afa-follow-cta-sidebar:hover { filter: brightness(1.1); }`}</style>
      <button
        onClick={toggleFollow}
        disabled={busy}
        className="afa-follow-cta-sidebar"
        style={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          padding: "14px",
          border: following ? "1.5px solid var(--afa-fill-solid)" : "none",
          background: following ? "transparent" : "var(--afa-fill-solid)",
          color: following ? "var(--afa-fill-solid)" : "var(--afa-on-fill-solid)",
          fontSize: "14px",
          fontWeight: 600,
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {!following && <PlusIcon style={{ width: "16px", height: "16px" }} />}
        {following ? tr.venueDetailPage.followingThisVenue : tr.venueDetailPage.followThisVenue}
      </button>
      <p style={{ marginTop: "10px", textAlign: "center", fontSize: "13px", color: "var(--afa-text-primary)", opacity: 0.5 }}>
        {tr.venueDetailPage.followCaption}
      </p>
    </div>
  )
}
