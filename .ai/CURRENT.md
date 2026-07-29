# Current Work

> This file is the latest cross-agent handoff.
> Keep it concise, factual, and current.
> Replace stale task information instead of accumulating a permanent chronological log.

## Session Metadata

- Task: Diagnose paying-customer reports of incorrect provider suggestions and unresolved contacts.
- Intended outcome: Establish root cause and safe remediation, including whether the 2026-07-24 Gemini model change is involved.
- Status: Provider hotfix and dashboard product update are committed, pushed, deployed, and production
  smoke-verified. Reviewed repair decisions and credit/email dry runs are complete; production repair,
  credit application, and customer send remain authorization-gated.
- Current or last agent: OpenAI Codex
- Branch: `main`
- Last updated: 2026-07-29
- Relevant plan: `.ai/plans/2026-07-29-provider-contact-resolution-incident.md`
- Issue/PR: none

## Verified Repository State and Constraints

- The prior Admin task is complete and published; no unfinished product implementation is recorded.
- The worktree began with unrelated edits to `.ai/README.md`, `.ai/decisions/README.md`,
  `.ai/plans/README.md`, `AGENTS.md`, and `CLAUDE.md`. Preserve them.
- `Utility-Sheet-Issue.html` is an untracked customer email and must not be committed.
- The customer reports incorrect companies on the last five or more sheets, manual correct-company entries
  not pulling contact information, and `unresolved contacts`.
- The user changed `GEMINI_MODEL_NAME` back to `gemini-3.1-flash-lite` and initiated the emergency
  rollback. The user later explicitly authorized the hotfix/product-update commit, push, and deployment.
  No customer-record repair, Stripe credit, or customer email is authorized yet.

## Work Completed

- Extracted the customer-reported symptoms from the email.
- Located separate provider suggestion/search and contact-resolution services.
- Confirmed production switched from `gemini-3.1-flash-lite` to `gemini-3.5-flash-lite` on July 24.
- Confirmed UtilitySheet combines Google Search with JSON mode but no explicit JSON schema.
- Reproduced `gemini-3.5-flash-lite` returning input-token usage but no candidate/text/output tokens for
  that request shape. The identical request succeeds on `gemini-3.1-flash-lite`.
- Verified that omitting Search or adding an explicit response JSON schema restores valid 3.5 output.
- Confirmed the supplied account had 5 submitted sheets after cutover, all 5 affected, with 8 of 23
  provider entries unresolved; the measured pre-cutover account baseline was 0 unresolved of 53.
- Confirmed global non-demo impact after cutover: 14 of 18 submitted sheets affected and 34 of 80
  provider entries unresolved.
- Confirmed every fresh 3.5 provider search fell back and apparent successful suggestions were cache hits.
- Identified cache amplification: contact misses 90 days, suggestions 30 days, searches 7 days; cache keys
  are not model/request-format aware.
- Verified the user's rollback deployment reached `READY`.
- Ran a controlled production demo smoke test: HTTP 200, non-empty results for all nine categories, and
  fresh telemetry attributed to `gemini-3.1-flash-lite`.
- Measured compensation scope: four affected Pro-entitled accounts, three actively billed; no affected
  Team or Free account. Current billed population is six Pro subscriptions plus one four-seat Team
  subscription.
- Confirmed Stripe customer-balance adjustments are the existing mechanism for referral credits, but the
  referral ledger is not appropriate for incident compensation.
- User approved a universal one-month credit for every actively billed customer and no Free-account
  credit. Read-only Stripe verification confirmed six active Pro subscriptions and one active Team
  subscription, $82 total current monthly recurring amount, and no existing negative customer balances.
- User approved the surgical engineering design: explicit caller schemas, empty-response classification,
  preserved upstream telemetry reasons, model/request-format-aware cache namespaces, five-minute
  negative/fallback TTLs, and a cache version bump. Production remains on 3.1 while this is validated;
  SDK/API migration is out of the incident hotfix.
- User approved the universal-credit, affected-sheet review/repair, and segmented-communication design.
  The operator review will use a local, untracked, read-only incident packet; high-confidence missing
  contacts may be repaired automatically after a reviewed dry run, while ambiguous provider names remain
  a smaller review queue. It will not require raw database review or automatically replace provider names.
- Recorded the approved design in
  `docs/superpowers/specs/2026-07-29-provider-resolution-incident-remediation-design.md`.
- Split the approved scope into four implementation-ready plans covering the provider hotfix,
  sheet review/repair, universal customer credits, and customer communications.
- Implemented the provider-resolution hotfix locally:
  - explicit schemas for provider arrays and contact objects;
  - default model changed to `gemini-3.1-flash-lite`;
  - empty candidate/text responses retry and surface as `provider_error`;
  - original provider/parse failures survive later quality gates;
  - cache namespaces include model and request-format version;
  - fallback suggestions/searches and contact misses use five-minute TTLs.
- Implemented private incident review and repair tooling with fresh no-cache diagnostics, conservative
  exact-provider/confidence/corroboration gates, an ignored HTML review packet, and an apply-gated,
  all-or-none null-field repair with optimistic concurrency and audit events.
- Ran the read-only production review across 69 incident-window entries: 6 automatic contact-repair
  candidates, 8 entries requiring customer confirmation, and 55 entries left unchanged. No customer
  record or cache changed.
- Implemented the idempotent Stripe customer-balance credit operation. Its live dry run found 7 eligible
  active billing entities, no prior incident credits, and $82.00 pending.
- Implemented four state-aware customer email variants, recipient segmentation/deduplication, a
  dry-run-first sender with Stripe-credit verification, and the resolved dashboard product update.
- The recipient dry run found 8 deduplicated recipients: 1 reporting customer, 2 other affected paid,
  4 paid goodwill, and 1 affected non-billed. The non-billed account is correctly excluded from credit
  language. No email was sent.
- Validated the operator-exported decision file: 69 entries with 6 `fill_missing`, 8
  `customer_confirmation`, and 55 `leave_unchanged` decisions.
- The repair dry run confirmed all 6 selected entries remain eligible across 5 requests, covering 5
  missing phone fields and 6 missing URL fields with no stale rows. No production data changed.
- Committed the incident release as `3adfc8c485c8a4a723fe0ee5355bc621d947d2f5`, fast-forward pushed
  it to `origin/main`, and verified local `HEAD == origin/main`.
- Vercel production deployment `dpl_4vTrb4Ay7X7BMpXVa9aYAbhsXS6h` reached `READY` for that exact SHA
  and attached the `utilitysheet.com` and `www.utilitysheet.com` aliases.

## Validation

- Startup audit completed: applicable `AGENTS.md`, prior `.ai/CURRENT.md`, worktree status/diff, and
  AI telemetry documentation inspected.
- Vercel runtime-error aggregate from July 24 onward showed no seller/provider 5xx errors, matching the
  caught/null failure path.
- Read-only redacted production telemetry and contact-resolution aggregates inspected.
- Controlled API reproduction completed with installed `@google/genai` 1.43.0:
  - 3.1 + JSON + Search: valid JSON and output tokens.
  - 3.5 + JSON + Search without schema: no candidate/text/output tokens.
  - 3.5 + JSON without Search: valid JSON.
  - 3.5 + JSON + Search + explicit response schema: valid JSON.
- Production rollback smoke test completed after deployment
  `dpl_KSAA98Bx7UTknexGoN175iAP3MQj` reached `READY`:
  - `/api/demo/suggestions` returned HTTP 200 in 10.2 seconds.
  - All nine configured utility categories returned non-empty results.
  - Fresh AI telemetry recorded the restored `gemini-3.1-flash-lite` model.
- Provider hotfix focused suite: 6 files / 44 tests passed.
- Combined incident suite: 9 files / 54 tests passed.
- Full Vitest suite: 134 files / 668 tests passed.
- `npm exec tsc -- --noEmit` passed.
- Focused ESLint passed for all changed implementation and test files.
- `npm run build` passed.
- `npm run security:scan` passed.
- `git diff --check` passed with existing line-ending warnings only.
- Read-only Stripe dry run: 7 eligible, 0 already applied, 7 pending, $82.00 total.
- Read-only communication dry run: 8 deduplicated recipients; no email sent.
- Private read-only report:
  `.incident-reports/provider-resolution-2026-07-2026-07-29T17-19-29-553Z.html`.
  Two fresh AI responses were parse-rejected and therefore remained outside the automatic repair set.
- Reviewed repair dry run: 6 selected/eligible, 0 stale, 5 phone fields, 6 URL fields, 5 requests; no
  production data changed.
- Production hotfix smoke test: `/api/demo/suggestions` returned HTTP 200 in 10.9 seconds and all 9
  categories returned non-empty results.
- Vercel reported no `/api/demo/suggestions` runtime errors in the post-release window.
- The dashboard product-update source was included in the exact deployed SHA; its focused test passed.
  `/api/updates` intentionally exposes database updates only and is not the verification path for the
  client-merged featured update.

## Remaining Required Work

- Apply the 6 reviewed repairs only after explicit production-data authorization and confirmation of an
  Admin account. The dry run is current and all 6 rows were eligible.
- Apply the seven Stripe credits only after explicit financial authorization using the verified
  expected count of 7 and total of 8200 cents.
- Send customer communications only after the hotfix deployment, repair-review decision, and credit
  application are verified, `PROVIDER_INCIDENT_EXCLUDED_EMAILS` is configured/reviewed, and customer
  delivery is explicitly authorized.

## Concurrent Editing Warnings

- Do not overwrite the pre-existing coordination-file changes listed above.
- Avoid concurrent edits to the incident AI/provider, scripts, email template, and product-update files.
- Do not commit the untracked customer email or the ignored `.incident-reports/` artifacts.

## Recommended Next Action

Obtain explicit authorization for the 6 production contact repairs. After repair verification, obtain
separate authorization for the seven Stripe credits and then for the eight customer emails.
