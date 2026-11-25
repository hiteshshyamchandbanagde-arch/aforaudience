# CC dispatch: run D2c, allow "UPI"/"QR" in the hi/mr venue i18n Latin check (finish D2)

> **Existing branch `feat/venue-direct-pay-d2`** (head a4a6674e): `git fetch && git checkout feat/venue-direct-pay-d2 && git reset --hard origin/feat/venue-direct-pay-d2`; if origin/qa moved, `git rebase origin/qa` (never merge). One small commit, push, status file, stop. 20-min limit.

**Failure left by D2b:** `e2e/dashboard-i18n-venue.spec.ts` (hi/mr) is red because the new direct-pay panel shows Latin "UPI" and "QR" in Hindi/Marathi. These are product terms Indian users read in Latin script (on every UPI app and QR code). **Precedent (reviewed by chat):** `e2e/marathi-locale.spec.ts` already allows them: `LATIN_ALLOWED = new Set(["AforAudience", "AFA", "OTP", "UPI"])`.

## Do
- In `e2e/dashboard-i18n-venue.spec.ts`, add `"UPI"` and `"QR"` to `PROPER_NOUNS` (with a one-line comment citing marathi-locale.spec.ts). Check `e2e/dashboard-i18n-organiser.spec.ts` too: if the organiser side of the direct-pay panel trips the same check, add them there as well. Nothing else in the specs changes (T2: this test change is justified and chat-reviewed).
- Do NOT transliterate UPI/QR in the dictionaries.
- Run the touched specs (hi + mr) and the D2 venue direct-pay spec locally against QA; all green.

## Finish
Status file (T7): the change + justification, before/after, pushed head. Do not touch the Feedback table or any DB.
