import { test, expect } from "./helpers/test";

/**
 * Prod nit (27 Nov): with `trailingSlash: true`, every client
 * fetch("/api/...") (no slash; ~275 call-sites) took a 308 hop to
 * "/api/.../" first. next.config.ts now sets skipTrailingSlashRedirect and
 * puts the slash redirect back for pages only (redirects(), api/ and _next/
 * excluded). Page URLs keep their canonical slash form (SEO unchanged).
 *
 * Plain HTTP with redirects NOT followed, so a 308 is seen as a 308.
 * Read-only GETs, signed out.
 */

const NO_FOLLOW = { maxRedirects: 0 } as const;

test("[prod-nit 2711] /api/auth/sms-otp answers 200 with or without the slash, no redirect", async ({ request }) => {
  for (const path of ["/api/auth/sms-otp", "/api/auth/sms-otp/"]) {
    const res = await request.get(path, NO_FOLLOW);
    expect(res.status(), `${path} must not redirect`).toBe(200);
    expect(res.headers()["location"], `${path} has no Location header`).toBeUndefined();
    expect(typeof (await res.json()).enabled, `${path} returns the flag`).toBe("boolean");
  }
});

test("[prod-nit 2711] page URLs still 308 to the slash form; files keep no slash", async ({ request }) => {
  const events = await request.get("/events", NO_FOLLOW);
  expect(events.status(), "/events redirects").toBe(308);
  expect(new URL(events.headers()["location"] ?? "", "http://x").pathname).toBe("/events/");

  const nested = await request.get("/events/some-slug", NO_FOLLOW);
  expect(nested.status(), "nested page redirects").toBe(308);
  expect(new URL(nested.headers()["location"] ?? "", "http://x").pathname).toBe("/events/some-slug/");

  // Query strings survive the redirect.
  const withQuery = await request.get("/register?role=artist", NO_FOLLOW);
  expect(withQuery.status()).toBe(308);
  const loc = new URL(withQuery.headers()["location"] ?? "", "http://x");
  expect(loc.pathname + loc.search).toBe("/register/?role=artist");

  const slashed = await request.get("/events/", NO_FOLLOW);
  expect(slashed.status(), "/events/ is served directly").toBe(200);

  const file = await request.get("/favicon-32x32.png/", NO_FOLLOW);
  expect(file.status(), "a file URL with a slash redirects to the bare file").toBe(308);
  expect(new URL(file.headers()["location"] ?? "", "http://x").pathname).toBe("/favicon-32x32.png");
});
