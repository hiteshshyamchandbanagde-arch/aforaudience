"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import EnvBadge from "@/components/EnvBadge"

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") || ""
  const [status, setStatus] = useState<"checking" | "ok" | "error">("checking")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!token) {
      setStatus("error")
      setError("This verification link is invalid or has expired.")
      return
    }

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          setStatus("error")
          setError(data.error || "Something went wrong")
          return
        }
        setStatus("ok")
      })
      .catch(() => {
        setStatus("error")
        setError("Something went wrong. Please try again.")
      })
  }, [token])

  return (
    <div className="w-full max-w-[440px]">
      <div className="text-center mb-8">
        <Link href="/" className="font-serif text-[28px] font-bold text-[#0E0C0A] no-underline">
          <span className="text-[#C8441A]">A</span>forAudience
          <EnvBadge />
        </Link>
      </div>

      <div className="bg-white rounded-[16px] p-8 sm:p-10 border border-[rgba(14,12,10,0.08)] shadow-[0_4px_24px_rgba(0,0,0,0.06)] text-center">
        {status === "checking" && (
          <p style={{ fontSize: "14px", color: "#0E0C0A", opacity: 0.6 }}>Verifying your email...</p>
        )}
        {status === "ok" && (
          <>
            <div style={{ background: "#F0FFF4", border: "1px solid #68D391", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", fontSize: "14px", color: "#276749" }}>
              ✅ Email verified.
            </div>
            <Link href="/" style={{ color: "#C8441A", fontWeight: 500, fontSize: "14px" }}>
              Continue to AforAudience
            </Link>
          </>
        )}
        {status === "error" && (
          <p style={{ fontSize: "14px", color: "#C8441A" }}>{error}</p>
        )}
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <main className="min-h-screen bg-[#F7F3EE] flex items-center justify-center px-4 py-10 sm:px-6 sm:py-16 font-sans">
      <Suspense fallback={<div>Loading...</div>}>
        <VerifyEmailContent />
      </Suspense>
    </main>
  )
}
