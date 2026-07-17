# Seller Form Defaults Live Migration Plan

- Status: Completed
- Owner: OpenAI Codex
- Date: 2026-07-17
- Authorization: The user explicitly authorized running `migrations-intake-link-seller-form-defaults.sql` against the database configured in `.env.local`.
- Excluded actions: No commit, push, deployment, data edits beyond the reviewed migration, or other schema changes.

## Verified preflight

- `main`, `origin/main`, and `HEAD` are aligned at `fab994d` (`Implement reusable seller form defaults`).
- The worktree was clean before this coordination update.
- `.env.local` contains `DATABASE_URL` for an SSL-required Neon target. The sanitized host SHA-256 fingerprint prefix is `79d6a988e446`.
- The reviewed migration is additive and contains only two `ALTER TABLE intake_links ADD COLUMN IF NOT EXISTS` statements.

## Execution

1. [x] Query the target catalog read-only and confirm the table, referenced profile key, and current column state.
2. [x] Apply the exact migration statements in one Neon `sql.transaction(...)`.
3. [x] Verify both columns, types, nullability/defaults, foreign key behavior, and effective defaults for existing rows.
4. [x] Confirm the worktree still contains only the expected coordination-file edits and record the result in `.ai/CURRENT.md`.

## Acceptance criteria

- `intake_links.default_brand_profile_id` is nullable UUID and references `brand_profiles(id)` with `ON DELETE SET NULL`.
- `intake_links.default_utility_categories` is non-null `text[]` with the complete canonical utility-category default.
- Existing rows have the complete default category array and retain null Branding Profile selection.
- No other migration, deployment, push, or production-data action occurs.

## Result

- The transaction committed successfully against `neondb/public` on the sanitized Neon target.
- `default_brand_profile_id` is nullable UUID with `intake_links_default_brand_profile_id_fkey` referencing `brand_profiles(id) ON DELETE SET NULL`.
- `default_utility_categories` is non-null `text[]` with the nine canonical categories as its default.
- All 112 existing `intake_links` rows have null selected Branding Profile, zero null category arrays, and the complete canonical category array.
- No commit, push, deployment, or unrelated data mutation was performed.
