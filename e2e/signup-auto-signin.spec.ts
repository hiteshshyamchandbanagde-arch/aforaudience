import bcrypt from "bcryptjs";
import { randomBytes, randomInt } from "crypto";
import type { APIRequestContext, Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { registerTestAudience } from "./helpers/auth";
import { deleteRegisteredTestUsers } from "./helpers/cleanup";
import { withQaDb } from "./helpers/qa-db";
import { useRuleViewport } from "./helpers/viewports";

/**
 * Run C (Hitesh phone pass, 13-14 Oct):
 *   item 2 - a successful sign-up leaves the person signed in (the sign-up
 *            code already proves the phone), no second code at /login;
 *   item 3 - onboarding skips "Verify your phone" for a verified phone,
 *            and still shows it to an unverified account.
 * Plus the negative side of item 2: the "signup-otp" sign-in (lib/auth.ts)
 * gives no session without a correct sign-up code, and never signs into an
 * account that is already verified.
 *
 * Every account here is a throwaway e2e.<digits>@example.com one, deleted
 * in afterAll with any OTP rows made for its phone (T6). The tests that
 * make accounts straight in the QA database are @needs-db.
 */

const created: { email: string; phone: string }[] = [];

test.afterAll(async () => {
  const phones = created.map((c) => c.phone);
  await deleteRegisteredTestUsers(created.map((c) => c.email));
  if (phones.length) {
    await withQaDb((client) => client.query(`DELETE FROM "Otp" WHERE phone = ANY($1::text[])`, [phones])).catch(() => {});
  }
});

/** A fresh account straight in the QA database (phone set, onboarding not done). */
async function insertAccount(opts: { isVerified: boolean }) {
  const s = `${Date.now()}${randomInt(1000, 10000)}`;
  const email = `e2e.${s}@example.com`;
  const phone = `+917${randomInt(100_000_000, 1_000_000_000)}`;
  const password = randomBytes(18).toString("base64url");
  const id = `e2esignup${randomBytes(8).toString("hex")}`;
  const hash = await bcrypt.hash(password, 10);
  created.push({ email, phone });
  await withQaDb((client) =>
    client.query(
      `INSERT INTO "User" (id, name, "displayName", email, phone, password, role, "isVerified", "isApproved", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, 'AUDIENCE', $7, true, now())`,
      [id, `e2e_s${s.slice(-12)}`, "E2E Signup", email, phone, hash, opts.isVerified],
    ),
  );
  return { id, email, phone, password };
}

async function csrf(request: APIRequestContext) {
  return ((await (await request.get("/api/auth/csrf/")).json()) as { csrfToken: string }).csrfToken;
}

async function sessionUser(request: APIRequestContext) {
  const session = (await (await request.get("/api/auth/session/")).json()) as { user?: { email?: string } };
  return session?.user ?? null;
}

/** Calls the signup-otp sign-in the way next-auth's signIn() does. */
async function signupOtpSignIn(request: APIRequestContext, form: Record<string, string>) {
  await request.post("/api/auth/callback/signup-otp/", {
    form: { csrfToken: await csrf(request), json: "true", ...form },
    maxRedirects: 0,
  });
}

async function requestSignupCode(request: APIRequestContext, phone: string) {
  const res = await request.post("/api/auth/otp/request/", { data: { purpose: "SIGNUP_VERIFY", phone } });
  expect(res.ok(), await res.text()).toBe(true);
  const { devOtp } = (await res.json()) as { devOtp?: string };
  expect(devOtp, "QA dev OTP (OTP_PROVIDER=mock)").toMatch(/^\d{6}$/);
  return devOtp!;
}

async function passWelcomeToAllSet(page: Page) {
  const allSet = page.getByRole("heading", { name: /you're all set/i });
  const notNow = page.getByRole("button", { name: /^not now$/i });
  await expect(allSet.or(notNow).first()).toBeVisible();
  if (!(await allSet.isVisible())) await notNow.click();
  await expect(allSet).toBeVisible();
}

test("[run C] sign-up signs you in with no second code, and onboarding skips Verify your phone", async ({ page, isMobile }) => {
  await useRuleViewport(page, isMobile);

  const account = await registerTestAudience(page, (c) => created.push(c));

  // Signed in as the account just made, and never sent to /login.
  await expect(page).not.toHaveURL(/\/login/);
  expect((await sessionUser(page.request))?.email).toBe(account.email);

  // Onboarding starts on the first page; the phone is already verified.
  await expect(page.getByRole("heading", { name: /welcome to aforaudience/i })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /^get started$/i }).click();
  await expect(page.getByRole("heading", { name: /verify your phone/i })).toBeHidden();
  await expect(page.locator('input[maxlength="6"]')).toHaveCount(0);

  await passWelcomeToAllSet(page);
  await expect(page.getByRole("heading", { name: /verify your phone/i })).toBeHidden();
  const card = page.locator(".afa-sheet-mount");
  await expect(card).toHaveScreenshot(`signup-onboarding-all-set-${isMobile ? 390 : 1440}.png`, { maxDiffPixelRatio: 0.02 });

  await page.getByRole("button", { name: /start browsing events/i }).click();
  await expect(page).toHaveURL(/\/events\/?($|\?)/);
  // No "Verify your phone" banner either.
  await expect(page.locator('[data-afa-nudge="phone-verify"]')).toHaveCount(0);
});

test("[run C] an unverified account still gets the Verify your phone step @needs-db", async ({ page, isMobile, baseURL }) => {
  await useRuleViewport(page, isMobile);
  const account = await insertAccount({ isVerified: false });

  await page.request.post("/api/auth/callback/credentials/", {
    form: { csrfToken: await csrf(page.request), identifier: account.email, password: account.password, callbackUrl: baseURL ?? "/", json: "true" },
    maxRedirects: 0,
  });
  expect((await sessionUser(page.request))?.email).toBe(account.email);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /welcome to aforaudience/i })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /^get started$/i }).click();
  await expect(page.getByRole("heading", { name: /verify your phone/i })).toBeVisible();
  await expect(page.locator('input[maxlength="6"]')).toBeVisible();
});

test("[run C] signup-otp gives no session without the right sign-up code @needs-db", async ({ page }) => {
  const account = await insertAccount({ isVerified: false });

  // No code, and a wrong code: nobody is signed in, the phone stays unverified.
  await signupOtpSignIn(page.request, { userId: account.id });
  expect(await sessionUser(page.request)).toBeNull();
  const code = await requestSignupCode(page.request, account.phone);
  const wrong = code === "000000" ? "111111" : "000000";
  await signupOtpSignIn(page.request, { userId: account.id, code: wrong });
  expect(await sessionUser(page.request)).toBeNull();

  const verified = await withQaDb(async (client) =>
    (await client.query(`SELECT "isVerified" FROM "User" WHERE id = $1`, [account.id])).rows[0]?.isVerified,
  );
  expect(verified).toBe(false);
});

test("[run C] signup-otp never signs into an account that is already verified @needs-db", async ({ page }) => {
  // A real, correct SIGNUP_VERIFY code for the account's own phone is still
  // refused once the account is verified: this sign-in exists only for the
  // account just created in the same sign-up.
  const account = await insertAccount({ isVerified: true });
  const code = await requestSignupCode(page.request, account.phone);
  await signupOtpSignIn(page.request, { userId: account.id, code });
  expect(await sessionUser(page.request)).toBeNull();

  // A code for one phone can't sign in a different (unverified) account.
  const other = await insertAccount({ isVerified: false });
  const codeForFirst = await requestSignupCode(page.request, account.phone);
  await signupOtpSignIn(page.request, { userId: other.id, code: codeForFirst });
  expect(await sessionUser(page.request)).toBeNull();
});
