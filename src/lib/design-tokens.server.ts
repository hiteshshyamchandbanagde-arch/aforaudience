import { unstable_cache, revalidateTag } from "next/cache"
import prisma from "@/lib/prisma"
import { DESIGN_TOKEN_CACHE_TAG, toDTO, type DesignTokenDTO } from "@/lib/design-tokens"

// GEN-2609-075 - the DB-touching half of the design-tokens system.
// Split out of design-tokens.ts specifically so that file stays safe
// to import from a Client Component (the admin page needs its pure
// validation/contrast helpers) - importing `@/lib/prisma` (which pulls
// in the `pg` driver's Node-only modules) or `next/cache`'s server-only
// APIs from a file a Client Component imports breaks `next build`
// outright. Import THIS file only from Server Components and Route
// Handlers.

async function fetchDesignTokens(): Promise<DesignTokenDTO[]> {
  const rows = await prisma.designToken.findMany({ orderBy: { key: "asc" } })
  const out: DesignTokenDTO[] = []
  for (const row of rows) {
    const dto = toDTO(row)
    if (dto) out.push(dto)
  }
  return out
}

// Cached, tagged read used by the root layout (and anywhere else that
// just needs the current values, not the admin CRUD surface). Kept as
// its own tiny wrapper rather than inlining unstable_cache at the call
// site so there's exactly one place that owns the cache key/tag.
//
// GEN-2609-108 - `revalidate: 300` is a safety net, not the main refresh
// path (editor saves and the admin "Refresh site cache" button still
// clear the tag immediately). Without it the entry never expired, so a
// DB change made outside the editor (SQL applied after a merge) stayed
// invisible until someone saved: on 26 Sep --afa-text-muted 0.5 sat
// unseen for hours. Cost: at most one small DesignToken read (~110 rows)
// per 5 minutes per cache, and only when a page is actually requested.
const DESIGN_TOKEN_CACHE_SECONDS = 300
const getCachedDesignTokens = unstable_cache(fetchDesignTokens, ["design-tokens-v1"], {
  tags: [DESIGN_TOKEN_CACHE_TAG],
  revalidate: DESIGN_TOKEN_CACHE_SECONDS,
})

// Never throws - the root layout's whole point is to render even when
// the DB is unreachable, falling back to globals.css's own defaults.
export async function getDesignTokensSafe(): Promise<DesignTokenDTO[]> {
  try {
    return await getCachedDesignTokens()
  } catch (err) {
    console.warn("[design-tokens] read failed, falling back to globals.css defaults", err)
    return []
  }
}

// This Next version (16.2.9) changed revalidateTag's contract from the
// training-data version - see node_modules/next/dist/docs/.../
// revalidateTag.md, AGENTS.md's own "read the docs before writing code"
// warning. The single-arg call is deprecated and, more importantly,
// profile="max" (the new recommended default) gives stale-while-
// revalidate semantics - the STALE value keeps serving until the NEXT
// visit after this one triggers a background refresh, which would fail
// this ticket's actual acceptance bar ("show it on the next load").
// `{ expire: 0 }` is the documented immediate-expiration form for
// exactly this case (a Route Handler triggering revalidation on demand,
// not a Server Action) - the cache entry is gone immediately, so the
// very next request recomputes for real.
export function revalidateDesignTokens() {
  revalidateTag(DESIGN_TOKEN_CACHE_TAG, { expire: 0 })
}
