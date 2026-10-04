import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { useRuleViewport } from "./helpers/viewports";

/**
 * The colour rules (GEN-2609-118, decided 4 Oct): orange (--afa-fill-solid)
 * is only ever an action you tap; a selected state is amber
 * (--afa-selected); informational marks are amber too.
 *
 * Every check compares computed colours with the computed value of the
 * token itself (read through a probe element on the same page), so an
 * admin edit to a token in Design System never breaks these. At 390 and
 * 1440. Read-only: nothing is written.
 */

/** The computed rgb() of a colour token on the current page. */
async function tokenColour(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement("div");
    probe.style.color = `var(${name})`;
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, token);
}

/** Visible elements (inside `root`) whose own background or text colour is `colour`, described for messages. */
async function elementsPainted(root: Locator, colour: string): Promise<string[]> {
  return root.evaluate((el, target) => {
    const out: string[] = [];
    for (const node of [el, ...Array.from(el.querySelectorAll("*"))]) {
      const r = (node as HTMLElement).getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(node);
      if (cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
      const bg = cs.backgroundColor === target;
      // Text colour only counts where the element itself holds text.
      const ownText = Array.from(node.childNodes).some((c) => c.nodeType === Node.TEXT_NODE && c.textContent?.trim());
      const fg = ownText && cs.color === target;
      if (bg || fg) out.push(`${bg ? "bg" : "text"}:<${node.tagName.toLowerCase()}> "${(node.textContent || "").trim().slice(0, 40)}"`);
    }
    return out;
  }, colour);
}

test.beforeEach(async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
});

test("[BUG-2610-008] /artists: the selected genre's underline is --afa-selected (amber), not the CTA orange", async ({ page }) => {
  await page.goto("/artists/");
  // "All" is selected on arrival; its underline is the absolutely positioned 1px bar inside it.
  const selected = page.locator("button.afa-genre-filter").first();
  await expect(selected).toBeVisible();
  const underline = selected.locator("span").last();
  await expect(underline).toHaveCSS("height", "1px");
  const selectedColour = await tokenColour(page, "--afa-selected");
  const fillSolid = await tokenColour(page, "--afa-fill-solid");
  const bg = await underline.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg, `underline ${bg}; --afa-selected ${selectedColour}; --afa-fill-solid ${fillSolid}`).toBe(selectedColour);
});

test.describe("signed in as Atul", () => {
  test.use({ storageState: authFile("atul") });

  // scripts/qa-seed.ts: Atul's paid, confirmed booking for Solo Stand-up Showcase.
  const CONFIRMED_BOOKING = "qa-demo-booking-full-atul-2";

  test("[GEN-2609-118] checkout: the only orange element is the Pay button; 'See fee breakdown' is amber", async ({ page }) => {
    // Checkout needs a booking that is still pending. Atul's seeded booking is
    // served to this page as pending, in the browser only: nothing is written,
    // Razorpay's script is blocked and Pay is never pressed.
    await page.route("**/checkout.razorpay.com/**", (route) => route.abort());
    await page.route(new RegExp(`/api/bookings/${CONFIRMED_BOOKING}/?$`), async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      body.booking.status = "PENDING";
      body.booking.isExpired = false;
      body.booking.expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
      body.payment = { razorpayOrderId: "order_e2e_never_paid", amount: Math.round(body.booking.totalAmount * 100), currency: "INR", status: "CREATED", keyId: "rzp_test_e2e_never_used" };
      await route.fulfill({ response: res, json: body });
    });
    await page.goto(`/checkout/${CONFIRMED_BOOKING}/`);
    const main = page.locator("main");
    const pay = main.getByRole("button", { name: /^Pay\b/ });
    await expect(pay).toBeVisible();
    const feeLink = main.getByRole("button", { name: /See fee breakdown/ });
    await expect(feeLink).toBeVisible();

    const fillSolid = await tokenColour(page, "--afa-fill-solid");
    const amber = await tokenColour(page, "--afa-selected");
    await expect(feeLink).toHaveCSS("color", amber);
    const painted = await elementsPainted(main, fillSolid);
    expect(painted, `elements in ${fillSolid}: ${painted.join(" | ")}`).toHaveLength(1);
    expect(painted[0]).toMatch(/^bg:<(button|a)> "Pay\b/);
  });

  test("[GEN-2609-118] booking confirmed ('You're going'): the count circle is amber, not orange; only View My Ticket is orange", async ({ page }) => {
    await page.goto(`/checkout/${CONFIRMED_BOOKING}/`);
    const sheet = page.locator(".cm-mobile, .cm-modal-mount").filter({ visible: true });
    await expect(sheet.getByRole("heading", { name: /You.re going/ })).toBeVisible();
    const viewTicket = sheet.getByRole("button", { name: "View My Ticket" });
    await expect(viewTicket).toBeVisible();

    const fillSolid = await tokenColour(page, "--afa-fill-solid");
    const painted = await elementsPainted(sheet, fillSolid);
    expect(painted, `elements in ${fillSolid}: ${painted.join(" | ")}`).toHaveLength(1);
    expect(painted[0]).toMatch(/^bg:<(button|a)> "View My Ticket/);

    // The circle: 140 px round, holding only the supporter count.
    const circle = sheet.locator("div").filter({ hasText: /^\d+$/ }).last();
    await expect(circle).toHaveCSS("border-radius", "50%");
    const { text, back } = await circle.evaluate((el) => {
      // The circle's own fill composited over the first opaque surface behind it.
      const parse = (c: string) => (c.match(/[\d.]+/g) || []).map(Number);
      const over = (top: number[], under: number[]) => {
        const a = top[3] ?? 1;
        return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a));
      };
      const layers: number[][] = [];
      for (let n: Element | null = el; n; n = n.parentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c.length && (c[3] ?? 1) > 0) layers.push(c);
        if (c.length && (c[3] ?? 1) === 1) break;
      }
      let back = layers.pop() || [20, 20, 20];
      while (layers.length) back = over(layers.pop()!, back);
      const span = el.querySelector("span") || el;
      return { text: over(parse(getComputedStyle(span).color), back), back };
    });
    const lum = (c: number[]) => {
      const [r, g, b] = c.map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const [hi, lo] = [lum(text), lum(back)].sort((a, b) => b - a);
    const ratio = (hi + 0.05) / (lo + 0.05);
    expect(ratio, `count text rgb(${text}) on rgb(${back})`).toBeGreaterThanOrEqual(4.5);
  });
});
