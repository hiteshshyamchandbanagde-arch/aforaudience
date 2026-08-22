"use client"
import { useEffect, useState } from "react"
import { useLocale } from "@/lib/i18n/translate"
import { BellIcon, BellOffIcon } from "@/components/icons/VenueIcons"

// Same isolated-island pattern as VenueFollowButton - the organiser detail
// page is otherwise a plain server component. Fetch/toggle logic is
// unchanged (already correct); restyled onto VenueFollowHeaderButton's
// exact chrome (profile page rebuild, this session) - sharp corners,
// --afa-fill-solid instead of the legacy --afa-terracotta, real
// BellIcon/BellOffIcon instead of the 🔔/🔕 emoji toggle. marginBottom
// removed from the wrapper - the old page hardcoded spacing here because
// this was the only thing under the H1; the rebuilt hero lays this out
// in its own flex row alongside "Member since", so the page controls
// that gap now, not this component.
export default function OrganiserFollowButton({ organiserId }: { organiserId: string }) {
  const { t: tr } = useLocale()
  const [following, setFollowing] = useState(false)
  const [notifyEnabled, setNotifyEnabledState] = useState(true)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch(`/api/organisers/${organiserId}/follow`)
      .then((res) => res.json())
      .then((data) => {
        setFollowing(data.following)
        setNotifyEnabledState(data.notifyEnabled)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [organiserId])

  const toggleFollow = async () => {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/organisers/${organiserId}/follow`, { method: "POST" })
      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(`/organisers/${organiserId}`)}`
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
      const res = await fetch(`/api/organisers/${organiserId}/follow`, {
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
    <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
      <style>{`.afa-organiser-follow-cta:hover { filter: brightness(1.1); }`}</style>
      <button
        onClick={toggleFollow}
        disabled={busy}
        className="afa-organiser-follow-cta"
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
        {following ? tr.followButton.following : tr.followButton.follow}
      </button>
      {following && (
        <button
          onClick={toggleNotify}
          disabled={busy}
          aria-label={notifyEnabled ? tr.followButton.muteNotifications : tr.followButton.enableNotifications}
          title={notifyEnabled ? tr.followButton.notificationsOnTitle : tr.followButton.notificationsOffTitle}
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
