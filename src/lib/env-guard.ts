// ---------------------------------------------------------------------------
// Environment guard for QA-only routes and pages.
//
// Some routes exist purely to help us verify plumbing in QA (a Razorpay
// credential check, a test-payment page, future debug tools). These must
// never be reachable on production, even if someone knows the URL — that
// would leak configuration state, or worse, provide a live test-payment
// button on the real site.
//
// The check reads Vercel's built-in VERCEL_ENV variable, which is:
//   - "production"  → the prod aforaudience.com deploy
//   - "preview"     → the qa.aforaudience.com deploy AND all PR previews
//   - "development" → only during local `vercel dev` (nobody uses this)
//   - undefined     → local `next dev` on your own machine
//
// We deliberately treat "undefined" as non-production so these routes
// work in your local dev environment too — otherwise you couldn't test
// them without pushing to QA every time.
// ---------------------------------------------------------------------------

export function isProductionEnv(): boolean {
  return process.env.VERCEL_ENV === "production"
}

/**
 * Convenience for API routes and pages: returns true when the route should
 * be visible (QA, local dev), false when it should 404 (production).
 */
export function isNonProductionEnv(): boolean {
  return !isProductionEnv()
}
