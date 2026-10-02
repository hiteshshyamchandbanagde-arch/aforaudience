import { unstable_cache, revalidateTag } from "next/cache"
import prisma from "@/lib/prisma"
import { DESIGN_TOKEN_CACHE_TAG, isValidTokenValue, resolveColorValue, toDTO, toPdfRgb, type DesignTokenDTO } from "@/lib/design-tokens"

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

// GEN-2609-119 - concrete colours for what users receive or download
// (share posters, emails, the ticket PDF, the manifest, the theme-color
// meta), none of which can render var(). Same cached read as the layout,
// so the tag and the 300s revalidate above are the freshness contract
// here too: an editor save shows on the next request, a direct DB change
// within the revalidate window. `resolveDesignColors` does one token
// read for the whole batch.
export async function resolveDesignColors<K extends string>(keys: readonly K[]): Promise<Record<K, string>> {
  const values: Record<string, string> = {}
  for (const t of await getDesignTokensSafe()) {
    if (t.type === "color" && isValidTokenValue(t.type, t.value)) values[t.key] = t.value
  }
  const out = {} as Record<K, string>
  for (const key of keys) out[key] = resolveColorValue(values, key)
  return out
}

export async function resolveDesignColor(key: string): Promise<string> {
  return (await resolveDesignColors([key]))[key]
}

export { toPdfRgb }

// The browser-chrome colours: the manifest's theme_color / background_color
// and the theme-color meta read this one function, so they can't drift.
export async function appChromeColors(): Promise<{ theme: string; background: string }> {
  const c = await resolveDesignColors(["--afa-fill-solid", "--afa-surface-page"] as const)
  return { theme: c["--afa-fill-solid"], background: c["--afa-surface-page"] }
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

// The editor's version history: newest 20, each with a readable
// creator. GEN-2609-076 - `createdBy` is a bare user id, resolved here
// (one extra query, bounded by the distinct admins in those 20) rather
// than on the client.
// GEN-2609-115 - shared by GET and every write route (save, restore,
// reset, snapshot), which return the fresh list in their own response.
// The editor used to refetch it with a second GET after each write, and
// after a restore the list kept showing the old rows until a reload.
export async function listDesignTokenVersions() {
  const versions = await prisma.designTokenVersion.findMany({ orderBy: { createdAt: "desc" }, take: 20 })
  const creatorIds = [...new Set(versions.map((v) => v.createdBy).filter((id): id is string => !!id))]
  const creators = creatorIds.length
    ? await prisma.user.findMany({ where: { id: { in: creatorIds } }, select: { id: true, displayName: true, name: true, email: true } })
    : []
  const creatorLabelById = new Map(creators.map((c) => [c.id, c.displayName || c.name || c.email]))
  return versions.map((v) => ({
    ...v,
    creatorLabel: v.createdBy ? creatorLabelById.get(v.createdBy) ?? v.createdBy : null,
  }))
}
