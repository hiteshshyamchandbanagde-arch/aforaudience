import { test, expect } from "./helpers/test";
import type { APIResponse } from "@playwright/test";

/**
 * [BUG-2610-014] Vercel functions run in Mumbai (bom1), next to the QA
 * database (Supabase ap-south-1). With no region set they ran in iad1
 * (Washington) and every query crossed the world: about 5 s per screen.
 *
 * Vercel's `x-vercel-id` header is `<edge>::<function region>::<id>` when a
 * function ran, and `<edge>::<id>` when the edge cache answered. /events/
 * itself is prerendered (x-vercel-cache: HIT, no function segment), so the
 * SSR check uses an event detail page, which is force-dynamic.
 *
 * No auth, read-only. Skipped where the header is absent (local `next dev`).
 */

/** The function region from `x-vercel-id`, or null if no function ran. */
function functionRegion(res: APIResponse): string | null {
  const id = res.headers()["x-vercel-id"];
  if (!id) return null;
  const parts = id.split("::");
  return parts.length >= 3 ? parts[parts.length - 2] : null;
}

test("[BUG-2610-014] /api/events/ runs in bom1", async ({ request }) => {
  const res = await request.get("/api/events/");
  expect(res.ok()).toBe(true);
  test.skip(!res.headers()["x-vercel-id"], "no x-vercel-id header: not on Vercel");
  expect(res.headers()["x-vercel-id"], "x-vercel-id names a function region").toMatch(/^[^:]+::[^:]+::/);
  expect(functionRegion(res)).toBe("bom1");
});

test("[BUG-2610-014] an SSR event page runs in bom1", async ({ request }) => {
  const list = await request.get("/api/events/");
  expect(list.ok()).toBe(true);
  test.skip(!list.headers()["x-vercel-id"], "no x-vercel-id header: not on Vercel");
  const events = (await list.json()) as { id: string }[];
  expect(events.length, "at least one event to open").toBeGreaterThan(0);

  const res = await request.get(`/events/${events[0].id}/`);
  expect(res.ok()).toBe(true);
  expect(res.headers()["x-vercel-id"], "x-vercel-id names a function region").toMatch(/^[^:]+::[^:]+::/);
  expect(functionRegion(res)).toBe("bom1");
});
