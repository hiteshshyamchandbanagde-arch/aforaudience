import type { APIRequestContext } from "@playwright/test";
import { request as playwrightRequest } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { authFile, type PersonaKey } from "./helpers/personas";

/**
 * BUG-2609-020 - the dashboard sidebar's role sections (Create Event,
 * Sales, My Venues, ...) popped in late: DashboardShell found out which
 * roles the user holds with three client-side fetches after the session
 * loaded. Now the held roles are worked out on the server
 * (src/lib/held-roles.ts, dashboard/tickets/profile layouts), so the
 * role items are in the first HTML the server sends.
 *
 * Checked on the raw server response (no JavaScript run), for Omkar
 * (Organiser and Venue Owner) and Atul (Audience only, so the items are
 * there because of the roles, not always):
 * - dashboard pages: both role sections' links are in the HTML;
 * - /tickets and /profile: their page body renders after its own data
 *   loads, so the sidebar is not in the HTML there, but the held roles
 *   the shell reads are (the HeldRolesProvider value in the server
 *   payload): no client round-trip is needed for them.
 * Read-only.
 */

const ORGANISER_ITEM = /href="\/dashboard\/organiser\/events\/create\/?"/;
const VENUE_ITEM = /href="\/dashboard\/venue\/create\/?"/;

async function serverHtml(persona: PersonaKey, path: string, baseURL: string) {
  const api: APIRequestContext = await playwrightRequest.newContext({ baseURL, storageState: authFile(persona) });
  try {
    const res = await api.get(path, { maxRedirects: 0 });
    expect(res.status(), `${path} as ${persona}: served, not redirected`).toBe(200);
    return await res.text();
  } finally {
    await api.dispose();
  }
}

/** The held roles the server sent with the page (RSC payload, escaped JSON). */
function heldRoles(html: string) {
  const m = html.replace(/\\"/g, '"').match(/"value":\{"ORGANISER":(true|false),"ARTIST":(true|false),"VENUE_OWNER":(true|false)\}/);
  return m ? { ORGANISER: m[1] === "true", ARTIST: m[2] === "true", VENUE_OWNER: m[3] === "true" } : null;
}

test("[BUG-2609-020] the dashboard role menu comes with the first server response, for the roles held", async ({ baseURL }) => {
  for (const path of ["/dashboard/organiser/sales/", "/dashboard/venue/bookings/"]) {
    const html = await serverHtml("omkar", path, baseURL!);
    expect(html, `Omkar ${path}: Create Event in the server HTML`).toMatch(ORGANISER_ITEM);
    expect(html, `Omkar ${path}: Register Venue in the server HTML`).toMatch(VENUE_ITEM);
  }
  const audience = await serverHtml("atul", "/dashboard/audience/", baseURL!);
  expect(audience, "Atul /dashboard/audience/: no organiser items").not.toMatch(ORGANISER_ITEM);
  expect(audience, "Atul /dashboard/audience/: no venue items").not.toMatch(VENUE_ITEM);

  for (const path of ["/tickets/", "/profile/"]) {
    expect(heldRoles(await serverHtml("omkar", path, baseURL!)), `Omkar ${path}: held roles in the server payload`).toEqual({
      ORGANISER: true,
      ARTIST: false,
      VENUE_OWNER: true,
    });
    expect(heldRoles(await serverHtml("atul", path, baseURL!)), `Atul ${path}: held roles in the server payload`).toEqual({
      ORGANISER: false,
      ARTIST: false,
      VENUE_OWNER: false,
    });
  }
});
