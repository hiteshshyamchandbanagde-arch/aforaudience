// Direct-pay standard term (Hitesh, 12 Nov 2026). AforAudience processes no
// payments and holds no money, so it can't issue refunds; it publishes one
// standard term the parties agree to before paying:
//   cancelled DIRECT_PAY_FULL_REFUND_MIN_DAYS+ days before the booked date:
//   any advance is refunded in full by the party who received it;
//   inside that window: as agreed between the parties.
// /refund-policy, /terms and the direct-pay disclosure lines all read this
// constant so the page and the in-app copy can't drift.
// (The online-payment tiers in src/lib/refund-policy.ts stay dormant.)
export const DIRECT_PAY_FULL_REFUND_MIN_DAYS = 15
