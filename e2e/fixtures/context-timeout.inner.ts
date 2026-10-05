import { test as base } from "@playwright/test";
import { test } from "../helpers/test";

/**
 * Run only by context-timeout.spec.ts (fixtures/context-timeout.config.ts).
 * Both tests time out on purpose, inside an action that never finishes (a
 * click on a button the page does not have), the way a goal-spec step
 * times out on a slow QA.
 */
const TIMEOUT = 2_000;
const STUCK = { timeout: 30_000 };

base("finally close", async ({ browser }) => {
  base.setTimeout(TIMEOUT);
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.setContent("<p>no button here</p>");
    await page.locator("button").click(STUCK);
  } finally {
    await context.close();
  }
});

test("newContext fixture", async ({ newContext }) => {
  test.setTimeout(TIMEOUT);
  const context = await newContext();
  const page = await context.newPage();
  await page.setContent("<p>no button here</p>");
  await page.locator("button").click(STUCK);
  await context.close();
});
