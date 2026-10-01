# Current task: HOA question group (Option A), migration applied, code not started

- Date: 2026-10-01. Agent: Claude Opus 5.5 (Claude Code), taking over from the
  2026-09-19 Claude Opus 5 session. Branch: `main`.
- Status: **in progress, waiting on owner decisions.** Option A confirmed. The
  migration is written, mirrored in `schema.sql`, and **applied to production**.
  Application code is not started.
- Plan: `.ai/plans/2026-09-19-hoa-question-group.md` (Approved, in progress).
  Section 11 holds the migration record, section 12 the open decisions.
- Decision: `.ai/decisions/2026-10-01-hoa-questions-in-home-basics.md` (Accepted).
- Background, the 2026-09-19 shipped work, and the customer's reply:
  `docs/product-feedback/2026-09-19-alisha-starkey-hoa-feedback.md`.

## Product-owner direction, 2026-10-01

1. **Option A is confirmed:** the HOA group lives in Home Basics, available on
   the Free plan and in both packet modes.
2. Explicit authorization to apply `migrations-hoa-questions.sql`, and to commit
   and push as needed.
3. The owner supplied the customer's reply and two attachments under
   `user-feedback/` and asked for recommendations on the two open questions.

## Done this session

- `migrations-hoa-questions.sql` (new) and `schema.sql`: six nullable columns on
  `requests`: `has_hoa TEXT CHECK (has_hoa IN ('yes', 'no', 'not_sure'))`,
  `hoa_name`, `hoa_management_company`, `hoa_management_phone`,
  `hoa_dues_amount`, `hoa_portal_or_payment`. No default, backfill, index, or
  cross-column constraint.
- **Applied to production.** Target `.env.local` Neon database `neondb`, host
  SHA-256 prefix `79d6a988e446` (the previously verified target). One
  transaction, 5 second `lock_timeout`. `requests` went from 30 to 36 columns;
  `requests_has_hoa_check` present; other constraints unchanged; 964 rows, none
  with an HOA value set. Catalog and aggregate checks only; no credentials or
  row data printed.
- Decision record created; plan corrected and extended; feedback record
  extended with the customer's reply.
- Committed and pushed to `main` with owner authorization (see git log). The
  push carries SQL and documentation only, no application code.

## Validation

- Before applying: offline dry run in in-memory Postgres (PGlite, in the session
  scratchpad). Old `schema.sql` plus the migration equals the new `schema.sql`
  shape; a re-run is a no-op; the check accepts `yes`, `no`, `not_sure`, NULL
  and rejects other values.
- After applying: live catalog matches the reviewed SQL (above).
- `npm test -- --run tests/unit/referral-credit-migration.test.ts`: 2 passed.
- `npm run security:scan`: passed.
- Not run: full Vitest, lint, `tsc`, Playwright, build. No TypeScript changed.

## Waiting on the owner (plan section 12)

The customer's reply asks for more than the six columns hold. Proposed, **not
approved and not built**:

1. Add `hoa_management_contact`, `hoa_management_email`, and
   `hoa_dues_frequency` (`monthly` / `quarterly` / `yearly`) to complete Oregon
   Form 4.4 section 4 lines A to C. They would be appended to the same
   idempotent migration file. **A second database run needs its own
   authorization.**
2. Leave parking and storage spaces out of the first release.
3. **Do not collect HOA portal passwords**, which the customer asked for. This
   is security-sensitive and the owner's call.
4. Treat association document upload as separate demand, out of scope.
5. Detail fields behind **Yes** only; "Not sure" and "No" still print.
6. Add only the `has_hoa` enum to the redacted `seller_submitted` summary and
   list it in `docs/ai-telemetry.md`. Never the free-text values.

## Remaining required work

1. Owner decisions above.
2. If item 1 is approved: extend the migration and `schema.sql`, get
   authorization, apply, verify.
3. Implement the field group per plan sections 5, 7, and 12, using the corrected
   file list in section 10. The seller write path is
   `app/api/seller/[token]/route.ts:538-554`.
4. Fix the stale "HOA / Condo" labels at
   `components/seller-form/steps/ReviewStep.tsx:67,74` while adding the HOA rows
   there. The 2026-09-19 relabel missed that file.
5. Run plan section 8 validation, including `npm run test:e2e:mobile`.

## Risks and cautions

- `user-feedback/` is untracked and **must not be committed**: customer contact
  details and copyrighted forms. It is not in `.gitignore`, so a blanket
  `git add` would pick it up. Stage files by name.
- The repository root also holds ignored copies of environment files
  (`.env.txt`, `.env - Copy.txt`). They are ignored by `.env*` and were not
  read for values. Only `.env.local` is the verified database target.
- PDF pagination with all HOA fields at maximum length is unverified; read
  `docs/pdf-system-reference.md` before touching `lib/pdf/packet-html.ts`.
- The new columns are unused until the application code ships. They are inert
  under the deployed code.
- This is not evidence for a custom-question builder. The standing verdict
  (`docs/product-feedback/2026-09-03-michelle-wright-opus-evaluation.md`, Idea 2)
  is unchanged.

## Concurrent editing

None known. After the push the worktree holds only the untracked
`user-feedback/` folder.

## Next concrete action

Get the owner's answers to the six items above, then implement. If the three
extra columns are approved, extend and re-apply the migration first, since the
application types and Zod schemas depend on the final column set. Two optional
items carried over, neither blocking: eyeball a live handoff packet's public
page for the Home Basics card added in `e244484`, and decide whether to raise
the affordance of the unused question-gap capture control or accept email as the
channel.
