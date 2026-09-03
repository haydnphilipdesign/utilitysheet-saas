# Plan: Instrumented Question Gap Capture

## Status

**Completed 2026-09-03.** Implemented by OpenAI Codex across two revisions,
independently reviewed and validated by Claude Opus 5. All acceptance criteria
met. No required work remains.

`migrations-question-requests.sql` was applied to the production database on
2026-09-03 with explicit product-owner authorization, and the resulting table,
constraints, and indexes were verified. The feature code is not yet deployed, so
the table is present and empty until the work ships.

- Owner for implementation: OpenAI Codex
- Reviewing agent: Claude Opus 5 (independent diff and validation review before done)
- Created: 2026-09-03
- Related: `docs/product-feedback/2026-09-03-michelle-wright-opus-evaluation.md`

## Goal

Record, as structured data, the seller-form questions customers want but cannot
find. Today a customer who needs a question UtilitySheet does not ask has no way
to say so, so the only demand signal is the rare customer who emails support.

This slice exists to make the next two product decisions evidence-based rather
than argued:

1. Which named fields to add to the Advanced modules.
2. Whether a general custom-question builder is ever warranted.

The decision rule it feeds: if requests concentrate on a short list, build those
fields. If they form a varied long tail, the builder becomes the right answer.

## Verified Repository Facts

Confirmed by inspection on 2026-09-03. Do not re-derive; do re-verify if the
worktree has moved on.

- `components/advanced-modules/AdvancedModuleConfigurator.tsx` (203 lines) is a
  shared client component with props `enabledModules`, `exclusions`,
  `onToggleModule`, `onToggleField`, `disabled`, `className`.
- It renders in exactly two places:
  - `app/dashboard/settings/page.tsx`, under the "Advanced questions" block.
  - `app/dashboard/requests/new/page.tsx`, under "Advanced Modules & Questions".
- The Settings call site passes `disabled={!intakeCanCustomize || intakeSaving}`;
  `intakeCanCustomize` is false on Free, so a previously selected Advanced
  configuration is read-only there. Request creation omits `disabled` because
  its packet-mode control gates Free users before the configurator renders.
- Both call sites are themselves conditional on Advanced packet mode. A normal
  Free user starts in Simple mode and is gated from selecting Advanced, so the
  configurator, and therefore a capture UI placed only inside it, is not reachable
  on either surface. This creates a conflict between D1's approved placement and
  D2 / Acceptance Criterion 1's Free-user reachability requirement.
- `lib/packet/modules.ts` defines 5 modules and 33 built-in fields. There is no
  mechanism for user-defined questions anywhere in the codebase.
- Authenticated routes resolve identity via `stackServerApp.getUser()` then
  `ensureAccountActivation(user)`, which returns `{ account, activeOrganization }`.
  `app/api/intake-link/route.ts` is a good reference implementation.
- `lib/validation/schemas.ts` holds request-payload Zod schemas.
- `lib/security/api-response.ts` exports `enforceMaxRequestBodyBytes` and
  `invalidRequestBodyResponse`.
- `lib/rate-limit.ts` exports named `RateLimitPolicy` objects plus
  `checkRateLimit`, `isRateLimitUnavailable`, and `getRateLimitHeaders`.
  `growthReferralEventRatelimit` and `accountSecurityRatelimit` show the shape.
- Domain queries live in `lib/neon/queries/`, re-exported through
  `lib/neon/queries/index.ts`.
- Root `migrations-*.sql` files are focused and deployable.
  `migrations-testimonial-outreach.sql` is a good format reference.

## Approved Design Decisions

These were decided deliberately. Do not change them unilaterally. If
implementation reveals one is wrong, stop and record the conflict rather than
substituting a different approach.

**D1 (AMENDED, revision 2). One implementation in its own component, rendered by
both call sites outside the packet-mode conditional.**

The original D1 said to put the capture UI *inside* `AdvancedModuleConfigurator`.
That was an error. Both call sites mount the configurator only when packet mode is
already Advanced, and Free users cannot reach Advanced on either surface: Settings
disables the mode radiogroup via `!intakeCanCustomize`, and request creation
intercepts the Advanced button with `if (!isPro) { setShowUpgradeDialog(true);
return; }` so the mode never changes. Placing the capture inside the configurator
therefore binds it to the exact gate that excludes the audience D2 exists to
reach. The component-level test passed while the feature remained unreachable,
which is precisely the failure mode D2 warned about.

Amended decision:

- Extract the capture into its own component,
  `components/question-requests/QuestionGapCapture.tsx`. It is not
  advanced-modules-specific and must not live in that directory.
- Revert `components/advanced-modules/AdvancedModuleConfigurator.tsx` to its
  original state. It should carry none of this feature.
- **Settings:** render inside the `seller-questions-heading` section, after the
  `{intakeDefaultPacketMode === 'advanced' && (...)}` block and before
  `</section>`, so it appears in Simple mode too. Pass `context="settings"` and
  `packetMode={intakeDefaultPacketMode}`.
- **Request creation:** render after the packet-mode selector block and outside
  `{formData.packet_mode === 'advanced' && (...)}`. Pass
  `context="request_creation"` and `packetMode={formData.packet_mode}`.

This is a better design independently of the bug. The capture asks about the
question set in general, not about advanced modules, so a Free user in Simple
mode who needs a question that does not exist is exactly the signal worth having,
and they would never open the advanced configurator to give it.

**D2. Free users must be able to submit.** The capture input must NOT inherit the
configurator's `disabled` prop. A Free user asking for a field is both demand
signal and conversion signal, and they are exactly the cohort most likely to have
concluded the product cannot do what they need.

Revision 2 clarification: satisfying D2 means **end-to-end reachability**, not
merely that the input ignores a `disabled` prop. The test must prove a Free user
in Simple mode can see and submit. Not inheriting `disabled` is necessary and was
never sufficient.

**D3. The input asks for the question, not the answer.** Helper text must tell
the user to describe the question they want asked and not to paste actual codes,
passwords, or property details. This is a real mitigation, not boilerplate: the
field is free text and someone will otherwise type a live door code into it.

**D4. Reading the data is a SQL query in v1.** No admin UI in this slice. An
admin triage view is a reasonable follow-up but is explicitly out of scope, and
adding it would roughly double the slice.

**D5. Storage is a first-class table, never a telemetry event.** Per
`docs/ai-telemetry.md` and the guardrails in the evaluation memo, this content
must not flow into analytics event properties, AI provider calls, or logs.

## Scope

### In scope

1. **Migration.** New root file `migrations-question-requests.sql`:

   ```sql
   CREATE TABLE IF NOT EXISTS question_requests (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
       organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
       requested_text TEXT NOT NULL,
       context TEXT NOT NULL CHECK (context IN ('settings', 'request_creation')),
       packet_mode TEXT CHECK (packet_mode IN ('simple', 'advanced')),
       status TEXT NOT NULL DEFAULT 'new'
           CHECK (status IN ('new', 'reviewed', 'planned', 'declined')),
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );

   CREATE INDEX IF NOT EXISTS idx_question_requests_created_at
       ON question_requests(created_at DESC);
   CREATE INDEX IF NOT EXISTS idx_question_requests_account_created_at
       ON question_requests(account_id, created_at DESC);
   ```

   Mirror the final shape into `schema.sql`. **Creating the migration does not
   authorize running it.** Do not apply it to any live database.

2. **Validation.** Add `questionRequestBodySchema` to `lib/validation/schemas.ts`:
   `requestedText` trimmed, min 3, max 300 characters; `context` enum
   `['settings', 'request_creation']`; optional `packetMode` enum
   `['simple', 'advanced']`.

3. **Query module.** New `lib/neon/queries/question-requests.ts` exporting a
   `createQuestionRequest` insert. Re-export from `lib/neon/queries/index.ts`,
   matching the existing pattern.

4. **Rate limit policy.** Add `questionRequestRatelimit` to `lib/rate-limit.ts`,
   10 per hour, following the shape of the existing policies including the
   `redis ? ... : null` fallback.

5. **API route.** New `app/api/question-requests/route.ts`, POST only:
   - `stackServerApp.getUser()`, 401 when absent.
   - `ensureAccountActivation(user)`, 404 when absent.
   - `enforceMaxRequestBodyBytes` guard.
   - `checkRateLimit` keyed on account id, honoring
     `isRateLimitUnavailable` and returning `getRateLimitHeaders`.
   - Zod parse, `invalidRequestBodyResponse` on failure.
   - Insert with `account_id` and `organization_id` taken from the server-resolved
     activation state. Never from the client payload.
   - Return `{ ok: true }`. Do not echo the submitted text back.
   - On error, log a generic message. **Never log `requestedText`.**

6. **UI (REVISED).** New `components/question-requests/QuestionGapCapture.tsx`:
   a collapsed-by-default disclosure labelled along the lines of "Don't see a
   question you need?", opening to a short text input, the D3 helper line, and a
   submit control. Success replaces the control with a brief confirmation.
   Failure shows an inline error and preserves what was typed. Props:
   `context` and optional `packetMode`. It takes **no** `disabled` prop from its
   call sites; it disables only its own control while its request is in flight.

   Revert `AdvancedModuleConfigurator.tsx` to its original state, then mount the
   new component at both call sites at the positions given in D1.

7. **Tests (REVISED)** in `tests/unit/`:
   - Route: 401 unauthenticated; rejects empty, whitespace-only, and over-length
     text; rejects an invalid `context`; happy path inserts with server-resolved
     ids; ignores any client-supplied `accountId` or `organizationId`.
     (These already exist and pass. Keep them.)
   - Component: renders and submits successfully with `packetMode="simple"`,
     which is the Free-user state. Replaces the previous "enabled while the
     configurator is disabled" test, which asserted the wrong thing.
   - Failure path: a non-OK response shows an inline error and preserves the
     typed text.

   **Review checkpoint, not an automated test:** confirm by reading both call
   sites that `QuestionGapCapture` is not nested inside any packet-mode
   conditional. This is the assertion that actually guards D2, and it is stated
   honestly here as a human or reviewing-agent check because a unit test cannot
   cheaply prove it.

### Explicitly out of scope

- Any admin UI for reading requests.
- Any change to the 33 built-in fields, modules, or exclusions model.
- Any change to seller-facing surfaces, packet HTML, or the PDF builder.
- Any custom-question authoring, storage, or rendering. This slice records
  requests. It does not act on them.
- Running the migration.

## Acceptance Criteria

1. An authenticated user on any plan, including Free, can **reach, see and
   submit** the capture from both Settings and request creation **while in Simple
   packet mode**, and each submission is stored with the correct `context`.
   Reachability is the criterion. A component that ignores `disabled` but never
   mounts does not satisfy this.
2. `account_id` and `organization_id` are always server-resolved. A payload
   carrying its own account or organization id cannot influence the stored row.
3. Empty, whitespace-only, and over-length submissions are rejected with a
   validation response, not a 500.
4. Submitting repeatedly past the rate limit returns a limited response with the
   correct headers, and a missing Redis configuration does not hard-fail the
   route.
5. `requestedText` appears in no log line, analytics event, or AI provider call.
6. The helper text tells the user not to include real codes or passwords.
7. `schema.sql` matches the migration's final shape.
8. Lint, type-check, and the full Vitest suite pass.
9. No unrelated behavior changes, and no edits to seller, packet, or PDF paths.

## Required Validation

```powershell
npm run lint
npm exec tsc -- --noEmit
npm test -- --run
npm run security:scan
```

Run the focused new tests first, then the full suite. Record actual results,
including failures, in `.ai/CURRENT.md`. Do not report completion on a partial
run.

## Risks and Cautions

- **Migration safety.** The migration is deliverable but must not be applied.
  Confirm with the product owner before any live database action.
- **D2 is the easy mistake.** Reusing the `disabled` prop for the capture input
  silently removes the Free cohort from the dataset, and the bug would be
  invisible in normal use. The named test exists for this.
- **Free-text privacy.** Treat `requestedText` as potentially containing
  credentials or personal data at every point it is handled.
- **Large shared files.** `app/dashboard/settings/page.tsx` and
  `app/dashboard/requests/new/page.tsx` are both large and both carry unrelated
  state. Make minimal additive edits and preserve everything else.
- **Do not expand scope into the memo's Next items.** The sensitive-field flag,
  revocable packet links, the question inventory view, and the short-term-rental
  preset are all deliberately held pending evidence.

## Expected Files

New:
- `components/question-requests/QuestionGapCapture.tsx` (revision 2)
- `migrations-question-requests.sql`
- `lib/neon/queries/question-requests.ts`
- `app/api/question-requests/route.ts`
- `tests/unit/question-requests-route.test.ts`
- `tests/unit/question-gap-capture.test.tsx`

Modified:
- `schema.sql`
- `lib/validation/schemas.ts`
- `lib/rate-limit.ts`
- `lib/neon/queries/index.ts`
- `app/dashboard/settings/page.tsx` (mount capture outside the mode conditional)
- `app/dashboard/requests/new/page.tsx` (mount capture outside the mode conditional)

Reverted to original (revision 2):
- `components/advanced-modules/AdvancedModuleConfigurator.tsx`

## Follow-Up, Not Part of This Slice

- Admin triage view for submitted requests.
- A weekly aggregate of the top requested fields, which is the input to the
  build-fields-versus-build-builder decision.

## Review Notes on the Partial Implementation (Claude Opus 5, 2026-09-03)

The backend half was reviewed against the repository and **stands as built**. Do
not redo it.

Verified correct:

- `account_id` and `organization_id` come only from `ensureAccountActivation`, so
  a client-supplied id cannot influence the row.
- Rate limit is checked before the body is parsed, so malformed traffic cannot
  cheaply bypass it.
- `invalidRequestBodyResponse` is used, the route returns `{ ok: true }` without
  echoing the text, and the catch block logs a fixed string, so `requestedText`
  cannot leak into logs.
- The insert is parameterized through the Neon tagged template.
- `migrations-question-requests.sql` and the `schema.sql` additions agree.
- `z.string().trim().min(3).max(300)` applies the length checks after trimming,
  so whitespace-only input is correctly rejected.

Two non-blocking nits, fix only while already in the file:

1. `lib/neon/queries/question-requests.ts` returns silently when `sql` is null,
   so a misconfigured environment reports success to the user and stores nothing.
   This matches the existing codebase pattern, so it is acceptable, but it is
   worth a comment noting the deliberate choice.
2. The route's `catch { }` discards the error entirely, which makes a genuine
   database failure undiagnosable. Logging `err instanceof Error ? err.name : 'unknown'`
   keeps the text safe while preserving a debugging signal.

## Revision History

- **Revision 1**, 2026-09-03, Claude Opus 5. Original plan.
- **Revision 2**, 2026-09-03, Claude Opus 5. D1 amended after Codex correctly
  halted on a verified D1/D2 conflict. The capture moves out of
  `AdvancedModuleConfigurator` into its own component mounted outside the
  packet-mode conditional on both surfaces. Acceptance criterion 1 restated in
  terms of reachability. Component test replaced. Backend unchanged.

- **Revision 2 completed**, 2026-09-03. UI reworked per amended D1. Reviewed and
  independently validated by Claude Opus 5.

## Final Review Record (Claude Opus 5, 2026-09-03)

Reachability checkpoint, the assertion that guards D2 and which no automated test
covers, verified by reading both call sites:

- `app/dashboard/settings/page.tsx`: the `intakeDefaultPacketMode === 'advanced'`
  block opens at 1299 and closes at 1330. `QuestionGapCapture` is mounted at 1332,
  after that block and inside the `seller-questions-heading` section which closes
  at 1336. Outside the conditional. Confirmed.
- `app/dashboard/requests/new/page.tsx`: `QuestionGapCapture` is mounted at 954,
  and the `formData.packet_mode === 'advanced'` block does not open until 959.
  Outside the conditional. Confirmed.
- `components/advanced-modules/AdvancedModuleConfigurator.tsx` shows no diff
  against HEAD. Clean revert confirmed.

Data-path check: `requestedText` appears only in the component's own state, the
fetch body, the Zod schema, the route handler, and the parameterized insert. It
reaches no logger, no analytics call, and no AI provider. The capture component
fires no `trackEvent`, which is a deliberate and correct departure from the
convention in neighboring dashboard components.

Validation re-run independently by the reviewer, not accepted on report:

- Focused tests: 11 passed across 2 files.
- Full Vitest: 742 passed across 145 files.
- `tsc --noEmit`: exit 0.
- `security:scan`: passed.
- ESLint on all changed and new files: clean.
- Full lint: one pre-existing `@typescript-eslint/no-explicit-any` error at
  `components/admin/EventLogTable.tsx:6`, on a file this slice does not touch and
  which does not appear in `git status`. Confirmed unrelated and left alone.

One copy fix applied during review: replaced an em dash in the success message
with a comma, per house style. Focused test and lint re-run after the change.
