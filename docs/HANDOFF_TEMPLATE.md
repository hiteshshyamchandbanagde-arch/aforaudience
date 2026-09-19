# Session Handoff — [DATE] ([chat|CC] — [one-line goal of this session])

This is a **template**, not a filled-in handoff. Copy this whole structure into a new top entry in `HANDOFF.md` at the start of every session's write-up (newest entry on top, per the existing "supersedes, does not delete" convention — older entries stay below, never deleted). Fill in every `[bracketed]` placeholder; delete guidance sentences that aren't bracketed once the real content replaces them. Sections 6, 9, 11 carry real, currently-true content already (not placeholders) — copy them forward unchanged unless the fact itself has actually changed, and say so explicitly if it has.

## 1. Last 5 sessions summary

| Session / date | Goal | Status | Remarks | Branches committed |
|---|---|---|---|---|
| [date] | [one line] | [done / partial / blocked] | [anything non-obvious] | [branch name(s)] |

Keep exactly the 5 most recent rows; drop the oldest as a new one is added. This is a fast-scan table, not a narrative — the narrative lives in the session's own numbered sections below it.

## 2. Activity in progress

List every ticket/branch actively being worked *right now*, across all lanes (chat and CC both) — not finished, not abandoned:

- `[GEN/BUG/FEAT-xxxx-xxx]` — `[branch name]` — [current state: built-not-pushed / pushed-no-PR / PR open / rebase needed / blocked on X]

## 3. Open PRs awaiting action

| Branch | PR # | CI status | Merge-ready? |
|---|---|---|---|
| `[branch]` | `[#nnn]` or **`NOT YET OPENED`** | `[green/red/pending]` | `[y/n, and why not if n]` |

A pushed branch with no PR opened yet is a silent stall point — always write `NOT YET OPENED` explicitly rather than leaving the cell blank, so it reads as a flagged gap, not an oversight.

## 4. Decisions currently sitting with Hitesh

Running queue — entries are removed only once **resolved**, not once their branch merges (a decision can resolve before or after its code lands):

| Question | Options | Status | Resolution |
|---|---|---|---|
| [the actual question, framed so a yes/no or a pick-one answers it] | [option A / option B / ...] | `open` / `resolved` | [what Hitesh actually decided, and when — blank while open] |

## 5. `CodeCounter` state

- Current value(s): `[prefix/yearMonth: N]` for every prefix touched recently (GEN, BUG, FEAT, etc.)
- Last verified against the real DB: `[timestamp]` (a value copied from a prior handoff without re-querying is not "verified" — say so if that's what this is)
- **Guard pattern, one-line reminder:** always `SELECT` the real row immediately before any write; condition every `UPDATE ... currentSeq` on the value you just read (`WHERE "currentSeq" = <value you read>`); never advance the counter from a cached/remembered number, even from earlier in the same session.

## 6. Known GEN-numbering collisions/gaps ledger

**Permanent, append-only.** Add a row when a new collision or gap is found and resolved; never remove a row, even after the ticket it describes is long merged. This exists so a collision is never re-discovered from scratch by a future session re-running the same grep.

| Ticket # | What happened | Resolution |
|---|---|---|
| `GEN-2609-054` | Two unrelated pieces of work both self-labeled `GEN-2609-054` in `design.md` (one guessed without `CodeCounter` access at write-time). | The guessed entry was marked `[mislabeled — see correction below]` and its content preserved as historical context; the real `GEN-2609-054` (type-scale/spacing tokens) kept the number. |
| `GEN-2609-069` | Two unrelated commits both self-labeled `GEN-2609-069`: `ee9e47c` (PR #637, "confirmed-state action row wrapping," 14 Sep) predates the toggle-pill-variant ticket that's actually logged as `GEN-2609-069` in the `Feedback` table (16–17 Sep). | The existing `GEN-2609-069` `Feedback` entry stayed untouched (already backfilled and real); `ee9e47c`/PR #637 was renumbered to `GEN-2609-071` since it had no existing `design.md` entry or `Feedback` row of its own to break. |

Add new rows below this line as future collisions surface:

| Ticket # | What happened | Resolution |
|---|---|---|
| `[GEN-xxxx-xxx]` | [what collided, with commit/PR refs] | [how it was resolved, and why that number/side won] |

## 7. Docs-conflict watchlist

Any branch **currently open** (not yet merged) that touches `docs/design.md` or `HANDOFF.md`:

- `[branch name]` — touches `[design.md / HANDOFF.md / both]` — [what it's likely to conflict with, if another open branch also touches the same file]

Two branches appending to the same file's end (`design.md`) or top (`HANDOFF.md`) will conflict on merge — not a code conflict, but still real work to reconcile (keep both sides' entries, reorder chronologically if needed, never let one side silently overwrite the other). Listing every currently-open docs-touching branch here means the conflict is expected, not discovered cold at merge time.

## 8. Verification standard checklist

Every session ticks this, per build, before calling anything merge-ready:

- [ ] `tsc --noEmit` clean
- [ ] `check-design-tokens.js` clean (`BASE_REF=origin/qa HEAD_REF=HEAD node scripts/check-design-tokens.js`)
- [ ] `next build` clean — run in the **foreground**, exit code checked via `$PIPESTATUS` on the shell's own `PIPESTATUS[0]`, not read off a backgrounded task's reported exit code. (A backgrounded `next build` has previously reported a false-positive clean exit against a commit that actually failed to build — see `docs/design.md`'s `GEN-2609-073` entry for the full incident. Treat every backgrounded build result as provisional until confirmed with a foreground re-run before it gates a real decision.)

## 9. Production-freeze reminder

**Freeze is active until "company registered." No exceptions. No production Supabase access. No `qa` → `main` merge.** This line does not change between handoffs — copy it forward verbatim every time, and say so explicitly (rather than silently omitting it) if the freeze itself is ever lifted.

## 10. UI/UX Design System Debt Ledger

Running table, updated whenever a token/typography/Button migration ticket lands (not every session — only ones that move this baseline):

| Metric | Value | As of |
|---|---|---|
| Legacy (non-locked) `--afa-*` color tokens still defined | `[count]` | `[ticket #, date]` |
| Orphaned tokens (defined, zero live usages) | `[count]` | `[ticket #, date]` |
| Public content pages migrated to locked tokens | `[N of 11]` | `[ticket #, date]` |
| Public content pages NOT yet migrated | `[list, or "none — full 11/11 as of GEN-2609-073"]` | `[ticket #, date]` |
| Raw `<button>` elements repo-wide | `[count]` | `[ticket #, date]` |
| Raw `<button>` migrated to shared `Button` component | `[count]` / `[count]` ratio | `[ticket #, date]` |

Update this table as a diff against its own last row, not a full repo re-scan, whenever a migration PR merges — the point is that the next audit starts from a known baseline instead of re-deriving these numbers from zero.

## 11. Canonical locked-tokens source-of-truth pointer

**`docs/afa-design-tokens-reference.md`** is the single real source of truth for locked design tokens — confirmed during `GEN-2609-074`, which also found that "`design-system.md`" (named in an earlier dispatch) does not exist anywhere in this repo. Any PR that introduces a new `--afa-*` token must update `docs/afa-design-tokens-reference.md`'s Section 1 token table **in the same PR**, not as a follow-up — a token merged without its reference-doc entry is the exact drift this ledger exists to prevent.

## 12. Immediate next action

**[One single sentence: the first concrete thing the next session does. No "and also," no list — if there are multiple candidates, name the one that actually blocks the others and put the rest in section 2/4 instead.]**

## 13. Chat vs. CC ownership note

**Standing model, decided (not an open question, not a one-off exception to re-flag each time):** **chat** owns all PR-open/merge and git-write operations (pushing branches, opening PRs, merging), gated on a session-scoped GitHub PAT Hitesh provides that session; **CC** owns all coding — branching, editing, committing, verifying locally, and pushing its own feature branches. Neither lane crosses into the other's job. This is exactly the split observed across the `GEN-2609-070` through `-074` sessions once the PAT was provided (before that, chat had read-only access — clone-and-read but no write, confirmed directly rather than assumed); that pattern is the standing model going forward, not something to log as a deviation each time it recurs. Per-item in sections 2/3, note which lane each open item belongs to.

**Forward-looking note, not yet acted on:** chat's half of this depends on Hitesh manually re-pasting a short-lived PAT each session — real friction, and a bare token in a chat transcript even briefly is worth removing on its own. Hitesh is considering moving chat's git-write auth to a proper GitHub connector (already configured for this project, not yet given repo-scoped write permissions) instead. If/when that changes, update this section again - the ownership split itself won't change, only *how* chat authenticates to exercise its half of it.

---

*Copy everything above this line into `HANDOFF.md`'s new top entry. Do not edit this template file itself except to add a new row to section 6's permanent ledger when a genuinely new collision is found — that's the one section meant to accumulate here as well as in each session's own copy.*
