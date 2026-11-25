import { test, expect } from "./helpers/test";
import { contrastOf } from "./helpers/contrast";
import { useRuleViewport } from "./helpers/viewports";

/**
 * GEN-2609-115: the form-submit button (Button variant "form-submit") on
 * the two auth pages a visitor sees first. It was the last pair failing
 * AA in the editor's contrast panel. Its text is --afa-on-fill-solid on
 * --afa-fill-solid since GEN-2609-115 (was --afa-cream, 2.81:1). At 390
 * and 1440, signed out. Read-only: nothing is submitted.
 */
for (const [path, name] of [
  ["/login/", "Sign In"],
  ["/register/", "Create Account"],
] as const) {
  test(`[GEN-2609-115] ${path}: the '${name}' submit button's text has contrast of at least 4.5:1`, async ({ page, isMobile }) => {
    await useRuleViewport(page, isMobile);
    await page.goto(path);
    const submit = page.getByRole("button", { name, exact: true }).filter({ visible: true }).first();
    await expect(submit).toBeVisible();
    const ratio = await contrastOf(submit);
    test.info().annotations.push({ type: "contrast", description: `${path} ${name}: ${ratio}:1` });
    expect(ratio, `${name} text contrast`).toBeGreaterThanOrEqual(4.5);
  });
}
