import { notFound } from "next/navigation"
import { isProductionEnv } from "@/lib/env-guard"

// ---------------------------------------------------------------------------
// Server-side guard for /dev/* pages. Runs BEFORE any child page renders,
// so a client-side bypass is not possible — the whole folder tree 404s
// on production before any content is generated. Any future page under
// /dev/* inherits this protection automatically, no per-page opt-in.
//
// Using `notFound()` (Next.js built-in) rather than returning null so the
// response looks identical to any other 404 — no hint that the route
// exists at all in prod.
// ---------------------------------------------------------------------------

export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (isProductionEnv()) {
    notFound()
  }
  return <>{children}</>
}
