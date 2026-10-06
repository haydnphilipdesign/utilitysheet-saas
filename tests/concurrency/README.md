# Concurrency harness (manual)

The Vitest suites run the Admin write and reminder SQL against PGlite, which is a
single connection. That proves atomicity, constraints and decision logic, but not
how two sessions interleave. `run.ts` covers that gap with real concurrent
connections to a disposable local PostgreSQL server.

It is not part of `npm test` or CI because the repository does not depend on a
PostgreSQL server or the `pg` client. Run it by hand after changing
`lib/neon/queries/admin-writes.ts`, `lib/neon/queries/reminder-operations.ts`,
`lib/ops/triage.ts`, `lib/neon/queries/seller-submission.ts`, or the locking strategy.

## Safety

- Starts its own server on `127.0.0.1` in a temporary directory and removes it afterward.
- Reads no `DATABASE_URL` and has no way to reach a hosted database.
- Loads `schema.sql` and the migration files it names into that local server only.

## Running

Install the two harness packages somewhere outside the repository (they are
deliberately not project dependencies), then point the script at them:

```powershell
# one-time, in any scratch directory
npm init -y; npm install embedded-postgres pg

# from the repository root
$env:PG_HARNESS_MODULES = "C:\path\to\scratch\node_modules"
npx tsx tests/concurrency/run.ts
```

The script prints one `PASS`/`FAIL` line per check and exits non-zero on failure.

## What it checks

- Two admins demoting each other concurrently always leave exactly one admin.
- A role change waits for an open one and then decides against its committed result.
- Parallel seller edits, status corrections and entitlement overrides: one wins, the other is reported stale, with one audit/timeline entry.
- Concurrent reminder claims (two Admin sessions, or Admin and customer): exactly one claim.
- A waiting reminder claim sees the committed claim rather than a stale snapshot.
- Two operators triaging the same item at once: one wins, the other is told to refresh.

Last run: 2026-10-05, PostgreSQL 18.4 (embedded), all 12 checks passed.
- Simultaneous seller submissions: one accepted, one refused, one sheet and one event. The same key twice is one accepted and one duplicate.
- A submission from an earlier editing session that waits behind an uncommitted reopen is refused as stale once the reopen commits, and its retry key is not treated as a duplicate.
- Two reopens at once, and a resubmission racing close-without-changes: exactly one takes effect.
