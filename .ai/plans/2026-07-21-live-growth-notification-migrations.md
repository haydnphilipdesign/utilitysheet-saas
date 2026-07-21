# Live Growth and Notification Migrations

- Status: Completed
- Owner: OpenAI Codex
- Date: 2026-07-21
- Branch: `main`
- Authorization: The user explicitly authorized applying the outstanding migrations.
- Excluded actions: No commit, push, deployment, unrelated schema change, or production-data edit.

## Objective

Determine whether the two schema objects identified during the repository review are present in the
Neon database configured by `.env.local`, apply only the missing reviewed migrations, and verify the
result without exposing credentials or production data.

## Migration scope

- `migrations-growth-referral-events.sql`
  - `growth_referral_events` table
  - primary key and two check constraints
  - `idx_growth_referral_events_type_time`
  - partial `idx_growth_referral_events_referral_code`
- `migrations-organization-notification-settings.sql`
  - `organizations.notification_settings JSONB NOT NULL DEFAULT '{}'::jsonb`

Both migrations are additive and idempotent. The growth-events table stores event type, surface,
optional referral code, and timestamp; it stores no seller, request, property, IP, or user-agent data.
The organization column defaults existing rows to an empty JSON object, preserving owner-only routing.

## Procedure

1. Confirm the working tree and sanitized `.env.local` target identity.
2. Query the live catalog read-only for both schema shapes.
3. Apply only missing migration statements in one short Neon transaction.
4. Verify columns, defaults/nullability, constraints, indexes, and existing-row default state using
   aggregate/catalog results only.
5. Update this plan and `.ai/CURRENT.md` with the exact result.

## Acceptance criteria

- Both expected schema shapes exist and match the reviewed SQL.
- The migration transaction completes successfully or no transaction is needed because both shapes
  already exist.
- Verification exposes no credentials and no row-level production data.
- No other migration, code change, commit, push, deployment, email, or production mutation occurs.

## Result

- Sanitized target: `.env.local` Neon database `neondb`, SSL required, host SHA-256 prefix
  `79d6a988e446` (matching the previously verified target).
- Read-only catalog preflight found both migrations already fully applied, so no redundant migration
  transaction was executed.
- `organizations.notification_settings` is `jsonb`, non-null, and defaults to `'{}'::jsonb`.
- All 118 organization rows have non-null JSON-object settings.
- `growth_referral_events` has the five reviewed columns, UUID primary key, event-type/surface/referral
  check constraints, and both expected indexes including the partial referral-code index.
- Aggregate integrity checks found 2 existing events and zero invalid event types, overlong surfaces,
  or overlong referral codes. No row-level production data was read or printed.
- No product code, migration SQL, commit, push, deployment, email, or unrelated production mutation
  occurred.

No required migration work remains.
