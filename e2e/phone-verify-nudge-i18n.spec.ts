import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { test, expect } from "./helpers/test";
import { deleteRegisteredTestUsers } from "./helpers/cleanup";
import { withQaDb } from "./helpers/qa-db";
import { useRuleViewport } from "./helpers/viewports";

/**
 * BUG-2609-029 - the "Verify your phone" banner (PhoneVerifyNudge) was
 * hard-coded English in every language. @needs-db
 *
 * The banner shows only to a signed-in account whose phone is not
 * verified, and no QA persona is one (they are all verified, and
 * verifying is one-way). So the spec makes a throwaway unverified
 * Audience account straight in the QA database, in the
 * e2e.<digits>@example.com shape that deleteRegisteredTestUsers removes,
 * signs it in and deletes it afterwards. onboardedAt is set so the welcome
 * takeover does not hide the nudge stack.
 */

// Literals on purpose (see marathi-locale.spec.ts): hi.ts / mr.ts phoneVerifyNudge.
// BUG-2610-017 (7 Oct decision) shortened the copy to "Verify your phone to
// book" + "Verify" in all 12 locales; these literals follow it.
const EXPECTED = {
  hi: {
    ariaLabel: "अपना फ़ोन सत्यापित करें",
    message: "बुक करने के लिए अपना फ़ोन सत्यापित करें",
    verifyNow: "सत्यापित करें",
  },
  mr: {
    ariaLabel: "तुमचा फोन व्हेरिफाय करा",
    message: "बुक करण्यासाठी तुमचा फोन व्हेरिफाय करा",
    verifyNow: "व्हेरिफाय करा",
  },
} as const;

const created: string[] = [];

test.afterAll(async () => {
  await deleteRegisteredTestUsers(created);
});

async function createUnverifiedAudience() {
  const stamp = `${Date.now()}${randomBytes(2).readUInt16BE(0)}`;
  const email = `e2e.${stamp}@example.com`;
  const password = randomBytes(18).toString("base64url");
  const hash = await bcrypt.hash(password, 10);
  created.push(email);
  await withQaDb((client) =>
    client.query(
      `INSERT INTO "User" (id, name, "displayName", email, password, role, "isVerified", "onboardedAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 'AUDIENCE', false, now(), now())`,
      [`e2enudge${randomBytes(8).toString("hex")}`, `e2e_n${stamp.slice(-12)}`, "E2E Nudge", email, hash]
    )
  );
  return { email, password };
}

for (const locale of ["hi", "mr"] as const) {
  test(`[BUG-2609-029] phone-verify banner is in ${locale} @needs-db`, async ({ page, isMobile, baseURL }) => {
    await useRuleViewport(page, isMobile);
    const user = await createUnverifiedAudience();

    // Credentials sign-in through the API, as global-setup.ts does; the
    // cookie lands in this page's context.
    const csrf = (await (await page.request.get("/api/auth/csrf/")).json()) as { csrfToken: string };
    // maxRedirects 0: the answer is a redirect to the homepage, which the
    // session cookie does not need rendered.
    await page.request.post("/api/auth/callback/credentials/", {
      form: { csrfToken: csrf.csrfToken, identifier: user.email, password: user.password, callbackUrl: baseURL ?? "/", json: "true" },
      maxRedirects: 0,
    });
    const session = (await (await page.request.get("/api/auth/session/")).json()) as { user?: { email?: string } };
    expect(session?.user?.email, "the throwaway account is signed in").toBe(user.email);

    await page.addInitScript((id) => window.localStorage.setItem("afa-locale", id), locale);
    await page.goto("/events/");
    await expect(page.locator("html")).toHaveAttribute("lang", locale);

    const want = EXPECTED[locale];
    const banner = page.getByRole("status", { name: want.ariaLabel, exact: true });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(want.message);
    await expect(banner.getByRole("link", { name: want.verifyNow, exact: true })).toBeVisible();
    expect((await banner.innerText()).match(/[A-Za-z]{2,}/g) ?? [], "English left in the banner").toEqual([]);
  });
}
