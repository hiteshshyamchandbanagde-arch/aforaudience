# Onboarding Guidelines

UI/UX audit Section 09 / Step 6, sub-spec 5/5 — the last of the six-step
audit. Unlike `-038`/`-039`/`-040`/`-041`, this is a real feature build:
a one-time, full-screen welcome sequence (Welcome → Verify phone → Enable
notifications → next-step card) shown once after signup, replacing phone
verification's old spot in `NudgeStack`'s persistent-banner treatment.
Every claim in the dispatch was independently re-verified against a fresh
clone before building; three of them needed real correction - see Section
3.

## 1. The sequence

New component: `src/components/WelcomeSequence.tsx`, mounted at root
layout (`src/app/layout.tsx`) alongside (not replacing) `NudgeStack`.
Gated on `session.user.onboardedAt == null` via a shared helper
(`src/lib/onboarding.ts`'s `isOnboardingSequenceDue`), used by both this
component and `NudgeStack` (which suppresses its four banners while the
takeover is showing, so nothing stacks underneath it - the whole point of
the fix).

- **Screen 1 - Welcome.** Generic copy, "Get started" CTA. No skip needed
  - nothing to decline, just an intro card.
- **Screen 2 - Phone verify.** Reuses the exact OTP request/verify calls
  `verify-phone/page.tsx` already used, now extracted into
  `src/lib/useOtpVerification.ts` so neither implementation forks from
  the other. See Section 3.2/3.3 for why this screen branches into three
  real cases, not one form.
- **Screen 3 - Notification opt-in.** Reuses `subscribeAndSave()`,
  extracted from `NotificationOptIn.tsx` into `src/lib/push-subscribe.ts`
  (no behavior change to the existing banner). Skipped automatically if
  push isn't supported or permission is already decided - same gating
  `NotificationOptIn.tsx` itself uses.
- **Screen 4 - Next-step card.** Reads `session.user.intendedRole`
  (persisted, see Section 3.1) to link to `/profile?role={artist|
  organiser|venue}` - the exact same URL `postLoginRedirect()` already
  sends a user to today, which `profile/page.tsx` already knows how to
  scroll to and highlight the right "apply as X" card. Falls back to
  `/events` if no intended role was ever captured. Either the CTA or the
  "Not now" skip PATCHes `onboardedAt = now()` via `/api/users/me`
  (`{ onboardingComplete: true }` - a boolean flag, not a client-supplied
  date; the server always stamps its own `now()`).
- Reuses `.afa-backdrop-mount`/`.afa-sheet-mount` (`docs/motion-
  guidelines.md`) for the takeover's entrance, same structure
  `MobileEventFilterSheet.tsx` already uses (backdrop + sheet layers),
  just full-viewport instead of a bottom sheet. Mounts once per sequence,
  not per internal step change, so the animation doesn't replay on every
  Screen 1→2→3→4 transition.
- Every button is the shared `src/components/ui/Button.tsx` (`primary` /
  `secondary` variants) from Step 4 of the original audit sequence -
  locked-palette tokens by construction (`--afa-fill-solid`/
  `--afa-on-fill-solid` for primary, muted `--afa-text-primary` at 0.4
  opacity for secondary/skip). Repo-wide grep confirms zero
  `--afa-terracotta` or other legacy-token hits in any new file this pass
  touched.

## 2. `onboardedAt` and `intendedRole` (schema)

Two new nullable `User` columns (migration
`prisma/migrations/20260913100000_add_user_onboarded_at_and_intended_role`):

- **`onboardedAt DateTime?`** - null means "hasn't completed or skipped
  past the sequence yet." Backfilled to each pre-existing row's own
  `createdAt`, **not `now()`** - backfilling to `now()` would falsely
  cluster all 233 real `aforaudience-qa` users into one instant, corrupting
  any future cohort/analytics query against this column, and gains
  nothing over the truthful value already sitting right there in the same
  row. Either way, `now()` or `createdAt`, no pre-existing user sees the
  sequence retroactively - the choice only affects future readability of
  the column itself.
- **`intendedRole String?`** - see Section 3.1 for why this needed
  persisting at all, given it already survived as a query param today.

**Row-count and backfill-effect preview** (shown before running, per the
standing destructive-change convention even though this is an UPDATE, not
a DELETE): 233 total rows in `aforaudience-qa` as of 13 Sep 2026, 232
already `isVerified` (only 1 real unverified row). First 5 by
`createdAt`:

| id | role | isVerified | createdAt |
|---|---|---|---|
| `4c7833ea-7cef-4153-b27f-f84e4021d33f` | ADMIN | true | 2026-07-11 16:42:37 |
| `qa-audience-001` | AUDIENCE | true | 2026-09-10 01:44:45 |
| `qa-audience-002` | AUDIENCE | true | 2026-09-10 01:44:45 |
| `qa-audience-006` | AUDIENCE | true | 2026-09-10 01:44:45 |
| `qa-audience-007` | AUDIENCE | true | 2026-09-10 01:44:45 |

**Not yet applied to `aforaudience-qa` as of this write-up** - the
migration hit the Claude Code auto-mode classifier's "Cloud Storage Mass
Delete" guard (a false positive: this is an additive `ALTER TABLE` plus a
backfill `UPDATE`, nothing is deleted) and needs explicit approval before
running. See the migration file's own header for the exact SQL queued to
run. Everything else in this build (schema in `prisma/schema.prisma`,
Prisma client regenerated locally, all application code, `tsc --noEmit`
and `next build` both clean) is otherwise complete and ready the moment
the migration itself is approved and applied.

## 3. Corrections found on re-verification

### 3.1 `intendedRole` was not actually "dropped" - but was fragile

The dispatch's finding #2 said `intendedRole` was "currently used only
for display copy... never persisted," implying it might already be lost
by the time a user reaches `/login`. Re-tracing the actual code found
it's more nuanced: `RegisterForm.tsx` already carries it through as a URL
query param on both the credentials path
(`router.push('/login?registered=true&role=' + intendedRole)`) and the
Google sign-up path (`signIn('google', { callbackUrl:
'/profile?role=' + intendedRole })`), and `login/page.tsx`'s own
`postLoginRedirect()` already forwards it again to `/profile?role=X`,
which `profile/page.tsx` already reads to scroll-and-highlight the right
apply card. **So it is not dropped for an immediate first login.**

The real gap: it was never sent to the server at all (`RegisterForm.tsx`'s
POST body to `/api/auth/register` never included it), so it only ever
existed as a client-side URL param - meaning it's completely lost on any
**delayed** first login (register, close the tab, log in fresh days
later with no query params in the URL). Since the welcome sequence can
fire on any future login until completed, and there's no way to predict
whether a given login is the "immediate" or "delayed" case, `intendedRole`
needed a durable home. Persisted it as a `User` column instead of
threading it through as a query param the way the dispatch suggested -
already touching the `User` table for `onboardedAt`, and a persisted
column is strictly more robust than a query param for this. Screen 4
reads `session.user.intendedRole` directly; no URL parsing needed in
`WelcomeSequence.tsx` at all.

### 3.2 Registration already verifies most users before they ever reach here

The dispatch's finding #1 was accurate as stated (`register/route.ts`
sends the OTP, a full `/verify-phone` page exists, nobody is redirected
there right after signup) but incomplete in a way that matters for
Screen 2's design: **`RegisterForm.tsx` already has a mandatory OTP-entry
stage as part of registration itself**, before it ever redirects to
`/login`. `handleVerifyOtp()` calls `/api/auth/otp/verify`, which sets
`isVerified: true` right there - so by the time a credentials-registered
user's first login happens, they're almost always already verified.
Confirmed against real data: 232 of 233 `aforaudience-qa` users are
`isVerified: true` (Section 2).

This means Screen 2 is NOT most users' first opportunity to verify - it's
a safety net for two narrower populations: (a) someone who abandoned
registration's own OTP step and comes back later, and (b) Google sign-ups
(Section 3.3), who never see a phone-verify step at all. Screen 2 branches
on `session.user.isVerified` accordingly - already-verified users get a
one-line acknowledgment and a single "Continue," not a redundant OTP form.

### 3.3 Google sign-up never collects a phone at all

Not in the dispatch's findings. `src/lib/auth.ts`'s custom
`adapter.createUser` (the path a brand-new Google sign-up takes) creates
the row with no `phone` field set at all (`isVerified: false`
permanently, until the user adds one separately via Profile) - there is
no phone to send a code to. `verify-phone/page.tsx`'s own `sendCode`
already silently no-ops when `phone` is null (`if (!phone) return`), which
would have shown Screen 2's OTP form with a permanently-disabled "Send
code" button and no explanation. Screen 2 checks for this case explicitly
(`!user.phone`) and shows a one-line note instead, linking onward - same
"Continue" treatment as the already-verified case (Section 3.2), just
different copy (`welcomeSequence.noPhoneOnFileMessage`).

### 3.4 OTP staleness - resolved, not left open

The dispatch flagged this as needing Hitesh's call: "whether the OTP sent
at registration time is still valid by the time a user reaches Screen 2."
`src/lib/otp.ts`'s `OTP_EXPIRY_MINUTES = 5` makes this a technical
question with a clear answer, not a product judgment call: given Section
3.2's finding that Screen 2's OTP form only ever renders for users who
*abandoned* registration's own OTP stage and returned at some
indeterminate later time, any code sent back at registration is
essentially always expired by then. Screen 2 always issues a fresh
`sendCode()` on mount for this population rather than assuming the
original send is still good - resolved here rather than punted, since the
reasoning doesn't depend on taste.

## 4. Relationship with `PhoneVerifyNudge`

The dispatch's finding #4 (this sequence and the standing nudge aren't
mutually exclusive, they cover different populations) was re-verified and
holds exactly as stated:

- **Pre-existing users** (backfilled `onboardedAt`, Section 2) never see
  the new sequence - `PhoneVerifyNudge` remains their only path to
  verification, unchanged.
- **New users** see the sequence; if they skip Screen 2 while still
  unverified, `PhoneVerifyNudge` picks up normally the moment the
  sequence completes and `NudgeStack` stops suppressing itself (it gates
  independently on `isVerified`, not on anything the sequence sets).

No changes made to `PhoneVerifyNudge.tsx` itself. It's worth noting (not
fixed here, out of scope) that it still renders `--afa-error-bg` and
`--afa-terracotta`/hardcoded `white` directly, unlocalized - the same
category of legacy-token/localization gaps `docs/notifications-
guidelines.md` catalogued for push content, just in a different
component.

## 5. Flagged, not built - needs Hitesh's call

**Role-approval welcome moment.** Once a user is actually *approved* as
Artist/Organiser/Venue Owner (via the existing apply-and-admin-approve
flow), that's arguably a distinct moment worth its own small "you're
approved, here's what's next" welcome - genuinely different from this
signup-time sequence, which fires long before any role approval could
exist. Not built here; logged as a follow-up idea only, per the
dispatch's own instruction not to build it.

## Built

Schema, all application code, and both locale-dictionary additions (11
files, `welcomeSequence` namespace) are complete; `tsc --noEmit` and
`next build` both clean. **Migration not yet applied** (Section 2) -
blocked on approval, not on anything technical. Once applied, this
closes Step 6 (5/5) and the original six-step UI/UX audit sequence in
full.
