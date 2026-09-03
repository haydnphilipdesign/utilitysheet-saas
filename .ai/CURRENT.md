# Current Work

## Session Metadata

- Task: Act on the Michelle Wright feedback evaluation. Implement instrumented
  question gap capture.
- Intended outcome: Customers on any plan can report seller-form questions they
  need but cannot find, stored as structured data.
- Status: **Completed.** Implemented, independently reviewed, validated, and the
  migration applied to production. No required work remains. The feature records
  nothing until the code is committed and deployed.
- Current or last agent: Claude Opus 5 (final review). Codex implemented.
- Branch: `main`
- Last updated: 2026-09-03
- Relevant plan: `.ai/plans/2026-09-03-question-gap-capture.md` (Completed,
  revision 2)
- Issue/PR: none

## Outcome

Question gap capture is built and reviewed. A "Don't see a question you need?"
disclosure appears in Settings > Seller Form and on request creation, on every
plan and in both packet modes, and records requested question text to the
`question_requests` table through an authenticated, rate-limited route.

The slice took two revisions. Revision 1 placed the capture inside
`AdvancedModuleConfigurator`, which is mounted only in Advanced mode and is
therefore unreachable for Free users, contradicting its own design decision D2.
Codex correctly halted rather than working around the approved plan. D1 was
amended, the capture became its own component mounted outside the packet-mode
conditional on both surfaces, and the component test was rewritten to assert
reachability in Simple mode rather than merely that the input ignores `disabled`.

### Verified by review, not accepted on report

- **Reachability**, the assertion no automated test covers: capture mounts at
  `app/dashboard/settings/page.tsx:1332` (the advanced block closes at 1330) and
  `app/dashboard/requests/new/page.tsx:954` (the advanced block opens at 959).
  Outside the conditional on both surfaces.
- **Clean revert**: `AdvancedModuleConfigurator.tsx` shows no diff against HEAD.
- **No leak path**: `requestedText` reaches only component state, the fetch body,
  the Zod schema, the route, and the parameterized insert. No logger, no
  analytics, no AI provider. The component deliberately fires no `trackEvent`.
- **Validation re-run independently**: 11 focused tests, 742 full-suite tests,
  `tsc --noEmit` exit 0, `security:scan` passed, ESLint clean on all changed and
  new files. The single full-lint error at `components/admin/EventLogTable.tsx:6`
  is pre-existing on an untouched file and was confirmed unrelated.

One copy fix applied during review: an em dash in the success message replaced
with a comma, per house style.

### Files

New: `components/question-requests/QuestionGapCapture.tsx`,
`app/api/question-requests/route.ts`, `lib/neon/queries/question-requests.ts`,
`migrations-question-requests.sql`, `tests/unit/question-requests-route.test.ts`,
`tests/unit/question-gap-capture.test.tsx`.

Modified: `schema.sql`, `lib/validation/schemas.ts`, `lib/rate-limit.ts`,
`lib/neon/queries/index.ts`, `app/dashboard/settings/page.tsx`,
`app/dashboard/requests/new/page.tsx`.

Nothing was committed or pushed.

## Migration Applied (2026-09-03)

The product owner explicitly authorized running the migration. It was applied to
the production Neon database and verified.

- Pre-check: `question_requests` did not exist.
- Applied all 3 statements from `migrations-question-requests.sql` (1 table,
  2 indexes). Additive only, no existing table touched.
- Verified 8 columns with correct types and nullability, 3 CHECK constraints
  (`context`, `packet_mode`, `status`), 2 foreign keys (`account_id` CASCADE,
  `organization_id` SET NULL), the primary key, and both indexes.
- Contract check passed: every column the application INSERT supplies exists, and
  no NOT NULL column lacking a default is left unsupplied. The runtime schema and
  `lib/neon/queries/question-requests.ts` agree.
- Final state: table present, 0 rows.

**The table exists in production but the feature code is not deployed.** Nothing
will be recorded until the work is committed and shipped. An empty table is
harmless in the meantime.

## Required Product-Owner Actions

1. **Commit and deploy the work.** It is currently uncommitted on `main`. The
   migration is already applied, so deploying the code is the only remaining step
   before the capture starts recording.
2. **Send the reply to Michelle**, draft at
   `docs/product-feedback/2026-09-03-michelle-wright-reply-draft.md`. Verify her
   plan is Pro or Teams first.

## Optional Follow-Up, Not Required Work

- Admin triage view for submitted requests. Reading is a SQL query in v1 by
  design (D4).
- A weekly aggregate of top requested fields, which is the input to the
  build-fields-versus-build-builder decision.
- Two non-blocking code nits recorded at the end of the plan: the query returns
  silently when `sql` is null, and the route's `catch` discards the error object.

## Verified Repository State and Constraints

Verified by inspection on 2026-09-03. Re-verify if the worktree has moved.

- `lib/packet/modules.ts` defines 5 advanced modules and 33 built-in fields.
  There is no user-defined question mechanism anywhere in the codebase.
- No field exists for cameras, Wi-Fi, lockbox, gate codes, front door codes, or
  smart locks. A search for those terms across `lib/` returns zero matches.
- `AdvancedModuleConfigurator` renders in exactly two places:
  `app/dashboard/settings/page.tsx` and `app/dashboard/requests/new/page.tsx`.
  Settings drives `disabled` from `intakeCanCustomize`; request creation omits
  the prop because it gates Free users at the Advanced packet-mode control.
- `schema.sql` declares `intake_links` with `UNIQUE(account_id)`. One reusable
  seller link and one default configuration per workspace.
- `requests.public_token` is a permanent bearer token. No expiry, no revocation,
  no view audit. `is_locked` is plan enforcement, not a security control.
- `accounts.subscription_status` is one of `free`, `pro`, `canceled`.
- Authenticated routes resolve identity via `stackServerApp.getUser()` then
  `ensureAccountActivation(user)`. `app/api/intake-link/route.ts` is the
  reference implementation.

## Work Completed This Session

1. **Product evaluation.**
   `docs/product-feedback/2026-09-03-michelle-wright-opus-evaluation.md`.
   Full critique of the seven preliminary ideas, nine independent ideas, a
   Now/Next/Later sequence, security guardrails, follow-up questions, validation
   metrics, and explicit confidence limits. Also published as a private artifact
   at https://claude.ai/code/artifact/b1d00380-db2c-475d-b590-99d23e912301
2. **Corrected Finding 2** after product owner review. The first draft read "Can
   info collected be edited?" as asking about correcting submitted answers. The
   better supported reading, adopted at roughly 75 to 80 percent confidence, is
   that she asked whether the form's question set can be changed. Her own example
   is entirely about collection scope. Under that reading the original support
   reply was well targeted. Attribution weights shifted from 55/25/20 to
   45/25/30.
3. **Implementation plan.** `.ai/plans/2026-09-03-question-gap-capture.md`.
4. **Customer reply draft.**
   `docs/product-feedback/2026-09-03-michelle-wright-reply-draft.md`. Asks two
   questions rather than five, and holds three for the follow-up exchange.
5. **Read-only analysis SQL.**
   `docs/product-feedback/2026-09-03-advanced-field-usage-analysis.sql`. Six
   aggregate queries. Returns no customer values.
6. **Question request storage.** Added `migrations-question-requests.sql` and
   mirrored the `question_requests` table and indexes in `schema.sql`. The
   migration was deliberately not run.
7. **Validated server path.** Added `questionRequestBodySchema`, the
   `createQuestionRequest` query, the 10-per-hour account rate-limit policy, and
   authenticated `POST /api/question-requests`. Client ownership ids are
   ignored; persisted ids come only from `ensureAccountActivation`.
8. **Shared capture UI, revision 2.** Added
   `components/question-requests/QuestionGapCapture.tsx` and mounted it outside
   both Advanced-only conditionals with the correct surface context and live
   packet mode. `AdvancedModuleConfigurator.tsx` is restored to its original
   Git content. The form warns users not to include real codes, passwords, or
   property details.
9. **Privacy boundary.** `requestedText` is not logged, tracked, or passed to AI.
   The error path logs only a fixed generic message and never echoes the text.
10. **Tests.** Route coverage remains unchanged. The revised component coverage
    proves successful submission with `packetMode="simple"` and proves a failed
    request shows an inline error without clearing typed text.

## Analysis Results (run 2026-09-03, read-only against production)

The owner authorized running
`docs/product-feedback/2026-09-03-advanced-field-usage-analysis.sql`. It was executed
read-only. No rows were written. Results are recorded in section 8 and Finding 4 of the
evaluation.

Headline result: **`garage_door_code` has an 8.3 percent fill rate** (9 of 108 submitted
advanced requests where the seller filled in at least one Mailbox & Home Access field).
Location and provider questions in the same module fill at 84 to 89 percent. Sellers
answer descriptive questions and do not answer credential questions.

Other results:

- Advanced adoption: 5 of 9 Pro workspaces default to advanced; 1 of 108 Free.
- 286 advanced requests, 221 submitted. Advanced submits at 77.3 percent versus simple at
  82.1 percent.
- 100 of 221 submitted advanced requests contain no advanced answers at all.
- **Caveat: 271 of 286 advanced requests come from 2 Pro accounts.** Both verified as
  genuine customers (178 and 69 distinct addresses, across 103 and 50 distinct days), not
  seeded data and not the owner's admin account. Effectively n = 2 workspaces. Do not
  treat as a market base rate.
- Notes fields show almost no usage: 6 non-empty answers total, longest 89 characters.

Consequence for the roadmap: new credential fields are now the weakest item, and idea G
(ask how access transfers, not what the code is) is the primary recommendation for any
access work. The gap capture slice is unaffected.

## Decisions and Rationale

No durable decision record was created. The evaluation is a recommendation, not
an accepted decision, and the gap capture slice is ordinary implementation.

A record under `.ai/decisions/` becomes **required** if the owner later approves
expanding credential collection, because
`.ai/decisions/2026-07-30-optional-access-codes-in-advanced-packets.md` reasoned
about the closing handoff case only and would need updating or superseding.

Sequencing decision worth carrying forward: the sensitive-field flag and
revocable packet links ship **before** any new credential fields, not after.
This turns the "wait for a deliberate security model" position from a permanent
blocker into a two-item prerequisite that actually gets built.

## Validation Performed

- Focused new tests: `npm test -- tests/unit/question-requests-route.test.ts
  tests/unit/question-gap-capture.test.tsx` passed, 2 files / 11 tests.
- `npm exec tsc -- --noEmit` passed.
- `npm test -- --run` passed, 145 files / 742 tests.
- `npm run security:scan` passed.
- Revised UI changed-file ESLint passed with no findings.
- `npm run lint` was run in full and failed only on the pre-existing
  `components/admin/EventLogTable.tsx:6` `@typescript-eslint/no-explicit-any`
  error; it also reported 19 unrelated existing warnings. No slice file was
  named.
- `git diff --check` passed; Git emitted only line-ending normalization
  warnings.
- Direct inspection of all six new implementation/test files found no secret
  patterns. A targeted flow search confirmed `requestedText` appears only in
  UI state/payload, Zod validation, the route-to-query handoff, parameterized SQL,
  tests, and schema definitions, not analytics, telemetry, AI, or dynamic logs.
- Manual review of both call sites confirmed `QuestionGapCapture` is outside the
  packet-mode conditional at `app/dashboard/settings/page.tsx:1332` and
  `app/dashboard/requests/new/page.tsx:954`.
- The analysis SQL was executed read-only against production with owner
  authorization. No rows were written; the results are recorded above.

## Remaining Required Work

1. Claude Opus 5 independently reviews the final diff and validation before the
   task is called done. No required implementation work remains.

## Owner Actions, Not Agent Work

- Send the reply to Michelle after editing. Verify her plan is Pro or Teams
  first, so the paragraph about editing submitted sheets is accurate for her.
- ~~Run or authorize the analysis SQL.~~ Done 2026-09-03. Results above.

## Known Risks and Uncertainties

- The migration exists but was not applied. The feature cannot persist requests
  in an environment until the migration is separately authorized and applied.
- Free-user Simple-mode reachability is implemented and manually verified at
  both call sites; final independent review remains required.
- Repository-wide lint remains red because of the pre-existing admin-table
  explicit-`any` error. Changed-file lint is green.
- The evaluation rests on one customer request. Broad demand is not established.
- Michelle's question is interpreted, not confirmed. The submitted-data reading
  remains possible. The reply draft covers both, so nothing downstream depends on
  resolving it first.
- It is still unknown whether Michelle coordinates the sale of short-term-rental
  properties or their ongoing operation. That answer separates a cheap preset
  from a different product and is the single largest open question.
- Resolved: query 4 did invalidate the credential expansion. Sellers leave
  `garage_door_code` blank 91.7 percent of the time. Adding more code fields
  would most likely produce more blank fields. Any future access work should ask
  how access transfers rather than asking for the secret.
- The fill-rate finding rests on 2 workspaces. It is strong enough to stop a
  build, and not strong enough to be treated as a market-wide law.

## Concurrent Editing Warnings

- **Claude Opus 5 owns final review next.** Avoid concurrent edits to the slice
  files until that review finishes.
- Preserve `.ai/plans/2026-08-05-codex-security-standard-scan.md` and its scan
  artifacts. That paused scan is unrelated.
- `docs/product-feedback/` is untracked. All four documents there are
  intentional.

## Recommended Next Action

Claude Opus 5: independently review the revision 2 diff and validation, then
record the final review outcome. Do not run the migration.
