# CC dispatch: run L1, legal pages for Razorpay website verification (Hitesh "go", 8 Nov)

> **New branch `fix/legal-pages-l1` off `origin/qa`.** Small chunks (AGENTS.md): one small edit, commit, push, next. **45-min hard limit, push after every commit.** Push, write the status file, stop. Chat opens the PR and merges. **Never `git stash pop` on a clean tree.**

**Why:** Hitesh is activating the company's Razorpay merchant account for aforaudience.com. Razorpay's website check needs Terms, Privacy, Refund/Cancellation and Contact pages that name the operating company. Today Terms has 8 `<Placeholder>`s, Privacy has 12, there is no Refund page and no Contact page. This run fixes the pages. Run L2 (next) handles the footer links, the company line and the locale labels; don't touch the footer here.

**Start:** `git fetch && git reset --hard origin/qa`. Read `src/app/terms/page.tsx`, `src/app/privacy/page.tsx`, `src/components/LegalDocLayout.tsx`, `src/lib/refund-policy.ts`, `docs/design.md`.

## Company facts (use exactly these)
- Operator: **Shyamkasturi Productions Private Limited**. Use the sentence "AforAudience is a product of Shyamkasturi Productions Private Limited" where the operator is named.
- Registered office: Sr No 76/2, Flat No A/504, The Nest Co-op Housing Society, Ravet, Haveli, Pune 412101, Maharashtra, India.
- Contact email: info@aforaudience.com (use it for support, privacy and grievance contact).
- Grievance Officer: Hitesh Banagde, Director, info@aforaudience.com, at the registered office address above.
- Phone: none yet. Don't invent one, and leave no placeholder; Hitesh adds it later.
- Last updated: the date of the commit.

## Defaults chosen by chat (Hitesh can change; list them in the status file)
- Minimum age: 18.
- Data retention: account data deleted within 90 days of account closure, except booking, payment and tax records kept as long as Indian law requires (currently up to 8 years).
- Booking fee: "₹20 per ticket, plus GST where applicable"; free events never charged. Must match what checkout charges; check the code and say if it differs.
- Payouts (Terms): "Payouts to Organisers and Venue Owners are made as set out in the payout terms agreed when they join." No timeline.
- Jurisdiction: courts at Pune, Maharashtra.

## 1. Terms and Privacy
- Replace every `<Placeholder>` in both pages with the facts and defaults above. Afterwards no `<Placeholder>` remains in either file (grep to confirm). Keep the existing structure and wording otherwise.
- Terms §3 "Refund policy": replace with a short summary plus a link to `/refund-policy`.

## 2. New page `/refund-policy` (Refund & Cancellation Policy)
- Use `LegalDocLayout` like Terms and Privacy. Same route conventions (trailingSlash, metadata).
- **The text must match `src/lib/refund-policy.ts` exactly.** Read the tiers from the code (today: ≥14 days before the show = full amount minus booking fee and taxes; 7–14 days = 50%; under 7 days = none). Don't use 15 days, which is a decision still pending. Also cover: an event cancelled by the Organiser = full refund including the booking fee; free events have nothing to refund; refunds go back to the original payment method through Razorpay, typically within 5–7 working days; how to cancel (My Tickets → cancel); contact info@aforaudience.com.
- If the code's tiers differ from the above, describe the code and flag it in the status file.

## 3. New page `/contact`
- Company name, product line, registered office address, email (mailto), Grievance Officer block, a link to the Refund policy. English only, like the other legal pages. Semantic `<address>`.
- Design tokens only (the design-tokens check must pass); match the LegalDocLayout look.

## Tests (T1)
- e2e `e2e/legal-pages.spec.ts`: `/terms/`, `/privacy/`, `/refund-policy/`, `/contact/` each return 200, contain "Shyamkasturi Productions Private Limited", contain no "to be finalized" / "once registered" / "Placeholder" text, and Contact shows info@aforaudience.com. Refund page states the same day tiers as `refund-policy.ts` (import the thresholds or assert against the same numbers).
- Screenshots at 390 + 1440 for `/refund-policy/` and `/contact/`.
- Regression shape: the placeholder/company assertions fail on `origin/qa` and pass on the branch (show both).
- tsc, unit self-tests, eslint (touched files), checker/ratchet green on the pushed head.

## Finish
- Status file `cc-autopilot-status.md` (T7). Human check for Hitesh: read Terms, Privacy, Refund and Contact once on the preview (wording, address); confirm the defaults (age 18, 90-day deletion, ₹20 + GST, Pune courts); add a phone number when one exists.
- Do not touch the Feedback table. No data changes.
