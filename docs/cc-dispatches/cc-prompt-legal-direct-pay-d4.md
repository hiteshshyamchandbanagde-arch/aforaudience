# CC dispatch: run D4, legal pages for Pay at entry + Direct payments (qa)

> **New branch `fix/legal-direct-pay-d4` off `origin/qa`.** Content-only change in `src/app/terms/page.tsx` and `src/app/refund-policy/page.tsx` (+ `e2e/legal-pages.spec.ts`). Small commits, push, status file (do NOT commit it), stop. 30-min limit. A prod port follows separately (chat), so keep the wording self-contained and don't add new imports beyond what these pages already use.

**Why (Hitesh, 8 Nov):** launch moves no money through AFA. Priced shows are **Pay at entry** (reserve on AFA, pay the organiser at the venue by cash/UPI). Organiser↔Venue owner and Organiser↔Artist deals are settled **directly** between them (UPI/cash), confirmed in-app. Online payment through Razorpay exists but is switched off and may be turned on later. Today the Terms/Refund pages describe only online payment + a ₹20 booking fee, which is now misleading.

## Terms (`src/app/terms/page.tsx`) — keep structure/numbering style, update "Last updated"
- §3 Booking tickets: rewrite the price/fee bullet so it covers the three ticket types: **Free**; **Pay at entry** — "you reserve on AforAudience and pay the Organiser directly at the venue (cash or UPI); AforAudience does not collect, hold or refund this payment, and no booking fee is charged"; **Online payment** (when offered) — "processed by Razorpay; a platform booking fee may apply and is shown separately before you pay". Ticket delivery bullet: tickets are issued on reservation (pay at entry/free) or on payment confirmation (online).
- New section **"Direct payments between users"** (after Payments): bookings between Organisers and Venue Owners, and between Organisers and Artists (performance fees and buy-in spots), are paid directly between the two parties; AforAudience shows the payee's details, records the "paid"/"received" confirmations, and is **not a party to the payment**; any dispute about amount, payment, refund or cancellation of a direct payment is between the parties; AforAudience may help by sharing the in-app record. Users must only use the payee details shown in the app and never pay anyone claiming to be AforAudience.
- Payments section: "When online payment is offered, it is processed through Razorpay…"; keep the no-storage sentence.
- Liability: the cap tied to "booking fee(s) you paid" must still make sense when no fee was paid — word it as "the platform fees (if any) you paid us in the relevant transaction".

## Refund policy (`src/app/refund-policy/page.tsx`)
- Keep §1 tiers (still read from `refund-policy.ts`) but state they apply to **online payments** made through AforAudience.
- New section **"Pay at entry and direct payments"**: nothing is collected online, so there is nothing for AforAudience to refund; cancel your reservation in My Tickets to release the seat; any money paid directly to an Organiser/Venue Owner/Artist is refunded (or not) by them under their own terms; contact them first, then info@aforaudience.com if you need the in-app record.
- §5 "How refunds are paid": scope it to online payments.

## Tests (T1)
- `e2e/legal-pages.spec.ts`: Terms contains "Direct payments between users" and "pay the Organiser directly at the venue"; Refund page contains "Pay at entry". Fails on origin/qa, passes on the branch. Update the contact/refund-policy baselines only if they change (refund-policy will) and justify.
- tsc, eslint (touched files, no new errors), design-tokens green.

## Finish
Status file (T7, not committed): the exact new paragraphs (so chat can port them to main verbatim), before/after, pushed head. Human check: Hitesh reads both pages once. Do not touch the Feedback table or any DB.
