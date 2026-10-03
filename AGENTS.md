<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:afa-testing-rule -->
# Testing rule (always applies)
Read and follow `docs/testing-rules.md` for every change: every fix leaves a permanent committed test (regression test failing on `origin/qa`, passing on the branch), live checks go into `e2e/` as specs, no skip/only, no loosening or deleting tests to pass, and every handoff reports tests added, before/after results, the CI link and a Human check list.
<!-- END:afa-testing-rule -->
