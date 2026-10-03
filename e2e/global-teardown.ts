import { request, type FullConfig } from "@playwright/test";
import { warn } from "./helpers/qa-db";
import { ADMIN_AUTH_FILE, deleteTempAdmin, readTempAdminRun, restoreGoalToken } from "./helpers/temp-admin";

/**
 * Runs once after the suite, whatever the result: removes the run's temp
 * admin (helpers/temp-admin.ts). Before that, the last resort for the goal
 * test: if --afa-selected is not back to the value recorded at the start,
 * it is put back in the DB and the site's token cache is cleared through
 * the revalidate route, as the admin (the route is admin-only).
 */
export default async function globalTeardown(config: FullConfig) {
  const run = readTempAdminRun();
  if (!run) return;

  try {
    if (await restoreGoalToken(run)) {
      warn("e2e teardown", `${run.tokenKey} was not reverted by the spec - put back to ${run.originalValue} in the database.`);
      const baseURL = config.projects[0]?.use?.baseURL;
      const ctx = await request.newContext({ baseURL, storageState: ADMIN_AUTH_FILE });
      try {
        const res = await ctx.post("/api/admin/design-tokens/revalidate/");
        if (!res.ok()) warn("e2e teardown", `Token cache refresh failed (HTTP ${res.status()}); the site picks the value up within 5 minutes.`);
      } finally {
        await ctx.dispose();
      }
    }
  } finally {
    await deleteTempAdmin(run);
    console.log(`[e2e teardown] deleted the temp admin ${run.email}`);
  }
}
