# CC dispatch F: spacing phase 2 (GEN-2609-107): zero visual change, spacing hidden from the admin editor

> **New branch `chore/spacing-p2-f` off `origin/qa`.** Push after every commit. Chat merges. Autopilot. Budget about 150 turns; if you run short, push what's done and report PARTIAL (chat re-runs for the rest).
**FIRST ACTION:** status file `RESULT: PARTIAL chore/spacing-p2-f none`. Read `docs/testing-rules.md`, HANDOFF part 27 (phase 2 inputs), #718 (phase 1 codemod), `scripts/verify-equivalence.js`, `src/lib/design-tokens.ts`, `/dashboard/admin/design-system`.

Decision (24 Sep, chat, delegated): spacing moves onto the `--afa-space-*` scale for hygiene, but **individual spacing tokens are NOT admin knobs**.

1. **Safety net first:** add a spacing per-site check to `verify-equivalence.js` (each converted site resolves to the identical px value as before). Commit it alone.
2. **Values with no token:** for those used ≥ 10 times (40px ×35, 80px ×32, 64px ×20, 56px ×16, and any others ≥ 10), **add tokens to the scale** with the exact value (zero visual change), in `globals.css`, `design-tokens.ts`, the reference doc and the QA `DesignToken` table (insert rows for QA only, and list the SQL in the handoff). Then convert those sites. Rare odd values (3px, 5px, 9px, …) stay literal with a scoped `token-ok(spacing): <reason>`, unless an existing token is within 0px, i.e. identical.
3. **Negative margins (13):** express as `calc(-1 * var(--afa-space-…))` where a token matches exactly, else leave with `token-ok(spacing)`.
4. **Hidden sites** (30 ternary, 8 calc(), 2 template, 1 variable): convert where the value maps exactly; leave the rest with a reason.
5. **Admin editor:** hide the spacing group in `/dashboard/admin/design-system` (keep the DB rows and runtime injection). Test: the spacing group isn't shown to the admin (temp admin, `@needs-db`, CI only).
6. **Proof of zero visual change:** Playwright full-page screenshots of 10 key pages at 390 and 1440 on `origin/qa` versus the branch, with a pixel diff of 0 (tolerance for anti-aliasing only), committed as a reusable `e2e/visual-equivalence.spec.ts` that is skipped unless `VISUAL_BASE_URL` is set, so it doesn't run in normal CI. Report the per-page diff.

Ratchet: the spacing-literal baseline must drop; report from-to. Status file at the end: `RESULT: PUSHED|PARTIAL <branch> <sha>`, the tokens added, sites converted, literals left (with reasons), and the visual diff results.
