# CC dispatch E: email/PDF contrast + design-token tests in CI (GEN-2610-001)

> **New branch `fix/email-pdf-contrast-e` off `origin/qa`.** Push after every commit. Chat merges. Autopilot. Budget about 80 turns.
**FIRST ACTION:** status file `RESULT: PARTIAL fix/email-pdf-contrast-e none`. Read `docs/testing-rules.md`, the #721 code (ticket email, ticket PDF, poster routes, token resolver), and `scripts/design-tokens.test.ts`.

Decided (2 Oct, chat): the ticket email and PDF stay **light documents** (ink on cream).
1. **[GEN-2610-001] Small orange text on cream is 2.81:1.** Keep `--afa-fill-solid` for fills, bars and large type (≥ 18.66 px bold / 24 px) only. Small label text on the light documents uses `--afa-ink`, or a resolver-derived darkened accent if the design needs an orange tint, at ≥ 4.5:1. Re-measure every small-text colour pair in the email HTML and the PDF.
   - Test: a unit test over the email renderer's output (parse its inline styles) and the PDF's colour choices (the resolver output used by the PDF), asserting every small-text pair is ≥ 4.5:1 and large or fill uses are exempt. **It must fail on `origin/qa`** (the 2.81 pair).
2. **Resolver tests in CI:** add `scripts/design-tokens.test.ts` to the `design-tokens` workflow (it isn't run today), and make sure it passes.
3. **Jaipur mobile smoke:** the ticket said the Jaipur Mic Gala 100 smoke fails on mobile. Recent full runs are green, so check whether it's now fixed or just not picking a booked seat by luck. Make seat picking choose an **available** seat explicitly (Hitesh holds C3/C5/B3/B5 and F5-F8). Report what you found.

No visual change on the site itself (email and PDF only). Status file at the end: `RESULT: PUSHED <branch> <sha>`, contrast before/after per pair, red-on-qa/green-on-branch for the new test.
