import { test, expect } from "./helpers/test";
import { useRuleViewport } from "./helpers/viewports";

/**
 * Nightly 14 Nov (run 43591452734) - launch-waves-ui.spec.ts saw two
 * register forms in the DOM at once (a Hindi one and an English one).
 *
 * Why: the server renders /register in English; a saved language is
 * applied on the client, and React re-renders the form. For a moment
 * (~20 ms measured on QA's build) the server's English form is still in
 * the DOM, hidden, next to the new one. This spec is the product check
 * behind the test-side wait there: while the page loads in Hindi, a
 * person never sees more than one form, and it ends as one Hindi form.
 *
 * Signed out, the language lives in this test's own localStorage only.
 */

const SIGNED_OUT = { storageState: { cookies: [], origins: [] } };
const HI_PLACEHOLDER = "आपका पूरा नाम";

test.use(SIGNED_OUT);

test("[S1b-b1] /register in hi: never two visible forms while the language is applied; ends with one Hindi form", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);
  const hint = await page.request.get("/api/platform-settings/launch-waves/");
  expect(hint.status()).toBe(200);
  await page.addInitScript(() => window.localStorage.setItem("afa-locale", "hi"));

  if ((await hint.json()).W1 !== true) {
    // QA has W1 off for a human check: no form, the closed state instead.
    await page.goto("/register/");
    await expect(page.locator("[data-afa-signups-soon]")).toBeVisible();
    return;
  }

  await page.goto("/register/", { waitUntil: "commit" });
  // Sample every frame until the Hindi form is the only one left: never
  // more than one *visible* name field at any moment.
  const most = await page.evaluate(
    (hiPlaceholder) =>
      new Promise<number>((resolve) => {
        let maxVisible = 0;
        const started = performance.now();
        const tick = () => {
          const fields = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="fullName"]'));
          const visible = fields.filter((f) => f.offsetParent !== null && f.getClientRects().length > 0);
          maxVisible = Math.max(maxVisible, visible.length);
          const settled = fields.length === 1 && fields[0].placeholder === hiPlaceholder;
          if (settled || performance.now() - started > 15_000) resolve(maxVisible);
          else requestAnimationFrame(tick);
        };
        tick();
      }),
    HI_PLACEHOLDER
  );
  expect(most, "visible register forms at one moment").toBeLessThanOrEqual(1);

  const fullName = page.locator('input[name="fullName"]');
  await expect(fullName).toHaveCount(1);
  await expect(fullName).toHaveAttribute("placeholder", HI_PLACEHOLDER);
  await expect(fullName).toBeVisible();
});
