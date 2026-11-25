// Prints a one-line result of the last Playwright run as a GitHub check-run
// annotation (and to the job summary), read from the JSON reporter's
// test-results/results.json. Run as the last step of the e2e workflows with
// `if: always()`, so the counts are readable through the GitHub API even
// when the logs and artifacts are not.
//
// It also lists the tickets the run verified (docs/testing-rules.md T5): a
// spec that verifies a ticket carries its ID in square brackets in its
// title, e.g. test("[BUG-2609-077] ...") (docs/test-coverage-map.md). A
// ticket passed when every test carrying it passed; it failed when any did.
//
// Never changes the job's result: the Playwright step already decides that.
import fs from "node:fs";

// One file, or several (CI shards): stats, errors and suites are added up.
const files = process.argv.length > 2 ? process.argv.slice(2) : ["test-results/results.json"];
const label = process.env.E2E_SUMMARY_LABEL ?? "e2e";

function emit(level, message) {
  console.log(`::${level} title=${label}::${message}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `**${label}:** ${message}\n`);
  }
}

const missing = files.filter((f) => !fs.existsSync(f));
for (const f of missing) {
  emit("error", `no ${f} was written - the suite did not start (see the global-setup error above) or the job was killed`);
}
const present = files.filter((f) => fs.existsSync(f));
if (present.length === 0) process.exit(0);

const stats = {};
const errors = [];
const suites = [];
for (const f of present) {
  const r = JSON.parse(fs.readFileSync(f, "utf8"));
  for (const k of ["expected", "unexpected", "flaky", "skipped", "duration"]) stats[k] = (stats[k] ?? 0) + (r.stats?.[k] ?? 0);
  errors.push(...(r.errors ?? []));
  suites.push(...(r.suites ?? []));
}
const passed = stats.expected ?? 0;
const failed = stats.unexpected ?? 0;
const flaky = stats.flaky ?? 0;
const skipped = stats.skipped ?? 0;
const seconds = Math.round((stats.duration ?? 0) / 1000);
const duration = `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;

const line = `${passed} passed, ${failed} failed, ${flaky} flaky, ${skipped} skipped in ${duration}`;
if (errors.length > 0 && passed + failed + flaky === 0) {
  // A global-setup failure: no test ran at all.
  const first = String(errors[0]?.message ?? "").split("\n")[0];
  emit("error", `no tests ran - ${first}`);
} else {
  emit(failed > 0 ? "error" : flaky > 0 ? "warning" : "notice", line);
}

// Ticket IDs in brackets anywhere in a test's full title (file, describe, test).
const TICKET = /\[((?:BUG|FEAT|GEN)-\d{4}-\d{3})\]/g;

/** Every test result in the report, with its full title. */
function* testsIn(suite, titles = []) {
  const path = [...titles, suite.title];
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) yield { title: [...path, spec.title].join(" "), status: t.status };
  }
  for (const child of suite.suites ?? []) yield* testsIn(child, path);
}

// expected/flaky passed (flaky on a retry); unexpected failed; skipped did not run.
const tickets = new Map();
for (const suite of suites) {
  for (const { title, status } of testsIn(suite)) {
    for (const [, id] of title.matchAll(TICKET)) {
      const t = tickets.get(id) ?? { ran: 0, failed: 0 };
      if (status === "unexpected") t.failed++;
      if (status !== "skipped") t.ran++;
      tickets.set(id, t);
    }
  }
}
const ids = [...tickets.keys()].sort();
const passedIds = ids.filter((id) => tickets.get(id).failed === 0 && tickets.get(id).ran > 0);
const failedIds = ids.filter((id) => tickets.get(id).failed > 0);
const notRunIds = ids.filter((id) => tickets.get(id).ran === 0);
if (ids.length > 0) {
  emit("notice", `TICKETS PASSED: ${passedIds.join(", ") || "none"}`);
  emit(failedIds.length > 0 ? "error" : "notice", `TICKETS FAILED: ${failedIds.join(", ") || "none"}`);
  if (notRunIds.length > 0) emit("notice", `TICKETS NOT RUN (skipped or left out): ${notRunIds.join(", ")}`);
}
