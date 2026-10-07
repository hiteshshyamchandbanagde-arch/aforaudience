import { test, expect } from "./helpers/test";
import { useRuleViewport } from "./helpers/viewports";

/**
 * BUG-2608-040 - on /venues in Hindi the first cards said "813 सीटें" but
 * cards further down the same list said "731 seats". Every card's seat
 * count goes through the one lookup (tr.venuesPage.seatsLabel in
 * VenuesGridClient); this scrolls the whole list in Hindi, past the first
 * screenful, and requires every seat count to be Hindi.
 *
 * Guest; nothing is written. The locale is the saved one (localStorage
 * "afa-locale"), as a returning Hindi visitor has it. At 390 and 1440.
 */

test.beforeEach(async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
});

test("[BUG-2608-040] /venues in Hindi: every card's seat count says सीटें, including cards far down the list", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("afa-locale", "hi"));
  await page.goto("/venues/");
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");

  const seatCounts = page.locator("span").filter({ hasText: /^\s*\d[\d,]*\s+(seats|सीटें)\s*$/i });
  await expect(seatCounts.first()).toBeVisible({ timeout: 20_000 });

  // Scroll to the end, a screen at a time, until no more cards appear.
  let previous = -1;
  for (let i = 0; i < 60; i++) {
    const count = await seatCounts.count();
    const atBottom = await page.evaluate(() => window.innerHeight + window.scrollY >= document.body.scrollHeight - 4);
    if (atBottom && count === previous) break;
    previous = count;
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(150);
  }

  const texts = (await seatCounts.allInnerTexts()).map((t) => t.trim());
  test.info().annotations.push({ type: "venue cards", description: String(texts.length) });
  expect(texts.length, "the list runs past the first screenful").toBeGreaterThan(6);
  const english = texts.filter((t) => /seats/i.test(t));
  expect(english, `cards still in English: ${english.slice(0, 5).join(", ")}`).toEqual([]);
  // The last card on the page is Hindi too.
  await seatCounts.last().scrollIntoViewIfNeeded();
  await expect(seatCounts.last()).toHaveText(/सीटें/);
});
