import { test, expect } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { useRuleViewport } from "./helpers/viewports";

/**
 * BUG-2610-003 - a numbered-seat event showed "—" for its ticket tier on
 * My Tickets and for its price on the listing card. A numbered booking
 * stores no section counts (its picks are seats) and a tiered event has no
 * flat ticket price; both are now resolved when read, from the seats'
 * tiers and the event's cheapest tier. Existing rows are not rewritten.
 *
 * Jaipur Mic Gala 100 is the seeded numbered event (one tier, General
 * ₹250). At 390 and 1440. Read-only.
 */

// scripts/qa-seed.ts jaipurEventId.
const JAIPUR = "qa-jaipur-event-0001";

test.beforeEach(async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
});

test("[BUG-2610-003] the Jaipur Mic Gala 100 listing card shows its price from the tier, not '—'", async ({ page }) => {
  await page.goto(`/events/?search=${encodeURIComponent("Jaipur Mic Gala 100")}`);
  const card = page.getByRole("link").filter({ has: page.getByRole("heading", { level: 3, name: "Jaipur Mic Gala 100" }) }).first();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card).toContainText(/(from )?₹250\b/i);
  await expect(card.getByText(/^—$/)).toHaveCount(0);
});

test.describe("signed in as Atul", () => {
  test.use({ storageState: authFile("atul") });

  test("[BUG-2610-003] My Tickets: a numbered-seat booking's card shows its tier name, not '—'", async ({ page }) => {
    // Pick Atul's upcoming confirmed numbered-seat booking from the same data
    // My Tickets draws from, and its seats' tiers from the booking itself.
    const mine = await page.request.get("/api/bookings/my");
    expect(mine.ok(), `GET /api/bookings/my: HTTP ${mine.status()}`).toBeTruthy();
    type Mine = { id: string; status: string; ticketCode: string | null; seatLabels?: string[]; event: { id: string; date: string } };
    const bookings = (await mine.json()) as Mine[];
    const numbered = bookings.filter(
      (b) => b.status === "CONFIRMED" && b.ticketCode && (b.seatLabels?.length ?? 0) > 0 && new Date(b.event.date) > new Date(),
    );
    const booking = numbered.find((b) => b.event.id === JAIPUR) ?? numbered[0];
    expect(booking, "Atul has an upcoming confirmed numbered-seat booking on QA").toBeTruthy();
    const detail = await page.request.get(`/api/bookings/${booking.id}`);
    const { booking: full } = (await detail.json()) as { booking: { numberedSeats: { tierLabel: string }[] } };
    const tiers = [...new Set(full.numberedSeats.map((s) => s.tierLabel))];
    expect(tiers.length, "the booking's seats have tiers").toBeGreaterThan(0);

    await page.goto("/tickets/");
    // The ticket stub row (Tier / Qty / Ref) holding this booking's code.
    const stub = page
      .locator(`div:has(> div > p:text-is("Tier")):has(> div > p:text-is("${booking.ticketCode}"))`)
      .filter({ visible: true })
      .first();
    await expect(stub).toBeVisible({ timeout: 20_000 });
    const tierValue = stub.locator("> div").first().locator("p").nth(1);
    await expect(tierValue).toHaveText(tiers.join(", "));
  });
});
