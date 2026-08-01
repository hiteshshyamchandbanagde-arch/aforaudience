# AforAudience — Session Handoff

Written for whoever (human or Claude) picks this up next. Covers what changed, current state, and what's still open.

## Environment map

| | Branch | Domain | Vercel env | Supabase project |
|---|---|---|---|---|
| Prod | `main` | www.aforaudience.com | Production | `aforaudience-prod` (`cncumfwwnjcwacggrgsr`) |
| QA | `qa` | qa.aforaudience.com | Preview | `aforaudience-qa` (`nqiyrypmjtogoocerxtu`) |

- Vercel project: `aforaudience`, team `hitesh-shyamchand-bangade-s-projects`
- GitHub: `hiteshshyamchandbanagde-arch/aforaudience` (public repo)
- Local clone: `C:\Users\hites\AforA\aforaudience` (Windows, git already authenticated for push/pull)
- `qa.aforaudience.com` has Vercel Deployment Protection on — only Vercel-authenticated sessions (your browser, already logged in) can view it. Tools/testers without Vercel access can't reach it.

## What this session did

**1. Fixed the QA environment setup.** `qa.aforaudience.com` was 404ing because the `qa` branch was created via GitHub's UI (branch duplication), which fires a `create` event, not a `push` — so Vercel never built it. Fixed by pushing a real commit to `qa`.

**2. Built multi-identifier login + OTP + account codes**, applied to QA only so far:
- Login now accepts email, phone, username, or a generated code (`AFA`/`ART`/`ORG`/`VEN` + `YYMM` + 6-digit sequence) — see `resolveIdentifierToUser` in `src/lib/auth-helpers.ts`.
- Every `User` gets an `AFA...` code at signup (DB trigger, not app code). Artist/Organiser/VenueOwner get their own role-specific code when a user upgrades into that role via the existing Profile page cards.
- OTP login/signup added via NextAuth's `otp-login` CredentialsProvider (`src/lib/auth.ts`) — separate from the password `credentials` provider.
- OTP sending is provider-swappable (`src/lib/otp.ts`): `OTP_PROVIDER=mock` (QA — shows the code on-screen, no real SMS) vs `OTP_PROVIDER=msg91` (prod, **not yet configured** — needs an MSG91 account + India DLT template registration, which takes 1-2 days to approve. Not started as of this handoff unless done separately.). Defaults to `msg91` if unset — fails safe, never silently falls back to mock.
- Email verification is async/non-blocking (link via Resend, `sendEmailVerificationEmail` in `src/lib/email.ts`) — doesn't gate login, unlike phone OTP which does.
- Full file list touched: `prisma/schema.prisma`, `src/lib/auth.ts`, `src/lib/auth-helpers.ts` (new), `src/lib/otp.ts` (new), `src/lib/email.ts`, `src/app/api/auth/register/route.ts`, `src/app/api/auth/otp/{request,verify}/route.ts` (new), `src/app/api/auth/username-check/route.ts` (new), `src/app/api/auth/verify-email/route.ts` (new), `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/RegisterForm.tsx`, `src/app/(auth)/verify-email/page.tsx` (new), `src/components/AuthPromptSheet.tsx`, `src/app/profile/page.tsx`.

**3. Enabled RLS on all tables in `aforaudience-qa`** (was disabled project-wide). Confirmed safe — the app connects via Prisma using a privileged pooler role that bypasses RLS entirely, and no code anywhere uses the Supabase JS client / anon key, so this closes a latent exposure risk at zero functional cost.

**4. Fixed a pre-existing bug found while testing**: on `/profile`, "Visit your Artist/Organiser/Venue dashboard" was plain unclickable text, not a link. Now wired to `/dashboard/{artist,organiser,venue}`.

**5. Created a QA admin account** — username `Admin`, email `hiteshshyamchandbanagde@gmail.com`, phone `+919890840084`, role `ADMIN`, code `AFA2607000004`. Password is a random unknown value by design — this account is OTP-login only, so no credential was ever shared in chat.

## Outstanding — promote to prod (task not started)

1. Check `aforaudience-prod` for duplicate `User.name` values (would break the new unique constraint) and any existing Artist/Organiser/VenueOwner rows (would need a `code` backfill, since new rows get one via trigger but old ones wouldn't retroactively).
2. Apply the same migration to `aforaudience-prod` (code columns/triggers, `Otp`, `CodeCounter`, `EmailVerificationToken`, `User.name` unique constraint).
3. Enable RLS on `aforaudience-prod` tables (same rationale as QA).
4. Merge `qa` → `main` on GitHub.
5. Set Vercel **Production** env vars: `OTP_PROVIDER=msg91`, `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID` — blocked until MSG91 account + DLT registration is done.

## Other flagged-but-not-fixed items

- **`.env` defaults to the PROD database URL**, with `.env.local` (gitignored) overriding to localhost for dev. Works today but fragile — a missing `.env.local` anywhere would silently connect to prod. Not fixed, just flagged.
- **Homepage hero section** (`src/app/page.tsx`) has an empty right-column void — no image element exists there at all. Pre-existing, unrelated to this session's work.
- Considered adding the user's code to the top nav (not just Profile page) — decided against it, Profile placement was judged sufficient.

## Environment gotchas for next time

- **PowerShell breaks on unquoted parentheses** in paths like `src/app/(auth)/login/page.tsx` — always quote them, or run `git add` per-file rather than pasting multi-path commands.
- **The Cowork sandbox's mount of this folder has shown stale/inconsistent reads multiple times** — false `git diff` (entire repo appeared modified when only ~13 files actually changed), false `tsc` errors in untouched files, and a `Glob` call that missed files that definitely exist. Any time a sandbox-run `git status`, `git diff`, `tsc`, or `Glob` result looks suspicious or too broad, verify via the user's own PowerShell terminal before trusting it or taking action based on it.
- A GitHub fine-grained PAT was pasted into a prior chat session — it should have been revoked in GitHub settings. Confirm this happened before assuming it's safe to ignore.
- Local git in PowerShell is already authenticated for both push and pull — no token needed for normal git operations.
