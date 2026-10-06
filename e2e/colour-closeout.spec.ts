import type { Locator, Page } from "@playwright/test";
import { test, expect, gotoDashboard } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { contrastOf, tokenColour } from "./helpers/contrast";
import { useRuleViewport } from "./helpers/viewports";
import { openArtistEventsAllCities } from "./helpers/events";

/**
 * The colour closeout's text rules, read off real QA pages at 390 and 1440.
 *
 * GEN-2609-113: status text on its own tint uses the colour that passes
 * AA there: gold (pending, draft) is --afa-amber on --afa-amber-tint (it
 * was --afa-gold, 2.55:1); error is --afa-error-bright on --afa-error-tint
 * (plain --afa-error is about 2.5:1). The ticket itself is a literal-to-
 * token sweep, which the design-token ratchet guards; this checks what a
 * person reads. Five places: three as QA's seed has them, two where the
 * page's own API answer is given another status in the browser (nothing
 * is saved). The gold PENDING special-notes badge is in contrast.spec.ts.
 *
 * GEN-2609-114: sage text on the dark surface is --afa-sage-bright, not
 * --afa-sage (about 2:1 on dark): the profile's "Visit your Organiser
 * dashboard" line and the outline-success "Message Organiser" button,
 * two of the sites the ticket moved.
 *
 * Every colour is compared with the token's computed value on the same
 * page, so an admin edit in Design System never breaks this; the 4.5:1
 * is measured with every see-through layer behind the text composited in.
 */

test.beforeEach(async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
});

/** The first background painted behind the element (itself or an ancestor). */
async function backgroundBehind(el: Locator) {
  return el.evaluate((node) => {
    for (let n: Element | null = node; n; n = n.parentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      if (bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return bg;
    }
    return null;
  });
}

/** The text is `fg`, sits on `tint` (if given), and reads at 4.5:1 or better. */
async function expectToneText(page: Page, el: Locator, fg: string, tint: string | null, where: string) {
  await expect(el, where).toBeVisible();
  await expect(el, `${where}: text is ${fg}`).toHaveCSS("color", await tokenColour(page, fg));
  if (tint) expect(await backgroundBehind(el), `${where}: on ${tint}`).toBe(await tokenColour(page, tint));
  const ratio = await contrastOf(el);
  test.info().annotations.push({ type: "contrast", description: `${where}: ${ratio}:1` });
  expect(ratio, `${where}: text contrast`).toBeGreaterThanOrEqual(4.5);
}

const GOLD = ["--afa-amber", "--afa-amber-tint"] as const;
const ERROR = ["--afa-error-bright", "--afa-error-tint"] as const;

test.describe("Omkar", () => {
  test.use({ storageState: authFile("omkar") });

  test("[GEN-2609-113] organiser dashboard: the Draft badge is amber on its tint, at least 4.5:1", async ({ page }) => {
    await gotoDashboard(page, "/dashboard/organiser/");
    const draft = page.locator("main").getByText("Draft", { exact: true }).filter({ visible: true }).first();
    await expectToneText(page, draft, ...GOLD, "Draft badge");
  });

  test("[GEN-2609-114] profile: 'Visit your Organiser dashboard' is --afa-sage-bright, at least 4.5:1", async ({ page }) => {
    await page.goto("/profile/");
    const line = page.getByText(/Visit your Organiser dashboard/).filter({ visible: true }).first();
    await expect(line).toBeVisible({ timeout: 20_000 });
    await expectToneText(page, line, "--afa-sage-bright", null, "Organiser dashboard link");
    expect(await tokenColour(page, "--afa-sage-bright")).not.toBe(await tokenColour(page, "--afa-sage"));
  });
});

test.describe("Hrithik", () => {
  test.use({ storageState: authFile("hrithik") });

  test("[GEN-2609-113] artist dashboard: a pending application's badge is amber on its tint, at least 4.5:1", async ({ page }) => {
    await gotoDashboard(page, "/dashboard/artist/");
    const pending = page.locator("main").getByText("pending", { exact: true }).filter({ visible: true }).first();
    await expectToneText(page, pending, ...GOLD, "pending application badge");
  });

  test("[GEN-2609-113] artist dashboard: a rejected application's badge is --afa-error-bright on its tint, at least 4.5:1", async ({ page }) => {
    // Hrithik has no rejected application in the seed: his pending one is
    // shown as rejected, in this browser only.
    await page.route(/\/api\/artists\/me\/?$/, async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const res = await route.fetch();
      const body = await res.json();
      const app = body.applications.find((a: { status: string }) => a.status === "PENDING") ?? body.applications[0];
      expect(app, "Hrithik has an application in the QA seed").toBeTruthy();
      app.status = "REJECTED";
      await route.fulfill({ response: res, json: body });
    });
    await gotoDashboard(page, "/dashboard/artist/");
    const rejected = page.locator("main").getByText("rejected", { exact: true }).filter({ visible: true }).first();
    await expectToneText(page, rejected, ...ERROR, "rejected application badge");
  });

  test("[GEN-2609-113] artist events: 'Buy-in required' is --afa-error-bright on its tint, at least 4.5:1", async ({ page }) => {
    // The buy-in event is in Bengaluru and Hrithik's city is Ballari: the
    // page narrows to his city once it has loaded, so show every city.
    const buyIn = page.getByText(/^Buy-in required: ₹/).filter({ visible: true }).first();
    await openArtistEventsAllCities(page, buyIn);
    await expectToneText(page, buyIn, ...ERROR, "Buy-in required note");
  });
});

test.describe("Atul", () => {
  test.use({ storageState: authFile("atul") });

  test("[GEN-2609-113] My Tickets: a reserved (pending) ticket's badge is amber on its tint, at least 4.5:1", async ({ page }) => {
    // Atul's pending bookings have all expired (they show as Expired).
    // One is served unexpired to this page only; nothing is written.
    await page.route(/\/api\/bookings\/my\/?$/, async (route) => {
      const res = await route.fetch();
      const bookings = await res.json();
      const pending = bookings.find((b: { status: string }) => b.status === "PENDING");
      expect(pending, "Atul has a pending booking in QA").toBeTruthy();
      pending.expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
      await route.fulfill({ response: res, json: bookings });
    });
    await page.goto("/tickets/");
    const badge = page.getByText("Reserved — pay to confirm", { exact: true }).filter({ visible: true }).first();
    await expect(badge).toBeVisible({ timeout: 20_000 });
    await expectToneText(page, badge, ...GOLD, "Reserved badge");
  });
});

test.describe("Vinayak", () => {
  test.use({ storageState: authFile("vinayak") });

  test("[GEN-2609-114] venue bookings: the outline 'Message Organiser' button's text is --afa-sage-bright, at least 4.5:1", async ({ page }) => {
    await gotoDashboard(page, "/dashboard/venue/bookings/");
    const message = page.getByRole("button", { name: /Message Organiser/ }).filter({ visible: true }).first();
    await expect(message, "Vinayak has a venue booking in the QA seed").toBeVisible();
    await expectToneText(page, message, "--afa-sage-bright", null, "Message Organiser button");
  });
});
