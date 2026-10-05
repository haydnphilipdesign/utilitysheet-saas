# Admin Writes Are Atomic With Their Evidence; Status Corrections Are Not Submissions

Date: 2026-10-05. Status: Accepted (implemented locally under the Admin operational-readiness plan; not yet released).

## Context

Admin actions changed data and then wrote `admin_audit_logs` (and sometimes `event_logs`) in separate calls. A failed audit insert left a successful change reported as a failure. Policy checks such as last-admin protection were a count followed by a write, which two concurrent admins could both pass. The Admin status selector called the shared `updateRequestStatus`, so an operator could set Submitted without the seller submitting.

`lib/neon/db.ts` uses the Neon HTTP driver. It has no interactive transactions: separate awaited calls never share a connection.

## Decision

1. **One statement per Admin write.** Each write in `lib/neon/queries/admin-writes.ts` is a single statement of data-modifying CTEs that locks the target row, decides the outcome, applies the change, and inserts the audit entry and any required timeline event. If the audit or timeline insert fails, the change rolls back. Where a lock must be taken first, the statements are submitted together through Neon's non-interactive `sql.transaction([...])`.
2. **Statements are text plus positional parameters** (`lib/neon/statements.ts`) so the identical SQL runs against PGlite in Vitest and against real PostgreSQL in `tests/concurrency/run.ts`.
3. **The SQL decision is authoritative.** It re-checks that the actor is still an admin, the before-state the operator saw (`expectedRole`, `expectedPlan`, `expectedStatus`, expected seller contact), self-protection, Team-managed entitlement, closure status and last-admin protection. `lib/admin/policies.ts` remains as pure policy documentation and tests; `lib/admin/refusals.ts` words the SQL outcomes.
4. **Optimistic concurrency uses the fields being changed, not `updated_at`.** `updated_at` moves on unrelated writes (billing webhooks, seller activity), which would produce spurious conflicts.
5. **Role changes are serialized** with `pg_advisory_xact_lock` on a fixed key. In READ COMMITTED the statement after the lock takes its snapshot after the lock is granted, so two admins demoting each other cannot both succeed.
6. **Blocked policy attempts are audited** (`blocked: true`). Stale edits, no-ops and missing targets write nothing, so there are no misleading success entries.
7. **Errors are stable and safe.** `lib/admin/action-guard.ts` returns coded refusals; unexpected failures return a correlation reference and log the detail server-side. A failed cache refresh after commit is never reported as a failed write.
8. **Manual signup reconciliation is not atomic and does not pretend to be.** It requires a reason and confirmation, commits an attempt audit before execution and a count-only outcome afterward (`completed`, `partial`, `failed`, `unknown`). The cron route is unchanged.

### Status correction policy

`metered_at` remains the only authority for a first submission (see `2026-09-15-submission-based-free-metering.md`). An Admin correction changes `status` only. It never sets or clears `metered_at`, does not reset `last_activity_at`, and triggers no quota, referral, email or packet behaviour.

| Request state | Allowed correction |
| --- | --- |
| Unmetered, Draft/Sent/In progress | Among Draft, Sent, In progress. Submitted is refused. |
| Metered and Submitted | None. Use submitted-sheet editing. |
| Metered but not Submitted | Restore to Submitted only. |
| Unmetered but Submitted | None. Test drives are submitted without metering; older records may also look like this. Manual review. |
| Deleted | None. No edits, corrections or reminders. |

The shared `updateRequestStatus` used by customer routes is unchanged.

## Alternatives rejected

- **Count then write for last-admin protection.** Not safe under concurrency.
- **Row locks only (`FOR UPDATE` on admin rows) for role changes.** Workable, but the advisory lock is simpler to reason about and was verified with held interleavings.
- **`updated_at` as the record version.** Spurious conflicts from unrelated writes.
- **Let Admin set `metered_at` when choosing Submitted.** It would fabricate a submission and consume quota without the seller flow.
- **Change `updateRequestStatus` globally.** It would alter customer behaviour outside this task.

## Consequences

- New Admin writes must follow the same single-statement pattern and add a PGlite failure-injection test.
- Server actions take an object including the expected before-state; callers must pass what the operator saw.
- Admin entitlement overrides accept only Free and Pro. `canceled` remains a billing-owned state.
- Account controls are refused server-side for closing or closed accounts, matching the existing read-only UI.
- Lock behaviour is verified by the manual harness in `tests/concurrency/`, which is not part of CI.
- Impersonation remains disabled and still uses the older best-effort audit helper. It must adopt this pattern before it is ever enabled.
