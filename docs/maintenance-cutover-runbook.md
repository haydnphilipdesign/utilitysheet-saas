# Maintenance mode and the limiter counter-key cutover

Operator runbook for pausing the five endpoints whose rate-limit counter keys
change in telemetry Slice 1, and for reopening them safely. The reason for the
pause and the 31-minute figure are in
[telemetry-privacy.md](telemetry-privacy.md#required-releasecounter-key-migration-procedure).

> **Owner decision, 2026-10-13:** the Slice 1 release did **not** use this
> procedure. The owner accepted briefly looser rate limits and released it as
> an ordinary deployment (see the amendment in
> `.ai/decisions/2026-10-13-capability-safe-telemetry.md`). Maintenance mode
> ships off by default and remains available as a general pause switch. This
> runbook is kept for a future change where a strict pause is wanted.

**The paused procedure below has never been performed.** Every step in
"Procedure" is a production action that needs the owner's explicit approval
at the time.

## Rules that do not bend

- Keep the pause on for **at least 31 minutes after the last old-version
  request to an affected endpoint finishes**. Not 31 minutes after switching
  maintenance on.
- Every hostname and deployment that shares the production Redis store must be
  covered for the whole pause.
- Never disable rate limiting, never delete counter keys, never let the old
  and new limiter schemes take traffic at the same time.
- Nothing reopens by itself. Reopening is a deliberate deployment.

## What the application provides

**Day to day, use the switch in Admin > Maintenance.** It needs no deployment
and takes effect within about 10 seconds (see `ADMIN.md`, "Maintenance"). The
hosting settings in the table below are the override and fallback: when
`MAINTENANCE_MODE` is on it forces the pause for that deployment and the Admin
switch cannot end it. A strict cutover should use the hosting setting, because
the Admin switch reaches server instances a few seconds apart and only exists
in deployments that contain it.
| Control | Meaning |
| --- | --- |
| `MAINTENANCE_MODE` | Unset, empty, `off`, `false`, `0` or `no`: normal operation. **Any other value turns the pause on**, so a typo during a cutover pauses instead of opening. Use `on`. |
| `MAINTENANCE_EXPECTED_BACK_AT` | Optional. ISO time with an offset, for example `2026-10-20T21:45:00-04:00`. Shown to people ("We expect to be back around 9:45 PM", in their own time zone) only while it is still in the future. Leave it unset unless you are confident; once it passes, the estimate simply disappears. There is no countdown. |
| `MAINTENANCE_RETRY_AFTER_SECONDS` | Optional. `Retry-After` when no estimate is set. Default 1800, limited to 60 through 86400. |
| `GET /api/maintenance` | `{ "maintenance": true or false, "expectedBackAt": ... }`. Always 200, never cached. Use it to confirm what a specific deployment is doing. |

While on, these five handlers answer first, before the limiter, any lookup,
the request body, any write, email, PDF rendering or model call:

| Endpoint | Method |
| --- | --- |
| `/api/seller/[token]` (submission) | POST |
| `/api/seller/[token]/suggestions` | GET |
| `/api/seller/[token]/suggestions/search` | GET |
| `/api/seller/[token]/send-link` | POST |
| `/api/packet/[token]/pdf` | GET |

The answer is HTTP 503 with `Retry-After`, `Cache-Control: no-store`,
`X-UtilitySheet-Maintenance: 1` and a JSON body with `code: "MAINTENANCE"`.
Someone who follows a PDF link in a browser gets a small page instead of JSON.

### Deliberately not paused

| Path | Why |
| --- | --- |
| `GET /api/health` | Monitoring keeps working. It reports configuration, not maintenance; use `/api/maintenance` for that. |
| `/api/cron/*` (activation reconcile, re-engagement, account-closure retry, ops monitor) | None of them calls an affected endpoint or a changed limiter key. They keep their schedules. The PDF gate answers before any operational event is recorded, so the pause does not raise PDF incidents. |
| `/api/webhooks/*` (Stripe, Resend) and all billing routes | Billing and delivery callbacks must never be interrupted. A unit test fails if a gate is added to any route other than the five above. |
| Sign-in, marketing pages, the dashboard, request creation, reminders, branding, settings | Unaffected limiter keys or no limiter. |
| `GET /api/seller/[token]` and `GET /api/packet/[token]` | Reads without a changed limiter key. A completed sheet stays viewable on the web during the pause. |
| `POST /api/seller/[token]/observations` | Its limiter scope is new in Slice 5 and has no old bucket. |
| Reusable-link start (`/api/intake/...`) | Not paused on the server. The page shows the paused screen to new visitors, so few forms are started. One started from an old tab is harmless: it cannot be sent until reopening. |

Side effects to expect: reminder and invitation emails sent during the pause
lead sellers to the paused screen. No completion emails go out, because
nothing can be submitted. The dashboard shows a banner saying so.

### What people see

| Situation | Experience |
| --- | --- |
| Opens a seller link or reusable link during the pause | A "This form is paused for maintenance" screen with the agent's contact details, the estimate if configured, and "Check again". If answers from an earlier visit are in that browser, it says so. |
| Seller tab already open, loaded from a build that contains this code | A notice in the form. Suggestions say "paused" instead of showing an empty list, lookup says "paused" instead of "no matches", the return-link email explains that nothing was sent and that the page address is the link, and a refused submit says "Not sent yet" next to the Submit button. The seller can keep answering. Nothing is resent automatically: after "Check again" reports that we are back, the seller taps Submit. |
| Answers during the pause | They stay on the open page. They are also kept in that browser's local storage when the browser allows it, and the notice says which of the two applies. They are never stored on the server before submission, and they do not follow the seller to another device, a private window or a browser with cleared data. |
| PDF download (public sheet or dashboard) | A calm notice that downloads are paused, not "We couldn't create the PDF". |
| Signed-in dashboard | A banner: sellers cannot send forms and PDF downloads are paused. |
| **Tab loaded from a build without this code** (anything opened before the cutover release went live) | The request is still refused, but the old script shows its old wording: an empty suggestion list, "no matches", "We couldn't save your info just now. Your answers are still here. Tap retry", "We couldn't create the PDF". The return-link email is the exception: the old script displays the server's message. Answers are still kept on the page and in the local draft, and Retry works after reopening. See "Known limit" below. |

## What the application cannot do

The gate exists only in deployments built from this code with the flag on. It
cannot reach into a deployment that was built earlier. So application code
alone does **not** cover:

1. The previous production deployment while its in-flight requests finish.
2. Any older deployment that is still reachable at its generated URL.
3. Tabs pinned to an old deployment by Skew Protection, if that is enabled.
4. Preview or branch deployments, if they hold the production Redis credentials.

These need an external gate, set up and approved by the owner. Until one is
confirmed, do not treat the pause as complete.

### External gate options (all unverified; choose and confirm before the window)

- **A. Firewall rule on the hosting project** that refuses the five path
  patterns above for every deployment and hostname of the project. Assumed
  (not verified) to apply to generated deployment URLs and to take effect
  without a redeploy. It also blocks the new deployment, which is fine during
  the pause. A refusal from the firewall cannot carry the maintenance marker;
  the pages handle that by asking `/api/maintenance` after an unexplained 403
  or 5xx. **Removing the rule exposes old deployments again**, so it must be
  paired with B or C before it is removed.
- **B. Make old deployments unreachable for good**: delete them, or protect
  generated deployment URLs so only the production domains are public. This
  also removes them as instant-rollback targets, which is intended: an instant
  rollback to an old-scheme deployment would itself break the rules above.
- **C. Rotate the Redis credentials** so that only deployments from the
  cutover release onward can reach the counters. An old deployment then cannot
  read or write any counter. Check first what else uses that Redis database
  and that token, and expect every Redis-backed feature of the still-live old
  deployment to fail from the moment of rotation until the new release is
  promoted.

Recommended combination: A for the window, plus B before A is removed.

## Unverified hosting assumptions

Confirm each one in the hosting and Redis dashboards before scheduling.

1. Production runs on Vercel and currently serves `origin/main` `7d6a2af`, the old limiter scheme. (Local `main` is one commit ahead and has never been deployed.)
2. Environment variables are fixed per deployment, so `MAINTENANCE_MODE` takes effect only in a deployment created after it is set, and turning it off also needs a new deployment.
3. A production deployment can be built without receiving the production domains, checked at its generated URL, and promoted afterwards.
4. Old deployments remain reachable at their generated URLs and keep their production environment, including the Redis credentials.
5. Whether Skew Protection is enabled. If it is, open tabs keep calling the old deployment.
6. Whether Preview deployments use the same Redis database as Production.
7. Whether a firewall rule applies to generated deployment URLs and all hostnames, and how quickly it takes effect.
8. Which hostnames reach the project (`utilitysheet.com`, `www.utilitysheet.com`, any alias or redirect domain).
9. The maximum function duration in force. No route sets one in code, so the platform default applies; it bounds how long an in-flight old request can run.
10. That runtime logs can be filtered by deployment and path well enough to see the last old request finish.
11. That nothing outside this project (another Norma app, a script, a monitor) uses the same Redis database or calls the five endpoints.
12. That no CDN or proxy in front of the project caches API responses. The refusal is `no-store`, but an intermediary that ignores it would keep serving the 503 after reopening.

## Production actions that need the owner's approval

Each is a separate decision. None is authorized by the local work.

- Merging `codex/maintenance-mode` and choosing what else is in the cutover release.
- Scheduling the window and telling customers, if you choose to.
- Setting, changing or removing `MAINTENANCE_MODE`, `MAINTENANCE_EXPECTED_BACK_AT` and `MAINTENANCE_RETRY_AFTER_SECONDS` in Production.
- Creating, promoting or redeploying any production deployment.
- Adding and removing the firewall rule; changing Skew Protection or deployment protection; deleting old deployments.
- Rotating Redis credentials.
- The post-wait synthetic limiter check (step 6), which sends real requests to production.
- Any rollback.

## Procedure

Keep a written log with exact times (UTC) as you go. `T_gate`, `T_last` and
`T_open` below are entries in it.

### 1. Preparation (days before, no traffic change)

1. Merge and validate the cutover release: `main` with Slice 1, this branch, and whatever else is approved. Run the complete test suite on the merged result. Slice 6 edits two of the five route files; after merging, confirm the gate is still the first statement of each handler (the guard test checks which files are gated, the route tests check that nothing runs before the gate).
2. Confirm every item under "Unverified hosting assumptions". Decide the external gate.
3. List every deployment and hostname that holds the production Redis credentials. That list is what must be covered.
4. Pick a quiet time. Expect the pause to last about an hour: drain, 31 minutes, checks.
5. Write down the identifier of the current production deployment (the old version).

### 2. Activate the gate (starts the pause)

1. In Production, set `MAINTENANCE_MODE=on`. Optionally set `MAINTENANCE_EXPECTED_BACK_AT` to a realistic time with an offset.
2. Build the cutover release as a production deployment **without** promoting it.
3. On its generated URL, confirm `GET /api/maintenance` returns `"maintenance": true`. Request `/api/packet/not-a-real-token/pdf` and confirm 503 with `X-UtilitySheet-Maintenance: 1`. The gate answers before the limiter, so this sends nothing to Redis. Never use a customer link as a probe.
4. If either check fails, stop. Do not promote. Nothing has changed for users.
5. Apply the external gate.
6. Promote the cutover release to the production domains.
7. Confirm on every production hostname: `/api/maintenance` says `true`, the synthetic PDF URL returns the marked 503, the site, sign-in and dashboard load, and `/api/health` is unchanged.
8. Record `T_gate`: the moment both the promotion and the external gate were in effect.

From here the new limiter scheme is deployed but receives no traffic on the
five endpoints, and the old scheme can receive none.

### 3. Drain and record the last old request

1. In the runtime logs, filter to each old deployment and the five paths. Watch until no request is in flight.
2. Record `T_last`: the completion time of the last old-version request to any of the five endpoints, on any old deployment.
3. If the logs cannot establish it, use `T_gate` plus the maximum function duration as `T_last`. Do not guess earlier.
4. If an old-version request to an affected endpoint appears later (a direct deployment URL, a pinned tab, a preview), the external gate is incomplete. Fix it, and set `T_last` to that request's completion.

### 4. Wait

1. `T_open` is `T_last` plus 31 minutes, at the earliest. Later is fine.
2. Keep both gates on. Do not remove the estimate early to "open quietly"; nothing opens until step 7.
3. If the wait will run past the published estimate, update `MAINTENANCE_EXPECTED_BACK_AT` and redeploy with the flag still on, or leave it: a past estimate is no longer shown.

### 5. Confirm exclusive routing

Before `T_open`, confirm again that no old, preview or alternate deployment
can receive affected traffic: recheck the logs for the old deployments since
`T_last`, recheck each hostname, and confirm option B (or C) is in place if
the firewall rule is going to be removed.

### 6. Verify the new scheme (separately approved)

After `T_open` and before reopening to the public, a build with the flag off
can be checked at its generated URL with synthetic, made-up tokens only:
expect the ordinary 404, and 429 with rate-limit headers once a synthetic
identifier passes its threshold. This is the first new-scheme limiter traffic
and is allowed only after the wait. It needs its own approval and a written
list of the exact requests. Never send a customer link.

### 7. Reopen

1. Not before `T_open`.
2. Set `MAINTENANCE_MODE=off` (or remove it) and remove `MAINTENANCE_EXPECTED_BACK_AT`.
3. Redeploy the same cutover commit and promote it.
4. Confirm on every production hostname that `/api/maintenance` says `false`.
5. Remove the firewall rule only if old deployments are unreachable or cannot reach Redis.
6. Open a test-drive seller form end to end, download a PDF, and watch the logs and Admin Operations for a few minutes.
7. Record the reopening time in the log.

Sellers who waited press "Check again" or reload. Their answers come back
from the open page or the local draft, and they submit themselves.

### 8. Rollback

- **Before promotion (step 2.4):** remove the variables. Nothing reached users.
- **During the pause, before any new-scheme limiter traffic:** the old counters
  were never mixed with new ones, so the old version can be promoted again and
  the external gate removed without a wait. This abandons the cutover; the
  whole procedure starts again later. If step 6 has already sent new-scheme
  requests, treat it as the next case.
- **After reopening:** a return to an old-scheme deployment is a cutover in
  the other direction and needs the same pause, drain, 31-minute wait and
  exclusive routing. Do not use instant rollback to an old-scheme deployment.
  Prefer fixing forward on the new scheme. If the new release must come out of
  service while a fix is prepared, redeploy it with `MAINTENANCE_MODE=on`: the
  pause is safe to re-enter at any time, and every tab loaded since the
  cutover already understands it.

## Known limit: tabs opened before the cutover release

A browser tab keeps the script it loaded. Tabs opened before the cutover
release is live were built without this code, so they show the old generic
wording described under "What people see". They are still covered where it
matters: their requests are refused, their answers stay on the page and in
the local draft, and retrying works after reopening.

Showing maintenance wording in those tabs would need a release that ships
this browser code while the old limiter scheme is still in service, ahead of
the window. This branch cannot be that release, because it is built on the
commit that contains Slice 1. It would mean applying the same change to the
currently deployed commit and deploying that first. That is an owner decision
and separate work; a quiet evening window keeps the number of such tabs small
without it.
