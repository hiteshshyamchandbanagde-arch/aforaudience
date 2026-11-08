# CC dispatch: run D2b, finish D2 (venue direct payment) UI gaps

> **Existing branch `feat/venue-direct-pay-d2`**: `git fetch && git checkout feat/venue-direct-pay-d2 && git reset --hard origin/feat/venue-direct-pay-d2`; if origin/qa moved, `git rebase origin/qa` (never merge). Small chunks; one dictionary file per call. 40-min limit. Push, **commit the status file `cc-autopilot-status.md` to the branch**, stop. **Never `git stash pop` on a clean tree.**

**Context:** D2 (c17720e7, 29 commits) built the venue direct-payment flow. Its RESULT said "Two UI gaps are left (listed below)" but the list was truncated and no status file was saved. Migration `20261109120000_add_venue_direct_pay` is **already applied to QA** by chat, so the D2 e2e spec can now run against a preview/local server pointed at QA.

## Do
1. Re-read `docs/cc-dispatches/cc-prompt-venue-direct-pay-d2.md` §Do 3 (UI) and compare it item by item with what the branch has. Write the two gaps (and anything else missing) at the top of the status file before fixing. Likely candidates: optional UPI QR upload/display (`upiQrUrl`) in the owner profile and payee block (only if an upload helper already exists; otherwise show UPI ID only and say so), and decline/cancel actions or chips missing on one side (organiser or owner, fixed-rate or negotiated path).
2. Fix them in small commits. Design tokens only; 12 locales one file per call.
3. Run the D2 e2e spec (`e2e/*venue*direct*`) locally against QA data; fix real failures (no loosening). Keep existing venue-booking specs green unchanged.
4. **Razorpay stays switchable:** no changes to online venue checkout / wallet / payment / webhook / refund code.

## Finish
Status file (T7, committed on the branch): the gap list, what changed, tests before/after, Human check (Hitesh on phone: as Omkar request Vinayak's hall; as Vinayak set a UPI ID, accept, see it shown; Omkar "I've paid"; Vinayak confirm). Do not touch the Feedback table or any DB.
