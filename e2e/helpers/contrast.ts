import type { Locator, Page } from "@playwright/test";

/**
 * Colour helpers for the contrast and token checks. Everything is read
 * from the browser's computed styles, so an admin edit to a token in
 * Design System never breaks a check: the test compares against the
 * token's own value on the same page.
 */

/** The computed rgb()/rgba() of a colour token on the current page (as a background, so alpha survives). */
export async function tokenColour(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = `var(${name})`;
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return value;
  }, token);
}

/** WCAG contrast of the element's text against what is painted behind it. */
export async function contrastOf(el: Locator) {
  return el.evaluate((node) => {
    const parse = (c: string) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = "1"] = m[1].split(/[ ,/]+/).filter(Boolean);
      return [Number(r), Number(g), Number(b), Number(a)];
    };
    const over = (top: number[], bottom: number[]) => {
      const a = top[3];
      return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat(1);
    };
    // Backgrounds from the element up to the page; then paint them bottom-up.
    const layers: number[][] = [];
    for (let el: Element | null = node; el; el = el.parentElement) {
      const bg = parse(getComputedStyle(el).backgroundColor);
      if (bg && bg[3] > 0) layers.push(bg);
      if (bg && bg[3] === 1) break;
    }
    let base = [255, 255, 255, 1];
    for (const layer of layers.reverse()) base = over(layer, base);
    const text = over(parse(getComputedStyle(node).color)!, base);
    const lum = (c: number[]) => {
      const [r, g, b] = c.slice(0, 3).map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const [hi, lo] = [lum(text), lum(base)].sort((x, y) => y - x);
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  });
}
