# Provider and Contact Resolution Incident

## Status

Emergency mitigation complete. Engineering, compensation, repair-review, and communication design are
approved; local implementation and release validation are complete. The approved design is recorded in
`docs/superpowers/specs/2026-07-29-provider-resolution-incident-remediation-design.md`.
The read-only production review and the Stripe/email dry runs are complete. Production repair, Stripe
credit, email, deployment, commit, and push remain separately authorization-gated.

The independent implementation plans are:

- `docs/superpowers/plans/2026-07-29-provider-resolution-hotfix.md`
- `docs/superpowers/plans/2026-07-29-incident-sheet-review-and-repair.md`
- `docs/superpowers/plans/2026-07-29-universal-customer-credit.md`
- `docs/superpowers/plans/2026-07-29-provider-incident-communications.md`
The user changed the production model back to `gemini-3.1-flash-lite` and initiated the redeploy.
No product-code change, cache invalidation, data repair, Stripe credit, email, commit, or push has
been performed by Codex.

## Incident

On 2026-07-29, a paying customer reported that the last five or more UtilitySheets:

- suggested incorrect utility companies;
- did not recognize a correct company entered manually;
- did not pull contact information; and
- displayed `unresolved contacts`.

The user noted a Gemini model change on 2026-07-24 and asked whether it is related.

## Verified Starting Facts

- The customer email is preserved as the untracked local file `Utility-Sheet-Issue.html`.
- Provider suggestions/search run through `lib/providers/suggestion-service.ts`.
- Contact resolution runs through `lib/providers/contact-service.ts`.
- The default model in `lib/ai/gemini-client.ts` is `gemini-3.5-flash`; production may override it with `GEMINI_MODEL_NAME`.
- Contact misses, including transient AI failures, are cached for 90 days by locality/category/provider-name scope.
- Existing uncommitted coordination-file changes predate this investigation and must be preserved.

## Root Cause

The July 24 model switch is causal with very high confidence.

- Production AI telemetry shows the last `gemini-3.1-flash-lite` run at
  2026-07-24 15:28 UTC and the first `gemini-3.5-flash-lite` run at 19:03 UTC.
- UtilitySheet's Gemini client combines Google Search grounding with
  `responseMimeType = application/json`, but supplies no explicit response JSON schema.
- A controlled call using the installed `@google/genai` 1.43.0 client reproduced the production signal:
  `gemini-3.5-flash-lite` consumed input tokens but returned no candidate, text, or output tokens.
- The identical request returned valid JSON on `gemini-3.1-flash-lite`.
- Removing Google Search or adding an explicit `responseJsonSchema` made
  `gemini-3.5-flash-lite` return valid JSON.

The empty response is intentionally converted into a safe `null`/fallback by the application. Provider
suggestions therefore fell back to a generic provider list, and contact resolution produced unresolved
entries without an HTTP 5xx. This explains the customer's wrong-company and unresolved-contact symptoms
as two effects of the same model/request incompatibility.

## Verified Impact

- Supplied paying account after the 19:03 UTC cutover: 5 submitted sheets, all 5 affected; 8 of 23
  provider entries unresolved.
- Same account before the cutover in the measured window: 0 unresolved across 53 provider entries.
- All non-demo accounts after cutover: 14 of 18 submitted sheets affected; 34 of 80 provider entries
  unresolved.
- Across all measured `gemini-3.5-flash-lite` runs, every fresh provider search fell back and every
  apparent successful provider suggestion was a cache hit. Fresh suggestion attempts fell back.
- Vercel's aggregated runtime error view showed no seller/provider 5xx errors, consistent with the
  application's caught/null failure path.

## Amplifying Defects

- Failed contact lookups, including transient empty model responses, are cached for 90 days.
- Provider suggestion fallbacks are cached for 30 days and search fallbacks for 7 days.
- Provider/search/contact cache keys do not include the configured model or an AI-request-format version.
- Suggestion telemetry can overwrite an upstream `ai_provider_error` with `quality_gate_failed`, obscuring
  empty-response incidents.

## Investigation Completed

1. Inspected production runtime errors and the deployment/model timeline.
2. Traced provider suggestion/search, manual-entry, contact-resolution, cache, and unresolved rendering.
3. Queried redacted account-scoped and global AI/contact aggregates.
4. Reproduced the empty-output failure and verified both rollback and explicit-schema behavior.
5. Established customer and global impact without printing seller/property payloads.

## Acceptance Criteria

- Distinguish whether incorrect suggestions and unresolved contacts share one cause or are separate failures.
- Establish whether the July 24 model change is causal, contributory, or unrelated using concrete evidence.
- Identify any cache behavior that could preserve failures after an upstream recovery.
- Provide a safe remediation plan that preserves seller-flow availability and privacy.
- Record evidence gaps honestly; do not claim a production root cause from code inspection alone.

All diagnosis acceptance criteria are met.

## Recommended Remediation

### Emergency mitigation

1. Set production `GEMINI_MODEL_NAME=gemini-3.1-flash-lite`.
2. Redeploy and run a controlled suggestion/search/contact smoke test.
3. Invalidate affected provider/search/contact cache namespaces, preferably by version bump rather than
   broad destructive deletion.

Steps 1 and 2 are complete. Vercel deployment `dpl_KSAA98Bx7UTknexGoN175iAP3MQj` reached `READY`.
A controlled production demo request returned HTTP 200 and non-empty results for all nine utility
categories. Fresh telemetry recorded `gemini-3.1-flash-lite`; six category runs passed and three were
quality-gated but still returned bounded fallback results. Step 3 remains part of the code release.

### Durable application fix

1. Require caller-specific JSON schemas for suggestion-array and contact-object generation.
2. Add a regression test covering Gemini 3.5 Flash Lite with JSON schema plus Google Search.
3. Treat a successful transport response with no candidate/text as `provider_error`.
4. Preserve the original upstream failure reason through quality gates and telemetry.
5. Include model/request-format versions in AI cache keys.
6. Use a short negative-cache TTL for contact misses rather than the 90-day positive-contact TTL.
7. Add redacted contact-resolution outcome telemetry.
8. Evaluate the documented SDK/API migration separately after the hotfix is stable.

### Customer/data repair

After the production fix is verified, re-resolve only currently null contact fields for affected submitted
sheets. Preserve provider names, manual corrections, and all existing contact fields. This is a separate
production-data mutation requiring explicit authorization.

## Compensation Facts

- Four Pro-entitled accounts submitted affected sheets.
- Three of those four have active local Stripe customer/subscription identifiers; the reporting customer
  is one of the actively billed accounts.
- No Team or Free account submitted an affected sheet during the incident window.
- Current billed population in local production records: six Pro subscriptions and one Team subscription
  with four seats.
- A one-month credit would therefore be $27 if limited to the three billed affected Pro accounts, or $82
  if applied to every currently billed Pro and Team billing entity at current list prices.
- Stripe customer balance credits are already used for referral credits, but the referral ledger must not
  be repurposed for incident compensation. Any automated incident-credit path needs its own idempotent,
  auditable record; a small manual Stripe adjustment may be safer for only three affected billers.

## Design Gate

Before product-code changes or compensation tooling:

1. Confirm whether communication and credit are targeted to affected accounts or universal to all billed
   customers. **Approved: universal one-month credit for all actively billed customers.**
2. Present engineering and compensation approaches with trade-offs.
3. Obtain user approval of the selected design.
4. Record the approved design and convert it into an implementation plan.

Stripe was verified read-only after approval: all six Pro and one Team subscription are `active`; their
current monthly recurring amounts total $82, and none currently has a negative customer balance that
would complicate the incident credit.

Steps 1-4 are complete. The user approved the full engineering, universal-credit, hybrid automatic
repair, and segmented-communication design on 2026-07-29. The design record and four scoped
implementation plans are complete.

## Approved Engineering Design

Approved by the user on 2026-07-29:

- Keep production on `gemini-3.1-flash-lite` while the compatibility fix is validated.
- Add caller-specific JSON schemas for provider arrays and contact objects.
- Treat a transport-success response with no candidate/text as `provider_error`.
- Preserve the original upstream failure reason through quality gates and telemetry.
- Include the Gemini model and AI request-format version in cache namespaces.
- Retain long positive-result TTLs but use a five-minute TTL for contact misses and generic
  suggestion/search fallbacks.
- Bump affected cache namespaces as part of the release.
- Do not combine this incident hotfix with an SDK/API migration; evaluate that separately.
- Add focused regression tests for the 3.5 JSON + Search + schema request shape, empty responses,
  failure-reason preservation, and cache TTL/key behavior.

### Local implementation status

Implemented and locally validated on 2026-07-29:

- caller-specific provider-array and contact-object response schemas;
- default-model safety fallback to `gemini-3.1-flash-lite`;
- empty candidate/text retry and `provider_error` classification;
- preserved provider/parse upstream reasons through quality gates and telemetry;
- model/request-format-aware cache namespaces with version bumps;
- five-minute provider/search fallback and contact-miss TTLs.

Focused validation passed: 6 test files / 44 tests and `npm exec tsc -- --noEmit`.
No deployment, cache deletion, production smoke test of this code, commit, or push has occurred.

Full local implementation validation also passed: 134 Vitest files / 668 tests, TypeScript, focused
ESLint, production build, security scan, and `git diff --check`.

## Approved Review, Repair, Credit, and Communication Design

- Generate a local, untracked, read-only incident packet instead of asking the operator to inspect raw
  database rows or manually discover affected requests.
- Group entries by sheet and show request/Admin link, service address, category, recorded provider and
  entry mode, current contact fields, fresh contact/provider candidates, and a proposed disposition.
- Classify high-confidence rows as automatic contact-repair candidates when the provider matches, service
  area is confirmed, contact evidence is official or strongly verified, and only null fields would change.
- Let the operator review automatic candidates as a batch and remove exceptions; reserve individual
  decisions for ambiguous providers, customer confirmation, or leave-unchanged cases.
- Never automatically replace a provider name or overwrite an existing contact value.
- Require a reviewed repair dry run and separate authorization before any production-data mutation.
- Credit all seven actively billed customers one current subscription month ($82 total) through an
  idempotent one-off Stripe customer-balance operation, separate from the referral ledger.
- Require a credit dry run and separate authorization before applying live financial changes.
- Segment incident communication among the reporting customer, other affected paid customers, unaffected
  paid goodwill recipients, and the affected non-billed account. Do not email or credit Free accounts.

### Local operations results

- Read-only incident review: 69 entries; 6 automatic contact-repair candidates, 8 customer-confirmation
  cases, and 55 unchanged.
- Read-only credit preview: 7 active billing entities; $82.00 total; no incident credit already applied.
- Read-only communication preview: 8 recipients after exclusion/deduplication; no email sent. One
  affected Pro-entitled but non-billed account is assigned the no-credit segment.
- The private report is ignored under `.incident-reports/`; tracked source contains no incident customer
  identity, property address, or seller data.
- No production record, Stripe balance, email recipient, cache, or deployment was changed by these
  operations.

## Expected Areas

- `lib/ai/gemini-client.ts`
- `lib/providers/suggestion-service.ts`
- `lib/providers/contact-service.ts`
- seller/provider API routes and seller-form components
- AI telemetry query/schema/docs
- focused unit tests

## Validation

- Production runtime/deployment evidence when connector access permits.
- Focused unit tests around confirmed failure behavior.
- Type-check or broader validation only if implementation is later authorized.

## Risks and Constraints

- Customer and property details are sensitive. Do not print raw production payloads or secrets.
- Production logs may not retain enough provider-response detail because the app intentionally redacts AI payloads.
- Negative contact cache entries may outlive the initiating failure for up to 90 days.
- No live cache clearing, environment change, deployment, database query/mutation, or customer-data repair without explicit authorization.
