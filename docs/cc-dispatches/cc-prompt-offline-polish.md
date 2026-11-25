# CC dispatch: offline polish (BUG-2610-001 follow-ups from Hitesh's 14 Oct phone test)

> **New branch `fix/offline-polish` off `origin/qa`.** Small chunks (AGENTS.md): one small edit, commit, push, next; one locale file per tool call. Push, write the status file, stop. Chat opens the PR and merges. **Never `git stash pop` on a clean tree.**

**Start:** `git fetch && git reset --hard origin/qa` (must include this file). Read `HANDOFF.md` Part 58, `docs/design.md` "Offline tickets", `public/offline.html`, `public/sw.js`, `src/components/OfflineBanner.tsx`, `src/app/tickets/page.tsx`, `e2e/offline-tickets.spec.ts`, `e2e/offline-page.spec.ts`.

Context: #754 made My Tickets work offline (verified on Hitesh's phone 14 Oct 10:29). Every other page offline correctly shows `/offline.html`. These four items finish the offline experience.

## 1. `/offline.html`: a way back to the saved tickets
- Today its only button is "Try again" (`location.reload()`); a person at the venue door who tapped another tab is stuck.
- Add a primary button **"Show my saved tickets"** linking to `/tickets/` (the SW serves the cached shell offline), and make "Try again" the secondary (outline) button. Keep the existing text and tip.
- `offline.html` is static English today. Leave it English-only, but if the page can read the user's saved locale from `localStorage` cheaply (the app's existing locale key) and the strings exist in the dictionaries, use them; otherwise English is acceptable here. Say which you did.
- Bump `CACHE_VERSION` (offline.html is precached).

## 2. Offline My Tickets header shows SIGN IN / SIGN UP
- Offline, the cached `/tickets/` shell is the signed-out render and the session fetch fails, so the top bar shows Sign in / Sign up above the saved tickets. That looks like the person was signed out.
- While the page is in its offline view (`renderOffline`), the header must not show Sign in / Sign up. Simplest acceptable: the top bar hides the auth buttons while `navigator.onLine === false` (or the app's offline state) and no session is known. Do not fake a signed-in user and do not show anyone's name from the snapshot.

## 3. Sign-in offline says "Could not send code."
- Login / OTP send (and `verify-phone`, `WelcomeSequence` which share `couldNotSendCodeError`): when the request fails because the device is offline (`navigator.onLine === false` or a network `TypeError`, not an HTTP error), show a new message **"You're offline. Connect to the internet to get your code."** New i18n key, all 12 locales, translated (not English copies; `scripts/i18n-untranslated.test.ts` must pass).
- Same treatment for password sign-in if it shows a generic error offline.

## 4. Offline banner wording + translation
- `OfflineBanner.tsx` hard-codes English: "You're offline — showing saved content" / "Back online". Move both to the dictionaries (12 locales, translated).
- The text "showing saved content" is only true on My Tickets. Use **"You're offline"** everywhere, and **"You're offline — showing your saved tickets"** only on `/tickets` when the saved view is showing (the page already has its own "last updated" notice, so if the banner text duplicates it, the plain "You're offline" there is fine too; pick one and say why).

## Tests (T1)
- e2e `offline-page.spec.ts`: offline.html shows "Show my saved tickets"; tapping it while offline (after a tab-reached My Tickets snapshot) lands on the saved tickets.
- e2e: offline My Tickets top bar has no Sign in / Sign up.
- e2e or unit: offline OTP send shows the offline message, not "Could not send code."
- Banner text per page. 390 + 1440; update baselines that change and list them.
- Each regression must fail on `origin/qa` and pass on the branch (show both).

## Finish
- tsc, unit self-tests, eslint (touched files), checker/ratchet green on the pushed head.
- Status file `cc-autopilot-status.md` (T7) with Human check: Hitesh, phone: Tickets tab online → airplane → tap Discover (offline page) → "Show my saved tickets" → saved tickets, no Sign in/Sign up; sign-in offline message.
- Do not touch the Feedback table.
