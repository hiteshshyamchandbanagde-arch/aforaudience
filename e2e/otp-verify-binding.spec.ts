import bcrypt from "bcryptjs";
import { randomBytes, randomInt } from "crypto";
import type { APIRequestContext } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { deleteRegisteredTestUsers } from "./helpers/cleanup";
import { withQaDb } from "./helpers/qa-db";

/**
 * Run S2 (8 Nov, security): /api/auth/otp/verify must only verify the
 * account whose phone the code was sent to. Before the fix, a valid
 * SIGNUP_VERIFY code for phone A + the userId of another unverified
 * account B marked B verified.
 *
 * Throwaway e2e.<digits>@example.com accounts made straight in the QA
 * database, deleted in afterAll with their OTP rows (T6). No real SMS:
 * the QA OTP provider is mock and returns the code (devOtp).
 */

const created: { email: string; phone: string }[] = [];

test.afterAll(async () => {
  const phones = created.map((c) => c.phone);
  await deleteRegisteredTestUsers(created.map((c) => c.email));
  if (phones.length) {
    await withQaDb((client) => client.query(`DELETE FROM "Otp" WHERE phone = ANY($1::text[])`, [phones])).catch(() => {});
  }
});

async function insertUnverified() {
  const s = `${Date.now()}${randomInt(1000, 10000)}`;
  const email = `e2e.${s}@example.com`;
  const phone = `+917${randomInt(100_000_000, 1_000_000_000)}`;
  const id = `e2eotps2${randomBytes(8).toString("hex")}`;
  const hash = await bcrypt.hash(randomBytes(18).toString("base64url"), 10);
  created.push({ email, phone });
  await withQaDb((client) =>
    client.query(
      `INSERT INTO "User" (id, name, "displayName", email, phone, password, role, "isVerified", "isApproved", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, 'AUDIENCE', false, true, now())`,
      [id, `e2e_o${s.slice(-12)}`, "E2E OTP S2", email, phone, hash],
    ),
  );
  return { id, phone };
}

async function isVerified(id: string) {
  return withQaDb(async (client) => (await client.query(`SELECT "isVerified" FROM "User" WHERE id = $1`, [id])).rows[0]?.isVerified);
}

async function requestSignupCode(request: APIRequestContext, phone: string) {
  const res = await request.post("/api/auth/otp/request/", { data: { purpose: "SIGNUP_VERIFY", phone } });
  expect(res.ok(), await res.text()).toBe(true);
  const { devOtp } = (await res.json()) as { devOtp?: string };
  expect(devOtp, "QA dev OTP (OTP_PROVIDER=mock)").toMatch(/^\d{6}$/);
  return devOtp!;
}

test("[S2] a code for phone A cannot verify account B; A's own code still verifies A @needs-db", async ({ request }) => {
  const a = await insertUnverified();
  const b = await insertUnverified();
  const code = await requestSignupCode(request, a.phone);

  // Valid code for A, userId of B: refused, B stays unverified.
  const cross = await request.post("/api/auth/otp/verify/", { data: { phone: a.phone, userId: b.id, code } });
  expect(cross.status()).toBe(400);
  expect(await cross.json()).toEqual({ error: expect.any(String) });
  expect(await isVerified(b.id)).toBe(false);

  // The wrong pairing did not use up A's code: A verifies with it.
  const own = await request.post("/api/auth/otp/verify/", { data: { phone: a.phone, userId: a.id, code } });
  expect(own.status(), await own.text()).toBe(200);
  expect(await isVerified(a.id)).toBe(true);
  expect(await isVerified(b.id)).toBe(false);
});
