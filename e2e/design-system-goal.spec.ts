import type { Browser, BrowserContext, Locator, Page } from "@playwright/test";
import { test, expect, AFTER_WRITE, gotoDashboard } from "./helpers/test";
import { markFirstVisitDone } from "./helpers/first-visit";
import { authFile } from "./helpers/personas";
import { FIXTURE_EVENT_ID } from "./helpers/roles";
import { ADMIN_AUTH_FILE, GOAL_TEST_VALUE, GOAL_TOKEN, readTempAdminRun } from "./helpers/temp-admin";

/**
 * The central-control goal (GEN-2609-114/118/119/121, BUG-2609-055): an
 * admin changes a design token in Admin -> Design System, saves, and with
 * no redeploy every visitor gets the new value on the next page load.
 * Until this spec, Hitesh proved it by hand (edit, check, revert).
 *
 * As the run's temp admin (helpers/temp-admin.ts; never Hitesh's account),
 * through the editor UI: --afa-selected is set to an obvious test value,
 * checked as a signed-out visitor and as Atul on /, /events/ and /venues/
 * (the custom property and the active nav item it colours), then put back
 * in `finally`. Global teardown puts it back in the DB if this could not.
 * Never a locked token, never confirmLocked.
 *
 * What a download or the browser chrome follows (GEN-2609-119, #721):
 * - manifest theme_color and the theme-color meta: --afa-fill-solid;
 *   manifest background_color: --afa-surface-page. Asserted: they equal
 *   those tokens' saved values while the edit is live (so they follow
 *   their own tokens, and the --afa-selected edit does not leak into them).
 * - share posters, the ticket PDF and emails read --afa-fill-solid,
 *   --afa-ink, --afa-cream and others, never --afa-selected. Asserted: the
 *   organiser share poster still renders (PNG) during the edit. Its colours
 *   are not read from the image, and the ticket PDF and the emails have no
 *   test-safe endpoint (a real booking or a real send), so they are not
 *   checked here.
 *
 * Also here: the Admin Settings Save buttons at 390 x 844 and 1440 x 900.
 */

const PAGES = ["/", "/events/", "/venues/"] as const;
/** The desktop nav link each page marks active (SiteNav colours it with --afa-selected). */
const ACTIVE_NAV: Partial<Record<(typeof PAGES)[number], string>> = { "/events/": "/events/", "/venues/": "/venues/" };

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

type Token = { key: string; value: string };

async function openContext(browser: Browser, storageState: string | undefined, viewport = DESKTOP, phone = false) {
  const context = await browser.newContext({
    storageState,
    viewport,
    ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : {}),
  });
  await markFirstVisitDone(context);
  return context;
}

/** Token values from the admin API, with var(--x) references followed to a concrete value. */
async function loadTokens(admin: BrowserContext) {
  const res = await admin.request.get("/api/admin/design-tokens/");
  expect(res.ok(), `GET /api/admin/design-tokens as the temp admin: HTTP ${res.status()}`).toBeTruthy();
  const { tokens } = (await res.json()) as { tokens: Token[] };
  const raw = new Map(tokens.map((t) => [t.key, t.value]));
  const resolve = (key: string, depth = 0): string => {
    const value = raw.get(key) ?? "";
    const ref = value.match(/^var\((--[a-z0-9-]+)\)$/i);
    return ref && depth < 10 ? resolve(ref[1], depth + 1) : value;
  };
  return { raw, resolve };
}

/** "#00E5FF" / "rgb(0, 229, 255)" -> "rgb(0, 229, 255)", for comparing a token with a computed colour. */
function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  return `rgb(${parseInt(n.slice(0, 2), 16)}, ${parseInt(n.slice(2, 4), 16)}, ${parseInt(n.slice(4, 6), 16)})`;
}

function tokenField(page: Page): Locator {
  // TokenField: a column whose mono caption is the raw key.
  return page.locator(`xpath=//span[normalize-space(text())="${GOAL_TOKEN}"]/parent::div`);
}

/** Sets GOAL_TOKEN in the editor and saves it, the way an admin does. */
async function saveThroughEditor(page: Page, value: string) {
  await gotoDashboard(page, "/dashboard/admin/design-system/");
  await page.locator("#token-search").fill(GOAL_TOKEN);
  const input = tokenField(page).locator('input[type="text"]');
  await expect(input).toBeVisible();
  await input.fill(value);
  await page.getByRole("button", { name: /^Save 1 change$/ }).click();
  await expect(page.getByText("Saved. Live on the next page load everywhere.")).toBeVisible(AFTER_WRITE);
  await expect(input).toHaveValue(value);
}

/** The computed --afa-selected on a page, reloading until it is `expected` (the save clears the cache; the next load re-renders). */
async function expectSelectedOn(page: Page, path: string, expected: string, who: string) {
  await expect
    .poll(
      async () => {
        await page.goto(path);
        return (await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--afa-selected"))).trim().toLowerCase();
      },
      { message: `computed --afa-selected on ${path} as ${who}`, ...AFTER_WRITE }
    )
    .toBe(expected.toLowerCase());
}

test.describe("@needs-db design system goal", () => {
  test("@needs-db an admin's token save reaches every visitor with no redeploy, then is reverted", async ({ browser }) => {
    // One editor save, six page checks under two sessions, the downloads,
    // then a second save to revert: honestly longer than 60 s on QA. Each
    // single wait still fails in 10-25 s.
    test.setTimeout(240_000);

    const run = readTempAdminRun();
    expect(run, "global-setup.ts created no temp admin (needs E2E_DATABASE_URL on the QA project)").not.toBeNull();
    const admin = await openContext(browser, ADMIN_AUTH_FILE);
    const editor = await admin.newPage();

    // 1. The value before the test.
    const before = await loadTokens(admin);
    const original = before.raw.get(GOAL_TOKEN);
    expect(original, `${GOAL_TOKEN} is a token row`).toBeTruthy();
    expect(
      original!.toUpperCase(),
      `${GOAL_TOKEN} already holds the test value: another run is editing it, or a run crashed (teardown restores it)`
    ).not.toBe(GOAL_TEST_VALUE);
    expect(original, "the value global-setup recorded for teardown").toBe(run!.originalValue);
    const originalResolved = before.resolve(GOAL_TOKEN);
    test.info().annotations.push({ type: "goal token", description: `${GOAL_TOKEN}: ${original} -> ${GOAL_TEST_VALUE} -> ${original}` });

    try {
      // 2. Change it through the editor and save.
      await test.step(`Admin -> Design System: set ${GOAL_TOKEN} to ${GOAL_TEST_VALUE} and save`, async () => {
        await saveThroughEditor(editor, GOAL_TEST_VALUE);
      });

      // 3. Everyone gets it, no redeploy.
      for (const [who, state] of [
        ["a signed-out visitor", undefined],
        ["Atul", authFile("atul")],
      ] as const) {
        await test.step(`${who}: the new value on ${PAGES.join(", ")} and on the active nav item`, async () => {
          const context = await openContext(browser, state);
          const page = await context.newPage();
          try {
            for (const path of PAGES) {
              await expectSelectedOn(page, path, GOAL_TEST_VALUE, who);
              const navHref = ACTIVE_NAV[path];
              if (navHref) {
                const link = page.locator(`.sitenav-desktop a[href="${navHref}"]`);
                await expect(link, `active nav item ${navHref} on ${path} as ${who}`).toHaveCSS("color", hexToRgb(GOAL_TEST_VALUE));
              }
            }
          } finally {
            await context.close();
          }
        });
      }

      // 4. Downloads and browser chrome follow their own tokens.
      await test.step("Manifest, theme-color and share poster follow their own tokens", async () => {
        const tokens = await loadTokens(admin);
        const theme = tokens.resolve("--afa-fill-solid").toLowerCase();
        const background = tokens.resolve("--afa-surface-page").toLowerCase();

        const guest = await openContext(browser, undefined);
        try {
          const manifestRes = await guest.request.get("/manifest.webmanifest");
          expect(manifestRes.ok(), `GET /manifest.webmanifest: HTTP ${manifestRes.status()}`).toBeTruthy();
          const manifest = (await manifestRes.json()) as { theme_color?: string; background_color?: string };
          expect(manifest.theme_color?.toLowerCase(), "manifest theme_color = --afa-fill-solid").toBe(theme);
          expect(manifest.background_color?.toLowerCase(), "manifest background_color = --afa-surface-page").toBe(background);

          const page = await guest.newPage();
          await page.goto("/");
          const meta = await page.locator('meta[name="theme-color"]').first().getAttribute("content");
          expect(meta?.toLowerCase(), "theme-color meta = --afa-fill-solid").toBe(theme);

          const poster = await guest.request.get(`/api/posters/organiser/${FIXTURE_EVENT_ID}/`);
          expect(poster.status(), "organiser share poster for the fixture event").toBe(200);
          expect(poster.headers()["content-type"]).toContain("image/png");
        } finally {
          await guest.close();
        }
      });
    } finally {
      // 5. Revert, through the editor like an admin would.
      await test.step(`Revert ${GOAL_TOKEN} to ${original}`, async () => {
        await saveThroughEditor(editor, original!);
      });
    }

    await test.step("Confirm the revert: a signed-out visitor has the original value again", async () => {
      const after = await loadTokens(admin);
      expect(after.raw.get(GOAL_TOKEN)).toBe(original);
      const context = await openContext(browser, undefined);
      try {
        await expectSelectedOn(await context.newPage(), "/events/", originalResolved, "a signed-out visitor");
      } finally {
        await context.close();
      }
    });
    await admin.close();
  });
});

/**
 * Admin Settings: every Save button is visible, not covered (the phone tab
 * bar, the chat bubble) and clickable. Real settings are never changed:
 * each Save is disabled until its field differs from the saved value, so a
 * no-op save is not possible. Instead one field (the roster lookback) is
 * changed without saving, its Save passes Playwright's click checks
 * (visible, enabled, receives the pointer) in a trial click, and the field
 * is put back.
 */
for (const [label, viewport, phone] of [
  ["390 x 844", PHONE, true],
  ["1440 x 900", DESKTOP, false],
] as const) {
  test(`@needs-db admin settings: Save buttons visible, uncovered and clickable at ${label}`, async ({ browser }) => {
    const context = await openContext(browser, ADMIN_AUTH_FILE, viewport, phone);
    const page = await context.newPage();
    try {
      await gotoDashboard(page, "/dashboard/admin/settings/");
      const saves = page.getByRole("button", { name: "Save", exact: true });
      await expect(saves.first()).toBeVisible();
      const count = await saves.count();
      expect(count, "Save buttons on Admin Settings").toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        const save = saves.nth(i);
        // Centred, where a person scrolls a button they want to press.
        // Playwright's own scroll leaves it on the bottom edge, under the
        // fixed tab bar, which says nothing about whether it can be reached.
        await save.evaluate((el) => el.scrollIntoView({ block: "center" }));
        await expect(save, `Save #${i + 1} of ${count} visible`).toBeVisible();
        expect(await isTopmostAtCentre(save), `Save #${i + 1} of ${count} is not covered at its centre`).toBe(true);
      }

      // The last one at the very bottom of the page: the spot a fixed tab
      // bar or chat bubble would cover for good.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const last = saves.last();
      await expect(last).toBeInViewport();
      expect(await isTopmostAtCentre(last), "the last Save, page scrolled to the bottom, is not covered").toBe(true);

      const lookback = page.locator("label", { hasText: /hype score lookback/i }).locator("xpath=following-sibling::div[1]");
      const field = lookback.locator('input[type="number"]');
      const save = lookback.getByRole("button", { name: "Save", exact: true });
      const saved = await field.inputValue();
      await expect(save, "Save is disabled while nothing changed").toBeDisabled();
      await field.fill(String(Number(saved || "0") + 1));
      await expect(save).toBeEnabled();
      await save.click({ trial: true });
      await field.fill(saved);
      await expect(save, "back to the saved value, nothing to save").toBeDisabled();
    } finally {
      await context.close();
    }
  });
}

/** True when the element (or its own content) is what a tap at its centre would hit. */
async function isTopmostAtCentre(locator: Locator) {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit !== null && (hit === el || el.contains(hit));
  });
}
