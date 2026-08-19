"use client"
import { useEffect, useState } from "react"
import { useLocale } from "@/lib/i18n/translate"
import { BellIcon, BellOffIcon } from "@/components/icons/VenueIcons"

// Small, self-contained island of interactivity - the venue detail page
// itself is a server component with no other client-side state, so this
// stays isolated rather than converting the whole page.
//
// GEN-2608-074 - token-migrated off --afa-terracotta onto the locked
// system, and replaced the 🔔/🔕 emoji notify-toggle icon with real
// line-art (BellIcon/BellOffIcon) - caught during the redesign audit,
// not previously flagged as its own bug.
export default function VenueFollowButton({ venueId }: { venueId: string }) {
  const { t: tr } = useLocale()
  const [following, setFollowing] = useState(false)
  const [notifyEnabled, setNotifyEnabledState] = useState(true)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
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
    if (busy) return
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
    if (busy) return
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

  if (!loaded) return null

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "28px" }}>
      <style>{`.afa-follow-cta:hover { filter: brightness(1.1); }`}</style>
      <button
        onClick={toggleFollow}
        disabled={busy}
        className="afa-follow-cta"
        style={{
          padding: "8px 18px",
          borderRadius: "999px",
          border: following ? "1.5px solid rgba(245,245,240,0.2)" : "none",
          background: following ? "transparent" : "var(--afa-fill-solid)",
          color: following ? "var(--afa-text-primary)" : "var(--afa-on-fill-solid)",
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
