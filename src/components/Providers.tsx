"use client"

import { SessionProvider } from "next-auth/react"
import SessionGuard from "@/components/SessionGuard"
import IdleTimeoutGuard from "@/components/IdleTimeoutGuard"
import NumberInputWheelGuard from "@/components/NumberInputWheelGuard"
import { ToastProvider } from "@/components/Toast"

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SessionGuard />
      <IdleTimeoutGuard />
      <NumberInputWheelGuard />
      <ToastProvider>{children}</ToastProvider>
    </SessionProvider>
  )
}
