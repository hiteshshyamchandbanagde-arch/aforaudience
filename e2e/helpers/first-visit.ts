import type { BrowserContext } from "@playwright/test";

/**
 * First-visit state the app keeps in the browser. A clean Playwright
 * context has none of it, so every test would otherwise start under the
 * intro splash (a full-screen overlay for ~2.5 s) and could meet the
 * install banner or a nudge on top of what it wants to click.
 *
 * Keys are read from the app, not invented here:
 *   introShown                            sessionStorage  src/app/layout.tsx (intro splash)
 *   afora-notif-nudge-dismissed           sessionStorage  src/components/NotificationOptIn.tsx
 *   afora_pwa_install_dismissed_at        localStorage    src/components/pwa/InstallPrompt.tsx (14-day cooldown)
 *   afora_displayname_nudge_dismissed_at  localStorage    src/components/DisplayNameNudge.tsx
 *
 * The welcome sequence (WelcomeSequence.tsx) is not a browser flag: it
 * shows while the signed-in user's `onboardedAt` is null in the database.
 * Every persona is already onboarded; only a freshly registered account
 * meets it (see registration.spec.ts).
 *
 * Playwright's storageState does not carry sessionStorage, so the flags
 * are set by an init script instead, which runs before any page script on
 * every navigation. Timestamps are written only when absent, so a test
 * that dismisses something itself keeps its own value.
 */
export const SESSION_FLAGS: Record<string, string> = {
  introShown: "1",
  "afora-notif-nudge-dismissed": "1",
};

export const LOCAL_TIMESTAMP_FLAGS = [
  "afora_pwa_install_dismissed_at",
  "afora_displayname_nudge_dismissed_at",
];

export async function markFirstVisitDone(context: BrowserContext) {
  await context.addInitScript(
    ({ sessionFlags, localFlags }) => {
      try {
        for (const [key, value] of Object.entries(sessionFlags)) {
          window.sessionStorage.setItem(key, value);
        }
        for (const key of localFlags) {
          if (!window.localStorage.getItem(key)) {
            window.localStorage.setItem(key, String(Date.now()));
          }
        }
      } catch {
        // about:blank and other opaque origins have no storage.
      }
    },
    { sessionFlags: SESSION_FLAGS, localFlags: LOCAL_TIMESTAMP_FLAGS }
  );
}
