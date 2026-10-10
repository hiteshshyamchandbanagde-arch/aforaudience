<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:afa-testing-rule -->
# Testing rule (always applies)
Read and follow `docs/testing-rules.md` for every change: every fix leaves a permanent committed test (regression test failing on `origin/qa`, passing on the branch), live checks go into `e2e/` as specs, no skip/only, no loosening or deleting tests to pass, and every handoff reports tests added, before/after results, the CI link and a Human check list.
<!-- END:afa-testing-rule -->
# Small-chunk rule (always applies — Hitesh, 9 Oct 2026)
Run every task in small chunks. Within a run: one small edit at a time, then commit and push before the next. Never edit more than one dictionary/locale file in a single tool call, never rewrite a whole large file, and split big specs into several commits. Chat keeps each dispatch to a small scope (about 2-4 tickets or one page group); if a dispatch is too big to finish in small steps, finish a pushed part and say what is left in the status file.
Tests too (Hitesh, 11 Oct 2026): run tests, fixes and implementation in small chunks to avoid token loss. Locally run only the specs you touched (or `npx playwright test --shard=i/N`), never the whole suite in one go; CI runs the suite as 6 sequential shards (e2e.yml / e2e-preview.yml), each with its own 15-min limit.
