import type { APIRequestContext, Page } from "@playwright/test";
import { test, expect, AFTER_WRITE, gotoDashboard } from "./helpers/test";
import { authFile } from "./helpers/personas";

/**
 * FEAT-2608-047: an artist lists where else they perform (city, country,
 * optional date and link) in the profile editor's Tour section, and the
 * stops are shown on their public profile under "Tour".
 *
 * As Hrithik (Pune, India), at 1440: a stop in another country is added
 * and saved through the editor, then seen on /artists/<his id>; then
 * removed and saved again, and gone from the public page.
 *
 * The public profile is cached for 30 s by design (artists/[id]/page.tsx
 * `revalidate = 30`), so each public check reloads until the page shows
 * the change: up to 75 s, the cache window twice plus a regeneration.
 *
 * A run cancelled mid-test leaves its Lisbon stop behind (5 Oct: the next
 * run failed on "Hrithik has no Lisbon stop to begin with"). So the test
 * first removes any Lisbon stop of his, keeping his other stops, through
 * the same route; "as it started" below means after that clean-up.
 *
 * His profile ends exactly as it started: `finally` compares every field
 * the editor writes with the values read before the test and, if any
 * differ (the editor's Save also writes empty social links where he has
 * none), PATCHes the original values back through /api/artists/me, the
 * same route the editor saves through. Desktop only (playwright.config.ts):
 * one pass of saves to a shared persona is enough.
 */

test.use({ storageState: authFile("hrithik") });

// scripts/qa-seed.ts: Hrithik's Artist row.
const HRITHIK = "qa-demo-artist-full-role";
const STOP = { city: "Lisbon", country: "Portugal", date: "2026-12-12" };
/** Long enough for the 30 s public-page cache to turn over twice. */
const PUBLIC_CACHE = { timeout: 75_000 };

const FIELDS = ["bio", "genre", "styleTag", "socialLinks", "tagline", "fullBiography", "journey", "influences", "acknowledgments", "goals"] as const;

type TourStop = { city: string; country: string; date: string | null; link: string | null };

/** The editor-writable part of Hrithik's profile, tour stops without their ids. */
async function profile(request: APIRequestContext) {
  const res = await request.get("/api/artists/me");
  expect(res.ok(), `GET /api/artists/me: HTTP ${res.status()}`).toBeTruthy();
  const data = await res.json();
  const out: Record<string, unknown> = {};
  for (const f of FIELDS) out[f] = data[f] ?? null;
  out.tourStops = (data.tourStops as TourStop[]).map((t) => ({ city: t.city, country: t.country, date: t.date, link: t.link }));
  return out;
}

/** Removes any STOP.city stop an earlier, cancelled run left on his profile; his other stops are kept. Returns how many it removed. */
async function clearLeftoverStops(request: APIRequestContext) {
  const res = await request.get("/api/artists/me");
  expect(res.ok(), `GET /api/artists/me: HTTP ${res.status()}`).toBeTruthy();
  const stops = (await res.json()).tourStops as TourStop[];
  const keep = stops.filter((t) => t.city !== STOP.city).map((t) => ({ city: t.city, country: t.country, date: t.date, link: t.link }));
  if (keep.length === stops.length) return 0;
  // tourStops alone: the route replaces the whole list and leaves every other field as it is.
  const patch = await request.patch("/api/artists/me", { data: { tourStops: keep } });
  expect(patch.ok(), `removing a leftover ${STOP.city} stop: HTTP ${patch.status()}`).toBeTruthy();
  return stops.length - keep.length;
}

async function saveProfile(page: Page) {
  await page.getByRole("button", { name: "Save Profile" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible(AFTER_WRITE);
}

/** Hrithik's public Tour list, reloading past the page cache until it does (or does not) show the stop. */
async function expectPublicStop(page: Page, shown: boolean) {
  const label = `${STOP.city}, ${STOP.country}`;
  await expect
    .poll(
      async () => {
        await page.goto(`/artists/${HRITHIK}/`);
        const tour = page.locator("h3", { hasText: /^Tour$/ }).locator("xpath=..");
        return (await tour.count()) > 0 && (await tour.getByText(label, { exact: true }).count()) > 0;
      },
      { message: `"${label}" ${shown ? "shown" : "gone"} under Tour on the public profile`, ...PUBLIC_CACHE }
    )
    .toBe(shown);
}

test("[FEAT-2608-047] a tour stop in another country, saved in the editor, is shown on the public profile; removed again", async ({ page }) => {
  // Two saves, each followed by a public page that may be 30 s stale:
  // honestly longer than 60 s. Each single wait still fails in 25-75 s.
  test.setTimeout(240_000);
  const leftover = await clearLeftoverStops(page.request);
  if (leftover > 0) test.info().annotations.push({ type: "clean-up", description: `removed ${leftover} leftover ${STOP.city} stop(s) from an earlier run` });
  const start = await profile(page.request);
  expect(start.tourStops, "Hrithik has no Lisbon stop to begin with").not.toContainEqual(expect.objectContaining({ city: STOP.city }));

  try {
    await test.step("Editor: add Lisbon, Portugal and save", async () => {
      await gotoDashboard(page, "/dashboard/artist/edit/");
      const tour = page.locator("div").filter({ has: page.locator("label", { hasText: /^Tour$/ }) }).last();
      const before = await tour.getByRole("button", { name: "Remove tour stop" }).count();
      await tour.getByRole("button", { name: "+ Add tour stop" }).click();
      const row = tour.getByRole("button", { name: "Remove tour stop" }).nth(before).locator("xpath=..");
      await row.getByPlaceholder("City").fill(STOP.city);
      await row.getByPlaceholder("Country").fill(STOP.country);
      await row.locator('input[type="date"]').fill(STOP.date);
      await saveProfile(page);
      const saved = (await profile(page.request)).tourStops as TourStop[];
      expect(saved.map((t) => `${t.city}, ${t.country}`)).toContain(`${STOP.city}, ${STOP.country}`);
    });

    await test.step("Public profile: the stop is shown under Tour, with its date", async () => {
      await expectPublicStop(page, true);
      const card = page.locator("h3", { hasText: /^Tour$/ }).locator("xpath=..").getByText(`${STOP.city}, ${STOP.country}`, { exact: true }).locator("xpath=..");
      await expect(card).toBeVisible();
      await expect(card).toContainText(/12 Dec 2026/);
    });

    await test.step("Editor: remove the stop and save", async () => {
      await gotoDashboard(page, "/dashboard/artist/edit/");
      const tour = page.locator("div").filter({ has: page.locator("label", { hasText: /^Tour$/ }) }).last();
      const row = tour.locator("div").filter({ has: page.getByRole("button", { name: "Remove tour stop" }) }).filter({
        has: page.locator(`input[placeholder="City"][value="${STOP.city}"]`),
      });
      await expect(row).toHaveCount(1);
      await row.getByRole("button", { name: "Remove tour stop" }).click();
      await expect(row).toHaveCount(0);
      await saveProfile(page);
    });

    await test.step("Public profile: the stop is gone", async () => {
      await expectPublicStop(page, false);
    });
  } finally {
    const now = await profile(page.request);
    if (JSON.stringify(now) !== JSON.stringify(start)) {
      const res = await page.request.patch("/api/artists/me", { data: start });
      expect(res.ok(), `restoring Hrithik's profile: HTTP ${res.status()}`).toBeTruthy();
    }
    expect(await profile(page.request), "Hrithik's profile is as it started").toEqual(start);
  }
});
