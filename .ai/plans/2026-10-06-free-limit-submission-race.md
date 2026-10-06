# Free monthly limit: race between the usage read and the submission write

- Status: **Completed 2026-10-06. Option B approved by the owner and implemented; see "Outcome" and "Addition" at the end. Committed and pushed.** Questions 2 and 3 were not answered separately; the stated proposals were applied (month boundary explicit midnight UTC; workspace scope left alone).
- Date: 2026-10-06. Agent: Claude Opus. Branch: main at e53bb1a.
- Related decisions: `2026-09-15-submission-based-free-metering.md` (lists this race as known and not addressed), `2026-10-06-read-only-after-submission-and-reopen.md`, `2026-08-27-team-billing-ownership-and-workspace-isolation.md`.
- Not authorized and not done: product code, migrations, production database access or queries, Stripe or billing changes, email, commit, push, deploy.

## Rules that hold whichever option is chosen

1. A resubmission after a reopen is never counted again and never newly locked.
2. `metered_at` is set once and never cleared.
3. A submission never removes an existing lock.
4. Paid accounts are never locked.
5. Test-drive requests are never counted.
6. No change to prices, limits, plan names or plan contents.

## 1. The race, confirmed from the code

`POST /api/seller/[token]` (`app/api/seller/[token]/route.ts`):

- Lines 498 to 531 read the request, the owner account and the organization, each as its own HTTP query.
- Lines 543 to 550: when the request is not a test drive, not paid and `metered_at` is null, it calls `getMonthlyUsage` and sets `shouldLock = usage.plan === 'free' && usage.used >= usage.limit`.
- Lines 683 to 709 pass `shouldLock` as a plain boolean to `submitSellerRequest`, which applies it at `lib/neon/queries/seller-submission.ts` lines 110 to 114.

`getMonthlyUsage` (`lib/neon/queries/accounts.ts` 257 to 323) is two or three more separate queries. The submission statement locks only its own request row (`FOR UPDATE` on `requests.id`). Two submissions for two different requests of one Free account never touch the same row, so nothing makes the second wait for the first. Both can read the same count, both pass `shouldLock = false`, and both are stored unlocked. Verified by reading; not reproduced against a database in this session.

The window is the time from one submission's count query to the other's commit: the rest of `getMonthlyUsage`, the in-memory work, and the statement. That is several HTTP round trips to Neon, so roughly tens to a few hundred milliseconds (estimate, not measured).

Two smaller stale reads sit in the same gap and are fixed by the same change: the route decides "unmetered" and "paid" from rows read before the statement, not from the locked row. The editing-session check in the statement already stops these from breaking rules 1 to 3 in every interleaving I could construct, so they are a tidiness point, not a second bug.

### How usage is counted today (verified)

| Question | Answer | Where |
| --- | --- | --- |
| Which requests count | `metered_at` set, `metered_at` at or after the start of the month, not test-drive (`is_demo` false or null), `is_locked = FALSE` | `accounts.ts` 271 to 279 |
| What sets `metered_at` | Only an accepted, non-test-drive seller submission, and only when it is null | `seller-submission.ts` 110 |
| Status | Not read. Owners can change status; they cannot change `metered_at` | decision 2026-09-15 |
| Month boundary | Midnight on the 1st in the **app server's local time zone**, computed in JavaScript (`setDate(1)`, `setHours(0,0,0,0)`). On Vercel that is UTC. It is not the customer's time zone and not a billing anniversary. A sheet counts in the month it was first submitted, not the month it was created | `accounts.ts` 265 to 267 |
| Account scope | By `requests.account_id` (the request's owner) only | `accounts.ts` 274 |
| Workspace scope | **None in the count.** The organization is used only to decide the plan (`team` means unlimited). Every metered, unlocked request the account owns in any workspace counts | `accounts.ts` 269, 300 to 315 |
| Locked submissions | Do not count, so every Free submission after the limit is locked, however many arrive | `accounts.ts` 278 |
| Deleted requests | A metered request is soft-deleted and **still counts** (no `deleted_at` filter). An unmetered one is hard-deleted and never counted | `requests.ts` 768 to 805 |
| Test-drive requests | Never metered (`isTestDrive` keeps `metered_at` as is) and excluded from the count twice over | `seller-submission.ts` 110, `accounts.ts` 277 |
| Paid accounts | Paid means owner account `pro` or the request's organization `team`. The route skips the usage read and never asks for a lock. `getMonthlyUsage` returns a limit of 999999 | route 531, 545 |
| Limit | 3, hard-coded in `getMonthlyUsage` (and as a display default in `app/dashboard/settings/page.tsx` line 100) | `accounts.ts` 320 |

Observations about existing behavior, not proposed for change here:

- Because the count has no workspace scope, sheets an account submitted earlier in the month while paid, or inside a Team workspace, count against that account's Free limit elsewhere in the same month. In a workspace that is not on Team, each member has their own 3.
- The comment above `getMonthlyUsage` still says "counts requests created this month". It counts submissions.

## 2. Every other place that reads or enforces the limit

| Place | What it does | Same weakness? |
| --- | --- | --- |
| Seller submission, `app/api/seller/[token]/route.ts` | The only enforcement point | **Yes. This is the race.** |
| Request creation, `POST /api/requests` | No limit check, by design since 2026-09-15 (comment at line 158) | No. Nothing to race |
| Reusable-link start, `app/api/intake/[slug]/start/route.ts` | No limit check (comment at lines 121 to 122); creates the request unmetered | No |
| Dashboard and Settings usage display, `GET /api/account` then `getMonthlyUsage` | Read-only display. Enforces nothing | No. After a race it would truthfully show "4 of 3"; the bar is clamped to 100% |
| Reading a locked sheet: `GET /api/requests`, `GET /api/requests/[id]`, `lib/packet/packet-data.ts` 325 to 331, request list queries | Hide details when `is_locked` and the viewer is not paid, decided at read time | No |
| Upgrade | **Writes nothing to the lock columns.** "Unlocks automatically" is the read-time rule above: a paid viewer sees locked sheets | No race. Nothing to interleave with |
| Downgrade or cancellation | Also writes nothing. Sheets locked earlier are hidden again; sheets submitted while paid stay unlocked and count for that month | No race |
| Admin entitlement override, Admin status correction | Change `subscription_status` or `status` only; never `metered_at` or the lock | No |
| Reopen and close-without-changes | Refuse locked and test-drive requests; never touch `metered_at` or the lock | No |
| Test-drive creation | Already serialized per account with an advisory lock; never metered | No |
| Request delete, `deleteRequest` in `requests.ts` | Reads `metered_at`, then hard-deletes or soft-deletes in a later statement | A different, smaller gap: a submission landing between the read and the delete is hard-deleted and stops counting. The customer loses the sheet, so there is nothing to gain. Noted, out of scope |

Consequence of the upgrade and downgrade finding: nothing ever re-evaluates a stored request. A sheet the race leaves unlocked stays unlocked for good. No later process corrects it.

## 3. How much this matters

**By accident: close to never, and worth one sheet.** It needs two different sellers of the same Free account to submit within the window above, while the account has exactly one slot left (or zero used and three or more land together). A Free account produces at most three counted submissions a month. The handoff of 2026-10-06 recorded 160 accounts and 768 submitted requests in total, so on the order of a few submissions a day across all customers. I ran no production query and cannot say whether it has ever happened; nothing in the code would record it if it had. The accidental gain is one extra unlocked sheet in that month.

**On purpose: more than one sheet, but awkward.** The gain is not capped at one. Every submission that reads the count before the first commit passes. Someone who creates N requests, fills each seller form themselves, and fires the N submissions together from a script gets up to N unlocked sheets in one burst, and can do it at zero used. The submission rate limit is per seller token, so it does not slow submissions across different requests. In practice this needs scripting and fake seller answers, so the "sheets" gained are ones the person typed themselves. A real coordinator cannot make real sellers submit in the same instant. I found no evidence of abuse and did not look for any in production.

**Cost to the business if it happens:** a few unlocked sheets on Free that should have prompted an upgrade. No money moves, no data is exposed to the wrong party, no paid customer is affected.

So: low likelihood, low impact, but it is the one entitlement rule in the product that can be bypassed with a script, and the fix is small.

## 4. Options

A fact that shapes all of them: under PostgreSQL's default READ COMMITTED level, **one statement sees one snapshot taken when it starts**. A statement that waits on a lock and then continues does not see what the other session committed in the meantime, except on the specific row it was waiting for. This is why the reminder claim takes its advisory lock as a separate first statement in the same transaction (`reminder-operations.ts` 74 to 93).

### Option A: count and decide inside the submission statement, nothing else

Move the plan check and the count into `submitSellerRequest` as CTEs and drop `shouldLock` as an input.

- **Does not close the race.** Two statements for different requests each count from their own snapshot and neither sees the other's uncommitted row. Adding a row lock on the account or an advisory lock inside the same statement does not help either, for the snapshot reason above.
- It narrows the window from several round trips to the overlap of two statements (single-digit milliseconds), and removes the stale "unmetered" and "paid" reads.
- Migration: none. Latency: Free submissions get faster (two or three fewer round trips). Neon HTTP driver: fine, one statement.
- Verdict: an improvement, but the two-connection harness would still fail a held interleaving. Not a fix on its own.

### Option B: per-account advisory lock, then the statement with the count inside it (recommended)

`submitSellerRequest` runs two statements through `executor.transaction`, which Neon runs as one non-interactive transaction in one HTTP request:

1. `SELECT pg_advisory_xact_lock(hashtextextended('utilitysheet:free-usage:' || account_id::text, 0)) FROM requests WHERE id = $1`. The key is derived from the stored owner, not from a value the route read earlier.
2. The existing submission statement, with new CTEs that read the owner's plan, the request's organization plan and the month's count, and compute the lock decision from the locked request row: lock only when the outcome is ACCEPTED, the request is not test-drive, `metered_at` is null, the owner is not paid, and the count is at or over the limit.

Because the second statement starts after the lock is held, its snapshot includes whatever the previous holder committed. Two simultaneous first submissions on one account are decided one after the other.

- Closes the race for any number of simultaneous submissions.
- Migration: **none**. No new column, table or index. The count uses the existing `account_id` index.
- Latency: Free first submissions drop the two or three `getMonthlyUsage` round trips and gain one trivial statement inside the same HTTP request, so they should be slightly faster. Paid and resubmissions gain only that trivial statement. A submission waits only when another submission for the same owner is mid-statement, for a few milliseconds.
- Neon HTTP driver: uses `transaction([...])` exactly as the reminder claim and test-drive creation already do in production. Transaction-scoped advisory locks are safe behind Neon's pooler because they end with the transaction. It relies on the default READ COMMITTED level; the code must not pass a stricter isolation option, and a comment should say so.
- Lock order: account advisory lock, then the request row. No other path takes this advisory lock, so it cannot form a cycle with reopen, Admin corrections or reminder claims.
- Rules 1 to 5 move into SQL, decided on the locked row, instead of depending on what the route read earlier.
- Route changes: remove the `getMonthlyUsage` call and `shouldLock`; derive `accessLocked` from the returned row (`is_locked` and not paid) for the email and contact-resolution gating that follows.
- Month boundary: the SQL must reproduce today's production behavior explicitly, `date_trunc('month', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`. `getMonthlyUsage` (display) should use the same definition so the two cannot drift; the limit value is passed as a parameter from one shared constant, still 3.
- Risk: this edits the statement that stores every seller submission. A mistake there is worse than the race. Mitigated by the tests in section 5 and by keeping every existing column assignment unchanged.

### Option C: a usage counter row

A new table keyed by account and month, incremented with `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` inside the submission statement. The conflict wait re-reads the committed row, so this closes the race in a single statement.

- Migration: **yes**, plus a backfill for the current month, plus production rollout ordering.
- Creates a second source of truth beside `metered_at`. Soft deletes, Admin corrections and any future change to what counts would all have to keep it in step.
- Latency and driver: fine.
- Verdict: correct but heavier than the problem deserves. Rejected unless a counter is wanted for other reasons.

### Option D: leave it, and write the reasoning down

Amend the 2026-09-15 decision record with the analysis in section 3: accidental gain is one sheet and vanishingly rare; deliberate gain needs scripted fake submissions; nothing leaks and no money moves.

- Migration, latency, driver: no change.
- Cost: the one bypassable entitlement rule stays bypassable, and a stored unlocked sheet is never corrected.
- Verdict: defensible. It is the right call if the owner does not want the submission statement touched again this soon.

### Considered and rejected: correct afterwards

Recount after the write and lock the newest sheet if over. The completion email, with the PDF attached, has already gone out unlocked by then, and it introduces a write that locks an already-submitted sheet, which no code does today.

## 5. How each option would be tested

**Embedded PostgreSQL unit tests** (`tests/unit/seller-submission-atomic.test.ts`, real `schema.sql`, one connection) prove the decision logic for A, B and C:

- Free at limit minus one: stored unlocked. Free at the limit: stored locked with `locked_reason = 'monthly_limit'` and `locked_at` set.
- Not counted: locked rows, test-drive rows, rows metered before the UTC month start, another account's rows. Counted: soft-deleted rows, rows in another workspace of the same owner.
- Owner on Pro, and request in a Team workspace: never locked at any count.
- Reopened resubmission with the account over the limit: not locked, `metered_at` identical to the original (rules 1 and 2).
- A request already locked stays locked through any accepted write (rule 3).
- Test-drive submission: `metered_at` stays null, never locked, and does not change the count seen by the next real submission (rule 5).
- Every non-accepted outcome (duplicate, already submitted, stale session, not found) writes nothing, including no lock.
- Option C only: the counter matches a recount from `requests` after each case.

**Route tests** (`tests/unit/seller-post-submission-routes.test.ts`, mocked queries): the route no longer calls `getMonthlyUsage` or sends `shouldLock`; a locked result still produces the "Locked, upgrade to view" email and skips contact resolution; a paid result never does. The existing parameter-name assertion at line 138 changes with the input shape.

**Two-connection harness** (`tests/concurrency/run.ts`, disposable local PostgreSQL, by hand, never a hosted database):

- First, a check that reproduces today's behavior (count on each connection, then submit on each) and shows two unlocked sheets, so the harness is proven able to see the bug before the fix.
- Two different requests of one Free account at limit minus one, submitted together, repeated 25 times: exactly one unlocked and one locked every time, both ACCEPTED, both metered.
- Held interleaving: connection A opens a transaction, submits and does not commit; B's submission for another request of the same account must not settle; after A commits, B is stored locked.
- More than two at once from zero used (needs a third and fourth connection): exactly three unlocked.
- Two different accounts never wait on each other.
- Paid owner, both at once: both unlocked.
- A resubmission after reopen racing a first submission on the same account at the limit: the resubmission stays unlocked and its `metered_at` is unchanged.
- Expected results by option: A fails the held interleaving (by design, which is the evidence against it); B and C pass all; D adds only the first check, kept as a documented demonstration or left out.

The full Vitest run, `tsc --noEmit`, ESLint on changed files, the seller-flow Playwright specs with mocked APIs, and `security:scan` apply to any code option.

## Recommendation

**Option B.** It is the only option that closes the race without a migration, it reuses a locking pattern already running in production for reminders, it makes Free submissions slightly faster, and it moves the "never recount, never relock, never lock paid" rules onto the locked row. The accidental case alone would not justify the work; the scripted case and the fact that a wrong result is permanent do.

If the owner prefers not to touch the submission statement now, Option D is acceptable and I would record the reasoning in the 2026-09-15 decision record.

## If Option B is approved: expected work

- `lib/neon/queries/seller-submission.ts`: lock statement plus plan, count and decision CTEs; `shouldLock` input removed; a limit parameter added.
- `app/api/seller/[token]/route.ts`: drop the usage read; take the lock result from the returned row.
- `lib/neon/queries/accounts.ts`: one shared limit constant and the same explicit UTC month start for the display count (value and behavior on Vercel unchanged).
- Tests as in section 5; `tests/concurrency/README.md` updated with the new checks and run date.
- Decision record: amend `2026-09-15-submission-based-free-metering.md` (the "known race" line, the explicit UTC month, where the decision now lives).
- No migration, no `schema.sql` change, no Stripe change.

## Questions for the owner

1. Which option: B (recommended), D, or another.
2. With B, confirm the month boundary stays midnight UTC on the 1st, now stated explicitly instead of inherited from the server's time zone.
3. The count has no workspace scope (section 1 observations). I propose leaving that alone here. Say so if you want it looked at separately.

## Assumptions to verify before implementing

- Production runs with the server time zone at UTC (Vercel default), so an explicit UTC month start changes nothing there.
- Neon's HTTP `transaction` runs at READ COMMITTED when no option is passed (the reminder claim already depends on this).
- A request's `account_id` never changes after creation (stated in the reopen decision; no code path found that changes it).

## Outcome (2026-10-06)

Implemented as described under Option B, with no migration and no `schema.sql` change.

- `lib/neon/queries/seller-submission.ts`: new `sellerSubmissionStatements` returns the advisory lock statement and the submission statement; `submitSellerRequest` runs them through `executor.transaction`. The `shouldLock` input is gone. The statement reads the owner and workspace plan and the month's count and sets the lock from `decision.should_lock`.
- `app/api/seller/[token]/route.ts`: no usage read. `accessLocked` comes from the stored row returned by the write.
- `lib/neon/queries/accounts.ts`, `lib/constants.ts`: `FREE_MONTHLY_SUBMISSION_LIMIT` (3) and an explicit UTC month start for the display count.
- Decision record amended: `2026-09-15-submission-based-free-metering.md`.

Deviations from the plan:

- A test-drive request is now also recognized from the stored `is_demo` flag, not only from the caller's `isTestDrive`, for both metering and locking. Same result for every caller that exists; stricter if a caller were ever wrong.
- The "reproduce the bug first" harness check runs the new statement without its lock on two connections, because the old read-then-write code no longer exists to run. It shows two unlocked sheets at one remaining slot, which is the race, and proves the lock is what closes it.
- `tests/unit/test-drive-seller-safety.test.ts` asserted on route source text that was removed; it now asserts the same guard in the query source.

Validation (Node 22.22.2; CI uses 20):

- Full Vitest: 199 files passed, 1 skipped; 1366 tests passed, 8 skipped. Ten new decision tests against embedded PostgreSQL with the real schema; route tests updated.
- Concurrency harness, four real connections on a disposable local PostgreSQL 18.4: all 28 checks passed, 8 new.
- `tsc --noEmit` clean. ESLint on changed files clean. `git diff --check` clean. `security:scan` passed.

Not verified:

- Nothing ran against Neon. That the HTTP `transaction` call runs at READ COMMITTED and holds a transaction-scoped advisory lock across its statements is inferred from the reminder claim, which depends on the same behavior in production.
- That the production server time zone is UTC (if it were not, the month boundary moves to UTC with this change).
- Playwright and `next build` were not run. The seller specs mock the API, so they do not exercise this code.
- Submission latency was not measured.

Required remaining work: none. Owner actions: review, commit, push. After deploy, submit one test request on a Free account and confirm it is stored and usage rises by one.

## Addition (2026-10-06): Team workspace sheets no longer count

Owner decision after the outcome above, answering question 3. Verified first: every account creates its own workspace at onboarding and can also join a Team workspace by invitation and switch between them, so one account can own requests in a Team workspace and in its own Free one. The count was owner-wide, so Team sheets used up the Free allowance of the member's own workspace.

- Change: the usage count in the submission statement and in `getMonthlyUsage` skips requests whose workspace is on Team. It uses the workspace's plan when counting, so sheets from a workspace that later leaves Team count again for that month.
- Not changed: sheets submitted while the account itself was on Pro still count after a downgrade in the same month.
- Tests: one new embedded PostgreSQL case (ten Team sheets do not lock a Free submission; they count once the workspace is no longer on Team) and an assertion on the display query. Full Vitest 1367 passed, 8 skipped; harness 28 of 28; `tsc`, ESLint, `security:scan` clean.
- Committed and pushed to `origin/main` on the owner's instruction, together with the rest of this plan's work.
