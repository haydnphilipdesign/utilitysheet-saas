# UtilitySheet Live Business Baseline (Addendum to the 2026-09-10 Strategic Audit)

- Date: 2026-09-10
- Author: Claude Code (Opus 5)
- Parent report: [2026-09-10-product-growth-audit.md](2026-09-10-product-growth-audit.md). That report was written without production data. It is not rewritten here.
- Authorization: owner brief of 2026-09-10. Read-only aggregate access to production Neon/Postgres, Stripe, and Vercel Web Analytics.
- Status: measurement complete for every source the brief required. Nothing in production, code, configuration, schema, or billing was changed.

Evidence labels:

- **[Verified]** Directly measured in current production data or read in current code.
- **[Inference]** Reasoned from verified evidence.
- **[Hypothesis]** Needs interviews, instrumentation, or an experiment.

Every rate below is shown with its count. The samples are small; read the counts first.

---

## 1. Executive summary

1. **Acquisition is the clearest constraint.** [Verified]
   - **Signups fell sharply.** Customer signups were 111 in December 2025 to March 2026. They were 28 in April to August 2026: 8 in the last 90 days and 2 in the last 30 days.
   - **Site traffic fell with them.** Vercel Analytics shows landing CTA viewers fell from 1,521 over 365 days to 237 over the last 90 days.
   - **Recent signups have not activated.** None of the 4 signups since 2026-07-14 has submitted a live file.
2. **The business is small, and its revenue is real but tiny.** [Verified]
   - **Subscriptions.** Stripe has 8 active subscriptions: 7 Pro at $9 and 1 Teams with 4 seats at $7. Current MRR is **$91**.
   - **Revenue.** UtilitySheet subscription invoices in the last 365 days totalled $590.25, of which $508.25 was collected. The rest was customer-balance credit applied in August 2026.
   - **Churn.** Only 10 subscriptions have ever existed. Two were canceled, both after about one billing month.
3. **Retention among serious users is strong; free-user retention is weak.** [Verified]
   - **Paid-flag workspaces.** Of the 10 activated workspaces with a paid flag now, 6 are active in month 3, and 7 were active in the last 60 days.
   - **Free workspaces.** Of the 24 eligible free-now workspaces, 1 is active in month 3.
   - **Direction of cause is unknown.** Heavy users may upgrade, rather than upgrading causing retention.
4. **Usage is highly and increasingly concentrated.** [Verified]
   - **Last 90 days.** 5 workspaces produced 92.3% of live submissions (275 of 298); 2 produced 56.4%.
   - **Paid share.** Paid-flag workspaces produced 95.0% of 90-day submissions (283 of 298).
5. **The Teams / TC-company thesis has no behavioral support yet.** [Verified]
   - **No multi-member organizations.** Zero organizations have two or more members.
   - **The one paying Team.** It pays for 4 seats, has 1 member, and has 0 accepted invitations out of 4 sent.
   - [Hypothesis] Companies may share one login. The data cannot show this.
6. **Automatic seller follow-up, as specified in the audit, is not worth building now.** [Verified]
   - **Eligible volume.** Requests unsubmitted at 48 hours with a stored seller email or phone: **0 in the last 90 days**, and 18 in the last 365 days.
   - **Where stalls actually are.** Most stalls are reusable-link starts with no stored contact. About 13 per month are genuine after removing restarts, and 72% of them sit in the top 5 workspaces.
7. **The closing-exposure loop is effectively zero.** [Verified] In the last 90 days, 298 packets were submitted. They produced 8 CTA impressions, 0 clicks, 0 `/from-a-closing` page views, 0 referred signups, and 0 referral credits (0 ever).
8. **"Nearly 86% of started UtilitySheets are completed" is not substantiated as worded.** [Verified]
   - **Plain definitions.** Plain definitions of "started" give 80.4% to 82.6%.
   - **Where 86% appears.** Only narrower denominators reach about 86%. Those are "seller reached the utilities step" (85.5%) or a de-duplicated count. The claim is directionally supported and needs revised wording.

---

## 2. Snapshot date and time

| Source | Access time (UTC) | Consistency |
| --- | --- | --- |
| Neon/Postgres (production) | 2026-09-10 18:02:47 to 18:17:18, in six batches | Each batch ran inside one `READ ONLY`, `REPEATABLE READ` transaction; batches are seconds to minutes apart |
| Stripe (live mode) | 2026-09-10 about 18:03 to 18:17 | List/retrieve calls only |
| Vercel Web Analytics | 2026-09-10 18:15:55 | Aggregate windows end 2026-09-10 01:00 UTC (daily granularity) |

All windows are rolling and relative to the snapshot: 30 days, 90 days, 365 days. Calendar months are UTC. Production data begins 2025-12-18, so "365 days" equals full product history.

---

## 3. Production sources successfully accessed

| Source | Access | Method | What was available |
| --- | --- | --- | --- |
| Neon/Postgres | **Succeeded** | Installed `@neondatabase/serverless` driver with the existing `DATABASE_URL` from `.env.local`, loaded in memory only | All product tables: accounts, organizations, members, invitations, requests, event logs, intake links, attribution, referral events, referral credits |
| Stripe | **Succeeded** | Installed `stripe` package with the existing live-mode key from `.env` | Subscriptions (all statuses), prices and products, coupons, invoices, charges, refunds, customer balances, and events retained since 2026-08-13 |
| Vercel Web Analytics | **Succeeded** | Documented Web Analytics REST API ([docs](https://vercel.com/docs/analytics/web-analytics-api)) using the existing authenticated Vercel CLI login for project `utilitysheet-saas` | Custom events by name and event data; page views and visitors; Pro plan reporting window of the latest 366 days |

**Production identity verification.** [Verified] The database is production by aggregate agreement with live Stripe. 7 of 7 account subscription IDs and 1 of 1 organization subscription ID match active live-mode Stripe subscriptions, and the latest request activity is from the snapshot day. The Stripe account display name is "UtilitySheet.com". `vercel env ls` failed with a CLI error, so the environment variables could not be compared directly.

## 4. Sources that remained unavailable or partial

| Item | Status | Classification |
| --- | --- | --- |
| Email provider (Resend) delivery, bounce, complaint data | Not accessed; not in this authorization | Inaccessible |
| Historical plan transitions before 2026-08-13 | Stripe retains events for about 30 days; the database has no plan-change history | Missing instrumentation |
| Monthly-limit blocks at reusable-link start (HTTP 403) | Not logged anywhere | Missing instrumentation |
| PDF forwarding and PDF-driven signups | The PDF footer is untracked; only packet-page download clicks exist in Vercel Analytics | Missing instrumentation |
| Company type (TC company vs other) | No field exists; inference from names or domains was prohibited | Missing instrumentation, and intentionally not inferred |
| Whether several people share one login | Not observable | Missing instrumentation |

No required source was blocked.

---

## 5. Privacy and query-safety controls used

- **Credentials.** Credentials were read in memory from existing local files and the existing CLI login, and never printed. Only a hostname fingerprint and the key mode (live or test) were inspected.
- **SQL.** Every statement had to begin with `SELECT` or `WITH`. A guard rejected mutation, DDL, session, lock, and function keywords, and multiple statements. All statements in a batch ran inside a Neon `transaction(..., { readOnly: true, isolationLevel: 'RepeatableRead' })`. Each batch asserted `current_setting('transaction_read_only') = 'on'`, which returned `on` every time. No temporary tables, functions, or writes were used.
- **Output guard.** Result columns named like identifiers (id, email, name, address, phone, token, slug, code) were rejected before printing, as were string values containing `@`, UUID patterns, or long text. The guard fired once, on a harmless alias. The alias was renamed; nothing was printed.
- **Stripe and database joins.** Stripe customer and subscription identifiers were held in process memory and passed to SQL as a parameter, so matching happened inside the database and only counts returned. No identifier was printed or written.
- **Duplicate-start check.** Property addresses were compared only inside SQL (normalized equality within the same workspace). Only counts were returned.
- **Not selected.** No seller answers, names, emails, phone numbers, addresses, tokens, slugs, or company names were selected for output. Contact fields were reduced to booleans inside SQL.
- **Scratch files.** Scripts and aggregate outputs live in the session scratchpad, outside the repository.
- **Suppressed identities.** Top-workspace identities were never retrieved. "Top 2" and "top 5" are computed shares.

---

## 6. Metric definitions, exclusions, windows, and timezone

| Term | Definition | Source of definition |
| --- | --- | --- |
| Customer workspace | An `accounts` row with `role = 'user'` that is not a member of the public demo organization (slug `utilitysheet-demo`). The Free limit and Pro plan are per account, so the account is the workspace unit. | `lib/admin/activation-funnel.ts`, `scripts/demo-seed.mjs`, `app/api/seller/[token]/route.ts:73` |
| Excluded internal | 1 admin account; 1 demo-workspace account and its organization (seeded with a `team` flag and no Stripe subscription) | Same |
| Live request | Customer-owned `requests` row with `deleted_at IS NULL`, `is_demo = FALSE`, and not in the demo organization. Test drives set `is_demo`. | `app/api/test-drive/route.ts`, admin funnel |
| Completed transaction / live submission | Live request with `status = 'submitted'`. The submission time is the first `seller_submitted` event (coverage 670 of 670 submitted rows). | `app/api/seller/[token]/route.ts:720` |
| Reusable-link request | First `request_created` event has `event_data.source = 'intake_link'`. The seller began at `/i/[slug]`. | `app/api/intake/[slug]/start/route.ts:208` |
| Individual request | First `request_created` event has `actor = 'agent'` and no intake source. The coordinator created it in the dashboard. | `app/api/requests/route.ts:215` |
| Unknown source | No `request_created` event (logging began 2026-01-15): 9 live requests | Data |
| Active workspace / organization | At least 1 live submission in the window | This addendum; matches audit section 14 |
| Meaningful activity | A live submission (not a login, draft, or opened form) | This addendum |
| Paid (Stripe) | An active Stripe subscription (none are trialing or past due) for the account's or organization's Stripe customer | Stripe |
| Paid flag | `accounts.subscription_status = 'pro'`, or membership in a non-demo organization with `subscription_status = 'team'` | Database |
| Recent | Last 30 days and last 90 days, both reported | This addendum |
| Free limit reached | A free account's 3rd metered, unlocked, non-demo request in a UTC calendar month, while no Stripe subscription covered that moment | `lib/neon/queries/accounts.ts:245-267` (production runs in UTC, so the server-local month equals the UTC month [Inference]) |
| Cohort | Calendar month (UTC) of a workspace's first live submission. Month N active means at least 1 live submission in month cohort + N. Only completed months are eligible. | Audit section 14 |

**Timezone.** UTC throughout. **Windows.** Rolling 30, 90, and 365 days, plus calendar months. **Demo, test-drive, internal, and deleted activity** are excluded everywhere except the exact replications of 2026-09-03 queries in section 15, which reproduce the original definitions.

---

## 7. Accounts, plans, organizations, subscriptions, and MRR

### Accounts and plan flags [Verified]

| Measure | Count |
| --- | ---: |
| Customer workspaces (accounts) | 139 |
| Free flag | 130 |
| Pro flag | 9 |
| Organizations (excluding demo) | 121 |
| Free organizations | 120 |
| Team organizations (excluding demo) | 1 |
| Organizations with 2 or more members | **0** |
| Organizations where 2 or more members have a live submission | **0** |
| Customer accounts with no organization membership (legacy) | 19 |

### Stripe subscriptions and MRR [Verified]

| Measure | Value |
| --- | ---: |
| Subscriptions ever created | 10 (9 Pro, 1 Teams) |
| Active now | 8: 7 Pro at $9 x1; 1 Teams at $7 x4 seats |
| Trialing, past due, discounted, or cancel-scheduled | 0 |
| Canceled | 2 (Pro; canceled May and June 2026; lifetimes 30 and 31 days) |
| Reactivated customers | 0 |
| **MRR (list, active subscriptions)** | **$91.00** ($63 Pro + $28 Teams) |
| MRR after active discounts | $91.00 (no active discounts) |
| Active customers carrying a credit balance now | 0 |

### Invoiced UtilitySheet subscription revenue, last 365 days [Verified]

| Month (paid) | Invoice total | Collected | Balance credit applied |
| --- | ---: | ---: | ---: |
| 2026-01 | $9.00 | $9.00 | $0 |
| 2026-02 | $57.00 | $57.00 | $0 |
| 2026-03 | $69.25 | $69.25 | $0 |
| 2026-04 | $73.00 | $73.00 | $0 |
| 2026-05 | $91.00 | $91.00 | $0 |
| 2026-06 | $82.00 | $82.00 | $0 |
| 2026-07 | $82.00 | $82.00 | $0 |
| 2026-08 | $91.00 | $9.00 | $82.00 |
| 2026-09 (to date) | $36.00 | $36.00 | $0 |
| **Total** | **$590.25** | **$508.25** | **$82.00** |

- **Credits applied in August.** [Inference] The August credits are consistent with the July provider-incident customer credits (`scripts/incident/credit-paid-customers.mjs`).
- **Excluded invoice.** The Stripe account also holds non-UtilitySheet products. One $350 invoice from January 2026 did not map to a Pro or Teams price and is excluded.
- **No other revenue.** Refunds in the last 365 days: 0. Succeeded charges equal paid invoices, so there is no separate one-time revenue.

### Database versus Stripe discrepancies (aggregate) [Verified]

| Check | Count |
| --- | ---: |
| Pro-flag customer accounts backed by an active Stripe Pro subscription | 7 of 9 |
| **Pro-flag customer accounts with no Stripe subscription or customer** | **2** |
| Active Stripe Pro subscriptions without a matching Pro account | 0 |
| Team organizations (excluding demo) backed by Stripe | 1 of 1; seat quantity agrees (4) |
| Demo organization with `team` flag and no Stripe subscription | 1 (expected seed data) |
| Canceled Stripe subscriptions whose account still shows Pro | 0 (both now Free) |
| Free accounts with a Stripe customer but no subscription ever (abandoned checkout) | 6 |
| Internal admin account with Pro flag and no subscription | 1 |
| Stripe subscriptions carrying `account_id` / `organization_id` metadata | 0 of 10 |

- **Customer-ID fallback.** [Inference] With no metadata on any subscription, webhook sync relies on its customer-ID fallback (`app/api/billing/webhook/route.ts:167-195`).
- **Comped Pro flags.** The two Pro flags without Stripe are complimentary or manually set; the origin is not recorded. One of them had 9 live submissions in the last 30 days.

### Paid workspaces with little or no recent activity [Verified]

| Paid group | Workspaces | 0 submissions, 30d | 0 submissions, 90d | 10+ submissions, 30d | Submissions 30d / 90d / 365d |
| --- | ---: | ---: | ---: | ---: | --- |
| Pro, Stripe-backed | 7 | 3 | 2 | 3 | 99 / 249 / 494 |
| Team organization member | 1 | 0 | 0 | 0 | 2 / 7 / 21 |
| Pro flag, no Stripe subscription | 2 | 1 | 1 | 0 | 9 / 27 / 78 |
| All customer workspaces | 139 | 129 | 126 | 3 | 116 / 298 / 653 |

- **Idle paying workspaces.** 3 of 8 Stripe-paying workspaces had no live submission in the last 30 days; 2 of 8 had none in 90 days.
- **Unused seats.** The Team organization pays for 4 seats and has 1 member.

---

## 8. Activity and customer concentration

### Volume by window [Verified]

| Measure | 30 days | 90 days | 365 days (all history) |
| --- | ---: | ---: | ---: |
| Live requests created | 139 | 363 | 812 |
| - reusable-link | 125 (89.9%) | 337 (92.8%) | 697 (85.8%) |
| - individual | 14 | 26 | 106 |
| - unknown source | 0 | 0 | 9 |
| Live submissions completed | 116 | 298 | 653 |
| - reusable-link | 108 (93.1%) | 280 (94.0%) | 570 (87.3%) |
| - individual | 8 | 18 | 77 |
| - Simple Utility Sheet | 84 | 209 | 426 |
| - Property Handoff Packet | 32 (27.6%) | 89 (29.9%) | 227 (34.8%) |
| Active workspaces | 10 | 13 | 37 |
| Active organizations | 10 | 13 | 32 (7 submissions had no organization) |
| Workspaces creating any live request | 13 | 17 | 51 |

### Concentration of live submissions [Verified]

| Window | Active workspaces | Submissions | Top 2 | Top 5 | Median per active workspace | Mean |
| --- | ---: | ---: | --- | --- | ---: | ---: |
| 30 days | 10 | 116 | 71 (61.2%) | 108 (93.1%) | 3.5 | 11.6 |
| 90 days | 13 | 298 | 168 (56.4%) | 275 (92.3%) | 6 | 22.9 |
| 365 days | 37 | 653 | 343 (52.5%) | 563 (86.2%) | 2 | 17.6 |

Created requests show the same pattern: top 5 hold 90.6% (30d), 90.1% (90d), and 83.6% (365d).

### Monthly trend [Verified]

| Month | Signups | Newly activated | Active workspaces | Submissions | Top 2 share | Top 5 share |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2025-12 | 13 | 4 | 4 | 5 | 60.0% | 100% |
| 2026-01 | 35 | 3 | 3 | 12 | 91.7% | 100% |
| 2026-02 | 40 | 10 | 12 | 39 | 48.7% | 74.4% |
| 2026-03 | 23 | 6 | 12 | 76 | 64.5% | 86.8% |
| 2026-04 | 3 | 2 | 9 | 76 | 68.4% | 93.4% |
| 2026-05 | 14 | 9 | 16 | 102 | 43.1% | 81.4% |
| 2026-06 | 3 | 0 | 7 | 91 | 56.0% | 96.7% |
| 2026-07 | 4 | 3 | 11 | 105 | 59.0% | 90.5% |
| 2026-08 | 4 | 0 | 10 | 109 | 58.7% | 91.7% |
| 2026-09 (10 days) | 0 | 0 | 7 | 38 | 57.9% | 94.7% |

- **Volume grew while the base did not.** [Verified] Submissions grew from 39 (February) to 109 (August), while signups fell and active workspaces stayed between 7 and 16.
- **Concentration direction.** [Inference] Top-5 concentration has risen since February: 74.4% then, 90.5% to 96.7% from June to September. Top-2 share has been stable at roughly 56% to 59% since June. Concentration is **worsening at the top-5 level and stable at the top-2 level**. Monthly workspace counts are 7 to 16, so month-to-month shares are noisy.

### Distribution of workspaces by completed transactions (all history) [Verified]

| Completed transactions | Workspaces | Submissions |
| --- | ---: | ---: |
| No live requests | 88 | 0 |
| Requests but 0 submitted | 14 | 0 |
| 1 | 15 | 15 |
| 2 to 5 | 14 | 40 |
| 6 to 20 | 2 | 14 |
| More than 20 | 6 | 584 (89.4%) |

### Packet mode and request source [Verified]

- **Property Handoff Packet.** 227 of 653 live submissions (34.8%). At most 7 workspaces ever submitted one, and 3 did so in the last 90 days.
- **Workspace source mix (all history, 37 activated).** 20 used only reusable links, 7 used both, 6 used only individual requests, and 4 are unknown (pre-logging).
- **Last 90 days.** 11 workspaces used only reusable links, 2 used both, and none used only individual requests. The reusable link is the product in practice.

---

## 9. Retention cohorts

### Cohorts by month of first live submission [Verified]

| Cohort | Size | Month 1 active | Month 3 active | Month 6 active | Reached 2nd | Active last 60 days |
| --- | ---: | --- | --- | --- | ---: | ---: |
| 2025-12 | 4 | 0 of 4 | 0 of 4 | 0 of 4 | 2 | 0 |
| 2026-01 | 3 | 1 of 3 | 1 of 3 | 1 of 3 | 1 | 1 |
| 2026-02 | 10 | 5 of 10 | 3 of 10 | 4 of 10 | 8 | 4 |
| 2026-03 | 6 | 3 of 6 | 1 of 6 | not yet eligible | 3 | 2 |
| 2026-04 | 2 | 1 of 2 | 0 of 2 | not yet eligible | 2 | 0 |
| 2026-05 | 9 | 2 of 9 | 2 of 9 | not yet eligible | 5 | 3 |
| 2026-06 | 0 | | | | | |
| 2026-07 | 3 | 1 of 3 | not yet eligible | not yet eligible | 1 | 2 |
| 2026-08 | 0 | | | | | |

### Pooled milestones and retention by segment [Verified]

| Segment | Workspaces | Reached 2nd | 5th | 10th | 25th | 100th | Median days 1st to 2nd | M1 | M3 | M6 |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| All activated | 37 | 22 (59.5%) | 8 (21.6%) | 6 (16.2%) | 5 (13.5%) | 3 (8.1%) | 5.1 | 13 of 37 (35.1%) | 7 of 34 (20.6%) | 5 of 17 (29.4%) |
| Excluding all-time top 2 | 35 | 20 (57.1%) | 6 | 4 | 3 | 1 | 6.1 | 11 of 35 (31.4%) | 5 of 32 (15.6%) | 4 of 16 (25.0%) |
| Paid flag now | 10 | 9 | 6 | 6 | 5 | 3 | 3.8 | 7 of 10 | 6 of 10 | 4 of 5 |
| Free now | 27 | 13 (48.1%) | 2 | 0 | 0 | 0 | 5.3 | 6 of 27 (22.2%) | 1 of 24 (4.2%) | 1 of 12 (8.3%) |
| First submission via reusable link | 21 | 13 | 5 | 4 | 3 | 1 | 3.2 | 8 of 21 | 5 of 18 | 2 of 5 |
| First submission via individual request | 11 | 7 | 3 | 2 | 2 | 2 | 6.8 | 5 of 11 | 2 of 11 | 3 of 7 |
| Reusable link only, lifetime | 20 | 12 | 5 | 4 | 3 | 1 | 2.7 | 7 of 20 | 5 of 17 | 2 of 5 |
| Individual requests only, lifetime | 6 | 2 | 0 | 0 | 0 | 0 | 27.9 | 0 of 6 | 0 of 6 | 0 of 3 |
| Both, lifetime | 7 | 7 | 3 | 2 | 2 | 2 | 27.1 | 6 of 7 | 2 of 7 | 3 of 5 |
| Solo workspace | 37 | 22 | 8 | 6 | 5 | 3 | 5.1 | 13 of 37 | 7 of 34 | 5 of 17 |
| Multi-member organization | 0 | | | | | | | | | |

- **Activated workspaces still active.** [Verified] Of the 34 workspaces first activated at least 90 days ago, 10 (29.4%) submitted in the last 60 days.
- **Time to activation.** [Verified] 37 of 139 customer workspaces (26.6%) ever activated. The median time from signup to first submission is 0.1 days: 27 activated within 7 days and 32 within 30 days. 32 of the 137 accounts older than 30 days (23.4%) activated within 30 days.

**Limitations.**

- **Plan is today's flag, not the plan at the time.** Historical plan transitions cannot be reconstructed beyond Stripe subscription start and end dates.
- **No causal reading.** Paid-versus-free retention is not causal.
- **Segments overlap.** "Individual only" workspaces are mostly early (pre-reusable-link) users.
- **No multi-member comparison.** Solo versus multi-member cannot be compared because the multi-member group is empty.
- **Sample size.** Month 6 has 17 eligible workspaces in total.

---

## 10. Free-limit and monetization behavior

| Measure | Value | Classification |
| --- | ---: | --- |
| Free workspaces ever reaching the monthly limit (3rd metered file in a month while unpaid) | 6 workspaces, 6 workspace-months | Verified |
| Free workspaces reaching the limit, last 90 days | 0 | Verified true zero |
| Free workspaces reaching the limit, last 30 days | 0 | Verified true zero |
| Submissions locked by the limit, ever | 1 (still locked; none in 90 days) | Verified |
| Workspaces upgrading after a first limit event | 1 of 6 (16.7%), within 7 days (0.2 days) | Verified, n = 6 |
| Workspaces upgrading after a lock event | 0 of 1 | Verified, n = 1 |
| Stripe-paid workspaces that never reached the limit before paying | 9 of 10 | Verified |
| Limit blocks at reusable-link start (HTTP 403) | Unknown | Missing instrumentation |
| New paid subscriptions by month | 2026-01: 1, 02: 4, 04: 1, 05: 3, 08: 1 | Verified (Stripe) |
| Cancellations | 2 (May, June 2026) | Verified (Stripe) |
| Reactivations | 0 | Verified (Stripe) |
| Pro-to-Team conversions marked in Stripe metadata | 0 | Verified; no conversion metadata exists on any subscription |
| Team seat increases | 1 (3 to 4 seats, February to March 2026) | Inference from invoice amounts |
| Downgrades other than cancellation | 0 observed since 2026-08-13; earlier history unavailable | Missing history (Stripe event retention) |

- **What the limit does.** [Inference] The Free limit is almost never the upgrade trigger. Nearly every paying workspace paid without first hitting the limit. The lock is a fair mechanism that rarely fires, because free workspaces seldom submit three files in a month.
- **Hypothesis.** Payment is driven by intent (packet mode, branding, volume expectations) rather than by the limit.

---

## 11. Seller completion and abandonment

### Completion under tested definitions [Verified]

| Definition of "started" | All history | Mature (created 8 to 365 days ago) | Mature, last 90 days (8 to 90 days ago) |
| --- | --- | --- | --- |
| D1. Every live request | 653 of 812 (80.4%) | 626 of 776 (80.7%) | 271 of 327 (82.9%) |
| D2. Seller opened the form or began a reusable link | 647 of 785 (82.4%) | 620 of 750 (82.7%) | 271 of 324 (83.6%) |
| D3. Seller opened the form (`seller_opened` event) | **647 of 783 (82.6%)** | 620 of 748 (82.9%) | 271 of 324 (83.6%) |
| D4. Seller reached the utilities step (suggestion event; logged since 2026-02-27) | 601 of 703 (85.5%) | 574 of 668 (85.9%) | 271 of 314 (86.3%) |
| D5. Status in progress or submitted | 653 of 789 (82.8%) | 626 of 754 (83.0%) | 271 of 324 (83.6%) |

### Splits (D3, mature 8 to 365 days) [Verified]

| Split | Completed |
| --- | --- |
| Simple Utility Sheet | 405 of 473 (85.6%) |
| Property Handoff Packet | 215 of 275 (78.2%) |
| Reusable link | 544 of 662 (82.2%) |
| Individual request (opened) | 76 of 86 (88.4%) |
| Individual request, all created (D1) | 76 of 103 (73.8%); many individual requests are never opened |

**Duplicate starts.** [Verified] Of 156 live requests unsubmitted after 48 hours, 43 (41 of them reusable-link) belong to a workspace that submitted another request for the same normalized property address. These are restarts, not abandonment. Excluding them, D1 is 653 of 769 (84.9%). [Inference] D3 on the same basis is at most 647 of 740 (87.4%), because the opened status of every duplicate was not separately counted.

**Client-side cross-check.** [Verified, Vercel Analytics, 90 days, visitor-based] The seller welcome step had 389 visitors and the success step 308 (79.2%). The funnel continues home basics 341, electric 318, review 294. Visitor counts are not request-joinable and lose ad-blocked sessions.

### The "Nearly 86%" claim

**Conclusion: Directionally supported but needs revised wording.** [Verified]

- **Plain definitions.** No plain definition of "started" reproduces 86%. Opened-form completion is 82.6% (647 of 783), and every live request gives 80.4%.
- **Narrow definitions.** 85.5% to 86.3% appears only when "started" means "reached the utilities step", or for Simple mode created 8 to 90 days ago (86.6%, D1). De-duplicating restarts also approaches it. None of these is what "started" plainly means, and choosing one to match the claim would be denominator selection.
- **Reproducible replacement.** "More than 80% of seller forms that sellers open are submitted." D3, all history: 82.6% (647 of 783) as of 2026-09-10. Cite the saved query in section 21.

### Time to completion (submissions in the last 365 days) [Verified]

| Source | Submissions | Median | 75th percentile | 90th percentile | Within 24 hours | Within 48 hours | After 7 days |
| --- | ---: | ---: | ---: | ---: | --- | --- | ---: |
| All | 653 | 4 minutes | 8 minutes | 1.0 hour | 635 (97.2%) | 641 (98.2%) | 2 |
| Reusable link (from seller start) | 570 | 4 minutes | 7 minutes | 14 minutes | 563 | 567 | 0 |
| Individual (from creation) | 77 | 2.1 hours | 8.7 hours | 48.6 hours | 66 | 68 (88.3%) | 2 |

A seller who does not finish within 48 hours almost never finishes.

### Unsubmitted requests [Verified]

| Measure | Count |
| --- | ---: |
| Unsubmitted live requests (all history) | 159 |
| Older than 24 hours | 158 |
| Older than 48 hours | 156 |
| Older than 7 days | 152 |
| Older than 30 days | 135 |
| With a stored seller email | 13 |
| With a stored seller phone | 3 (all also have email) |
| With neither | 146 |
| Reusable-link unsubmitted (none have stored contact) | 127 |

Unsubmitted for 48 hours or more, after removing same-property duplicates:

- **Genuine stalls.** 113 in all history; 40 of them created in the last 90 days.
- **Concentration.** 77 of all 156 stalls (49.4%) are in the top 2 workspaces and 113 (72.4%) in the top 5, across 31 workspaces.

### Reminder eligibility (retrospective) [Verified]

Eligible means a live request unsubmitted 48 hours after creation that has a stored seller email or phone. The existing reminder route is email-only (`app/api/requests/[id]/remind/route.ts:39`), and no SMS channel exists.

| Group | Window | Unsubmitted at 48 hours | Eventually submitted | By day 9 |
| --- | --- | ---: | --- | ---: |
| Stored email or phone | Last 90 days | **0** | n/a | n/a |
| Stored email or phone | Last 365 days | 18 (13 email only, 5 email + phone) | 5 (27.8%) | 5 |
| No stored contact, reusable link | Last 365 days | 127 (125 had opened the form) | 3 (2.4%) | 3 |
| No stored contact, individual | Last 365 days | 22 | 4 | 3 |
| Any contact status | Last 90 days | 64 | 2 | 2 |

- **Eligible by creation month (stored contact).** December 1, January 4, February 4, March 4, April 0, May 4, June 1, July 0, August 0.
- **Manual reminders.** Live customer requests reminded manually: 2 in total, and 0 were submitted afterward.

---

## 12. Growth and referral-loop performance

Window: last 90 days unless stated.

| Stage | Value | Source | Classification |
| --- | ---: | --- | --- |
| Live packets submitted | 298 | Database | Verified |
| Packet CTA impressions (server) | 8 (all history; first 2026-07-20) | `growth_referral_events` | Verified |
| Packet CTA impressions (client) | 5 events, 4 visitors (same in 365 days) | Vercel Analytics | Verified |
| Packet CTA clicks | 0 server; 0 client events in 365 days | Both | Verified true zero |
| `/from-a-closing` page views | 0 | Vercel Analytics | Verified true zero, subject to blocker loss |
| Signups with any attribution row | 0 (1 of 139 customer accounts ever) | `growth_attributions` | Verified; coverage too low to use |
| Referral (`product_referral`) signups | 0 | Database | Verified true zero |
| Referral-code signups | 0 (1 ever, activated) | Database | Verified |
| Referral activations | 0 | Database | Verified true zero |
| Referral credits awarded | 0 (0 ever) | `referral_credits` | Verified true zero |
| Impression to click | 0 of 8 (0%) | | Verified |
| Click to signup | Undefined (0 clicks) | | Insufficient sample |
| Signup to activation | Undefined (0 referred signups) | | Insufficient sample |
| Overall loop yield | 0 activations per 298 submitted packets | | Verified |
| Packet-page actions | 3 (2 PDF download, 1 website tap) | Vercel Analytics | Verified |

- **Why exposure is so low.** [Inference] 95% of submissions come from paid-flag workspaces whose packets do not render the CTA, and packet web views by anyone are rare (3 packet-page actions in 90 days).
- **Acquisition source to activation: not measurable.** [Verified] Attribution exists for 1 of 139 customer accounts, and Vercel `signup_completed` has a single source value (`signup_form`). Vercel also undercounts signups: 23 `signup_completed` events in 365 days against 139 database accounts.
- **PDF sharing or PDF-driven signup: not measurable.** The PDF footer is plain text, the server logs no PDF events, and dashboard PDF downloads are not tracked.
- **Joining sources.** Vercel Analytics visitors cannot be joined to accounts or requests by design, so client and server counts are compared only as totals.

**Top-of-funnel trend.** [Verified, Vercel Analytics]

| Measure | Last 90 days | 365 days | Implied earlier 275 days |
| --- | ---: | ---: | ---: |
| Visitors | 1,195 | n/a | |
| Landing primary CTA viewers | 237 | 1,521 | 1,284 |
| Landing primary CTA clickers | 7 | 123 | 116 |
| Signup started (visitors) | 8 | 80 | 72 |

---

## 13. Teams hypothesis evaluation

| Question | Answer | Label |
| --- | --- | --- |
| Does meaningful activity occur in multi-member organizations? | No. There are no multi-member organizations. | Verified |
| Does more than one member contribute within an organization? | No. 0 organizations have 2 or more contributors. | Verified |
| Share of activity from solo workspaces versus multi-member organizations | 100% solo (653 of 653) | Verified |
| The single paying Team organization | 4 seats paid, 1 member, 4 invitations sent, 0 accepted; 21 submissions ever, 7 in 90 days (2.3% of volume) | Verified |
| Does behavior support prioritizing small TC companies? | Not supported by product behavior. Not refuted either: a company may use one shared login. | Inference |
| Can the data distinguish a TC company from an ordinary multi-user organization? | No. There is no company-type field, and identity-based inference was not performed. | Verified |
| What requires interviews | Whether the top 5 workspaces are companies with several coordinators behind one login; why the Team invitations were not accepted; whether owners want a company-standard form | Hypothesis |

---

## 14. Automatic-reminder opportunity size

| Question | Answer |
| --- | --- |
| Monthly volume eligible for one automatic reminder (stored contact, unsubmitted at 48 hours) | **About 0 per month now** (0 in the last 90 days; 18 in 365 days, about 1.5 per month, all created before July) [Verified] |
| Current eventual completion among eligible requests | 5 of 18 (27.8%), all within 9 days [Verified] |
| Expected experiment sample size | The audit's threshold is at least 50 eligible requests. At the current rate that is never reached. [Inference] |
| Alternative scope (would need new seller-email capture at reusable-link start, a separate product decision) | About 13 genuine stalls per month (40 in 90 days), with a baseline eventual completion of 2.4% (3 of 127). Detecting a lift from about 3% to 15% needs roughly 90 stalls per arm (80% power, 5% two-sided). That is over a year for a randomized test, or about 4 months for a 50-request before/after read. [Inference] |
| Recommended primary metric (if ever built) | 7-day submission rate among live requests unsubmitted at 48 hours, excluding same-property restarts |
| Recommended guardrails | Seller unsubscribe and complaint rate, bounce rate (requires email-provider data), coordinator opt-out rate, duplicate restart rate |
| Is the opportunity large enough to justify implementation? | **No, not now.** [Inference] The audit's version has no eligible volume. The broader version would add at most about 6 or 7 submissions per month even at a 50% recovery rate. Those are mostly inside top paid workspaces that pay a flat fee, so the revenue effect is roughly zero. |

---

## 15. Comparison with the 2026-09-03 recorded figures

| 2026-09-03 recorded figure | Live result (2026-09-10) | Definition notes |
| --- | --- | --- |
| 9 Pro vs 108 Free workspaces | Exact rerun of the original query: **9 Pro, 108 Free** (unchanged) | The original counts accounts of every role that have an intake link. The corrected customer basis is 139 accounts (9 Pro flag, 130 Free flag). Of the 9 Pro flags, only 7 have Stripe subscriptions; add 1 Teams organization. |
| 286 advanced requests, 221 submitted (77.3%) | As-of reconstruction (created and submitted before 2026-09-04): **286, 221, 77.3%**, reproduced. Now: 300, 231, 77.0%. | Original has no customer or demo-organization exclusion. Customer-only live: 227 of 291 (78.0%). |
| Simple mode 82.1% submitted | As-of reconstruction: 427 of 520 (82.1%), reproduced. Now: 439 of 535 (82.1%). | Customer-only live: 426 of 521 (81.8%) |
| 95% of advanced requests from 2 accounts | As-of reconstruction: 271 of 286 (94.8%), reproduced | |
| 178 and 69 distinct addresses across 103 and 50 days (power accounts) | Not recomputed | Per-account address and day counts are row-level adjacent; top-2 share of all submissions is used instead (52.5% all history, 56.4% in 90 days) |
| Audit inference: about $81/month before Teams | **$91 MRR** (7 Pro plus a 4-seat Team) | Stripe authoritative |
| Founder July 14 estimate: about 120 signups, 10 to 30 used on a real transaction | Live reconstruction: 135 customer accounts created by 2026-07-14, 35 activated by then (25.9%) | Live figure excludes internal and demo accounts; deleted accounts cannot be counted. Activation was higher than the founder estimate. |
| Audit: 17.9% Simple and 22.7% Advanced did not submit | Same as above (reproduced) | Section 11 shows this includes never-opened individual requests and same-property restarts |

---

## 16. Data-quality and instrumentation limitations

1. **Event logging start dates.** No request source for 9 live requests (before 2026-01-15). `seller_opened` starts 2026-01-13. Suggestion events start 2026-02-27, which bounds D4.
2. **No plan history.** Plan segments use the current flag. Stripe subscription dates are the only transition history, and Stripe events are retained only from 2026-08-13.
3. **Stripe metadata.** No subscription carries account or organization metadata, so mapping relies on Stripe customer IDs.
4. **Two Pro flags without Stripe.** Their origin (comped, manual, legacy) is not recorded. They affect paid-segment retention (they are in "paid flag now").
5. **Limit blocks are not logged.** Reusable-link starts rejected by the monthly limit leave no trace, so limit pressure is a lower bound.
6. **Duplicate starts.** 43 of 156 stale unsubmitted requests are restarts, which inflates abandonment.
7. **Attribution coverage.** 1 of 139 customer accounts has attribution. Source-to-activation analysis is not possible.
8. **Vercel Analytics limits.** Counts are visitor-based and lossy (blockers, consent). The data cannot be joined to accounts. Signups are undercounted (23 vs 139). The window is 366 days (Pro plan), and daily granularity is limited to 62-day ranges.
9. **PDF.** PDF delivery, forwarding, and PDF-driven signups are unmeasured.
10. **No company or login-sharing signal.** Teams questions cannot be answered from behavior.
11. **Shared Stripe account.** The account holds non-UtilitySheet products; one unmapped $350 invoice was excluded.
12. **Email provider not accessed.** Completion-email and reminder deliverability are unknown.
13. **Small samples.** 37 activated workspaces, 10 paid, 17 month-6-eligible, and 6 limit-reaching. Percentages move several points per workspace.
14. **Legacy accounts.** 19 customer accounts have no organization membership; their 6 submissions are included in workspace metrics.

---

## 17. Strategic audit conclusions strengthened by live data

| Audit conclusion | Live evidence |
| --- | --- |
| "The product is ahead of the business" | MRR $91; 8 paying subscriptions; 10 ever |
| Customer and revenue concentration is the top weakness | Top 5 workspaces produce 92.3% of 90-day submissions; paid-flag workspaces 95.0% |
| Retention comes from template embedding (reusable link) | 94.0% of 90-day submissions are reusable-link; the reusable link is used by every workspace active in the last 90 days |
| The closing-exposure loop leaks where volume is highest | 8 impressions, 0 clicks, 0 activations against 298 packets in 90 days |
| Evidence infrastructure lags product infrastructure | Attribution on 1 of 139 accounts; no plan history; limit blocks unlogged; the scoreboard remains unfilled |
| The Property Handoff Packet costs completion | 78.2% vs 85.6% opened-form completion (mature) |
| "Nearly 86%" has no reproducible source | Not reproducible under plain definitions |
| "Org-wide packet defaults" should not be sold before it exists | The only Team organization has 1 active member |
| Do not raise referral rewards | 0 referral credits ever |

## 18. Strategic audit conclusions weakened or overturned

| Audit conclusion | Change | Why |
| --- | --- | --- |
| Bet 3 / Action 3: build automatic seller follow-up now | **Overturned (for now)** | 0 eligible requests in 90 days; stalls sit in no-contact reusable starts and top paid workspaces |
| "The binding constraint is not feature breadth" (implied focus on retention and delivery) | **Refined** | The live constraint is acquisition: signups fell from 111 (December to March) to 28 (April to August); 2 in the last 30 days |
| Primary ICP: small TC companies | **Weakened** | Zero multi-member organizations; 1 Team with 1 of 4 seats used. Still possible through shared logins, so not overturned |
| Bet 4: company-owned seller form (Validate first) | **Weakened** | No team behavior to build on |
| The Free-limit lock is the key monetization moment | **Weakened** | 6 workspaces ever reached the limit; 1 lock; 9 of 10 paying workspaces paid without reaching it |
| Bet 7: loop measurement is cheap with unknown yield | **Refined** | Web yield is now known to be about zero; PDF remains unmeasured, but volume behind it is concentrated in white-label paid accounts |
| Activation is the leak (10 to 30 of 120) | **Weakened** | 35 of 135 had activated by 2026-07-14; 26.6% overall; most activation happens on day 0 |

## 19. Decisions now supported

1. **Treat acquisition as the constraint for the next quarter.** Measure it weekly as signups and first live submissions. [Inference from Verified trend]
2. **Do not implement automatic seller reminders now.** Revisit only if stored-contact eligible volume exceeds about 10 per month, or if customers report stalled sellers as a pain. [Inference]
3. **Replace or remove "Nearly 86%".** Use "More than 80% of seller forms that sellers open are submitted" with the saved D3 query, or remove the number. [Verified basis]
4. **Pause company-owned form and Teams workflow investment** until interviews show companies behind shared logins, or a multi-member organization appears. [Inference]
5. **Protect the top 5 workspaces.** They carry about 92% of volume and most revenue; losing one changes the business. [Verified basis]
6. **Keep the lock and Free limit as they are.** They are neither hurting nor driving conversion. Do not spend effort on paywall tuning. [Inference]
7. **Reconcile billing hygiene as an owner review (no production change authorized here).** Two Pro flags have no Stripe subscription; subscriptions carry no metadata; 6 checkouts were abandoned. [Verified basis]
8. **Adopt this query set as the dated baseline** and rerun it quarterly (section 21). [Decision support]

## 20. Decisions still requiring customer research

- **Who the top workspaces are.** Are the top 5 workspaces TC companies with several coordinators behind one login, solo coordinators, or agents' assistants?
- **Why signups stopped.** What produced the December to March signups (communities, posts, a launch, a partner), and why did they stop? Attribution cannot answer this.
- **Early cancellations.** Why did 2 Pro customers cancel after one month? Why did 6 accounts start checkout and not subscribe?
- **Team invitations.** Why were the Team invitations not accepted?
- **Packet delivery.** Where do completed packets go (TMS upload, PDF email, link), and does the buyer side ever see them?
- **Willingness to pay** for a company offer.
- **Stalled sellers.** Are stalled sellers a felt problem, given that 98% of submissions finish within 48 hours and stalls cluster in a few accounts?

## 21. Recommended next action

**Find out what produced the December 2025 to March 2026 signups and restart that channel.** Begin with 5 conversations with the top workspaces. Ask how they found UtilitySheet, who uses the login, and who they would introduce. Use the answers to pick one acquisition channel to run for 6 weeks, measured by weekly signups and first live submissions. The measurement is already available with this query set.

### Reproducible query definitions (sanitized)

Shared CTEs used by every customer metric:

```sql
demo_org AS (SELECT o.id FROM organizations o WHERE o.slug = 'utilitysheet-demo'),
cust AS (
  SELECT a.id, a.created_at, a.subscription_status, a.stripe_customer_id
  FROM accounts a
  WHERE a.role = 'user'
    AND NOT EXISTS (SELECT 1 FROM organization_members om
                    WHERE om.account_id = a.id AND om.organization_id IN (SELECT id FROM demo_org))
),
live AS (
  SELECT r.id, r.account_id, r.organization_id, r.status, r.packet_mode, r.created_at, r.metered_at,
         (NULLIF(TRIM(r.seller_email), '') IS NOT NULL) AS w_mail,
         (NULLIF(TRIM(r.seller_phone), '') IS NOT NULL) AS w_tel,
         COALESCE((SELECT CASE WHEN e.event_data->>'source' = 'intake_link' THEN 'reusable'
                               WHEN e.event_data->>'actor' = 'agent' THEN 'individual' ELSE 'other' END
                   FROM event_logs e WHERE e.request_id = r.id AND e.event_type = 'request_created'
                   ORDER BY e.created_at LIMIT 1), 'unknown') AS src,
         CASE WHEN r.status = 'submitted' THEN COALESCE(
           (SELECT MIN(e.created_at) FROM event_logs e WHERE e.request_id = r.id AND e.event_type = 'seller_submitted'),
           r.last_activity_at) END AS sub_at,
         (SELECT MIN(e.created_at) FROM event_logs e WHERE e.request_id = r.id AND e.event_type = 'seller_opened') AS opened_at,
         (SELECT MIN(e.created_at) FROM event_logs e WHERE e.request_id = r.id
            AND e.event_type IN ('suggestions_fetched', 'suggestions_search')) AS sugg_at
  FROM requests r JOIN cust c ON c.id = r.account_id
  WHERE r.deleted_at IS NULL AND COALESCE(r.is_demo, FALSE) = FALSE
    AND (r.organization_id IS NULL OR r.organization_id NOT IN (SELECT id FROM demo_org))
)
```

Seller completion (D3, the recommended public basis):

```sql
WITH <shared CTEs>
SELECT COUNT(*) AS opened, COUNT(sub_at) AS submitted,
       ROUND(100.0 * COUNT(sub_at) / COUNT(*), 1) AS pct
FROM live WHERE opened_at IS NOT NULL;
```

Concentration (top-2 and top-5 share of submissions in a window):

```sql
WITH <shared CTEs>,
per AS (SELECT account_id, COUNT(*) AS n FROM live
        WHERE sub_at >= now() - interval '90 days' GROUP BY account_id),
ranked AS (SELECT n, ROW_NUMBER() OVER (ORDER BY n DESC) AS rk, SUM(n) OVER () AS tot FROM per)
SELECT COUNT(*) AS active_workspaces, MAX(tot) AS submissions,
       ROUND(100.0 * SUM(n) FILTER (WHERE rk <= 2) / MAX(tot), 1) AS top2_pct,
       ROUND(100.0 * SUM(n) FILTER (WHERE rk <= 5) / MAX(tot), 1) AS top5_pct,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY n) AS median_per_workspace
FROM ranked;
```

Cohort retention (month N active among completed-month-eligible workspaces):

```sql
WITH <shared CTEs>,
pm AS (SELECT account_id, date_trunc('month', sub_at AT TIME ZONE 'UTC') AS mon, COUNT(*) AS n
       FROM live WHERE sub_at IS NOT NULL GROUP BY 1, 2),
f AS (SELECT account_id, MIN(mon) AS c FROM pm GROUP BY 1),
cur AS (SELECT date_trunc('month', now() AT TIME ZONE 'UTC') AS cm)
SELECT to_char(f.c, 'YYYY-MM') AS cohort, COUNT(*) AS size,
  COUNT(*) FILTER (WHERE f.c + interval '3 months' < cur.cm) AS m3_eligible,
  COUNT(*) FILTER (WHERE f.c + interval '3 months' < cur.cm AND EXISTS (
    SELECT 1 FROM pm WHERE pm.account_id = f.account_id AND pm.mon = f.c + interval '3 months')) AS m3_active
FROM f CROSS JOIN cur GROUP BY f.c, cur.cm ORDER BY f.c;
```

Reminder eligibility (stored contact, unsubmitted at 48 hours):

```sql
WITH <shared CTEs>
SELECT COUNT(*) AS eligible, COUNT(sub_at) AS eventually_submitted
FROM live
WHERE (w_mail OR w_tel)
  AND created_at <= now() - interval '48 hours'
  AND created_at >= now() - interval '90 days'
  AND (sub_at IS NULL OR sub_at > created_at + interval '48 hours');
```

Free limit reached: rank each customer account's metered, unlocked, non-demo requests within a UTC calendar month and take the 3rd. Classify it as unpaid when no Stripe subscription for the account's customer, or its Team organization's customer, covers that timestamp. Stripe subscription start and end dates are supplied to SQL as a JSON parameter, so only counts return.

Database and Stripe agreement: pass the list of active Stripe subscription IDs as a `text[]` parameter, and count `accounts.subscription_id = ANY($1)` and `organizations.subscription_id = ANY($1)`.

Vercel Analytics: `GET https://api.vercel.com/v1/query/web-analytics/events/aggregate` with `projectId`, `teamId`, `since`, `until`, and `by=eventName`, or `by=eventData/step` with `filter=eventName eq 'seller_step_viewed'`.

---

## Final decision memo

1. **Is acquisition, activation, retention, or monetization the clearest current constraint?**
   - **Acquisition.** Signups went from 111 (December to March) to 28 (April to August), with 2 in the last 30 days, and landing CTA viewers fell to 237 in 90 days.
   - **Retention.** Among serious users it is healthy: paid-flag month-3 activity is 6 of 10.
   - **Activation.** About a quarter of signups activate, mostly on day 0.
   - **Monetization.** It is small but not the main blocker. The few heavy users already pay, just very little.
2. **Is customer concentration improving, stable, worsening, or impossible to determine?**
   - **Worsening at the top 5, stable at the top 2.** Top-5 share went from 74.4% in February to 90% to 97% from June to September. Top-2 share has held at about 56% to 59% since June.
   - **Low confidence.** Only 7 to 16 workspaces are active in any month.
3. **Does live behavior support small TC companies as the primary ICP?**
   - **No.** There are zero multi-member organizations, and the only Team uses 1 of 4 seats.
   - **Not refuted.** Companies may share a login; interviews are required.
4. **Is automatic seller follow-up sufficiently sized to justify implementation?**
   - **No.** Zero requests were eligible in the last 90 days.
   - **The broader scope is also too small.** It would require new contact capture, adds roughly 6 or 7 submissions per month at best, and would take over a year to test properly.
5. **Can the "Nearly 86%" claim be substantiated?**
   - **Not as worded.** Directionally supported: 82.6% of opened forms are submitted, and 85.5% of sellers who reach the utilities step submit.
   - **Revise it.** Use "More than 80% of seller forms that sellers open are submitted", or remove the number.
6. **Does the closing-exposure loop produce meaningful activation?**
   - **No.** In 90 days: 8 impressions, 0 clicks, 0 referred signups, 0 activations, and 0 referral credits ever.
7. **What single action should the owner take next?**
   - **Restart acquisition.** Find and restart the channel that produced the December to March signups, beginning with 5 conversations with the top workspaces about how they found UtilitySheet and whom they would introduce.
