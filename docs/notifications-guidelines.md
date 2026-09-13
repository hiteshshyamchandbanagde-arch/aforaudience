# Notifications Guidelines

UI/UX audit Section 09 / Step 6, sub-spec 4/5 (fourth of five one-page
specs, after `docs/motion-guidelines.md`, `docs/accessibility-guidelines.md`,
`docs/icon-system-guidelines.md`). Scope: catalog every push-notification
send site, the service-worker's push contract, the opt-in flow's rules of
engagement, and the badge-count endpoint's real role coverage - plus one
token-cleanup fix. Every number below was independently re-derived from
real source (`grep`, direct file reads, `qa` @ `3f3e9ee`), not taken from
the dispatch's own figures. Two of this pass's own starting numbers needed
correcting; see Section 1 and Section 4.

## 1. Push send-site catalog

`sendPushToUser`/`sendPushToRole` (`src/lib/push.ts`) are the only two
functions that send a push. **Real count: 19 call-site files (not
`src/lib/push.ts` itself, which only defines them), 31 individual call
sites (not "21 files / 25+ call sites")** - re-verified via
`grep -rn "sendPushToUser(\|sendPushToRole(" --include="*.ts" --include="*.tsx" src`
excluding the definition file itself. Every `title`/`body` below is a
literal string at the call site; none read from
`src/lib/i18n/dictionaries/*` (confirmed via grep for
`dictionaries|getDictionary|useTranslation` across all 19 files - zero
hits).

| File : line | Trigger | Recipient | Title | Target `url` |
|---|---|---|---|---|
| `api/admin/approvals/route.ts:69` | Admin approves/rejects Organiser application | Organiser | "You're approved as an Organiser!" / "Organiser application update" | `/dashboard/organiser` or `/profile` |
| `api/admin/approvals/route.ts:94` | Admin approves/rejects Venue Owner application | Venue Owner | "You're approved as a Venue Owner!" / "Venue Owner application update" | `/dashboard/venue` or `/profile` |
| `api/applications/[id]/route.ts:101` | Organiser approves/rejects an artist's application | Artist | "You're in the lineup!" / "Application update" | `/dashboard/artist/events` |
| `api/applications/route.ts:99` | Artist applies, lineup full | Artist (self) | "Added to waitlist" | `/dashboard/artist/events` |
| `api/applications/route.ts:117` | Artist applies, auto-approved | Artist (self) | "You're in the lineup!" | `/dashboard/artist/events` |
| `api/applications/route.ts:130` | Artist applies to an event | Organiser | "New application to review" | `/dashboard/organiser/events/[id]` |
| `api/bookings/[id]/companions/route.ts:149` | Booker tags a companion | Tagged user (any role) | "You've been tagged" | `/tickets` |
| `api/companions/[tagId]/respond/route.ts:56` | Tagged user accepts/declines | Original tagger (any role) | "Companion confirmed" / "Companion declined" | `/tickets` |
| `api/conversations/[id]/messages/route.ts:111` | New conversation message | Other participant(s) (any role) | `New message from {sender}` | `/dashboard/messages/[id]` |
| `api/cron/post-show-rating-prompts/route.ts:53` | Cron, post-show | Audience (booker) | "How was the show?" | `/events/[id]/rate` |
| `api/events/[id]/invite-artist/route.ts:108` | Organiser invites artist | Artist | "You've been invited to perform!" | `/dashboard/artist/events` |
| `api/events/[id]/tour-lineup/route.ts:120` | Organiser invites artist to Tour stop | Artist | "You've been invited to a Tour!" | `/dashboard/artist` |
| `api/events/route.ts:465` / `:489` | Organiser creates booking request | Venue Owner | "New venue booking request" | `/dashboard/venue-requests` |
| `api/messages/broadcast/route.ts:64` | Organiser broadcasts to lineup | Artist(s) | `Message from {organiser}` | `/dashboard/artist/messages` |
| `api/organisers/apply/route.ts:59` | User applies as Organiser | Admin (role broadcast) | "New Organiser application" | `/dashboard/admin` |
| `api/performances/[id]/cancel/route.ts:99` | Artist cancels, waitlist promoted | Artist (promoted) | "You're in the lineup!" | `/dashboard/artist/events` |
| `api/performances/[id]/cancel/route.ts:108` | Artist cancels | Organiser | "Artist cancelled" | `/dashboard/organiser/events/[id]` |
| `api/reviews/[id]/reply/route.ts:57` | Reply posted to a review | Review author (Audience) | "Reply to your review" | `/events/[id]` |
| `api/reviews/route.ts:97` | New review of a performance | Artist | `New {n}★ review` | `/dashboard/artist` |
| `api/reviews/route.ts:116` | New review of an event | Organiser | `New {n}★ review for {event}` | `/dashboard/organiser/events/[id]` |
| `api/venue-booking-requests/[id]/route.ts:98` | Request declined/withdrawn | Other side (Organiser or Venue Owner) | "Venue booking request declined" | `/dashboard/venue-requests` |
| `api/venue-booking-requests/[id]/route.ts:164` | Request accepted | Other side | "Venue booking confirmed!" | `/dashboard/venue-requests` |
| `api/venue-booking-requests/[id]/route.ts:199` | Counter-offer made | Other side | "New counter-offer" | `/dashboard/venue-requests` |
| `api/venue-owners/apply/route.ts:41` | User applies as Venue Owner | Admin (role broadcast) | "New Venue Owner application" | `/dashboard/admin` |
| `lib/follow.ts:80` | Someone follows an org/venue | Followed entity's owner (any role) | "New follower" | Owner's dashboard |
| `lib/follow.ts:142` | Followed entity announces an event | Follower(s) (any role) | "New event" | `/events/[id]` |
| `lib/plus-one.ts:100` | +1 confirms attendance | Artist | "You're fully supported!" / "New +1 confirmed" | `/dashboard/artist` |
| `lib/ticket-delivery.ts:241` | Event sells out | Organiser | "Sold out! 🎉" | `/dashboard/organiser/events/[id]` |
| `lib/ticket-delivery.ts:247` | Event hits 50% sold | Organiser | "Halfway there" | `/dashboard/organiser/events/[id]` |
| `lib/ticket-delivery.ts:253` | Event's first ticket sells | Organiser | "First ticket sold!" | `/dashboard/organiser/events/[id]` |

**Correction to this dispatch's own starting numbers:** the brief cited
"21 files, 25+ call sites." Re-grepping (excluding `push.ts`'s own
function definitions, which the naive file-count included) found the real
figures are **19 files, 31 call sites**.

## 2. Service worker push contract (`public/sw.js`)

- **Payload shape:** `{ title, body, url }` (see `PushPayload` in
  `src/lib/push.ts`, the only sender - the two files are kept in sync by
  convention, not a shared import, since a build step can't cross the
  SW/app boundary for this file).
- **`push` handler** (lines 199-215): defaults to
  `{ title: 'AforAudience', body: 'You have a new notification.', url: '/' }`,
  then spreads the real JSON payload over those defaults if present and
  parseable (`event.data.json()`, caught if it throws). This fallback
  triggers only when a push arrives with no payload or an unparseable one
  - low-frequency, but it is a fourth hardcoded-English string beyond the
  31 call sites in Section 1 (see Section 4).
- **`notificationclick` handler** (lines 220-238): closes the notification,
  reads `event.notification.data.url` (falling back to `/`), then searches
  same-origin open window clients - if one exists, focuses and navigates
  it; otherwise opens a new window at the target URL.

## 3. Opt-in flow rules of engagement (`NotificationOptIn.tsx`)

Mounted globally via `NudgeStack.tsx`. Per the component's own code
comments and logic:

- Shown only if the browser supports Push (`serviceWorker` + `PushManager`
  + `Notification`) and `Notification.permission` is still `'default'` -
  never re-nagged once the user has explicitly granted or denied it.
- Dismissible (unlike `PhoneVerifyNudge`) - not a required gate on any
  flow. Dismissal is **session-scoped**: `window.sessionStorage`, key
  `afora-notif-nudge-dismissed` - reappears in a new browser session, does
  not persist across tabs closing/reopening the same session either way
  `sessionStorage` behaves per-tab.
- Hidden on `/auth`, `/checkout`, `/verify-phone`, `/api` path prefixes -
  same exclusion list convention as the other nudge components, so it
  never competes with a page that has its own time-sensitive ask.
- Any authenticated role can see it (not role-gated) - admin approvals
  already push today; organiser/venue-owner/artist notifications
  (Section 1) are the reason it isn't restricted to one role.
- The banner's own text (`tr.notificationOptIn.*`) is already localized
  (fixed under `BUG-2608-045`) - this is the in-app opt-in prompt, a
  separate surface from the push notifications it's asking permission
  for, and is not part of Section 4's localization gap.

## 4. Badge-count endpoint role coverage (`/api/notifications/pending-count`)

**Confirmed, not a bug:** re-read `route.ts` directly. Only `VENUE_OWNER`
(pending `VenueBooking` + pending `VenueBookingRequest` against their
venues) and `ORGANISER` (pending `Application` + pending
`VenueBookingRequest` they've sent) branches compute a real count.
`ARTIST`, `AUDIENCE`, and `ADMIN` all fall through to the same
`return NextResponse.json({ count: 0 })` at the end of the function -
always zero, not a broken query. This is deliberate scope per the
endpoint's own comment (aggregates the two dashboards' existing per-page
badges into one nav-visible number) - not something this pass is
positioned to judge as a gap or not (Section 5.4).

## 5. Open decisions - flagged, not fixed

### 5.1 Push-content localization (the big one)

All 31 real call sites (Section 1) plus the SW's fallback string
(Section 2) send hardcoded English regardless of the recipient's chosen
language. Two structural blockers, confirmed by reading the schema and
the locale switcher directly, before any call site could be touched:

- **`User` has no `locale` column** (`prisma/schema.prisma`, full field
  list checked - no such field exists).
- **The language switcher is `localStorage`-only, client-side**
  (`STORAGE_KEY = "afa-locale"`, `src/lib/i18n/translate.tsx`) - never
  persisted server-side. Push sends happen in API routes/cron/`lib`
  functions with no access to a client's `localStorage`, so there is
  currently no server-side signal of what language any given user reads
  in, even for the routes that already have the recipient's `userId` in
  hand.

This needs, in order: a `User.locale` column + migration, a decision on
**when** the existing client-side choice gets persisted server-side (on
login? on every locale-switch action via a new `PATCH` endpoint? both?),
and only then can the 31 call sites be migrated to read from
`src/lib/i18n/dictionaries/*` (11 locales: `en`, `hi`, `bn`, `ta`, `te`,
`kn`, `ml`, `gu`, `fr`, `es`, `de`) keyed by each recipient's persisted
locale. None of the 31 call sites were touched this pass - the full list
in Section 1 is the checklist for whoever picks this up.

### 5.2 Emoji vs. icon-registry (`NotificationOptIn.tsx`'s 🔔)

The opt-in banner renders a bare `🔔` character (line 133) rather than a
shared registry icon. This overlaps with
`docs/icon-system-guidelines.md`'s 3-system consolidation section
(Section 5.1 there) - not re-litigated here, just flagged as the same
underlying gap surfacing in a fourth location.

### 5.3 SW fallback string localization

`public/sw.js`'s `{ title: 'AforAudience', body: 'You have a new
notification.', url: '/' }` fallback (Section 2) has the exact same
blocker as Section 5.1 - it fires when a push has no/bad payload, so
whatever locale-resolution mechanism eventually gets built for the 31 real
call sites should cover this path too rather than leaving a fourth
hardcoded string behind.

### 5.4 Badge-count role coverage - a product question, not a bug

Section 4 confirmed Artist/Audience/Admin always see `0` from
`/api/notifications/pending-count` by design, not by omission. Whether
any of those three roles needs a real count - and if so, counting what
(an Artist's own pending applications? an Audience member's unread
companion tags? an Admin's pending role applications, which already push
via `sendPushToRole('ADMIN', ...)` in Section 1?) - is a product
decision, not something to guess at here.

### 5.5 `NotificationOptIn.tsx`'s CTA button - the dispatch's proposed token
swap does not hold

The dispatch asked for a like-for-like swap: `var(--afa-terracotta)` +
hardcoded `white` → the correct locked-palette token, following the
precedent already shipped in `BUG-2609-024`
(`var(--afa-terracotta)` + hardcoded `"white"` → `var(--afa-fill-solid)` +
`var(--afa-on-fill-solid)`, the locked CTA-fill pair). **Re-verifying
against this component's actual context found that precedent doesn't
transfer here, and applying it as written would introduce a real bug:**

- The banner's own **container** already uses
  `background: var(--afa-fill-solid)` (line 121) - it is not a dark
  page/modal background the way every prior `--afa-terracotta` swap site
  was. Retargeting the button's background to the same
  `var(--afa-fill-solid)` token makes the button and its own container
  render the identical hex (`#FF5A36`) - the "Enable" button would
  visually disappear into the banner behind it. This is objectively
  checkable (both resolve to the same custom property) regardless of any
  judgment call.
- Separately, `docs/design.md`'s own stated rule for `--afa-fill-solid`
  ("the CTA-orange, reserved for booking/payment/commit actions,"
  invoked to justify *removing* it from a nav active-state in
  `BUG-2609-022`) is ambiguous for a notification permission-grant
  action - not clearly booking-adjacent the way the `BUG-2609-024`
  buttons were ("commit a queued booking-adjacent action").
- `--afa-amber` (the palette's quiet-accent token, used for the
  equivalent non-commit cases in `BUG-2609-022`/`024`) has **no existing
  precedent as a solid filled-button background** anywhere in the
  codebase - every real usage found is text color, a thin
  `border` on a `transparent` fill, or a small dot/bar accent. Using it
  as a solid pill background here would be a new pattern, not a reuse of
  an existing one.

No token exists in the current palette that reproduces the button's
current rendered color (`#C8441A`) under a different name - any real fix
changes what the button looks like, so this isn't the "not a new design
decision" swap the dispatch assumed. **Left as `--afa-terracotta` +
`white` for now, needs Hitesh's call** on what the "Enable" pill (and, by
the same background context, the dismiss `×`'s `rgba(247,243,238,0.6)`
color, which sits on the same fill-solid banner) should actually look
like. Note for whoever picks this up: `rgba(247,243,238,0.6)` is not a
first-of-its-kind hardcode either - the identical raw
`rgba(247,243,238,α)` pattern is used, untokenized, in 7+ other files
(`app/page.tsx`, `ArtistsNearYou.tsx`, `NearYouTabs.tsx`,
`TonightNearYou.tsx`, both poster routes) as the established convention
for muted cream-on-dark text - so tokenizing it in isolation here would
make this component inconsistent with the rest of the app, not more
consistent.

## Built

Nothing shipped this pass. The originally-scoped mechanical fix (Section
5.5) turned out not to be mechanical once re-verified against this
component's real background context - flagged instead of guessed, per
this dispatch's own instruction not to force a swap that changes
rendered appearance. This spec (catalog + open decisions) is the full
deliverable.
