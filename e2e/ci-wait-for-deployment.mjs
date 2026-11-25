// Waits for Vercel to finish deploying a commit and hands its URL to the
// following workflow steps as PLAYWRIGHT_BASE_URL.
//
//   node e2e/ci-wait-for-deployment.mjs <owner/repo> <sha>
//
// Used by e2e.yml on a push to qa: the job starts while Vercel is still
// building, and the QA alias serves the previous build until it is done, so
// without this the suite would test the commit before the one just merged.
//
// Reads the GitHub Deployments API (GH_TOKEN). Gives up after 12 minutes,
// or as soon as the deployment reports a failure, and fails the job with one
// clear message.
import fs from "node:fs";

const [repo, sha] = process.argv.slice(2);
const token = process.env.GH_TOKEN;
if (!repo || !sha) {
  console.error("usage: [GH_TOKEN=...] node e2e/ci-wait-for-deployment.mjs <owner/repo> <sha>");
  process.exit(2);
}

const DEADLINE_MS = 12 * 60 * 1000;
const POLL_MS = 15 * 1000;

async function api(path) {
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    // The token is optional on a public repository (it only raises the rate limit).
    headers: { Accept: "application/vnd.github+json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`GitHub API ${path}: HTTP ${res.status}`);
  return res.json();
}

function fail(message) {
  console.log(`::error title=e2e-qa::${message}`);
  process.exit(1);
}

const started = Date.now();
while (Date.now() - started < DEADLINE_MS) {
  const deployments = await api(`/deployments?sha=${sha}&per_page=20`);
  for (const deployment of deployments) {
    if (/^production/i.test(deployment.environment ?? "")) continue;
    const [latest] = await api(`/deployments/${deployment.id}/statuses?per_page=1`);
    if (!latest) continue;
    if (latest.state === "success") {
      const url = latest.environment_url || latest.target_url;
      console.log(`Deployment of ${sha.slice(0, 7)} is ready: ${url}`);
      if (process.env.GITHUB_ENV) fs.appendFileSync(process.env.GITHUB_ENV, `PLAYWRIGHT_BASE_URL=${url}\n`);
      process.exit(0);
    }
    if (latest.state === "failure" || latest.state === "error") {
      fail(`The deployment of ${sha.slice(0, 7)} failed (${latest.state}) - nothing to test. No tests were run.`);
    }
  }
  console.log(`No finished deployment for ${sha.slice(0, 7)} yet (${Math.round((Date.now() - started) / 1000)} s)...`);
  await new Promise((resolve) => setTimeout(resolve, POLL_MS));
}
fail(`No deployment of ${sha.slice(0, 7)} became ready within 12 minutes. No tests were run.`);
