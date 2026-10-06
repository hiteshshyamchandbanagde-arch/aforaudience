# CC dispatch L: two e2e races that the faster Mumbai region exposed (PR #738)

> **Existing branch `perf/region-bom1`** (PR #738, head `2aa0f7f`). Add commits and push. Do not rebase or force-push. Chat merges. Autopilot. Budget about 40 turns. Do not edit `.github/workflows/`. **Don't touch `vercel.json` or `e2e/function-region.spec.ts`.** Those are done and proven: the test failed with iad1 before the fix and passes with bom1 after.

**FIRST ACTION:** status file `RESULT: PARTIAL perf/region-bom1 2aa0f7f`. Update it before you run out of turns.

e2e-preview on `2aa0f7f` (bom1) went from 23 min to 9 min 21 s. The region test passed. These 2 tests failed:

**1. `colour-closeout.spec.ts:101` [GEN-2609-113] "Buy-in required" on artist events.** Chat traced the cause. The page lists all cities first, then narrows to Hrithik's home city once `/api/venues/cities` and `/api/user/location` answer. Hrithik's city is Ballari, which has an approved venue (Phillaur Bar). The buy-in fixture event is in Bengaluru, so it disappears after the narrowing. The test only passed when it measured before that happened, and faster responses closed that window. It also failed on K's iad1 preview, so this race was there before #738. `waitlist-wallet-credit.spec.ts` `openBrowseEvents()` already handles this properly: it waits for networkidle, then selects "All Cities" until the card stays. Reuse that, moving it into a shared helper if that's clean. Show the old test failing and the new one passing.

**2. `chat-bubble.mobile.spec.ts:76` [BUG-2609-068/081] profile at 390.** "Become an Artist" was covered by the chat button with the page scrolled to the end. This passed on the iad1 runs. Root-cause it: either the test measures before the profile finishes loading (a test race), or the page really lets the chat button cover that button. **If it's a real overlap, that's a product bug.** Fix the layout, don't the test, and say so plainly.

Run both specs 10 times in a row against the branch preview and report the pass counts.

Status file at the end: `RESULT: PUSHED perf/region-bom1 <sha>`, the root cause of each, the 10× results, the CI link, and a **Human check** (only if #2 turns out to be a real layout fix).
