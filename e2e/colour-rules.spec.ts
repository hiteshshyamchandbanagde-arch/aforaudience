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
