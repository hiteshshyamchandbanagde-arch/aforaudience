import type { Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { PHONE } from "./helpers/viewports";

/**
 * GEN-2609-012 - Discover on a phone browses in carousel rows (Tonight,
 * This Weekend, one per event type), with a guardrail: a row with fewer
 * than 3 events does not render, so a city with little on never shows
 * sparse carousels; if every row is sparse, the plain list shows instead.
 *
 * Phone only (the carousels are phone-only), at 390 x 844, signed out.
 * Two checks:
 * - QA as it is: every carousel on /events/ holds at least 3 events.
 * - A controlled set, made in the browser from one real event: 3 Open
 *   Mic, 2 Poetry, 1 Theater, a month out (so not Tonight or This
 *   Weekend). Only the Open Mic row renders; then with 2 events in all,
 *   no carousel renders and the events are listed instead.
 * Read-only.
 */

test.use({ viewport: PHONE });

const MIN_ROW = 3;

/** Every carousel on the page: its heading and how many events it holds. */
async function carousels(page: Page) {
  return page.locator(".afa-discover-carousel-track").evaluateAll((tracks) =>
    tracks
      .filter((t) => (t as HTMLElement).offsetParent !== null)
      .map((t) => ({ title: (t.previousElementSibling as HTMLElement | null)?.innerText.trim() ?? "", count: t.children.length }))
  );
}

/** Serves /api/events as `types.length` copies of one real upcoming event, with these types, 30 days out. */
async function serveTypes(page: Page, types: string[]) {
  await page.route(
    (url) => /^\/api\/events\/?$/.test(url.pathname),
    async (route) => {
      const res = await route.fetch();
      const real = (await res.json()) as { id: string; title: string; date: string; type: string }[];
      const template = real.find((e) => new Date(e.date).getTime() > Date.now() + 24 * 60 * 60 * 1000);
      expect(template, "QA has an upcoming event to copy").toBeTruthy();
      const date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      // Midweek, so it can never fall in This Weekend's range.
      while (date.getDay() === 0 || date.getDay() === 5 || date.getDay() === 6) date.setDate(date.getDate() + 1);
      const events = types.map((type, i) => ({ ...template, id: `${template!.id}-e2e-${i}`, title: `E2E carousel ${type} ${i}`, type, date: date.toISOString() }));
      await route.fulfill({ response: res, json: events });
    }
  );
}

test("[GEN-2609-012] Discover: every carousel on QA holds at least 3 events", async ({ page }) => {
  await page.goto("/events/");
  await expect(page.getByRole("link").filter({ has: page.getByRole("heading", { level: 3 }) }).first()).toBeVisible();
  const rows = await carousels(page);
  test.info().annotations.push({ type: "carousels", description: rows.map((r) => `${r.title}: ${r.count}`).join("; ") || "none (list shown)" });
  for (const row of rows) expect(row.count, `"${row.title}" carousel`).toBeGreaterThanOrEqual(MIN_ROW);
});

test("[GEN-2609-012] Discover: a row under 3 events is not drawn; all-sparse falls back to the list", async ({ page }) => {
  await serveTypes(page, ["OPEN_MIC", "OPEN_MIC", "OPEN_MIC", "POETRY", "POETRY", "THEATER"]);
  await page.goto("/events/");
  await expect(page.locator(".afa-discover-carousel-track").first()).toBeVisible();
  expect(await carousels(page)).toEqual([{ title: "Open Mic", count: 3 }]);

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await serveTypes(page, ["OPEN_MIC", "POETRY"]);
  await page.goto("/events/");
  const cards = page.getByRole("link").filter({ has: page.getByRole("heading", { level: 3, name: /E2E carousel/ }) });
  await expect(cards).toHaveCount(2);
  expect(await carousels(page), "no carousel when every row is sparse").toEqual([]);
});
