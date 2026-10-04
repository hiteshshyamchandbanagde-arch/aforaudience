import fs from "fs";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { PNG } from "pngjs";
import { test, expect } from "./helpers/test";
import { markFirstVisitDone } from "./helpers/first-visit";
import { authFile } from "./helpers/personas";
import { FIXTURE_EVENT_ID } from "./helpers/roles";
import { DESKTOP, PHONE } from "./helpers/viewports";

/**
 * Proof of zero visual change between two deployments (GEN-2609-107 phase
 * 2: spacing literals -> exact --afa-space-* tokens). Reusable for any
 * refactor that must not move a pixel.
 *
 * Full-page screenshots of 10 key pages at 390 and 1440 on VISUAL_BASE_URL
 * (e.g. the origin/qa deployment) and on the run's baseURL (the branch,
 * PLAYWRIGHT_BASE_URL), taken back to back against the same QA database,
 * then compared pixel by pixel. Pass: same size, and no pixel differs by
 * more than AA_TOLERANCE on any channel (smaller differences are
 * anti-aliasing). Every pair's counts go into the test's annotations and
 * the base/head/diff PNGs into its output folder.
 *
 * Only runs when VISUAL_BASE_URL is set, so it never runs in normal CI:
 *   VISUAL_BASE_URL=https://<qa> PLAYWRIGHT_BASE_URL=https://<preview> \
 *     npx playwright test e2e/visual-equivalence.spec.ts --project=chromium-desktop
 *
 * Kept steady: intro splash and nudges off (first-visit flags), CSS
 * animations, transitions and the caret off, web fonts loaded, the page
 * scrolled once to load lazy images. The chat bubble is masked: its icon
 * animates and differs between two shots of the same build (phase 1).
 *
 * Negative control: VISUAL_CONTROL_CSS is added to the head shots only
 * (e.g. `h1 { margin-left: 1px !important }`); the run must then fail.
 */

const VISUAL_BASE_URL = process.env.VISUAL_BASE_URL?.replace(/\/$/, "");
/** Largest per-channel difference still counted as anti-aliasing. */
const AA_TOLERANCE = 32;
const CONTROL_CSS = process.env.VISUAL_CONTROL_CSS;

type Shot = { path: string; who?: "omkar" | "atul" };
const PAGES: Shot[] = [
  { path: "/" },
  { path: "/events/" },
  { path: `/events/${FIXTURE_EVENT_ID}/` },
  { path: "/venues/" },
  { path: "/artists/" },
  { path: "/about/" },
  { path: "/for-artists/" },
  { path: "/register/" },
  { path: "/dashboard/organiser/", who: "omkar" },
  { path: "/tickets/", who: "atul" },
];

const STEADY_CSS = `*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }`;

/** A persona's saved session (cookies for the run's baseURL host), re-pointed at `origin`'s host. */
function sessionFor(who: Shot["who"], origin: string) {
  if (!who) return undefined;
  const state = JSON.parse(fs.readFileSync(authFile(who), "utf8")) as { cookies: { domain: string }[]; origins: unknown[] };
  const host = new URL(origin).hostname;
  return { cookies: state.cookies.map((c) => ({ ...c, domain: host })), origins: [] };
}

async function openContext(browser: Browser, origin: string, viewport: { width: number; height: number }, who: Shot["who"]) {
  const phone = viewport.width < 600;
  const context = await browser.newContext({
    baseURL: origin,
    viewport,
    storageState: sessionFor(who, origin) as never,
    ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : {}),
  });
  await markFirstVisitDone(context);
  return context;
}

async function shoot(context: BrowserContext, path: string, extraCss?: string): Promise<Buffer> {
  const page: Page = await context.newPage();
  await page.goto(path, { waitUntil: "load" });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.addStyleTag({ content: STEADY_CSS + (extraCss ?? "") });
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 100));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(500);
  return page.screenshot({ fullPage: true, animations: "disabled", caret: "hide", mask: [page.locator(".afa-support-chat-btn")] });
}

function compare(a: Buffer, b: Buffer) {
  const base = PNG.sync.read(a);
  const head = PNG.sync.read(b);
  if (base.width !== head.width || base.height !== head.height) {
    return { sameSize: false, size: `${base.width}x${base.height} vs ${head.width}x${head.height}`, changed: -1, real: -1, diff: null as Buffer | null };
  }
  const diff = new PNG({ width: base.width, height: base.height });
  let changed = 0;
  let real = 0;
  for (let i = 0; i < base.data.length; i += 4) {
    const d = Math.max(
      Math.abs(base.data[i] - head.data[i]),
      Math.abs(base.data[i + 1] - head.data[i + 1]),
      Math.abs(base.data[i + 2] - head.data[i + 2]),
      Math.abs(base.data[i + 3] - head.data[i + 3])
    );
    if (d > 0) changed++;
    if (d > AA_TOLERANCE) real++;
    // diff image: real changes red, anti-aliasing yellow, the rest a faint copy
    const [r, g, bl] = d > AA_TOLERANCE ? [255, 0, 0] : d > 0 ? [255, 200, 0] : [base.data[i] / 4, base.data[i + 1] / 4, base.data[i + 2] / 4];
    diff.data[i] = r;
    diff.data[i + 1] = g;
    diff.data[i + 2] = bl;
    diff.data[i + 3] = 255;
  }
  return { sameSize: true, size: `${base.width}x${base.height}`, changed, real, diff: PNG.sync.write(diff) };
}

test.describe("visual equivalence", () => {
  test.skip(!VISUAL_BASE_URL, "set VISUAL_BASE_URL to the deployment to compare against");

  for (const shot of PAGES) {
    test(`[GEN-2609-107] ${shot.path}${shot.who ? ` as ${shot.who}` : ""}: identical at 390 and 1440`, async ({ browser, baseURL }) => {
      test.setTimeout(180_000);
      const failures: string[] = [];
      for (const [label, viewport] of [["390", PHONE], ["1440", DESKTOP]] as const) {
        const baseCtx = await openContext(browser, VISUAL_BASE_URL!, viewport, shot.who);
        const headCtx = await openContext(browser, baseURL!, viewport, shot.who);
        try {
          const a = await shoot(baseCtx, shot.path);
          const b = await shoot(headCtx, shot.path, CONTROL_CSS);
          const name = `${label}-${shot.path.replace(/[^a-z0-9]+/gi, "_")}`;
          fs.writeFileSync(test.info().outputPath(`${name}-base.png`), a);
          fs.writeFileSync(test.info().outputPath(`${name}-head.png`), b);
          const r = compare(a, b);
          if (r.diff) fs.writeFileSync(test.info().outputPath(`${name}-diff.png`), r.diff);
          const line = r.sameSize ? `${label}: ${r.size}, ${r.changed} px differ, ${r.real} above anti-aliasing` : `${label}: size differs, ${r.size}`;
          test.info().annotations.push({ type: "visual diff", description: `${shot.path} ${line}` });
          console.log(`[visual] ${shot.path} ${line}`);
          if (!r.sameSize || r.real > 0) failures.push(line);
        } finally {
          await baseCtx.close();
          await headCtx.close();
        }
      }
      expect(failures, `${shot.path}: ${VISUAL_BASE_URL} vs ${baseURL}`).toEqual([]);
    });
  }
});
