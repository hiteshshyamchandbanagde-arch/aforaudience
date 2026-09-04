import type { ReactNode } from "react"
import AuthBrandPanel from "./AuthBrandPanel"

// Shared shell for the 5 auth pages (Login/Register/Forgot/Reset/Verify).
// Mobile: unchanged single-column layout (no brand panel — screen too tight
// to justify it). Desktop (lg+): asymmetric split — fixed 480px form column
// + flexible brand panel filling the rest. See docs/design.md, "Auth Pages —
// Desktop Brand Panel Redesign" (5 Sep 2026), ported from the Figma Make
// export's AuthLayout.tsx.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[var(--afa-surface-page)] font-sans flex flex-col items-center justify-center px-4 py-10 sm:px-6 sm:py-16 lg:flex-row lg:items-stretch lg:justify-start lg:p-0">
      <div className="w-full flex items-center justify-center lg:w-[480px] lg:flex-shrink-0 lg:px-12 lg:py-16">
        {children}
      </div>
      <div className="hidden lg:block lg:flex-1">
        <AuthBrandPanel />
      </div>
    </main>
  )
}
