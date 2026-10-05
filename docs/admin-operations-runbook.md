# Admin operations runbook

For the person running UtilitySheet day to day. It covers the routine, what to do when something breaks, what has and has not been verified outside the code, and the exact steps to release the operational-readiness work.

Related: `ADMIN.md` (how each Admin screen behaves), `.ai/decisions/2026-10-05-*.md` (why it works this way).

Never paste passwords, API keys, recovery codes, seller links or seller answers into this file, a triage note or an audit reason.

## 1. Routine

### Daily (about five minutes)

1. Open **Admin, Issues & Triage** (`/admin/operations`).
2. Read **Service issues**. For each open item: follow its link, decide, then Acknowledge, Snooze or Resolve with a short reason.
3. Check the notices at the top of that section. "Not installed", "could not load" and "no observations yet" all mean you are not being shown the whole picture. They do not mean everything is fine.
4. Check **Scheduled jobs**. Anything failed, partial or overdue appears in Service issues as well.
5. Answer customer support email.
6. Glance at **Customer follow-up** only if you have time. These are not failures.

### Weekly

- **Growth** (`/admin/growth`): activation and first submissions.
- **Telemetry** (`/admin/telemetry`): completion, repeat use, AI outcomes.
- **Requested Questions** (`/admin/question-requests`) and **Feedback** (`/admin/feedback`): read what is new, reply from the notification email where a reply helps, then mark each item reviewed or resolved.
- **Audit Logs**: skim for anything you do not recognise.

### Monthly

- **Stripe dashboard**: actual revenue, new subscriptions, cancellations, failed payments. The Admin "Paid-plan access" number counts accounts with access, including complimentary overrides and every Team member. It is not revenue and not a count of paying customers.
- **Provider costs**: Vercel, Neon, Resend, Stripe fees, Google AI, Upstash.
- **Access review**: section 3 of this document.
- **Recovery readiness**: section 4. Do the rehearsal at least twice a year.

## 2. Incident procedures

In every case: find the evidence first, change one thing, and write the reason on the audited action.

### 2.1 A seller says they did not get the email

1. Find the request in **Admin, Requests**. Confirm the seller email is spelled correctly.
2. Click **Send seller reminder**. The dialog shows the last reminder, recent attempts and their state.
   - **Accepted by provider** means Resend took the message. It is not proof of delivery.
   - **Delivery** shows delivered, bounced or spam complaint only if the delivery webhook is registered. Otherwise it says not confirmed.
3. If the address was wrong: **Edit Seller Info**, then send a reminder.
4. If it bounced or was marked as spam: do not keep sending. Ask the customer to reach the seller another way.
5. If the seller just needs the link: the customer can copy it from their dashboard.

Safe to retry: a reminder after the 10 minute cooldown. There is no override.

Needs verification first: an attempt marked **Outcome unknown**. See 2.2.

### 2.2 A reminder has an unknown outcome

This means the provider did not confirm, so the email may or may not have gone.

1. Open the request, click **Send seller reminder**.
2. If the dialog offers **Retry this reminder**, use it. It reuses the same provider key, so it cannot deliver twice. This is available for 23 hours and only if the message is unchanged.
3. Otherwise open the Resend dashboard, search for the seller address, and see whether a message was sent at that time. Then click **Record as sent** or **Record as not sent** with a reason.
4. If you do nothing, the block on new reminders for that request lifts after 24 hours.

Do not work around it by asking the customer to send a reminder. Their button is blocked by the same record for the same reason.

### 2.3 A packet PDF fails

1. **Issues & Triage** shows "Packet PDF generation failed unexpectedly" with a count. One isolated failure can be a transient browser start. Three within 15 minutes is the alert threshold.
2. The failure is not linked to a request, because the download route only knows the packet's private link and does not store it. Use the customer's report, or the time of the failure against Vercel logs (search `[pdf][packet_attachment] failed`).
3. Open the affected request in the customer's view and download the PDF yourself.
4. If every PDF fails: check the Vercel function logs for the PDF route and recent deployments. Roll back the deployment if it started with a release.

Safe to retry: downloading a PDF. It changes nothing.

Not counted as failures: wrong or expired links, locked packets on Free, rate limiting.

### 2.4 Payment and access disagree

1. Open the account in **Admin, Users**. Read **UtilitySheet entitlement** and **Billing context**.
   - Account entitlement and workspace entitlement are shown separately. Team access comes from the workspace.
   - A Pro account with no Stripe subscription is normal for a complimentary override.
   - An amber line means stored data disagrees with itself and deserves a look.
2. Follow the Stripe link (it opens the dashboard for the mode this environment uses). Confirm the real subscription status there. A stored subscription ID does not prove payment.
3. Check **Issues & Triage** for "A verified Stripe event could not be processed". Stripe retries failed events for days. If one is stuck, open it in Stripe (Developers, Events) and resend it after the cause is fixed.
4. Only if the customer has paid and access is wrong, and you cannot wait for Stripe's retry: use **Entitlement override** with a reason. This changes access only. It does not create, cancel or modify a Stripe subscription, and the next Stripe event may change it again.

Never: edit billing fields in the database by hand, or grant access to make a complaint go away without checking Stripe.

### 2.5 A scheduled job is missed or failed

1. **Issues & Triage, Scheduled jobs** shows last start, duration and last success for the three scheduled jobs.
   - **No runs observed yet**: monitoring has not seen it run. This is not "overdue". Expect it for up to a day after release.
   - **Finished with some failures**: it ran but some items failed. Signup reconciliation and account closure retry will try those again next run.
   - **No success in over 26 hours**: it is overdue.
2. Open Vercel, Cron Jobs, and check the run and its logs.
3. Signup reconciliation can be run by hand from **Admin, Users** (Sync verified signups). It needs a reason and is audited.
4. Account closures that exhausted retries are logged as "Account closure stuck; needs support review". Handle those individually.

The weekly summary email has no schedule configured, so it is not monitored and will never show as overdue.

### 2.6 The database or the whole site is down

The Operations page cannot tell you this. It needs the database to load, and in-app alerts are evaluated from the same database.

1. Check your external uptime monitor (see 5.5). If you do not have one yet, load the site and `/api/health` yourself.
2. Check the Neon status page and console, then the Vercel status page and the latest deployment.
3. If a deployment caused it, roll back in Vercel.
4. If data is damaged or lost, follow section 4. Do not improvise a restore against production.
5. Set `ADMIN_WRITES_DISABLED=true` in Vercel if you want to be sure no Admin write happens while you investigate.

After it is over, write down what happened, when you noticed, and what you would want alerting on.

## 3. Provider access, MFA and recovery checklist

Nothing below has been inspected by the implementation work. Every status starts as **unverified**. Change a status only after looking at the provider yourself, and record the date. Use `verified`, `unverified` or `not applicable`.

| Provider | Owner login protected by MFA | Recovery method stored somewhere safe | Second admin or break-glass access | Checked on |
| --- | --- | --- | --- | --- |
| Vercel (hosting, cron, env vars) | unverified | unverified | unverified | |
| Neon (database) | unverified | unverified | unverified | |
| Stripe (billing) | unverified | unverified | unverified | |
| Resend (email) | unverified | unverified | unverified | |
| Stack Auth (sign-in) | unverified | unverified | unverified | |
| Domain registrar and DNS | unverified | unverified | unverified | |
| Google AI (Gemini) | unverified | unverified | unverified | |
| Upstash (rate limiting) | unverified | unverified | unverified | |
| GitHub (source) | unverified | unverified | unverified | |
| Email inbox used for all of the above | unverified | unverified | unverified | |

Also confirm, and date:

- Who can sign in to UtilitySheet Admin (Users, filter by role Admin). There should be no account you do not recognise.
- API keys in Vercel are the ones you expect, and old keys have been revoked at the provider.
- `ADMIN_WRITES_DISABLED` and `ADMIN_ENABLE_IMPERSONATION` are set as you intend. Impersonation should stay off.

Recovery codes and keys belong in a password manager, never in this repository.

## 4. Recovery rehearsal

The goal is to know, before you need it, how far back you can restore and how long it takes. A provider feature existing is not proof that this project's recovery works.

**Running this uses a copy of real customer data. It needs your explicit decision each time, and care with who can reach the copy.**

1. **Find the real restore window.** In the Neon console, open the project settings and note the history retention (point-in-time restore window) for the production branch. Record it below. Do not assume the plan default.
2. **Decide your targets.** How much data could you afford to lose (for example, one hour)? How long could the product be down (for example, four hours)? Record both. Compare with step 1.
3. **Create an isolated branch** from the production branch at a point in time (Neon console, Branches, create from a past timestamp). Give it an obvious name such as `restore-rehearsal-YYYY-MM-DD`. This does not touch production.
4. **Keep it harmless.** Do not point the production deployment at it. If you connect an app to it, use a preview or local environment where:
   - `RESEND_API_KEY` is unset or a test key, so no email can be sent;
   - `CRON_SECRET` differs and no cron is scheduled against it;
   - Stripe keys are test-mode keys, and no webhook points at it;
   - `ADMIN_WRITES_DISABLED=true`.
5. **Check the data.** Row counts for `accounts`, `requests`, `utility_entries`, `admin_audit_logs`. Open two or three recent requests you know. Confirm the newest record is as recent as the timestamp you chose.
6. **Write down the steps you would take for real**: restore or promote the branch, update the connection string in Vercel, redeploy, verify, re-enable writes. Time yourself.
7. **Delete the rehearsal branch** when finished.
8. **Record the result.**

| Date | Restore window found | Data-loss target | Downtime target | Time taken | Result and notes |
| --- | --- | --- | --- | --- | --- |
| not yet rehearsed | unverified | not yet chosen | not yet chosen | | |

## 5. Release checklist for the operational-readiness work

Status as of 2026-10-05: the three migrations in 5.2 were applied to production, and the work was committed and pushed. Sections 5.4 (smoke checks), 5.5 (optional activation) and 5.6 (browser verification) have not been done. Each remaining step needs the owner's go-ahead individually.

### 5.1 Before anything else

- [ ] Review the diff and commit it (no commit has been made).
- [ ] Run the checks listed in `.ai/CURRENT.md` on the committed tree.
- [ ] Do an authenticated browser check in a safe environment (see 5.6). This has not been done.

### 5.2 Database migrations (run first, before deploying code)

All three files are additive, idempotent and create new tables only. They change no existing table and backfill nothing.

Order:

1. `migrations-reminder-operations.sql` **must run before the new code is deployed.** Until it has, the new reminder endpoints refuse to send and return "temporarily unavailable". The currently deployed code ignores the new table, so running this early is safe.
2. `migrations-operational-events.sql`. Order relative to deploy does not matter. Until it runs, the Operations page says monitoring is not installed and writers log instead.
3. `migrations-admin-triage.sql`. Same. Until it runs, triage controls are read-only.

How: paste each file into the Neon SQL editor for the production branch, or run it with `psql` against the production connection string from a trusted machine. Consider creating a Neon branch as a restore point immediately beforehand.

Verify afterward:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('reminder_operations', 'operational_events', 'job_runs', 'ops_alert_state', 'admin_triage_items')
ORDER BY 1;  -- expect 5 rows
```

Rollback: the tables are unused by the old code, so leaving them in place is harmless. Do not drop `reminder_operations` once the new code has run; it is the record that prevents duplicate reminders. Never roll back by deleting audit or operation history.

### 5.3 Deploy

- [ ] Push and deploy as usual. No new environment variable is required for the deploy itself.
- [ ] No change has been made to `vercel.json`. The three existing schedules are untouched.

Behaviour changes customers can notice: the reminder button now reports "already being sent" or "could not confirm" in rare cases instead of a raw provider error. Nothing else customer-facing changes.

Code rollback: redeploy the previous version in Vercel. It ignores the new tables. Reminders sent by the old code still write `reminder_sent` events, which the new cooldown honours when you roll forward again.

### 5.4 Post-release smoke checks

- [ ] `/admin/operations` loads and shows no "not installed" notice.
- [ ] On a test request you own, **Send seller reminder** shows the exact message; sending it shows Accepted and a second attempt shows the cooldown.
- [ ] From the customer dashboard, the reminder button on the same request reports the cooldown.
- [ ] **Correct status** on an unmetered request offers Draft, Sent, In progress only.
- [ ] A user detail page shows the Billing context card and a working Stripe link.
- [ ] After the next daily cron window, **Scheduled jobs** shows a run for each of the three jobs.
- [ ] **Audit Logs** shows the entries for what you just did.

### 5.5 Optional activation (each is separate, each is off until you do it)

**a. Delivery evidence (Resend webhook).** External configuration.

1. In Resend, Webhooks, add endpoint `https://<your production domain>/api/webhooks/resend`.
2. Subscribe to: `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed`.
3. Copy the signing secret into Vercel as `RESEND_WEBHOOK_SECRET` (Production) and redeploy.
4. Verify: send yourself a reminder on a test request; within a minute its attempt shows "delivery delivered".

Until this is done, delivery shows as "not confirmed" everywhere. That is accurate, not a fault.

**b. Alerts.** Sends email to you.

1. Decide the destination address.
2. In Vercel set `OPS_ALERT_EMAIL=<address>` and `OPS_ALERTS_ENABLED=true`, then redeploy.
3. Alerts are only evaluated when step c is done.

Default thresholds: three unexpected PDF failures in 15 minutes; any unrecovered billing webhook failure; any bounce, complaint or send failure in 24 hours; a scheduled job failed, or more than 26 hours without success. One message when a condition starts, one when it clears. These are starting points, not validated benchmarks; override with the `OPS_ALERT_*` variables in `.env.example`.

**c. Schedule the monitor route.** Done 2026-10-05 on owner request: `vercel.json` runs `/api/cron/ops-monitor` every 15 minutes (Vercel Pro). The entry is shown here for reference.

Add to the `crons` array and deploy:

```json
{ "path": "/api/cron/ops-monitor", "schedule": "*/15 * * * *" }
```

Check your Vercel plan's cron limits first. A less frequent schedule works; alerts are then delayed by up to that interval. The route uses the existing `CRON_SECRET`. With alerts disabled it only reports what would fire.

**d. Retention pruning.** Deletes old observations.

Set `OPS_RETENTION_PRUNE_ENABLED=true` (and optionally `OPS_EVENT_RETENTION_DAYS`, default 90). It runs inside the monitor route, so it also needs step c. It deletes only `operational_events` and `job_runs` rows older than the window. It never touches audit logs or reminder operations.

**e. External uptime probe.** Needed for database and site outages; not provisioned.

Using any uptime monitor you already have or choose:

- URL: `https://<your production domain>/api/health`
- Method GET, every 1 to 5 minutes, expect HTTP 200.
- Alert after three consecutive failures. Send to the same address as 5.5b.
- Do not add the `x-health-token` header to the probe. The public response is enough, and the token should not sit in a third-party tool or in logs.

What `/api/health` proves: the app is serving and one database query succeeded. It does not prove that sellers can submit, PDFs render or email sends.

Whether an external probe already exists has not been verified.

### 5.6 Authenticated browser verification (outstanding)

Automated component tests cover the dialogs, disabled states, labels and Operations states. A real signed-in browser pass has **not** been done, because the only local environment points at a hosted database and a live email key, and no Admin test credentials are configured. Production authentication was not weakened to work around that.

To do it safely:

1. Use a preview deployment or local server pointed at a **non-production** Neon branch with the three migrations applied, a Resend test key, and Stripe test keys.
2. Create an Admin test user there. Set `ADMIN_E2E_EMAIL` and `ADMIN_E2E_PASSWORD` in your shell.
3. Run `npm run test:e2e:desktop` and `npm run test:e2e:mobile`. `tests/admin-operations.spec.ts` covers navigation, keyboard access to the dialogs and the Operations page on desktop and mobile.
4. By hand, on desktop and a phone-width window, check: the sidebar and its slide-over; a very long property address and a 500 character reason; Tab and Escape through each dialog with focus returning to the button; the reminder preview frame; controls with `ADMIN_WRITES_DISABLED=true`; the Operations page empty and populated.

## 6. What is collected, and its blind spots

| Area | Evidence | Freshness | Blind spots | Where to look next |
| --- | --- | --- | --- | --- |
| Seller reminder email | One record per attempt: accepted, rejected, unknown; delivery if the webhook is registered | Immediate; delivery within about a minute | Reminders sent before release; anything if the webhook is not registered | Resend dashboard |
| Completion email to customer | A failure event when sending fails at submission | Immediate | No delivery evidence (provider ID is not stored); weekly summary, invitations, activation and referral email are not observed | Resend dashboard |
| Packet PDF | Unexpected generation failures on the public download; sampled success | Immediate | Not linked to a request; the attachment on completion email is reflected only through 2.1's failure event; branding test PDFs are not observed | Vercel logs |
| Billing webhook | Signature-verified events that failed processing, and their recovery by Stripe event ID | Immediate | Events Stripe never sent; unverified requests; whether Stripe and stored access actually agree | Stripe dashboard, Events |
| Scheduled jobs | Start, finish, duration, status and counts for the three scheduled jobs | After each run | A job that never starts shows "not observed" then "overdue" only after the grace period; weekly summary is unmonitored | Vercel Cron |
| AI suggestions | Existing aggregate outcomes | Per run | Not on the Operations page | Admin Telemetry |
| Database and site | Nothing in-app beyond "this page loaded" | n/a | Cannot detect its own outage | External probe, Neon and Vercel status |

Observations are kept for 90 days by default once pruning is enabled. Audit logs follow their own policy and are never pruned with them.

## 7. Environment variables added by this work

All are optional and default to off. `.env.example` is ignored by git in this repository, so this table is the tracked reference. Never commit real values.

| Variable | Default | Effect |
| --- | --- | --- |
| `RESEND_WEBHOOK_SECRET` | unset | Signing secret for `POST /api/webhooks/resend`. Unset: the route answers "not configured" and delivery stays unknown. |
| `OPS_ALERTS_ENABLED` | `false` | Must be `true`, with a valid `OPS_ALERT_EMAIL`, for any alert to be sent. |
| `OPS_ALERT_EMAIL` | unset | Destination for alerts. |
| `OPS_ALERT_PDF_FAILURE_THRESHOLD` | `3` | Unexpected PDF failures in the window that start an alert. |
| `OPS_ALERT_PDF_WINDOW_MINUTES` | `15` | Window for the PDF threshold. |
| `OPS_ALERT_JOB_OVERDUE_HOURS` | `26` | Wording of the overdue alert. The page's overdue rule is fixed at 26 hours. |
| `OPS_EVENT_RETENTION_DAYS` | `90` | Retention for operational observations (7 to 365). |
| `OPS_RETENTION_PRUNE_ENABLED` | `false` | Must be `true` for the monitor route to delete expired observations. |

Existing variables this work relies on, unchanged: `CRON_SECRET` (monitor route), `ADMIN_WRITES_DISABLED`, `STRIPE_SECRET_KEY` (only its prefix, to choose the Stripe dashboard link mode), `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL` (link in alert text).
