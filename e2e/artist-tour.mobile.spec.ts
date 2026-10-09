import { test, expect, gotoDashboard } from "./helpers/test";
import { authFile } from "./helpers/personas";
import { PHONE } from "./helpers/viewports";

/**
 * BUG-2608-049 - the Tour section of the artist profile editor was a
 * fixed 5-column grid (City / Country / Date / Link / Remove), so on a
 * phone every field was squeezed into one row and clipped ("Coun", "Li").
 * Fixed in #440 with an auto-fit grid that wraps to two columns.
 *
 * As Hrithik at 390 x 844: a tour stop row is added (in the page only,
 * never saved), and every field in it must sit inside the screen, be
 * at least as wide as its placeholder text, and take typing. Leaving the
 * page discards the row; Hrithik's profile is not changed.
 */

test.use({ storageState: authFile("hrithik"), viewport: PHONE });

test("[BUG-2608-049] artist edit, Tour at 390: no field narrower than its content, inputs usable", async ({ page }) => {
  await gotoDashboard(page, "/dashboard/artist/edit/");
  // data-afa-* hooks, not English labels: the editor follows the UI language (GEN-2610-007).
  const tour = page.locator("[data-afa-tour]");
  const before = await tour.locator("[data-afa-tour-stop]").count();
  await tour.locator("[data-afa-tour-add]").click();
  const row = tour.locator("[data-afa-tour-stop]").nth(before);
  const remove = row.locator("[data-afa-tour-remove]");
  await expect(remove).toBeVisible();

  const fields = await row.locator("input, button").evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const text = el instanceof HTMLInputElement ? el.placeholder : (el as HTMLElement).innerText;
      const ctx = document.createElement("canvas").getContext("2d")!;
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const inner = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
      return {
        name: text || (el as HTMLInputElement).type,
        left: r.left,
        right: r.right,
        inner,
        needs: text ? ctx.measureText(text).width : 0,
        overflow: el.scrollWidth > el.clientWidth + 1,
      };
    })
  );
  expect(fields.length, "City, Country, Date, Link and Remove").toBe(5);
  for (const f of fields) {
    expect(f.left, `"${f.name}" starts on screen`).toBeGreaterThanOrEqual(0);
    expect(f.right, `"${f.name}" ends on screen`).toBeLessThanOrEqual(PHONE.width);
    expect(f.inner, `"${f.name}" is as wide as its text`).toBeGreaterThanOrEqual(f.needs);
    expect(f.overflow, `"${f.name}" does not clip its content`).toBe(false);
  }

  const city = row.locator("[data-afa-tour-city]");
  await city.fill("Thiruvananthapuram");
  await expect(city).toHaveValue("Thiruvananthapuram");
  await row.locator("[data-afa-tour-country]").fill("India");
  await expect(row.locator("[data-afa-tour-country]")).toHaveValue("India");
  await row.locator('input[type="date"]').fill("2026-12-31");
  await expect(row.locator('input[type="date"]')).toHaveValue("2026-12-31");

  // Put the page back as it was; nothing was saved.
  await remove.click();
  await expect(tour.locator("[data-afa-tour-stop]")).toHaveCount(before);
});
