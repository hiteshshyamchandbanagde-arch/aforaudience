// Prints a one-line result of the last Playwright run as a GitHub check-run
// annotation (and to the job summary), read from the JSON reporter's
// test-results/results.json. Run as the last step of the e2e workflows with
// `if: always()`, so the counts are readable through the GitHub API even
// when the logs and artifacts are not.
//
// Never changes the job's result: the Playwright step already decides that.
import fs from "node:fs";

const file = process.argv[2] ?? "test-results/results.json";
const label = process.env.E2E_SUMMARY_LABEL ?? "e2e";

function emit(level, message) {
  console.log(`::${level} title=${label}::${message}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `**${label}:** ${message}\n`);
  }
}

if (!fs.existsSync(file)) {
  emit("error", `no ${file} was written - the suite did not start (see the global-setup error above) or the job was killed`);
  process.exit(0);
}

const { stats = {}, errors = [] } = JSON.parse(fs.readFileSync(file, "utf8"));
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
