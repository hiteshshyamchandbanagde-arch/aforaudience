import { PERSONAS } from "./personas";
import { withQaDb } from "./qa-db";

/**
 * Fixture Organiser, seeded by scripts/qa-seed.ts specifically so the
 * waitlist/wallet spec always has a real approved Organiser + a BUY_IN,
 * capacity-capped event + a venue booking with a real platform fee to
 * exercise the cancel -> waitlist -> wallet-credit -> apply-credit chain
 * against. Reused across every run, never recreated per-test - do not delete
 * this Organiser/Event/VenueBooking in QA (`E2E Fixture: Waitlist/Wallet
 * Flow`, ids prefixed `e2efixture`).
 *
 * Its session is saved by global-setup.ts: use
 * `storageState: authFile("fixtureOrganiser")`.
 */
export const FIXTURE_ORGANISER = {
  identifier: PERSONAS.fixtureOrganiser.identifier,
  password: PERSONAS.fixtureOrganiser.password,
};
export const FIXTURE_EVENT_ID = "e2efixtureevt00001";
export const FIXTURE_EVENT_TITLE = "E2E Fixture: Waitlist/Wallet Flow";

const FIXTURE_ORGANISER_ID = "e2efixtureorg0001org";
const FIXTURE_VENUE_BOOKING_ID = "e2efixturevb0001";
const FIXTURE_PLATFORM_FEE = 199;

/**
 * Puts the waitlist/wallet fixture back to its seeded state: nobody has
 * applied to the event, the venue booking still owes its ₹199 platform fee,
 * and the Organiser's wallet is empty (the same values scripts/qa-seed.ts
 * writes).
 *
 * The flow cannot be undone through the app: an artist can apply to an
 * event only once, a cancelled slot stays cancelled, and nothing ever puts
 * a paid platform fee back. Without this the spec could only ever pass
 * once per reseed. Touches the fixture event's own rows and nothing else.
 */
export async function resetWaitlistFixture() {
  await withQaDb(async (client) => {
    await client.query(`DELETE FROM "Performance" WHERE "eventId" = $1`, [FIXTURE_EVENT_ID]);
    await client.query(`DELETE FROM "Application" WHERE "eventId" = $1`, [FIXTURE_EVENT_ID]);
    await client.query(`UPDATE "VenueBooking" SET "platformFeeAmount" = $2 WHERE id = $1`, [
      FIXTURE_VENUE_BOOKING_ID,
      FIXTURE_PLATFORM_FEE,
    ]);
    await client.query(`UPDATE "Organiser" SET "walletBalance" = 0 WHERE id = $1`, [FIXTURE_ORGANISER_ID]);
  });
}
