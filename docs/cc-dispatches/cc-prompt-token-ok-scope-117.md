# CC dispatch: GEN-2609-117 — scope `token-ok` to the rule it names

> **New branch `chore/gen-2609-117-token-ok-scope` off `origin/qa`. Nothing else in this run.** Push, hand off, stop. Chat merges. **Never `git stash pop` on a clean tree.**

**Start:** `git fetch && git reset --hard origin/qa`. Read `HANDOFF.md` parts 13 and 17, and the `token-ok` sections of `scripts/check-design-tokens.js` (~L435-456, ~L674) and `scripts/design-token-ratchet.js` (~L162).

## Why
A trailing `token-ok` currently exempts **every rule on its line** (checker ~L674: "token-ok suppresses every rule on this line"). A one-line JSX style with an exempt `fontSize` plus a `padding` hides the spacing literal too. In #713 this silently dropped spacing 1866 → 1863. It must be fixed before the spacing migration (GEN-2609-107), which will add many reasons.

## Change
1. **Syntax:** `// token-ok(<rule>[,<rule>]): <reason>` and `{/* token-ok(<rule>): <reason> */}`. `<rule>` is an existing rule name from `RULES` (`hex-color-literal`, `rgb-rgba-literal`, `font-size-literal`, `spacing-literal`, `radius-literal`, `hardcoded-font-family`, `raw-button`, `bare-button`). The comment exempts only the named rules on that line; every other rule still runs.
2. **Unscoped `token-ok:` becomes an error** in both the checker and the ratchet, with a message naming the new syntax. An unknown rule name is also an error. No legacy fallback.
3. **Apply the same parsing in `design-token-ratchet.js`,** so counts and checks agree. Share one parser; don't duplicate the regex.
4. **Convert all 31 existing `token-ok` uses in `src/`** to the scoped form, choosing the rule(s) each reason actually covers. Keep every reason text unchanged. If a line needs 2 rules, name both. If a reason no longer applies to anything on the line, say so in the handoff; don't delete it silently.
5. **The `(always shown)` listing** now prints the rule(s) next to each line.
6. **Update the syntax** in the checker's error hint (~L759), in `docs/afa-design-tokens-reference.md`, and anywhere else the old form is documented (grep `token-ok:` in `docs/` and `scripts/`).

## Ratchet (expected to rise; this is the point)
Literals previously hidden by an unscoped `token-ok` will now count. Measure before and after, per category. **Raise the baseline only by exactly the revealed delta,** and list every newly counted literal (file:line, rule) in the handoff. Anything other than a small rise in `spacing-literal` (roughly +3) is a finding: stop and report it rather than raising the baseline.

## Self-tests (add to `check-design-tokens.test.js`)
Scoped comment exempts its rule; the same line's other literal of another rule is still flagged; multi-rule scope; unscoped form errors; unknown rule errors; JSX-comment form; ratchet and checker produce the same counts on a fixture.

## Verification
tsc; `next build`; checker vs origin/qa; ratchet (only the documented rise); all self-tests (design-tokens, check-design-tokens, migrate-tokens); ESLint per-line diff on touched files. No visual change is expected; no screenshots needed.

## Handoff (delta-only)
Compare link, commits, before/after ratchet per category, the revealed-literal list, the 31 conversions as `file:line → rule(s)`, and any reason that turned out to cover nothing.
