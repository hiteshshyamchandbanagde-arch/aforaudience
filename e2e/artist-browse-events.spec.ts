import { PNG } from "pngjs";
import jsQR from "jsqr";
import { test, expect } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { useRuleViewport } from "./helpers/viewports";
import { JAIPUR_EVENT_TITLE, openArtistEventsAllCities } from "./helpers/events";
import { HRITHIK_UPCOMING_EVENT_ID } from "./helpers/upcoming-fixtures";

/**
 * BUG-2610-023: the artist's Browse Events page (/dashboard/artist/events),
 * as Hrithik at 390 and 1440.
 *   1. "Apply to Perform" has the primary fill. An explicit
 *      `background: undefined` in its style used to delete the variant's
 *      fill (Button spreads `style` last): dark text on no fill. The static
 *      sweep for that pattern is scripts/button-style-override.test.ts.
 *   2. Past events are not listed (Browse is for applying).
 *   3. The share poster has no stray blocks, and its link (QR) is on the
 *      origin it was served from, not the old aforaudience.vercel.app.
 * Nothing is written: no button is pressed.
 */

test.use({ storageState: authFile("hrithik") });

type ApiEvent = { id: string; title: string; date: string; startTime: string };

/** When an event starts, India time (Event.date's India day + startTime). */
function startsAt(e: ApiEvent): number {
  const day = new Date(new Date(e.date).getTime() + 330 * 60_000).toISOString().slice(0, 10);
  return new Date(`${day}T${e.startTime.padStart(5, "0")}:00+05:30`).getTime();
}

test("[BUG-2610-023] artist Browse Events: Apply to Perform has the primary fill; no past events listed", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  let all: ApiEvent[] = [];
  page.on("response", async (res) => {
    if (/\/api\/events\/?$/.test(new URL(res.url()).pathname) && res.ok()) all = await res.json().catch(() => all);
  });

  const card = page.locator("[data-afa-browse-event]", { has: page.locator("h3", { hasText: JAIPUR_EVENT_TITLE }) });
  const apply = card.getByRole("button", { name: "Apply to Perform" });
  await openArtistEventsAllCities(page, apply);

  // 1. The primary fill: the button's background is the --afa-fill-solid colour, its text the on-fill colour.
  const [bg, fg, fill, onFill] = await apply.evaluate((el) => {
    const probe = document.createElement("div");
    document.body.appendChild(probe);
    probe.style.background = "var(--afa-fill-solid)";
    probe.style.color = "var(--afa-on-fill-solid)";
    const p = getComputedStyle(probe);
    const out = [getComputedStyle(el).backgroundColor, getComputedStyle(el).color, p.backgroundColor, p.color];
    probe.remove();
    return out;
  });
  expect(bg, "Apply to Perform has the primary fill").toBe(fill);
  expect(bg).not.toBe("rgba(0, 0, 0, 0)");
  expect(fg, "and the on-fill text colour").toBe(onFill);
  await expect(apply).toHaveScreenshot(`artist-apply-button-${isMobile ? 390 : 1440}.png`, { animations: "disabled", mask: [page.locator(".afa-support-chat-btn")] });

  // 2. No past events: every listed title is an upcoming event, and the API's past ones are absent.
  expect(all.length, "the All Cities list came back").toBeGreaterThan(0);
  const now = Date.now();
  const past = all.filter((e) => startsAt(e) <= now);
  const upcoming = all.filter((e) => startsAt(e) > now);
  expect(past.length, "QA has past events for the page to leave out (e.g. Tuesday Night Open Mic, 6 Sep)").toBeGreaterThan(0);
  const shown = await page.locator("[data-afa-browse-event]").evaluateAll((els) => els.map((el) => el.getAttribute("data-afa-browse-event")));
  for (const e of past) expect(shown, `past event "${e.title}" (${e.date.slice(0, 10)}) is not listed`).not.toContain(e.id);
  expect([...shown].sort(), "exactly the upcoming events are listed").toEqual(upcoming.map((e) => e.id).sort());
});

test("[BUG-2610-023] artist share poster: no stray blocks; the link is this deployment's origin", async ({ page, isMobile, baseURL }) => {
  await useRuleViewport(page, isMobile);
  // Hrithik has an active performance on this upcoming fixture, so its card shows his poster.
  const poster = page.locator('main img[src^="/api/posters/artist/"]').first();
  await openArtistEventsAllCities(page, poster);
  const src = (await poster.getAttribute("src"))!;
  const res = await page.request.get(src);
  expect(res.ok(), `${src} renders`).toBe(true);
  const png = PNG.sync.read(await res.body());
  expect([png.width, png.height]).toEqual([1080, 1350]);

  // The link and QR target are on the origin the poster was served from.
  const qr = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  expect(qr, "the poster's QR decodes").not.toBeNull();
  const origin = new URL(baseURL!).origin;
  expect(qr!.data, "QR names this deployment, not aforaudience.vercel.app").toBe(`${origin}/events/${HRITHIK_UPCOMING_EVENT_ID}`);

  // The right edge beside the venue lines and above the footer, where the
  // three blocks sat (x 1015-1075, y 872-1190), is plain page background.
  const px = (x: number, y: number) => Array.from(png.data.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 3));
  const background = px(1075, 20);
  const off: string[] = [];
  for (let y = 872; y <= 1190; y += 6) {
    for (let x = 1015; x <= 1075; x += 6) {
      const p = px(x, y);
      if (p.some((v, i) => Math.abs(v - background[i]) > 3)) off.push(`(${x},${y}) rgb(${p.join(",")})`);
    }
  }
  expect(off, `poster right edge is page background rgb(${background.join(",")})`).toEqual([]);

  // A long host (a Vercel preview's, ~70 characters) used to push the QR
  // box past the 72 px right margin, over x 1015-1075 (e2e-preview on
  // b8ae472). Ask for the poster as if served from such a host: a local
  // server takes the forwarded host as given; on Vercel the preview's own
  // long host stands in for it. The QR stays inside the margin and decodes.
  const longHost = "aforaudience-git-fix-uiux-bundle-3b-hitesh-shyamchand-bangade-s-projects.vercel.app";
  const longRes = await page.request.get(src, { headers: { "x-forwarded-host": longHost } });
  expect(longRes.ok()).toBe(true);
  const longPng = PNG.sync.read(await longRes.body());
  const longQr = jsQR(new Uint8ClampedArray(longPng.data), longPng.width, longPng.height);
  expect(longQr, "the long-host poster's QR decodes").not.toBeNull();
  const qrRight = Math.max(longQr!.location.topRightCorner.x, longQr!.location.bottomRightCorner.x);
  expect(qrRight, "QR inside the poster's 72 px right margin (x <= 1008)").toBeLessThanOrEqual(1008);
  const longPx = (x: number, y: number) => Array.from(longPng.data.subarray((y * longPng.width + x) * 4, (y * longPng.width + x) * 4 + 3));
  const longOff: string[] = [];
  for (let y = 872; y <= 1300; y += 6) {
    for (let x = 1015; x <= 1075; x += 6) {
      const p = longPx(x, y);
      if (p.some((v, i) => Math.abs(v - background[i]) > 3)) longOff.push(`(${x},${y}) rgb(${p.join(",")})`);
    }
  }
  expect(longOff, "long host: the right margin is page background").toEqual([]);

  // The preview card itself (title, image, button): one baseline per width.
  await poster.evaluate((img: HTMLImageElement) => img.decode());
  const shareCard = poster.locator("xpath=..");
  await expect(shareCard).toHaveScreenshot(`artist-poster-card-${isMobile ? 390 : 1440}.png`, {
    animations: "disabled",
    // The poster prints the fixture's date, which moves forward as the clock does.
    mask: [poster, page.locator(".afa-support-chat-btn")],
  });
});
