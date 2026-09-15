# UtilitySheet live business baseline (read-only production measurement)

- Status: **Completed** 2026-09-10 by Claude Code (Opus 5). No required work remains.
- Owner authorization: 2026-09-10 brief. Read-only aggregate access to production Neon/Postgres, Stripe, and Vercel Analytics. No mutation, no row-level output, no secrets printed, no commits, no deploys.
- Parent audit (completed; only a dated addendum link added): `docs/audits/2026-09-10-product-growth-audit.md`.
- Deliverable: `docs/audits/2026-09-10-live-business-baseline.md`.
- Baseline commit: `main` at `7b76a93`, with uncommitted audit files from the previous task.

## Scope

Measurement addendum only; the strategic audit was not redone. Metric groups:

- accounts, plans, organizations, subscriptions, and MRR;
- activity and concentration;
- retention;
- free-limit behavior and monetization;
- seller completion, including the "Nearly 86%" claim;
- growth loop;
- Teams;
- reminder sizing;
- comparison with 2026-09-03;
- limitations;
- effect on audit conclusions;
- decision memo.

Out of scope: application code, config, schema, migrations, dependencies, reminder implementation, copy changes, and customer outreach.

## Verified facts from startup inspection

- **Database access.** The app reaches the database through `@neondatabase/serverless` with `DATABASE_URL` (`lib/neon/db.ts`). `.env.local` holds the real Neon URL. `.env` has a placeholder database host and the live-mode Stripe key.
- **Exclusions already defined in code.** `role = 'user'`, `is_demo`, `deleted_at`, and the demo organization slug `utilitysheet-demo`. The demo seed creates a `team`-flag organization with no Stripe subscription.
- **Request source.** It comes from the first `request_created` event: `source = 'intake_link'` is reusable, and `actor = 'agent'` is individual.
- **Seller contact.** It is stored only on manual creation. Seller self-send does not persist the email.
- **Limit and billing state.** The Free limit is 3 metered unlocked requests per calendar month per account. Plan flags are webhook-synced, and no plan-change history table exists.

## Outcome

- **Sources accessed.** All three required sources: Neon (read-only transactions), Stripe (live), and Vercel Web Analytics.
- **Snapshot.** 2026-09-10, 18:02 to 18:18 UTC.
- **Metric groups.** Every metric group in the brief is computed or explicitly classified.
- **Headline results.**
  - MRR is $91 (7 Pro plus one 4-seat Team).
  - Acquisition collapsed after March 2026.
  - The top 5 workspaces produce 92.3% of 90-day submissions.
  - There are zero multi-member organizations.
  - Reminder-eligible volume in the last 90 days is 0.
  - The loop produced 8 impressions and 0 clicks in 90 days.
  - "Nearly 86%" is not substantiated as worded (82.6% of opened forms are submitted).

## Material deviations (recorded honestly)

1. **Vercel access path.** The installed CLI (47.0.7) has no analytics command, and `vercel env ls` failed with a CLI error. Web Analytics was queried through Vercel's documented REST API, using the existing authenticated CLI login held in memory. The token was never printed.
2. **Production verification method.** Environment variables could not be compared with Vercel. Production identity was instead verified by exact aggregate agreement between the database and live Stripe (7 of 7 account and 1 of 1 organization subscription IDs).
3. **Added check not in the brief.** A duplicate-start check counted unsubmitted requests whose workspace submitted the same normalized property address. Addresses were compared inside SQL; only counts were returned. It materially changes abandonment figures.
4. **Guard and query fixes.** The output guard rejected one harmless alias (`seller_...`), which was renamed. One SQL grouping error in a Stripe summary query was removed and replaced with an in-memory aggregate. No data was printed in either failure.
5. **Not accessed.** Email-provider data, because it was not in the authorization.
6. **Not recomputed.** The 2026-09-03 per-account distinct-address and distinct-day figures, because they are row-level adjacent; top-2 shares are used instead.
7. **Scratch location.** Scripts and aggregate outputs are kept in the session scratchpad, not the repository.

## Acceptance

- Every brief metric has a live value or a classification: met.
- Counts accompany rates, and cohort sizes accompany retention: met.
- No row-level or identifying output in files or console output; no secret values printed: met (see validation).
- Only authorized files changed: met (see validation).
- No required source unavailable: met.

## Validation

Run at the end of the session, 2026-09-10:

- **Read-only transactions.** Every SQL batch asserted `transaction_read_only = on` (all returned `on`).
- **Other services.** Stripe used list and retrieve calls only; Vercel used GET analytics queries only.
- **`git status`.** Changed files: `.ai/CURRENT.md` (modified); new untracked `.ai/plans/2026-09-10-live-business-baseline.md` and `docs/audits/2026-09-10-live-business-baseline.md`. The parent audit is untracked from the previous task. Pre-existing untracked files are unchanged: the previous-audit plan and `output/`.
- **`git diff --check`.** Clean (a line-ending notice only). The same check against the new and untracked docs is also clean.
- **Pattern scan.** Deliverable, plan, handoff, and parent audit scanned for emails, UUIDs, Stripe object IDs, key prefixes, connection strings, and bearer tokens: none found.
- **Formatting.** Em dashes: 0. Report section headings: 21 of 21.
- **`npm run security:scan`.** Passed. It scans tracked files only.

## Optional follow-up (owner decisions, not required work)

1. **Acquisition.** Identify and restart the December to March acquisition channel, starting with conversations with the top workspaces.
2. **Claim copy.** Replace or remove the "Nearly 86%" claim. Suggested wording is in the deliverable, section 11.
3. **Billing hygiene.** Review the 2 Pro flags without Stripe subscriptions and the missing subscription metadata. No production change is authorized here.
4. **Instrumentation.** Consider it only if a decision needs it: limit-block logging, attribution coverage, a plan-change record, and PDF CTA tracking.
5. **Baseline cadence.** Rerun the query set quarterly.
