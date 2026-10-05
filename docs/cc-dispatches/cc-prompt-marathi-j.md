# CC dispatch J: Marathi locale (GEN-2609-120) + PhoneVerifyNudge strings (BUG-2609-029)

> **New branch `feat/marathi-j` off `origin/qa`.** Push after every commit. Chat merges. Autopilot.

**FIRST ACTION:** status file `RESULT: PARTIAL feat/marathi-j none`. Budget about 80 turns. Read `docs/testing-rules.md`, `src/lib/i18n/locales.ts`, `src/lib/i18n/dictionaries/en.ts` and `hi.ts` (Devanagari reference), wherever `VALID_LOCALE_IDS` is duplicated as a literal (the pre-paint script), and `PhoneVerifyNudge.tsx`.

Launch is Pune-first and there is no Marathi.

1. **Tests first (T1)**, failing on `origin/qa`:
   - a dictionary-parity unit test: every locale has exactly the keys of `en.ts`, no empty values, interpolation placeholders (`{name}` etc.) identical to English. If this already exists, extend it to `mr`.
   - an e2e spec at 390 and 1440: pick मराठी in the language picker, reload, the choice persists and nav chrome renders in Marathi with no English fallbacks and no overflowing labels (Marathi strings run long).
   - for BUG-2609-029: PhoneVerifyNudge renders translated in at least `hi` and `mr`.
2. **`mr` locale:** `{ id: "mr", label: "Marathi", nativeLabel: "मराठी" }` placed right after Hindi, plus `dictionaries/mr.ts` covering every key. Use natural, everyday Marathi as spoken in Pune: not Sanskritised and not a word-for-word copy of the Hindi. Keep brand and product terms the way Hindi does (AforAudience, AFA code, OTP, UPI). Update every literal copy of the locale allow-list.
3. **BUG-2609-029:** move PhoneVerifyNudge's hard-coded strings into the dictionaries for all 12 locales.
4. **`DEFAULT_LOCALE` stays `en`.** Do not auto-select Marathi for anyone; that is a pending product decision.
5. Add `docs/i18n/mr-review.md`: a two-column table (English | Marathi) of the 40 most visible strings (nav, checkout, tickets, buttons) for Hitesh's native read on his phone.

No loosened tests (T2). Status file at the end: `RESULT: PUSHED feat/marathi-j <sha>`, key count, tests before/after, **Human check**: read `docs/i18n/mr-review.md` and the live UI in मराठी on a phone.
