# CC dispatch: run P1b, remove the "Draft — pending legal review" banner (8 Nov)

> **Existing branch `fix/legal-prod-port` (PR #765 → main)**: `git fetch && git checkout fix/legal-prod-port && git reset --hard origin/fix/legal-prod-port`. Do NOT rebase onto qa (this branch is based on main). One small commit, push, status file on the branch, stop. 20-min limit.

**Why:** `src/components/LegalDocLayout.tsx` renders a yellow box on every legal page: "Draft — pending legal review … It will be reviewed with our CA and a lawyer once the company is formally registered…". The company IS registered (Shyamkasturi Productions Private Limited) and Razorpay is about to verify these pages; a "draft / not registered" notice is false and likely to fail verification.

## Change
- Remove the banner block (and any prop/flag that only exists for it) from `src/components/LegalDocLayout.tsx`. Nothing else changes.
- `npx tsc --noEmit` + `npm run build` pass. Local `next start`: `/terms/ /privacy/ /refund-policy/ /contact/` 200 and none contains "pending legal review" or "formally registered" (paste the grep in the status file).
