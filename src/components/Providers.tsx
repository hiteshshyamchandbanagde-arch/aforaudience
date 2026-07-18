"use client"

import { SessionProvider } from "next-auth/react"
import SessionGuard from "@/components/SessionGuard"
import { ToastProvider } from "@/components/Toast"

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SessionGuard />
      <ToastProvider>{children}</ToastProvider>
    </SessionProvider>
  )
}
