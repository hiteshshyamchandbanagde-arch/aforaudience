# CC dispatch: run L2b, remove the "Draft — pending legal review" banner on qa (8 Nov)

> **Existing branch `fix/legal-footer-l2` (PR #764)** — run only AFTER the L2 amend run has pushed. `git fetch && git checkout fix/legal-footer-l2 && git reset --hard origin/fix/legal-footer-l2`; if origin/qa moved, `git rebase origin/qa` (never merge). One small change + its test, commit, push, status file, stop. 20-min limit.

**Why:** `src/components/LegalDocLayout.tsx` shows "Draft — pending legal review … once the company is formally registered…" on Terms/Privacy/Refund/Contact. The company is registered and Razorpay is verifying these pages; the notice is false. Same removal is being made on the prod port (#765).

## Change
- Remove the banner block (and any prop only used by it) from `LegalDocLayout.tsx`. Design-tokens check must stay green.
- Test (T1): in `e2e/legal-pages.spec.ts`, add "pending legal review" and "formally registered" to the forbidden-text list for all 4 pages (fails on origin/qa, passes on the branch — show both). Regenerate the legal-pages screenshot baselines (contact/refund-policy, 390/1440) since the banner leaves them; justify in the status file.
