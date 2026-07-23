"use client"
import { useEffect, useState } from "react"

// Same isolated-island pattern as VenueFollowButton - the organiser detail
// page is otherwise a plain server component.
export default function OrganiserFollowButton({ organiserId }: { organiserId: string }) {
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
    <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "28px" }}>
      <button
        onClick={toggleFollow}
        disabled={busy}
        style={{
          padding: "8px 18px",
          borderRadius: "999px",
          border: following ? "1.5px solid rgba(14,12,10,0.2)" : "none",
          background: following ? "transparent" : "#C8441A",
          color: following ? "#0E0C0A" : "white",
          fontSize: "13px",
          fontWeight: 600,
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {following ? "✓ Following" : "+ Follow"}
      </button>
      {following && (
        <button
          onClick={toggleNotify}
          disabled={busy}
          aria-label={notifyEnabled ? "Mute new event notifications" : "Get notified of new events"}
          title={notifyEnabled ? "Notifications on - tap to mute" : "Notifications off - tap to enable"}
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "50%",
            border: "1.5px solid rgba(14,12,10,0.2)",
            background: notifyEnabled ? "#FFF5F2" : "transparent",
            fontSize: "15px",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {notifyEnabled ? "🔔" : "🔕"}
        </button>
      )}
    </div>
  )
}
