"use client"

import { SessionProvider } from "next-auth/react"
import SessionGuard from "@/components/SessionGuard"
import IdleTimeoutGuard from "@/components/IdleTimeoutGuard"
import NumberInputWheelGuard from "@/components/NumberInputWheelGuard"
import { ToastProvider } from "@/components/Toast"
import { LocaleProvider } from "@/lib/i18n/translate"

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SessionGuard />
      <IdleTimeoutGuard />
      <NumberInputWheelGuard />
      <LocaleProvider>
        <ToastProvider>{children}</ToastProvider>
      </LocaleProvider>
    </SessionProvider>
  )
}
