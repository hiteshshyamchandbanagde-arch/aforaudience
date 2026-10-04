import type { APIRequestContext } from "@playwright/test";
import { test, expect, AFTER_WRITE } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { JAIPUR_EVENT_TITLE } from "./helpers/events";
import { useRuleViewport } from "./helpers/viewports";

/**
 * GEN-2609-007 (Mobile Redesign Phase 4b): the heart on an event card
 * saves the event; it is listed on /saved/; its heart there unsaves it
 * and it leaves the list.
 *
 * As Atul, on the Jaipur Mic Gala 100 card, at 390 and 1440. Atul's saved
 * list is put back as it started in `finally` (through the same toggle
 * the heart calls), whatever happened in between.
 */

test.use({ storageState: authFile("atul") });

type Saved = { id: string; title: string };

async function savedEvents(request: APIRequestContext): Promise<Saved[]> {
  const res = await request.get("/api/events/saved");
  expect(res.ok(), `GET /api/events/saved: HTTP ${res.status()}`).toBeTruthy();
  return res.json();
}

/** Toggles saves until Atul's saved set is `ids` again. */
async function restoreSaved(request: APIRequestContext, ids: Set<string>) {
  const now = new Set((await savedEvents(request)).map((e) => e.id));
  for (const id of [...now].filter((x) => !ids.has(x)).concat([...ids].filter((x) => !now.has(x)))) {
    await request.post(`/api/events/${id}/follow`);
  }
}

test("[GEN-2609-007] save an event with the heart, see it on /saved, unsave it there", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  const start = await savedEvents(page.request);
  const startIds = new Set(start.map((e) => e.id));
  try {
    // Start from "not saved", so the heart has something to do.
    const already = start.find((e) => e.title === JAIPUR_EVENT_TITLE);
    if (already) await page.request.post(`/api/events/${already.id}/follow`);

    await page.goto("/events");
    const card = page.getByRole("link", { name: new RegExp(JAIPUR_EVENT_TITLE, "i") }).filter({ visible: true }).first();
    // On a phone the listing may open as carousels with the full list
    // behind "See all events"; with fewer than 3 events in Atul's city it
    // is the plain list already (GEN-2609-012).
    const seeAll = page.getByRole("button", { name: /see all events/i });
    await expect(card.or(seeAll).first()).toBeVisible({ timeout: 20_000 });
    if (isMobile && (await seeAll.isVisible())) await seeAll.click();
    const heart = card.getByRole("button", { name: "Save event" });
    await expect(heart).toBeVisible({ timeout: 20_000 });
    await expect(heart).toHaveAttribute("aria-pressed", "false");
    await heart.click();
    const savedHeart = card.getByRole("button", { name: "Remove from saved" });
    await expect(savedHeart).toHaveAttribute("aria-pressed", "true", AFTER_WRITE);
    // Saving does not open the event.
    await expect(page).toHaveURL(/\/events\/?(\?.*)?$/);

    await page.goto("/saved/");
    const row = page.getByRole("link", { name: new RegExp(JAIPUR_EVENT_TITLE, "i") }).filter({ visible: true });
    await expect(row).toHaveCount(1, { timeout: 20_000 });
    const count = start.filter((e) => e.title !== JAIPUR_EVENT_TITLE).length + 1;
    await expect(page.getByText(/\d+ events? wishlisted/)).toHaveText(`${count} event${count === 1 ? "" : "s"} wishlisted`);

    await row.getByRole("button", { name: "Remove from saved" }).click();
    await expect(row).toHaveCount(0, AFTER_WRITE);
    expect((await savedEvents(page.request)).some((e) => e.title === JAIPUR_EVENT_TITLE), "unsaved on the server too").toBe(false);
  } finally {
    await restoreSaved(page.request, startIds);
    const end = new Set((await savedEvents(page.request)).map((e) => e.id));
    expect([...end].sort(), "Atul's saved list is as it started").toEqual([...startIds].sort());
  }
});
